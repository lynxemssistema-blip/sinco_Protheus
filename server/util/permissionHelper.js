const mysqlPool = require('../services/mysqlService');

// Confere no backend se o usuário pode ver valores financeiros (custos, preços).
// Espelha a regra do front (AuthContext.hasPermission), mas aqui é a fonte de verdade —
// nunca confiar só na UI para esconder dado sensível: o campo simplesmente não deve
// sair do servidor se o usuário não tiver a permissão "valores_financeiros".
// Diferente das demais permissões, "valores_financeiros" NUNCA é liberada automaticamente
// por TipoUsuario 'A'/'SA' — precisa ser aprovada explicitamente em Configurações/Permissões,
// mesmo para administradores.
async function hasFinancialAccess(req) {
    const user = req.user;
    if (!user) return false;

    try {
        const [rows] = await mysqlPool.query(
            'SELECT can_view FROM app_user_permissions WHERE user_id = ? AND page_id = ?',
            [user.id, 'valores_financeiros']
        );
        return rows.length > 0 && !!rows[0].can_view;
    } catch (err) {
        console.error('[permissionHelper] Erro ao checar valores_financeiros:', err.message);
        return false;
    }
}

module.exports = { hasFinancialAccess };
