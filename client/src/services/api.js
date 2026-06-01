import axios from 'axios';

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
    timeout: 60000
});

// Interceptor to attach JWT token to every request
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('@MetalFisa:token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Interceptor para tratamento de erros
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const data   = error.response?.data;

        // Determina se é falha de autenticação (sessão expirada / token inválido):
        //   • 401 → sempre é falha de auth
        //   • 403 sem corpo RBAC → servidor antigo retornando 403 para token inválido
        //     (retro-compatibilidade). RBAC sempre retorna { error: "...negado..." }.
        const isRbacDenial = status === 403 &&
            data && typeof data === 'object' && data.error &&
            (data.error.includes('negado') || data.error.includes('permissão'));

        const isAuthFailure = status === 401 || (status === 403 && !isRbacDenial);

        if (isAuthFailure) {
            const currentPath = window.location.pathname;
            if (currentPath !== '/login') {
                console.warn('🔒 Session expired, redirecting to login...');
                localStorage.removeItem('@MetalFisa:token');
                localStorage.removeItem('@MetalFisa:user');
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

        console.error(`❌ Erro na API [${status || 'NET'}] ${error.config?.method?.toUpperCase() || '?'} ${error.config?.url} — ${error.message}`);
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

export const getEstruturaProduto = async (codigo) => {
    const encodedCod = encodeURIComponent(codigo);
    const response = await api.get(`/production/estrutura/${encodedCod}`);
    return response.data;
};

export const getProductDocuments = async (codigo) => {
    const encodedCod = encodeURIComponent(codigo);
    const response = await api.get(`/docs/${encodedCod}`);
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

// CLIENTS
export const getClientes = async (query) => {
    const response = await api.get('/clients/search', { params: { q: query } });
    return response.data;
};

// USERS
export const getUsers = (params) => api.get('/users', { params }).then(res => res.data);
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
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
export const importProductWeights = (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/produtos/import-weights', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data);
};

// COMPANY
export const getCompanySettings = () => api.get('/company').then(res => res.data);
export const updateCompanySettings = (data) => api.put('/company', data).then(res => res.data);
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
export const saveProductionPlanBatch = (plans, observacao, modo_calculo, preferencias) =>
    api.post('/production/plan-batch', { plans, observacao, modo_calculo, preferencias }).then(res => res.data);

export const previewCascade = (payload) =>
    api.post('/production/cascade-preview', payload).then(res => res.data);
export const getPlanningHistory = (op) => api.get(`/production/planning-history/${encodeURIComponent(op)}`).then(res => res.data);
export const getPlanningPrefs = (op) => api.get(`/production/planning-prefs/${encodeURIComponent(op)}`).then(res => res.data);
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
export const getVerticalProduction = (operacao, params) => api.get(`/producao/vertical/${encodeURIComponent(operacao)}`, { params }).then(res => res.data);
export const getVerticalPendencies = (params) => api.get(`/producao/vertical-pendencias`, { params }).then(res => res.data);

export const getStockMainBalances = async (params) => {
    const response = await api.get('/stock/balances', { params });
    return response.data;
};

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
export const getSincoRestricoes = (codigo) => api.get(`/sinco/restricoes/${encodeURIComponent(codigo)}`).then(res => res.data);
export const getSincoRestricoesSz0 = (codigo) => api.get(`/sinco/restricoes-sz0/${encodeURIComponent(codigo)}`).then(res => res.data);
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
    const token = localStorage.getItem('@MetalFisa:token');
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
        const user = JSON.parse(localStorage.getItem('@MetalFisa:user') || '{}');
        await api.post('/email/system-error', {
            to: 'edsonmanoel2012@gmail.com',
            subject: `⚠️ ERRO NO SISTEMA - ${moduleName}`,
            html: `
                <h2>Erro Reportado pelo Sistema MetalFisa</h2>
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

export { api };
export default api;
