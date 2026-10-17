/**
 * Contexto de Tenant e Isolamento Multi-Tenant via AsyncLocalStorage
 * Permite que qualquer camada do backend (controllers, services, database adapters)
 * acesse o IdEmpresa da requisição ativa de forma transparente e segura.
 */

const { AsyncLocalStorage } = require('async_hooks');

const tenantStorage = new AsyncLocalStorage();

/**
 * Retorna o ID do Tenant ativo na requisição corrente.
 * Retorna null se não houver contexto (ex: cron jobs ou superadmin global).
 */
function getTenantId() {
    const store = tenantStorage.getStore();
    return store ? store.tenantId : null;
}

/**
 * Retorna o contexto completo do Tenant na requisição.
 */
function getTenantContext() {
    return tenantStorage.getStore() || null;
}

module.exports = {
    tenantStorage,
    getTenantId,
    getTenantContext
};
