const mysqlPool = require('../services/mysqlService');

/**
 * Middleware para validar permissões de acesso (RBAC).
 * 
 * @param {string} pageId - ID do módulo/página (ex: 'ROMANEIO', 'ENG_ORDERS')
 * @param {string} requiredAction - Ação requerida: 'view', 'create', 'edit', 'delete'
 */
const requirePermission = (pageId, requiredAction = 'view') => {
    return async (req, res, next) => {
        try {
            const user = req.user;
            
            // Requer que o usuário já tenha passado pelo authenticateToken
            if (!user) {
                return res.status(401).json({ error: 'Usuário não autenticado no middleware RBAC' });
            }

            // Administradores (Tipo 'A') têm acesso total, ignoram checagem de banco
            if (user.tipo === 'A' || user.TipoUsuario === 'A') {
                return next();
            }

            const userId = user.id || user.idUsuario;

            if (!userId) {
                return res.status(401).json({ error: 'User ID não pôde ser identificado' });
            }

            // Verifica as permissões do usuário comum no DB
            const [rows] = await mysqlPool.query(
                `SELECT can_view, can_create, can_edit, can_delete 
                 FROM app_user_permissions 
                 WHERE user_id = ? AND page_id = ?`,
                [userId, pageId]
            );

            // Se não encontrou permissão cadastrada, nega o acesso
            if (rows.length === 0) {
                return res.status(403).json({ error: 'Acesso negado: Você não possui permissão mínima para este módulo.' });
            }

            const perm = rows[0];

            // Verifica a ação específica
            const key = `can_${requiredAction}`; // ex: 'can_edit'
            if (!perm[key]) {
                 return res.status(403).json({ 
                    error: `Acesso negado: Você não possui permissão para realizar esta ação (${requiredAction}) neste módulo.` 
                 });
            }

            // Validação bem-sucedida
            next();

        } catch (error) {
            console.error(`Erro no middleware RBAC para modulo ${pageId}:`, error);
            res.status(500).json({ error: 'Erro interno ao validar permissões de acesso.' });
        }
    };
};

module.exports = { requirePermission };
