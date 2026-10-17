import axios from 'axios';
import { downloadBlob } from '../utils/downloadHelper';

export const getBaseUrl = () => {
    // Both in dev (via Vite proxy) and prod (via Node.js static serving),
    // the API is accessible at the same origin + '/api'.
    // Sockets will also be accessible at the same origin.
    // This entirely eliminates the CORS "network error" because the browser
    // never performs a cross-origin request.
    return '';
};

const api = axios.create({
    baseURL: `${getBaseUrl()}/api`,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: 150000
});

// Interceptor to attach JWT token and tenant override to every request
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('@Lynx:token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        const tenantOverride = localStorage.getItem('@Lynx:tenant_override');
        if (tenantOverride && tenantOverride !== 'null' && tenantOverride !== 'undefined') {
            config.headers['x-tenant-override'] = tenantOverride;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Interceptor para tratamento de respostas e erros
api.interceptors.response.use(
    (response) => {
        const contentType = response.headers?.['content-type'] || '';
        const url = response.config?.url || '';
        if (
            typeof response.data === 'string' &&
            (contentType.includes('text/html') || response.data.trim().startsWith('<!doctype html>') || response.data.trim().startsWith('<!DOCTYPE html>') || response.data.trim().startsWith('<html')) &&
            !url.includes('/docs/view')
        ) {
            console.error(`❌ [API Interceptor] A rota "${url}" retornou HTML em vez de JSON. O backend Node.js pode não estar ativo ou a rota /api não está configurada no servidor.`);
            const err = new Error(`A rota da API "${url}" retornou HTML em vez de JSON.`);
            err.response = response;
            err.isHtmlResponse = true;
            return Promise.reject(err);
        }
        return response;
    },
    (error) => {
        const status = error.response?.status;
        const data   = error.response?.data;

        // Determina se é falha de autenticação (sessão expirada / token inválido):
        //   • 401 → sempre é falha de auth
        //   • 403 → é proibição/autorização (RBAC), a menos que explicitamente retorne code TOKEN_EXPIRED ou TOKEN_INVALID
        const isRbacDenial = status === 403 &&
            data?.code !== 'TOKEN_EXPIRED' && data?.code !== 'TOKEN_INVALID';

        const isAuthFailure = status === 401 || (status === 403 && !isRbacDenial);

        if (isAuthFailure) {
            const currentPath = window.location.pathname;
            
            console.warn('🔒 Session expired or invalid. Clearing session...');
            localStorage.removeItem('@Lynx:token');
            localStorage.removeItem('@Lynx:user');

            // Do not redirect if already on login or landing page
            if (currentPath !== '/login' && currentPath !== '/') {
                window.location.href = '/login';
            }
            
            // Suppress further error logging for auth failures — they are expected
            // when the session expires and in-flight/debounced requests fire without a token.
            return Promise.reject(error);
        }

        // Don't log canceled requests (AbortController / React StrictMode)
        if (error.code === 'ERR_CANCELED') return Promise.reject(error);

        // 409 Conflict = duplicate resource (login/e-mail já cadastrado) — handled at component level
        if (status === 409) return Promise.reject(error);

        // Suprimir log de 404 esperado para a rota /sinco/produto/ (produto novo)
        const url = error.config?.url || '';
        if (status === 404 && url.includes('/sinco/produto/')) {
            return Promise.reject(error);
        }

        console.error(`❌ Erro na API [${status || 'NET'}] ${error.config?.method?.toUpperCase() || '?'} ${error.config?.url} — ${error.message}`, data);
        return Promise.reject(error);
    }
);

export const getPedidos = async (params, config = {}) => {
    const response = await api.get('/pedidos', { params, ...config });
    return response.data;
};

export const getKpiFaturar = async (config = {}) => {
    const response = await api.get('/pedidos/kpi-faturar', config);
    return response.data;
};

export const getPedidosFlat = async (params, config = {}) => {
    const response = await api.get('/pedidos/flat', { params, ...config });
    return response.data;
};

export const getVisaoGerencialAtrasos = async (params, config = {}) => {
    const response = await api.get('/pedidos/visao-gerencial-atrasos', { params, ...config });
    return response.data;
};

export const getVisaoGerencialFabrica = async (params, config = {}) => {
    const response = await api.get('/pedidos/visao-gerencial-fabrica', { params, ...config });
    return response.data;
};

export const updateSincoProductStructure = async (payload) => {
    return api.post('/protheus/estrutura-produtos/editar', payload).then(res => res.data);
};

export const updateSincoProduto = async (payload) => {
    return api.post('/protheus/produtos/update', payload).then(res => res.data);
};

export const updateSincoProdutoCliente = async (payload) => {
    return api.post('/protheus/produto-cliente/editar', payload).then(res => res.data);
};

export const getSincoProdutoCliente = async (codigo) => {
    return api.get(`/protheus/produto-cliente/${encodeURIComponent(codigo)}`).then(res => res.data);
};

export const updateSincoRoteiro = async (payload) => {
    const response = await api.post('/protheus/roteiro-produtivo/editar', payload);
    return response.data;
};

export const searchSincoProdutos = async (query) => {
    const response = await api.get('/sinco/produtos/busca', { params: { q: query } });
    return response.data;
};

export const saveSnapshotFabrica = async (data) => {
    const response = await api.post('/pedidos/snapshot-fabrica', data);
    return response.data;
};

export const getItensPedido = async (pedidoId) => {
    // Guard: never call with empty/undefined pedido — would hit /pedidos//itens
    if (!pedidoId || String(pedidoId).trim() === '') {
        console.warn('[getItensPedido] pedidoId inválido — chamada cancelada:', pedidoId);
        return [];
    }
    const response = await api.get(`/pedidos/${encodeURIComponent(String(pedidoId).trim())}/itens`);
    return response.data;
};

// Lean endpoint for PDF generation — only PG core data + MySQL notes (2 queries total)
export const getPedidoPdfData = async (pedidoId) => {
    if (!pedidoId || String(pedidoId).trim() === '') {
        console.warn('[getPedidoPdfData] pedidoId inválido:', pedidoId);
        return null;
    }
    const response = await api.get(`/pedidos/${encodeURIComponent(String(pedidoId).trim())}/pdf-data`);
    return response.data;
};

// Fetches lightweight status classification (Restrição/Revisão/Novo/PCP) for each item of an order.
// Uses the dedicated /item-status endpoint (Option B) — does NOT trigger the heavy /:id/itens enrichment.
export const getItemStatus = async (pedidoId) => {
    if (!pedidoId || String(pedidoId).trim() === '') {
        console.warn('[getItemStatus] pedidoId inválido — chamada cancelada:', pedidoId);
        return { items: [] };
    }
    const response = await api.get(`/pedidos/${encodeURIComponent(String(pedidoId).trim())}/item-status`);
    return response.data;
};

export const getProdutos = async (params) => {
    const response = await api.get('/produtos', { params });
    return response.data;
};

export const getMSMetalProdutos = async (params) => {
    const response = await api.get('/msmetal/produtos', { params });
    return response.data;
};

export const getMSMetalEstrutura = async (idOuCodigo) => {
    const response = await api.get(`/msmetal/produtos/${encodeURIComponent(idOuCodigo)}/estrutura`);
    return response.data;
};

export const getEstruturaProduto = async (codigo) => {
    const encodedCod = encodeURIComponent(codigo);
    const response = await api.get(`/production/estrutura/${encodedCod}`);
    return response.data;
};

export const getStockBalancesBatch = async (codigos) => {
    const response = await api.post('/stock/balances-batch', { codigos });
    return response.data;
};

export const getProductDocuments = async (codigo, altCodigo = null) => {
    const encodedCod = encodeURIComponent(codigo);
    const altParam = altCodigo ? `?alt=${encodeURIComponent(altCodigo)}` : '';
    const response = await api.get(`/docs/${encodedCod}${altParam}`);
    return response.data;
};

export const extractProductAIInfo = async (codigo, options = {}) => {
    const encodedCod = encodeURIComponent(codigo);
    const params = new URLSearchParams();
    if (options.preview) params.append('preview', 'true');
    const response = await api.post(`/produtos/${encodedCod}/extract-ai-batch?${params.toString()}`);
    return response.data;
};

export const bulkSaveAIMetadata = async (items) => {
    const response = await api.post('/produtos/bulk-save-ai-metadata', { items });
    return response.data;
};

export const getProductionOrders = async (params) => {
    const response = await api.get('/producao/ordens', { params });
    return response.data;
};

export const getProductionOrdersByOp = async (op, item, sequencia, client, product) => {
    const response = await api.get('/producao/op', { params: { op, item, sequencia, client, product } });
    return response.data;
};

export const searchProductionOps = async (params) => {
    const response = await api.get('/producao/search-ops', { params });
    return response.data;
};

export const getProductionStructureRouting = async (op) => {
    const response = await api.get('/producao/estrutura-routing', { params: { op } });
    return response.data;
};

export const checkOpItemAvailability = async (op, item) => {
    const response = await api.get('/romaneios/check-op-item', { params: { op, item } });
    return response.data;
};

export const getRomaneios = async (params) => {
    const response = await api.get('/romaneios', { params });
    return response.data;
};

export const getRomaneioTypes = async () => {
    const response = await api.get('/romaneios/types');
    return response.data;
};

export const createRomaneio = async (data) => {
    const response = await api.post('/romaneios', data);
    return response.data;
};

export const createRomaneioFolder = async (id) => {
    const response = await api.post(`/romaneios/${id}/create-folder`);
    return response.data;
};

export const getRomaneioBaseDirConfig = async () => {
    const response = await api.get('/romaneios/config/base-dir');
    return response.data;
};

export const downloadRomaneioBundle = async (id) => {
    const response = await api.get(`/romaneios/${id}/generate-bundle`, { responseType: 'blob' });
    return response.data;
};

export const downloadRelatorioTratamentoExcel = async (months = 5, includeFinancials = false) => {
    const response = await api.get('/romaneios/relatorio-tratamento-excel', {
        params: { months, includeFinancials },
        responseType: 'blob'
    });
    const fileName = `Relatorio_Envio_Fornecedores_Tratamento_${months ? `${months}Meses` : 'Completo'}_${includeFinancials ? 'ComValores' : 'SemValores'}_KG.xlsx`;
    downloadBlob(new Blob([response.data]), fileName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
};

export const getProductDocs = async (codigo) => {
    const response = await api.get(`/docs/${encodeURIComponent(codigo)}`);
    return response.data;
};

export const updateRomaneio = async (id, data) => {
    const response = await api.put(`/romaneios/${id}`, data);
    return response.data;
};

export const getRomaneioById = async (id) => {
    const response = await api.get(`/romaneios/${id}`);
    return response.data;
};

export const addRomaneioItem = async (id, itemData) => {
    const response = await api.post(`/romaneios/${id}/items`, itemData);
    return response.data;
};

export const updateRomaneioStatus = async (id, status, data_alteracao, usuario) => {
    const response = await api.put(`/romaneios/${id}/status`, { status, data_alteracao, usuario });
    return response.data;
};

export const deleteRomaneio = async (id) => {
    const response = await api.delete(`/romaneios/${id}`);
    return response.data;
};

export const updateRomaneioItem = async (romaneioId, itemId, data) => {
    const response = await api.put(`/romaneios/${romaneioId}/items/${itemId}`, data);
    return response.data;
};

export const deleteRomaneioItem = async (romaneioId, itemId) => {
    const response = await api.delete(`/romaneios/${romaneioId}/items/${itemId}`);
    return response.data;
};

export const getRomaneioItemOperations = async (itemId) => {
    const response = await api.get(`/romaneios/items/${itemId}/operations`);
    return response.data;
};

export const createRevision = async (id, reason) => {
    const response = await api.post(`/romaneios/${id}/revisions`, { reason });
    return response.data;
};

export const getRevisions = async (id) => {
    const response = await api.get(`/romaneios/${id}/revisions`);
    return response.data;
};

export const getRevisionDetails = async (id, revId) => {
    const response = await api.get(`/romaneios/${id}/revisions/${revId}`);
    return response.data;
};

export const searchRomaneioItems = async (query) => {
    const response = await api.get('/romaneios/items/search', { params: { q: query } });
    return response.data;
};

export const uploadRomaneioPhoto = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/romaneios/upload-photo', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data;
};

// ROMANEIOS - NFs VINCULADAS
export const getRomaneioNfsFromProtheus = async (params) => {
    const response = await api.get('/romaneios/protheus/nfs', { params });
    return response.data;
};

export const getRomaneioNfItemsFromProtheus = async (params) => {
    const response = await api.get('/romaneios/protheus/nf-items', { params });
    return response.data;
};

export const getRomaneioLinkedNfs = async (id) => {
    const response = await api.get(`/romaneios/${id}/notas-fiscais`);
    return response.data;
};

export const linkRomaneioNf = async (id, data) => {
    const response = await api.post(`/romaneios/${id}/notas-fiscais`, data);
    return response.data;
};

export const unlinkRomaneioNf = async (id, nfId) => {
    const response = await api.delete(`/romaneios/${id}/notas-fiscais/${nfId}`);
    return response.data;
};


// Stock API
export const getStockBalance = async (codigo) => {
    const encodedCod = encodeURIComponent(codigo);
    const response = await api.get(`/stock/${encodedCod}/saldo`);
    return response.data;
};

export const getStockMovements = async (codigo) => {
    const encodedCod = encodeURIComponent(codigo);
    const response = await api.get(`/stock/${encodedCod}/movimentos`);
    return response.data;
};

export const addStockMovement = async (data) => {
    const response = await api.post('/stock', data);
    return response.data;
};

export const getStockCandidateOps = async (codigo) => {
    const encodedCod = encodeURIComponent(codigo);
    const response = await api.get(`/stock/${encodedCod}/ops-candidatas`);
    return response.data;
};

export const empenharStockToOp = async (data) => {
    const response = await api.post('/stock/empenhar-op', data);
    return response.data;
};

export const getStockEmpenhos = async (codigo) => {
    const encodedCod = encodeURIComponent(codigo);
    const response = await api.get(`/stock/${encodedCod}/empenhos`);
    return response.data;
};

export const getProductStructureStock = async (codigo) => {
    const encodedCod = encodeURIComponent(codigo);
    const response = await api.get(`/stock/estrutura-saldo/${encodedCod}`);
    return response.data;
};

// CLIENTS
export const getClientes = async (query) => {
    const response = await api.get('/clients/search', { params: { q: query } });
    return response.data;
};

// USERS
export const getUsers = (params) => api.get('/users', { params }).then(res => res.data);
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const bulkUpdateUserProfile = (userIds, tipo, copyPermissions = true) => api.put('/users/bulk-profile', { userIds, tipo, copyPermissions }).then(res => res.data);
export const deleteUser = (id) => api.delete(`/users/${id}`).then(res => res.data);
export const getUserPreference = (key) => api.get(`/users/preferences/${encodeURIComponent(key)}`).then(res => res.data?.value);
export const saveUserPreference = (key, value) => api.put(`/users/preferences/${encodeURIComponent(key)}`, { value }).then(res => res.data);
export const getMyPermissions = () => api.get('/users/my-permissions').then(res => res.data);
export const getUserPermissions = (userId) => api.get(`/users/permissions/${userId}`).then(res => res.data);
export const saveUserPermissions = (userId, permissions) => api.put(`/users/permissions/${userId}`, { permissions }).then(res => res.data);
export const sendUserCredentials = (userIds, method = 'email', passwordDisplay = '') => api.post('/users/send-credentials', { userIds, method, passwordDisplay }).then(res => res.data);
export const changePassword = (newPassword, confirmPassword) => api.put('/users/change-password', { newPassword, confirmPassword }).then(res => res.data);

// PRODUCT EXTRAS
// PRODUCT EXTRAS
export const saveProductImage = (codigo, url) => api.post(`/produtos/${encodeURIComponent(codigo)}/imagem`, { url }).then(res => res.data);
export const getProductAssociations = (codigo) => api.get(`/produtos/${encodeURIComponent(codigo)}/associacoes`).then(res => res.data);
export const createProductAssociation = (codigo, data) => api.post(`/produtos/${encodeURIComponent(codigo)}/associacoes`, data).then(res => res.data);
export const deleteProductAssociation = (codigo, id) => api.delete(`/produtos/${encodeURIComponent(codigo)}/associacoes/${id}`).then(res => res.data);
export const getProductRoute = (codigo) => api.get(`/produtos/${encodeURIComponent(codigo)}/roteiro`).then(res => res.data);
export const setEstruturaCustoOverride = (codigoPai, componente, preco, usuario) =>
    api.post(`/production/estrutura/${encodeURIComponent(codigoPai)}/${encodeURIComponent(componente)}/preco`, { preco, usuario }).then(res => res.data);
export const removeEstruturaCustoOverride = (codigoPai, componente) =>
    api.delete(`/production/estrutura/${encodeURIComponent(codigoPai)}/${encodeURIComponent(componente)}/preco`).then(res => res.data);
export const importProductWeights = (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/produtos/import-weights', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data);
};

// COMPANY
export const getCompanySettings = () => api.get('/company').then(res => {
    const data = res.data;
    if (data) {
        if (typeof data.general_config === 'string') {
            try {
                data.general_config = JSON.parse(data.general_config);
            } catch (e) {
                console.error('Failed to parse general_config', e);
            }
        }
        if (typeof data.menu_config === 'string') {
            try {
                data.menu_config = JSON.parse(data.menu_config);
            } catch (e) {
                console.error('Failed to parse menu_config', e);
            }
        }
        // Keep report branding (logo, company name, CNPJ, address) in sync
        import('./companyBranding').then(m => m.applyCompanyBranding(data)).catch(() => {});
    }
    return data;
});
export const updateCompanySettings = (data) => api.put('/company', data).then(res => res.data);
export const lookupCnpjBrasilApi = (cnpj) => api.get(`/company/cnpj/${String(cnpj || '').replace(/\D/g, '')}`).then(res => res.data);
export const updateMenuSettings = (data) => api.put('/company/menu', data).then(res => res.data);
export const updateGeneralSettings = (data) => api.put('/company/general', data).then(res => res.data);
export const getRomaneioInitialNumber = () => api.get('/company/romaneio-number').then(res => res.data);
export const setRomaneioInitialNumber = (numero) => api.post('/company/set-romaneio-number', { numero_inicial: numero }).then(res => res.data);
export const getPedidosStatusSettings = () => api.get('/pedidos-status/settings').then(res => res.data);
export const togglePedidosStatusGlobal = (hide) => api.post('/pedidos-status/settings', { hideInactive: hide }).then(res => res.data);
export const getPedidosStatusList = (q) => api.get('/pedidos-status/list', { params: { q } }).then(res => res.data);
export const togglePedidoStatus = (pedido, ativo) => api.post('/pedidos-status/toggle', { pedido, ativo }).then(res => res.data);

// PRODUCTION CONTROL
export const getProductionDashboard = (params, signal) => api.get('/production', { params, signal }).then(res => res.data);
export const getProductionMatrix = (params) => api.get('/production/matrix', { params }).then(res => res.data);
export const getOperationById = (opId) => api.get(`/production/operations/${opId}`).then(res => res.data);
export const saveProductionPlan = (data) => api.post('/production/plan', data).then(res => res.data);
export const saveProductionPlanBatch = (plans, observacao, modo_calculo, preferencias, dataPcpOpts = {}) =>
    api.post('/production/plan-batch', { plans, observacao, modo_calculo, preferencias, ...dataPcpOpts }).then(res => res.data);

export const previewCascade = (payload) =>
    api.post('/production/cascade-preview', payload).then(res => res.data);
export const getResourceCapacities = () => api.get('/production/capacities').then(res => res.data);
export const getPlanningHistory = (op) => api.get(`/production/planning-history/${encodeURIComponent(op)}`).then(res => res.data);
export const getPlanningPrefs = (op) => api.get(`/production/planning-prefs/${encodeURIComponent(op)}`).then(res => res.data);
export const savePlanningPrefs = (op, prefs) => api.put(`/production/planning-prefs/${encodeURIComponent(op)}`, prefs).then(res => res.data);
export const getRecursosOrdem = () => api.get('/pcp-refinado/recursos').then(res => res.data);
export const getEstruturaPedido = (params) => api.get('/pcp-refinado/estrutura-pedido', { params }).then(res => res.data);

export const createPendenciasSnapshot = (data) => api.post('/pcp-refinado/pendencias-snapshot', data).then(res => res.data);
export const getPendenciasSnapshots = (op) => api.get('/pcp-refinado/pendencias-snapshot', { params: { op } }).then(res => res.data);
export const getPendenciasSnapshotById = (id) => api.get(`/pcp-refinado/pendencias-snapshot/${id}`).then(res => res.data);

export const getPlanningAudit = (params) => api.get('/production/planning-audit', { params }).then(res => res.data);
export const saveAppointment = (data) => api.post('/production/appoint', data).then(res => res.data);
export const getAppointmentHistory = (op, item, sequencia, operacao) => api.get(`/production/appointments/${op}`, { params: { item, sequencia, operacao } }).then(res => res.data);
export const submitConferencia = ({ id, status, observacao, conferido_por, fotos = [] }) => {
    const form = new FormData();
    form.append('id', id);
    form.append('status', status);
    form.append('conferido_por', conferido_por);
    if (observacao) form.append('observacao', observacao);
    fotos.forEach(f => form.append('fotos', f));
    return api.post('/production/conferencia', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(res => res.data);
};
export const getPendentesConferencia = (params) => api.get('/production/pendentes', { params }).then(res => res.data);
export const getConferenciaHistorico = (id) => api.get(`/production/conferencia/${id}/historico`).then(res => res.data);
export const submitConferenciaBulk = ({ ids, status, observacao, conferido_por, fotos = [] }) => {
    const form = new FormData();
    form.append('ids', JSON.stringify(ids));
    form.append('status', status);
    form.append('observacao', observacao || '');
    form.append('conferido_por', conferido_por);
    fotos.forEach(f => form.append('fotos', f));
    return api.post('/production/conferencia/bulk', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(res => res.data);
};
export const getProductionAnalytics = (params) => api.get('/production/analytics', { params }).then(res => res.data);
export const getProcessList = () => api.get('/production/processes').then(res => res.data);
export const getPedidosEvolution = (params) => api.get('/production/pedidos-evolution', { params }).then(res => ({ ...res.data, pedidos: res.data.agrupado || [] }));
export const getTrackingEvolution = (params) => api.get('/production/tracking-evolution', { params }).then(res => res.data);
export const getTrackingHistory = (params) => api.get('/production/tracking-history', { params }).then(res => res.data);
export const getTrackingComparison = (params) => api.get('/production/tracking-comparison', { params }).then(res => res.data);
export const getProductionAnalyticsDashboard = (params) => api.get('/production/analytics-dashboard', { params }).then(res => res.data);
export const getVerticalProduction = (operacao, params) => api.get(`/producao/vertical/${encodeURIComponent(operacao)}`, { params, timeout: 120000 }).then(res => res.data);
export const getVerticalPendencies = (params) => api.get(`/producao/vertical-pendencias`, { params }).then(res => res.data);

export const getStockMainBalances = async (params) => {
    const response = await api.get('/stock/balances', { params });
    return response.data;
};

export const analisarCadastroIA = (filters) => api.post('/stock/cadastro/analisar', filters).then(res => res.data);
export const consultarCadastroIA = (payload) => api.post('/stock/cadastro/consultar', payload).then(res => res.data);
export const salvarCorrecaoCadastro = (payload) => api.post('/stock/cadastro/correcoes', payload).then(res => res.data);
export const getCorrecoesCadastro = (params) => api.get('/stock/cadastro/correcoes', { params }).then(res => res.data);
export const atualizarStatusCorrecao = (grupoUuid, status) => api.patch(`/stock/cadastro/correcoes/${grupoUuid}/status`, { status }).then(res => res.data);
// Fase 1 — Levenshtein (sem IA). Timeout curto (é rápido).
export const analisarRedundanciasMp = (payload) => api.post('/stock/cadastro/analisar-mp', payload, { timeout: 30000 }).then(res => res.data);
export const getGruposMp = () => api.get('/stock/cadastro/analisar-mp/grupos').then(res => res.data);
// Fase 2 — Confirma 1 candidato com Gemini (~5-8s).
export const confirmarGrupoIA = (candidato_id, produtos) => api.post('/stock/cadastro/confirmar-grupo-ia', { candidato_id, produtos }, { timeout: 45000 }).then(res => res.data);
export const getOndeEUsado = (codigo) => api.get(`/stock/cadastro/onde-usado/${encodeURIComponent(codigo)}`).then(res => res.data);
export const getUltimaCompraBatch = (codigos) => api.post('/stock/cadastro/ultima-compra/batch', { codigos }).then(res => res.data);


export const getInternalRequests = async (params) => {
    const response = await api.get('/stock/requisicoes', { params });
    return response.data;
};

// COMPRAS (Solicitações e Pedidos de Compras)
export const getPurchaseRequests = (params) => api.get('/compras/solicitacoes', { params }).then(res => res.data);
export const getPurchaseOrdersWithClientPO = (params) => api.get('/compras/pedidos-com-pv', { params }).then(res => res.data);
export const getPurchaseFlowToInvoice = (params) => api.get('/compras/fluxo-completo', { params }).then(res => res.data);

// REPORTS
export const getProductionReportData = (params) => api.get('/reports/production/data', { params }).then(res => res.data);
export const getSalesPlanningReportData = (params) => api.get('/reports/sales-planning/data', { params }).then(res => res.data);
export const getSalesPlanningMasterSheet = (params) => api.get('/reports/sales-planning/master-sheet', { params }).then(res => res.data);
export const updateOrderItemTag = (data) => api.put('/reports/sales-planning/item-tag', data).then(res => res.data);
export const getResourceEvolutionReportData = (params) => api.get('/reports/resource-evolution', { params }).then(res => res.data);

// SALES NOTES (Ata Viva)
export const getSalesNotes = (orders, item, enrich = false) => api.get('/sales/notes', { params: { orders: Array.isArray(orders) ? orders.join(',') : orders, item, enrich } }).then(res => res.data);
export const createSalesNote = (data) => api.post('/sales/notes', data).then(res => res.data);
export const resolveSalesNote = (id, user) => api.put(`/sales/notes/${id}/resolve`, { resolved_by: user }).then(res => res.data);

// NOVO SINCO (SolidEdge Integration)
export const getSincoStatus = () => api.get('/sinco/status').then(res => res.data);
export const getSincoActiveDocument = () => api.get('/sinco/active-document').then(res => res.data);
export const getSincoProduto = (codigo) => api.get(`/sinco/produto/${encodeURIComponent(codigo)}`).then(res => res.data);
export const getSincoProductStructure = (codigo) => api.get(`/sinco/estrutura/${encodeURIComponent(codigo)}`).then(res => res.data);
export const getSincoProdutosRaizes = () => api.get('/sinco/produtos-raizes').then(res => res.data);
export const getSincoArvore = (codigo) => api.get(`/sinco/arvore/${encodeURIComponent(codigo)}`).then(res => res.data);
export const getSincoArvoreCompleta = (codigo) => api.get(`/sinco/arvore-completa/${encodeURIComponent(codigo)}`).then(res => res.data);
export const getSincoRestricoes = (codigo) => api.get(`/sinco/restricoes/${encodeURIComponent(codigo)}`).then(res => res.data);
export const getSincoRestricoesSz0 = (codigo) => api.get(`/sinco/restricoes-sz0/${encodeURIComponent(codigo)}`).then(res => res.data);
export const getAllSincoRestricoesSz0 = () => api.get('/sinco/restricoes-sz0-todas').then(res => res.data);
export const createSincoRestricaoSz0 = (payload) => api.post('/sinco/restricao/edit', payload).then(res => res.data);
export const getSincoOperacoes = (codigo) => api.get(`/sinco/operacoes/${encodeURIComponent(codigo)}`).then(res => res.data);
export const sincoExportDxf = (outputPath) => api.post('/sinco/export-dxf', { outputPath }).then(res => res.data);
export const sincoExportPdf = (outputPath) => api.post('/sinco/export-pdf', { outputPath }).then(res => res.data);
export const getSincoComentariosEngenharia = (codigo) => api.get(`/sinco/comentarios/${encodeURIComponent(codigo)}`).then(res => res.data);
export const createSincoComentarioEngenharia = (codigo, data) => api.post(`/sinco/comentarios/${encodeURIComponent(codigo)}`, data).then(res => res.data);
export const updateSincoComentarioEngenhariaStatus = (id, data) => api.put(`/sinco/comentarios/${id}/status`, data).then(res => res.data);

// SINCO (OS) - Apontamento de Produção
export const getSincoOsItems = (osId) => api.get(`/sinco/os/${encodeURIComponent(osId)}/items`).then(res => res.data);
export const getSincoOsItemsEnriched = (osId) => api.get(`/sinco-apontamento/os/${encodeURIComponent(osId)}/items`).then(res => res.data);
// Sinco Apontamentos endpoints
export const getSincoProcessosList = () => api.get('/sinco-apontamento/processos-list').then(res => res.data);
export const getSincoPedidoBom = (pedido) => api.get(`/sinco-apontamento/pedido/${encodeURIComponent(pedido)}/bom`).then(res => res.data);
export const getSincoItemProcessos = (ordemServicoItemId) => api.get(`/sinco-apontamento/items/${encodeURIComponent(ordemServicoItemId)}/processos`).then(res => res.data);
export const getSincoProcessoHistorico = (osItemProcessoId) => api.get(`/sinco-apontamento/processos/${encodeURIComponent(osItemProcessoId)}/historico`).then(res => res.data);
export const apontarSincoProcesso = (osItemProcessoId, payload) => api.post(`/sinco-apontamento/processos/${encodeURIComponent(osItemProcessoId)}/apontar`, payload).then(res => res.data);
export const getSincoMaterialEntrega = (ordemServicoItemId) => api.get(`/sinco-apontamento/items/${encodeURIComponent(ordemServicoItemId)}/material-entrega`).then(res => res.data);
export const solicitarSincoMaterial = (ordemServicoItemId, payload) => api.post(`/sinco-apontamento/items/${encodeURIComponent(ordemServicoItemId)}/material-entrega/solicitar`, payload).then(res => res.data);
export const marcarChegadaSincoMaterial = (ordemServicoItemId, payload) => api.post(`/sinco-apontamento/items/${encodeURIComponent(ordemServicoItemId)}/material-entrega/chegada`, payload).then(res => res.data);
export const entregarSincoMaterial = (ordemServicoItemId, payload) => api.post(`/sinco-apontamento/items/${encodeURIComponent(ordemServicoItemId)}/material-entrega/entregar`, payload).then(res => res.data);
export const getSincoOsMatrix = (osId, params) => api.get(`/sinco-apontamento/os/${encodeURIComponent(osId)}/matrix`, { params }).then(res => res.data);
export const getSincoOsMaterials = (osId, params) => api.get(`/sinco-apontamento/os/${encodeURIComponent(osId)}/materials`, { params }).then(res => res.data);
export const getSincoOsProcessosPlanejamento = (osId) => api.get(`/sinco-apontamento/os/${encodeURIComponent(osId)}/processos-planejamento`).then(res => res.data);
export const saveSincoOsProcessosPlanejamento = (osId, payload) => api.put(`/sinco-apontamento/os/${encodeURIComponent(osId)}/processos-planejamento`, payload).then(res => res.data);
export const getSincoDashboardPorUsuario = (params) => api.get('/sinco-apontamento/dashboard/por-usuario', { params }).then(res => res.data);

export const updateSalesNote = (id, data) => api.put(`/sales/notes/${id}`, data).then(res => res.data);
export const deleteSalesNote = (id) => api.delete(`/sales/notes/${id}`).then(res => res.data);

// PCP FORECASTS
export const savePCPForecast = (data) => api.post('/pedidos/pcp-forecasts', data).then(res => res.data);
export const getPCPForecastHistory = (pedido, item) => api.get(`/pedidos/items/${pedido}/${item}/pcp-forecasts/history`).then(res => res.data);

export const getFileUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const base = getBaseUrl();
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${cleanPath}`;
};

export const getReportDownloadUrl = (type, params, category = 'production') => {
    const queryParams = { ...params };
    const token = localStorage.getItem('@Lynx:token');
    if (token) {
        queryParams.token = token;
    }
    const query = new URLSearchParams(queryParams).toString();
    const base = getBaseUrl();
    return `${base}/api/reports/${category}/${type}?${query}`;
};

// FATURAMENTO SOLICITAÇÕES
export const createFaturamentoSolicitacao = async (data) => {
    const response = await api.post('/faturamento/solicitacoes', data);
    return response.data;
};

export const getFaturamentoSolicitacoes = async (params) => {
    const response = await api.get('/faturamento/solicitacoes', { params });
    return response.data;
};

export const getFaturamentoNFsEmitidas = async (params) => {
    const response = await api.get('/faturamento/nfs-emitidas', { params });
    return response.data;
};

export const updateFaturamentoSolicitacaoStatus = async (id, status) => {
    const response = await api.put(`/faturamento/solicitacoes/${id}/status`, { status });
    return response.data;
};

// --- Novas rotas para edição de Solicitação e Auditoria --- //
export const updateFaturamentoSolicitacaoItem = async (id, itemId, payload) => {
    const response = await api.put(`/faturamento/solicitacoes/${id}/itens/${itemId}`, payload);
    return response.data;
};

export const deleteFaturamentoSolicitacaoItem = async (id, itemId, payloadObj) => {
    const response = await api.delete(`/faturamento/solicitacoes/${id}/itens/${itemId}`, { data: payloadObj });
    return response.data;
};

export const insertFaturamentoSolicitacaoItem = async (id, payload) => {
    const response = await api.post(`/faturamento/solicitacoes/${id}/itens`, payload);
    return response.data;
};

export const updateFaturamentoSolicitacaoNotaFiscal = async (id, payload) => {
    const response = await api.put(`/faturamento/solicitacoes/${id}/notafiscal`, payload);
    return response.data;
};

export const getFaturamentoAuditoria = async (id) => {
    const response = await api.get(`/faturamento/solicitacoes/${id}/auditoria`);
    return response.data;
};

export const enviarFaturamentoEmailLote = async (data) => {
    const response = await api.post('/faturamento/enviar-email-lote', data);
    return response.data;
};

export const getFaturamentoDashboard = async (params) => {
    const response = await api.get('/faturamento/dashboard', { params });
    return response.data;
};

export const getFluxoCaixa = async (params) => {
    const response = await api.get('/financeiro/fluxo-caixa', { params });
    return response.data;
};

// System Settings API
export const getSystemSetting = async (key) => {
    const response = await api.get(`/settings/${key}`);
    return response.data;
};

export const saveSystemSetting = async (key, value) => {
    const response = await api.post(`/settings/${key}`, { value });
    return response.data;
};

// Error Reporting Helper
export const reportSystemError = async (moduleName, error, filters = {}) => {
    try {
        const user = JSON.parse(localStorage.getItem('@Lynx:user') || '{}');
        await api.post('/email/system-error', {
            to: 'edsonmanoel2012@gmail.com',
            subject: `⚠️ ERRO NO SISTEMA - ${moduleName}`,
            html: `
                <h2>Erro Reportado pelo Sistema Lynx</h2>
                <p><strong>Usuário:</strong> ${user?.nome || 'Desconhecido'} (${user?.login || 'N/A'})</p>
                <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                <p><strong>Módulo:</strong> ${moduleName}</p>
                <p><strong>Filtros Utilizados:</strong> ${JSON.stringify(filters)}</p>
                <p><strong>Mensagem do Erro:</strong> ${error?.message || error}</p>
                <p><strong>Stack Trace:</strong></p>
                <pre>${error?.stack || 'Não disponível'}</pre>
            `
        });
    } catch (emailErr) {
        console.error('Falha ao enviar log de erro por email', emailErr);
    }
};

export const getOpRoteiroSaldo = (op, item, sequencia, produto) => api.get('/producao/op-roteiro-saldo', { params: { op, item, sequencia, produto } }).then(res => res.data);

export const getOpMaterials = (ops) => api.post('/production/op-materials', { ops }).then(res => res.data);

// SGQ Romaneios
export const getSgqAssets = () => api.get('/sgq/assets').then(res => res.data);
export const getSgqRomaneios = () => api.get('/sgq/romaneios').then(res => res.data);
export const getSgqRomaneioDetails = (id) => api.get(`/sgq/romaneios/${id}`).then(res => res.data);
export const createSgqRomaneio = (data) => api.post('/sgq/romaneios', data).then(res => res.data);
export const markSgqRomaneioReturned = (id) => api.put(`/sgq/romaneios/${id}/retorno`).then(res => res.data);

// SGQ RNCs
export const getSgqNaoConformidades = () => api.get('/sgq/nao-conformidades').then(res => res.data);
export const getOpRncs = (params) => api.get('/sgq/rncs', { params }).then(res => res.data);
export const getAllRncs = (params) => api.get('/sgq/rncs/all', { params }).then(res => res.data);
export const createRnc = (data) => api.post('/sgq/rncs', data).then(res => res.data);
export const updateRnc = (id, data) => api.put(`/sgq/rncs/${id}`, data).then(res => res.data);
export const deleteRnc = (id) => api.delete(`/sgq/rncs/${id}`).then(res => res.data);

// Apontamentos de RNC
export const getRncApontamentos = (rncId) => api.get(`/sgq/rncs/${rncId}/apontamentos`).then(res => res.data);
export const createRncApontamento = (rncId, data) => api.post(`/sgq/rncs/${rncId}/apontamentos`, data).then(res => res.data);
export const deleteRncApontamento = (id) => api.delete(`/sgq/rncs/apontamentos/${id}`).then(res => res.data);

// Fornecedores e Clientes Protheus
export const getProtheusFornecedores = () => api.get('/protheus/fornecedores').then(res => res.data);
export const getProtheusClientes = () => api.get('/protheus/clientes').then(res => res.data);

// Checklist Apontamento Vertical
export const getChecklist = (op, item_op, sequen_op) => api.get(`/producao/checklist/${op}/${item_op}/${sequen_op}`).then(res => res.data);
export const saveChecklist = (data) => api.post('/producao/checklist', data).then(res => res.data);
export const uploadChecklistPhoto = (formData) => api.post('/producao/checklist/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(res => res.data);

// Product Status (Novo/Revisão)
export const getProductStatus = (codigo) => api.get(`/product-status/${encodeURIComponent(codigo)}`).then(res => res.data);
export const setProductStatus = (codigo, estado, usuario, acao = 'MARCACAO_MANUAL') => api.post(`/product-status/${encodeURIComponent(codigo)}`, { estado, usuario, acao }).then(res => res.data);
export const getProductStatusHistory = (codigo) => api.get(`/product-status/${encodeURIComponent(codigo)}/history`).then(res => res.data);

export const getProductStatusesBatch = (codigos) => api.post('/product-status/batch/get', { codigos }).then(res => res.data);
export const setProductStatusBatch = (codigos, estado, usuario, acao = 'MARCACAO_MANUAL_LOTE') => api.post('/product-status/batch/update', { codigos, estado, usuario, acao }).then(res => res.data);

// Ajuste em Lote de Apontamentos (Configurações / PCP)
export const getRecursosAjusteApontamento = () => api.get('/producao/ajuste-apontamento/recursos').then(res => res.data);
export const previewAjusteApontamento = (payload) => api.post('/producao/ajuste-apontamento/preview', payload).then(res => res.data);
export const executarAjusteApontamento = (payload) => api.post('/producao/ajuste-apontamento/executar', payload).then(res => res.data);
// CIPA & Eleição Eletrônica (NR-05)
export const getCipaGestoes = () => api.get('/cipa/gestoes').then(res => res.data);
export const getCipaGestao = (id) => api.get(`/cipa/gestoes/${id}`).then(res => res.data);
export const createCipaGestao = (data) => api.post('/cipa/gestoes', data).then(res => res.data);
export const updateCipaGestaoStatus = (id, status) => api.put(`/cipa/gestoes/${id}/status`, { status }).then(res => res.data);
export const addCipaComissaoMembro = (gestaoId, data) => api.post(`/cipa/gestoes/${gestaoId}/comissao`, data).then(res => res.data);
export const deleteCipaComissaoMembro = (gestaoId, comissaoId) => api.delete(`/cipa/gestoes/${gestaoId}/comissao/${comissaoId}`).then(res => res.data);
export const inscreverCipaCandidato = (gestaoId, data) => api.post(`/cipa/gestoes/${gestaoId}/candidatos`, data).then(res => res.data);
export const homologarCipaCandidato = (gestaoId, candidatoId, data) => api.put(`/cipa/gestoes/${gestaoId}/candidatos/${candidatoId}/homologar`, data).then(res => res.data);
export const getCipaUrnaStatus = (gestaoId) => api.get(`/cipa/urna/${gestaoId}/status`).then(res => res.data);
export const votarCipaUrna = (gestaoId, data) => api.post(`/cipa/urna/${gestaoId}/votar`, data).then(res => res.data);
export const apurarCipaUrna = (gestaoId, data = {}) => api.post(`/cipa/urna/${gestaoId}/apurar`, data).then(res => res.data);
export const salvarCipaMembrosIndicados = (gestaoId, data) => api.post(`/cipa/gestoes/${gestaoId}/membros-indicados`, data).then(res => res.data);
export const definirCipaCargos = (gestaoId, data) => api.put(`/cipa/gestoes/${gestaoId}/definir-cargos`, data).then(res => res.data);
export const darPosseCipa = (gestaoId, data) => api.post(`/cipa/gestoes/${gestaoId}/dar-posse`, data).then(res => res.data);
export const getCipaReunioes = (gestaoId) => api.get(`/cipa/gestoes/${gestaoId}/reunioes`).then(res => res.data);
export const createCipaReuniao = (gestaoId, data) => api.post(`/cipa/gestoes/${gestaoId}/reunioes`, data).then(res => res.data);
export const createCipaReuniaoWithAnexo = (gestaoId, formData) => api.post(`/cipa/gestoes/${gestaoId}/reunioes`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(res => res.data);
export const uploadCipaAtaAnexo = (reuniaoId, formData) => api.post(`/cipa/reunioes/${reuniaoId}/anexo`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(res => res.data);
export const assinarCipaAta = (reuniaoId, data) => api.post(`/cipa/reunioes/${reuniaoId}/assinar`, data).then(res => res.data);

// CIPA v2 - Diretório de Colaboradores, Gestão Legada Existente e Auditoria
export const getCipaColaboradoresDisponiveis = () => api.get('/cipa/colaboradores-disponiveis').then(res => res.data);
export const createCipaGestaoLegada = (data) => api.post('/cipa/gestoes/legada', data).then(res => res.data);
export const addCipaMembroManual = (gestaoId, data) => api.post(`/cipa/gestoes/${gestaoId}/membros`, data).then(res => res.data);
export const deleteCipaMembroManual = (gestaoId, membroId) => api.delete(`/cipa/gestoes/${gestaoId}/membros/${membroId}`).then(res => res.data);
export const getCipaAuditoria = (gestaoId) => api.get(`/cipa/gestoes/${gestaoId}/auditoria`).then(res => res.data);
export const auditarCipaComprovante = (hash) => api.get(`/cipa/auditar-comprovante/${hash}`).then(res => res.data);

export { api };
export default api;
