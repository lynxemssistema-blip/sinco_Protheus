/**
 * Helper Centralizado de Identificação e Superpoderes do SuperAdmin
 * 
 * Regra Máxima do Sistema:
 * O usuário SuperAdmin (SA) tem acesso total e irrestrito a TUDO no aplicativo:
 * - Visão cross-empresa (todas as empresas ou impersonadas)
 * - Bypass absoluto de qualquer checagem RBAC ou de permissões de tela/ação
 * - Gestão de módulos, empresas, usuários, setores e recursos
 * - Acesso a relatórios e valores financeiros sem qualquer restrição
 */

const SUPERADMIN_EMAILS = [
    'edsonmanoel2012@gmail.com'
];

const SUPERADMIN_LOGINS = [
    'sinco',
    'superadmin'
];

/**
 * Verifica se um objeto de usuário (do JWT ou do banco) pertence ao SuperAdmin Global da Plataforma
 * @param {Object} user 
 * @returns {boolean}
 */
function isSuperAdminUser(user) {
    if (!user) return false;

    // Se já foi validado anteriormente na request
    if (user.isSuperAdmin === true || user.is_superadmin === true || user.is_superadmin === 1) {
        return true;
    }

    const email = (user.email || '').toLowerCase().trim();
    const login = (user.login || user.Login || '').toLowerCase().trim();
    const id = user.id || user.idUsuario;

    if (SUPERADMIN_EMAILS.includes(email)) return true;
    if (id === 37) return true;
    if (SUPERADMIN_LOGINS.includes(login) && id === 37) return true;

    return false;
}

/**
 * Extrai o Tenant ID da requisição respeitando os superpoderes do SuperAdmin.
 * - Para SuperAdmin: se não houver override de empresa (header 'x-tenant-override' ou query 'tenant_id'/'empresa_id'),
 *   retorna null (Visão Global irrestrita).
 * - Para usuários regulares: retorna a empresa do usuário (req.user.IdEmpresa || 1).
 * 
 * @param {Object} req - Objeto de requisição do Express
 * @returns {number|null} ID da empresa ou null para visão global do SuperAdmin
 */
function getTenantContext(req) {
    const override = req.headers['x-tenant-override'] || req.query.tenant_id || req.query.empresa_id;
    const isSA = isSuperAdminUser(req.user) || req.isSuperAdmin;

    // Apenas se explicitamente solicitado modo global (visão unificada SuperAdmin de todas as empresas)
    if (isSA && (override === 'all' || req.query.empresa_id === 'all' || req.headers['x-tenant-all'] === 'true')) {
        return null;
    }

    // Se houver override numérico válido (impersonação)
    if (override && !isNaN(parseInt(override)) && parseInt(override) > 0) {
        return parseInt(override);
    }

    // Se já injetado pelo tenantMiddleware
    if (req.tenantId && !isNaN(parseInt(req.tenantId)) && parseInt(req.tenantId) > 0) {
        return parseInt(req.tenantId);
    }

    // Default isolado: empresa do usuário logado ou empresa 1 (Metalfisa matriz)
    return req.user?.IdEmpresa || 1;
}

module.exports = {
    SUPERADMIN_EMAILS,
    SUPERADMIN_LOGINS,
    isSuperAdminUser,
    getTenantContext
};
