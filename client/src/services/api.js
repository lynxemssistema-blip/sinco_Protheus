import axios from 'axios';

export const getBaseUrl = () => {
    const { protocol, hostname, port } = window.location;
    // Se estiver em produção (sem porta ou portas padrão), assume que a API está no mesmo host
    // Se estiver em dev (porta 3000 ou 5173), assume que a API está na 3001
    const isDev = port === '3000' || port === '5173' || port === '5174';
    const apiPort = isDev ? ':3001' : (port ? `:${port}` : '');
    
    // Para casos específicos onde o frontend roda em porta diferente mas a API está na 3001
    // (Padrão do boilerplate usado no projeto)
    const finalPort = (isDev && !port.includes('3001')) ? ':3001' : apiPort;

    return `${protocol}//${hostname}${finalPort}`;
};

const api = axios.create({
    baseURL: `${getBaseUrl()}/api`,
    maxContentLength: Infinity,
    maxBodyLength: Infinity
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
        // Auto-redirect to login on 401/403
        if (error.response?.status === 401 || error.response?.status === 403) {
            const currentPath = window.location.pathname;
            if (currentPath !== '/login') {
                console.warn('🔒 Session expired, redirecting to login...');
                localStorage.removeItem('@MetalFisa:token');
                localStorage.removeItem('@MetalFisa:user');
                window.location.href = '/login';
            }
        }
        console.error('❌ Erro na API:', {
            message: error.message,
            url: error.config?.url,
            status: error.response?.status,
        });
        return Promise.reject(error);
    }
);

export const getPedidos = async (params) => {
    const response = await api.get('/pedidos', { params });
    return response.data;
};

export const getPedidosFlat = async (params) => {
    const response = await api.get('/pedidos/flat', { params });
    return response.data;
};

export const getItensPedido = async (pedidoId) => {
    const response = await api.get(`/pedidos/${pedidoId}/itens`);
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

export const getProductionOrders = async (params) => {
    const response = await api.get('/producao/ordens', { params });
    return response.data;
};

export const getProductionOrdersByOp = async (op, item, sequencia, client, product) => {
    const response = await api.get('/producao/op', { params: { op, item, sequencia, client, product } });
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

export const updateRomaneioStatus = async (id, status) => {
    const response = await api.put(`/romaneios/${id}/status`, { status });
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

// PRODUCTION CONTROL
export const getProductionDashboard = (params) => api.get('/production', { params }).then(res => res.data);
export const getProductionMatrix = (params) => api.get('/production/matrix', { params }).then(res => res.data);
export const getOperationById = (opId) => api.get(`/production/operations/${opId}`).then(res => res.data);
export const saveProductionPlan = (data) => api.post('/production/plan', data).then(res => res.data);
export const saveProductionPlanBatch = (plans) => api.post('/production/plan-batch', { plans }).then(res => res.data);
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
export const getPedidosEvolution = (params) => api.get('/production/tracking-evolution', { params }).then(res => ({ ...res.data, pedidos: res.data.agrupado || [] }));
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

// SALES NOTES (Ata Viva)
export const getSalesNotes = (orders, item, enrich = false) => api.get('/sales/notes', { params: { orders: Array.isArray(orders) ? orders.join(',') : orders, item, enrich } }).then(res => res.data);
export const createSalesNote = (data) => api.post('/sales/notes', data).then(res => res.data);
export const resolveSalesNote = (id, user) => api.put(`/sales/notes/${id}/resolve`, { resolved_by: user }).then(res => res.data);

// NOVO SINCO (SolidEdge Integration)
export const getSincoStatus = () => api.get('/sinco/status').then(res => res.data);
export const getSincoActiveDocument = () => api.get('/sinco/active-document').then(res => res.data);
export const getSincoProductStructure = (codigo) => api.get(`/sinco/estrutura/${encodeURIComponent(codigo)}`).then(res => res.data);
export const getSincoProdutosRaizes = () => api.get('/sinco/produtos-raizes').then(res => res.data);
export const sincoExportDxf = (outputPath) => api.post('/sinco/export-dxf', { outputPath }).then(res => res.data);
export const sincoExportPdf = (outputPath) => api.post('/sinco/export-pdf', { outputPath }).then(res => res.data);
export const getSincoComentariosEngenharia = (codigo) => api.get(`/sinco/comentarios/${encodeURIComponent(codigo)}`).then(res => res.data);
export const createSincoComentarioEngenharia = (codigo, data) => api.post(`/sinco/comentarios/${encodeURIComponent(codigo)}`, data).then(res => res.data);
export const updateSincoComentarioEngenhariaStatus = (id, data) => api.put(`/sinco/comentarios/${id}/status`, data).then(res => res.data);

// SINCO (OS) - Apontamento de Produção
export const getSincoOsItems = (osId) => api.get(`/sinco/os/${encodeURIComponent(osId)}/items`).then(res => res.data);
export const getSincoOsItemsEnriched = (osId) => api.get(`/sinco-apontamento/os/${encodeURIComponent(osId)}/items`).then(res => res.data);
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
    const query = new URLSearchParams(params).toString();
    const base = getBaseUrl();
    return `${base}/api/reports/${category}/${type}?${query}`;
};

export { api };
export default api;

