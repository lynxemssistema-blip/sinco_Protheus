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
            let rows = [];
            try {
                [rows] = await mysqlPool.query(
                    `SELECT can_view, can_create, can_edit, can_delete
                     FROM app_user_permissions
                     WHERE user_id = ? AND page_id = ?`,
                    [userId, pageId]
                );
            } catch (dbError) {
                // MySQL indisponível ou tabela inexistente → permite por padrão
                console.warn(`⚠️ [RBAC] Falha ao consultar permissões (${pageId}/${requiredAction}): ${dbError.message} — permitindo por padrão`);
                return next();
            }

            // Sem linha cadastrada = política "default allow"
            // Só bloqueia se houver entrada explícita com can_X = 0/false
            if (rows.length === 0) {
                return next();
            }

            const perm = rows[0];
            const key = `can_${requiredAction}`;

            if (perm[key] === 0 || perm[key] === false) {
                return res.status(403).json({
                    error: `Acesso negado: você não possui permissão para realizar esta ação (${requiredAction}) neste módulo.`
                });
            }

            next();

        } catch (error) {
            console.error(`Erro no middleware RBAC para modulo ${pageId}:`, error);
            // Erro inesperado → permite para não bloquear o sistema
            next();
        }
    };
};

module.exports = { requirePermission };
