const mysqlPool = require('../services/mysqlService');
const { isSuperAdminUser } = require('../util/authHelper');

/**
 * Middleware para validar permissões de acesso baseadas em RBAC
 * @param {string} pageId - ID da página (ex: 'users', 'pcp', 'faturamento')
 * @param {string} action - Ação solicitada: 'view', 'create', 'edit', 'delete'
 */
const requirePermission = (pageId, action = 'view') => {
    return async (req, res, next) => {
        try {
            const user = req.user; // Obtido pelo middleware authenticateToken
            if (!user) {
                return res.status(401).json({ error: 'Usuário não autenticado' });
            }

            const tipo = (user.tipo || '').trim();

            // Regra Máxima: SuperAdmin, Admin (A) e Master da Empresa têm acesso total irrestrito
            if (isSuperAdminUser(user) || req.isSuperAdmin || user.is_master === 1 || user.is_master === true || tipo === 'A' || tipo === 'SA' || tipo === 'SUPERADMIN') {
                return next();
            }

            // Consultar configurações da empresa para Perfis Customizados isAdmin
            const [companyRows] = await mysqlPool.query('SELECT general_config FROM app_company_settings LIMIT 1');
            if (companyRows.length > 0) {
                try {
                    let gc = companyRows[0].general_config;
                    if (typeof gc === 'string') gc = JSON.parse(gc);
                    if (gc && gc.custom_profiles) {
                        const profile = gc.custom_profiles.find(p => p.code === tipo);
                        if (profile && profile.isAdmin) {
                            return next();
                        }
                    }
                } catch (e) {
                    console.warn('[RBAC] Erro ao parsear general_config', e);
                }
            }

            // Consultar permissão explícita na tabela app_user_permissions
            const [permRows] = await mysqlPool.query(
                'SELECT can_view, can_create, can_edit, can_delete FROM app_user_permissions WHERE user_id = ? AND page_id = ?',
                [user.id, pageId]
            );

            if (permRows.length === 0) {
                return res.status(403).json({ error: `Acesso negado: Nenhuma permissão configurada para a página '${pageId}'.` });
            }

            const perm = permRows[0];
            const hasAccess = !!perm[`can_${action}`];

            if (!hasAccess) {
                return res.status(403).json({ 
                    error: `Acesso negado: Você não possui privilégios de '${action}' para a página '${pageId}'.` 
                });
            }

            // Acesso liberado
            next();
        } catch (error) {
            console.error('[RBAC] Erro no middleware de autorização:', error);
            res.status(500).json({ error: 'Erro interno ao validar permissões.' });
        }
    };
};

module.exports = { requirePermission };
