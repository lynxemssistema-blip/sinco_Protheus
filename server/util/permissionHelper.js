const mysqlPool = require('../services/mysqlService');
const { isSuperAdminUser } = require('./authHelper');

// Confere no backend se o usuário pode ver valores financeiros (custos, preços, fluxo de caixa).
// O usuário SuperAdmin (SA) tem acesso total a tudo no sistema.
async function hasFinancialAccess(req) {
    const user = req.user;
    if (!user) return false;

    // SuperAdmin tem acesso irrestrito a todos os dados financeiros
    if (isSuperAdminUser(user) || req.isSuperAdmin) {
        return true;
    }

    // Masters e Administradores da empresa têm acesso aos dados financeiros da sua empresa
    const role = (user.tipo || user.TipoUsuario || '').toUpperCase().trim();
    if (user.is_master === 1 || user.is_master === true || req.isMaster || role === 'ADMIN' || role === 'MASTER' || role === 'FINANCEIRO') {
        return true;
    }

    const userId = user.id || user.idUsuario;
    if (!userId) return false;

    try {
        // Checa permissões granulares por página/módulo
        const [rows] = await mysqlPool.query(
            `SELECT can_view FROM app_user_permissions 
             WHERE user_id = ? AND page_id IN ('valores_financeiros', 'financeiro', 'fluxo_caixa', 'dashboard_financeiro') 
               AND can_view = 1`,
            [userId]
        );
        if (rows.length > 0) return true;

        // Checa flag legado na tabela usuario
        const [uRows] = await mysqlPool.query(
            'SELECT Financeiro FROM usuario WHERE idUsuario = ?',
            [userId]
        );
        if (uRows.length > 0) {
            const f = String(uRows[0].Financeiro || '').toUpperCase().trim();
            if (f === '1' || f === 'S' || f === 'TRUE') return true;
        }

        return false;
    } catch (err) {
        console.error('[permissionHelper] Erro ao checar valores_financeiros:', err.message);
        return false;
    }
}

module.exports = { hasFinancialAccess };
