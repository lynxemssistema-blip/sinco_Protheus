import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    Search, Filter, Calendar, AlertCircle, ChevronLeft, ChevronRight,
    Package, Layers, FileText, FileSpreadsheet, Loader2,
    GripVertical, Settings, X, Eye, EyeOff, Scissors, Play, Square
} from 'lucide-react';
import {
    getPedidosFlat, getProdutos, getReportDownloadUrl,
    getFileUrl, getUserPreference, saveUserPreference, api
} from '../services/api';

import DocsModal from '../components/DocsModal';
import NotesDrawer from '../components/NotesDrawer';
import MeetingReportModal from '../components/MeetingReportModal';
import ProductImageModal from '../components/ProductImageModal';
import EngineeringControlModal from '../components/EngineeringControlModal';
import EngineeringPlanModal from '../components/EngineeringPlanModal';
import PCPForecastModal from '../components/PCPForecastModal';
import PCPMetalDrawer from '../components/PCPMetalDrawer';
import InvoiceDetailsModal from '../components/InvoiceDetailsModal';
import { useAuth } from '../contexts/AuthContext';
import { useFilters } from '../contexts/FilterContext';
import useStickyState from '../hooks/useStickyState';

// ─── Column definitions ────────────────────────────────────────────────────────
const ALL_COLUMNS = [
    { key: 'pedido', label: 'Pedido', required: true },
    { key: 'emissao', label: 'Emissão', required: false },
    { key: 'cliente', label: 'Cliente', required: false },
    { key: 'pc', label: 'PC', required: false },
    { key: 'item', label: 'It', required: false },
    { key: 'acoes', label: 'Ações', required: true },
    { key: 'op', label: 'OP', required: false },
    { key: 'codigo', label: 'Cód. Prod', required: false },
    { key: 'c6_xrevm', label: 'C6_XREVM', required: false },
    { key: 'tipo', label: 'Tipo', required: false },
    { key: 'ref_cliente', label: 'Ref. Cliente', required: false },
    { key: 'rev_cliente', label: 'Rev. Cliente', required: false },
    { key: 'descricao', label: 'Descrição', required: false },
    { key: 'status', label: 'Status', required: false },
    { key: 'qtd_entregue', label: 'Entreg.', required: false },
    { key: 'saldo', label: 'Saldo Fat.', required: false },
    { key: 'valor_unitario', label: 'V. Unit (R$)', required: false },
    { key: 'valor_total', label: 'V. Total (R$)', required: false },
    { key: 'quantidade', label: 'Qtd.', required: false },
    { key: 'lib_producao', label: 'Lib. Eng.', required: false },
    { key: 'entrega', label: 'Entrega', required: false },
    { key: 'qtd_pcp', label: 'Qtd. PCP', required: false },
    { key: 'data_pcp', label: 'Data PCP', required: false },
];

const PREF_KEY = 'eng_page_col_order_v1';

function loadColConfigLocal() {
    try {
        const saved = localStorage.getItem(PREF_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            const knownKeys = new Set(parsed.map(c => c.key));
            const extra = ALL_COLUMNS.filter(c => !knownKeys.has(c.key));
            return [...parsed, ...extra];
        }
    } catch (_) { /* ignore */ }
    return ALL_COLUMNS.map(c => ({ ...c, visible: true }));
}

async function loadColConfigFromServer() {
    try {
        const saved = await getUserPreference(PREF_KEY);
        if (saved && Array.isArray(saved)) {
            const knownKeys = new Set(saved.map(c => c.key));
            const extra = ALL_COLUMNS.filter(c => !knownKeys.has(c.key));
            return [...saved, ...extra];
        }
    } catch (_) { /* fallback to local */ }
    return null;
}

function saveColConfig(cols) {
    localStorage.setItem(PREF_KEY, JSON.stringify(cols));
    saveUserPreference(PREF_KEY, cols).catch(() => { });
}

// ─── Helper ────────────────────────────────────────────────────────────────────
function formatProtheusDate(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '-';
    if (/^\d{8}$/.test(raw)) return raw.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1');
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1');
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
    if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) return raw.replace(/-/g, '/');
    return raw;
}

function formatCurrency(value) {
    const num = parseFloat(value);
    if (isNaN(num)) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

// ─── ColumnSettingsPanel ───────────────────────────────────────────────────────
function ColumnSettingsPanel({ columns, onChange, onClose }) {
    const [cols, setCols] = useState(columns);
    const [dragging, setDragging] = useState(null);

    const handleDragStart = (idx) => setDragging(idx);
    const handleDragOver = (e, idx) => {
        e.preventDefault();
        if (dragging === null || dragging === idx) return;
        const next = [...cols];
        const [moved] = next.splice(dragging, 1);
        next.splice(idx, 0, moved);
        setCols(next);
        setDragging(idx);
    };
    const handleDrop = () => setDragging(null);

    const toggleVisible = (idx) => {
        if (cols[idx].required) return;
        const next = [...cols];
        next[idx] = { ...next[idx], visible: !next[idx].visible };
        setCols(next);
    };

    const handleSave = () => {
        saveColConfig(cols);
        onChange(cols);
        onClose();
    };

    const handleReset = () => {
        const def = ALL_COLUMNS.map(c => ({ ...c, visible: true }));
        setCols(def);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <Settings className="h-5 w-5 text-indigo-600" />
                        <h2 className="text-base font-bold text-gray-800">Ordem e Visibilidade das Colunas</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
                        <X className="h-4 w-4 text-gray-500" />
                    </button>
                </div>
                <p className="text-xs text-gray-400 px-5 pt-3 pb-1">Arraste para reordenar. Clique no olho para mostrar/ocultar.</p>
                <div className="overflow-y-auto flex-1 px-5 py-2 space-y-1.5">
                    {cols.map((col, idx) => (
                        <div
                            key={col.key}
                            draggable
                            onDragStart={() => handleDragStart(idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDrop={handleDrop}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing select-none
                                ${dragging === idx ? 'border-indigo-400 bg-indigo-50 shadow-md' : 'border-gray-100 bg-gray-50 hover:border-indigo-200'}`}
                        >
                            <GripVertical className="h-4 w-4 text-gray-300 flex-shrink-0" />
                            <span className={`flex-1 text-sm font-medium ${!col.visible ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                {col.label}
                            </span>
                            {col.required
                                ? <span className="text-[10px] text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded font-semibold uppercase">Fixo</span>
                                : (
                                    <button onClick={() => toggleVisible(idx)} className="p-1 rounded-lg hover:bg-gray-200 transition">
                                        {col.visible
                                            ? <Eye className="h-4 w-4 text-indigo-500" />
                                            : <EyeOff className="h-4 w-4 text-gray-400" />
                                        }
                                    </button>
                                )
                            }
                        </div>
                    ))}
                </div>
                <div className="flex gap-3 p-5 border-t border-gray-100">
                    <button onClick={handleReset} className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
                        Resetar
                    </button>
                    <button onClick={handleSave} className="flex-1 py-2 text-sm text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition font-semibold">
                        Salvar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Tipo badge ────────────────────────────────────────────────────────────────
function TipoBadge({ tipo, detalhe }) {
    const configs = {
        Novo: { label: 'NOVO', bg: 'bg-blue-100 text-blue-700 border-blue-200' },
        'Revisão': { label: 'REVISÃO', bg: 'bg-orange-100 text-orange-700 border-orange-200' },
        'Restrição': { label: 'RESTRIÇÃO', bg: 'bg-red-100 text-red-700 border-red-200' },
    };
    const cfg = configs[tipo] || { label: 'PCP', bg: 'bg-gray-100 text-gray-700 border-gray-200' };

    return (
        <div className="relative group/tipo inline-flex justify-center">
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded border cursor-help ${cfg.bg}`}>
                {cfg.label}
            </span>
            {detalhe && (
                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tipo:flex flex-col items-center">
                    <div className="bg-slate-800 text-slate-100 text-[10px] rounded p-2 shadow-xl border border-slate-700 whitespace-nowrap text-left min-w-[150px] max-w-[300px]">
                        <div className="font-bold text-white mb-1 border-b border-slate-600 pb-1">Detalhes do Tipo:</div>
                        <div className="whitespace-normal">{detalhe}</div>
                    </div>
                    <div className="w-2 h-2 bg-slate-800 rotate-45 -mt-1 border-b border-r border-slate-700"></div>
                </div>
            )}
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────
const EngineeringOrdersPage = () => {
    const location = useLocation();
    const { user } = useAuth();
    const { orderFilters, updateOrderFilters } = useFilters();
    
    const canViewFinancials = user?.permissoes?.some(p => p.page_id === 'valores_financeiros' && p.can_view);

    const viewMode = 'flat';
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 50;

    // Tipo frontend filter (multi-select)
    const [tipoFilter, setTipoFilter] = useStickyState([], '@metalfisa:eng_tipoFilter');
    // Emissão frontend filter (single date)
    const [emissaoFilter, setEmissaoFilter] = useStickyState('', '@metalfisa:eng_emissaoFilter');
    const [showSettings, setShowSettings] = useState(false);
    const [colConfig, setColConfig] = useState(() => loadColConfigLocal());
    
    // Engineering Timesheet Active Timer
    const [activeTimer, setActiveTimer] = useState(null);

    // Bulk selection state
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [batchModalOpen, setBatchModalOpen] = useState(false);

    const fetchActiveTimer = async () => {
        try {
            const res = await api.get('/engineering-timesheets/active');
            setActiveTimer(res.data.activeTimer);
        } catch (err) {
            console.error('Error fetching active timer', err);
        }
    };

    const toggleTimer = async (pedido, itemCode) => {
        try {
            // Is this item already playing?
            if (activeTimer && activeTimer.pedido === pedido && activeTimer.item === itemCode) {
                // Stop it
                await api.post('/engineering-timesheets/stop', { id: activeTimer.id });
                setActiveTimer(null);
            } else {
                // It will auto-stop the previous one backend-side
                const res = await api.post('/engineering-timesheets/start', { pedido, item: itemCode });
                fetchActiveTimer();
            }
        } catch (err) {
            alert('Falha ao iniciar/parar apontamento de engenharia.');
            console.error(err);
        }
    };

    // Load column config from server (per-user) on mount
    useEffect(() => {
        loadColConfigFromServer().then(serverCols => {
            if (serverCols) {
                setColConfig(serverCols);
                localStorage.setItem(PREF_KEY, JSON.stringify(serverCols));
            }
        });
    }, []);

    // Modal states
    const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
    const [selectedProductForDocs, setSelectedProductForDocs] = useState({ code: '', name: '' });
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedProductForImage, setSelectedProductForImage] = useState(null);
    const [notesTarget, setNotesTarget] = useState(null);
    const [engineeringTarget, setEngineeringTarget] = useState(null);
    const [showReportModal, setShowReportModal] = useState(false);
    const [isGlobalReport, setIsGlobalReport] = useState(false);
    const [pcpForecastTarget, setPcpForecastTarget] = useState(null);
    const [downloadingPDF, setDownloadingPDF] = useState(false);
    const [pcpmetalOpen, setPcpmetalOpen] = useState(false);
    const [pcpmetalContext, setPcpmetalContext] = useState({});
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [invoiceModalItem, setInvoiceModalItem] = useState(null);
    // PCP Planned date modal
    const [planModalTarget, setPlanModalTarget] = useState(null); // { pedido, item, currentDate, currentObs }

    const filters = {
        cliente: orderFilters.cliente,
        pedido: orderFilters.pedido,
        produto: orderFilters.produto,
        dataInicial: orderFilters.dataInicial,
        dataFinal: orderFilters.dataFinal,
        dateType: orderFilters.dateType,
        only_active: orderFilters.only_active,
    };

    const setFilters = (val) => {
        if (typeof val === 'function') updateOrderFilters(val(orderFilters));
        else updateOrderFilters(val);
    };

    const page = orderFilters.page;
    const setPage = (val) => {
        const newPage = typeof val === 'function' ? val(page) : val;
        updateOrderFilters({ page: newPage });
    };

    // Bulk selection helpers
    const toggleItemSelection = (key) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };
    const toggleSelectAll = () => {
        if (filteredOrders.length > 0 && selectedItems.size === filteredOrders.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(filteredOrders.map(i => `${i.pedido}-${i.item}`)));
        }
    };
    const getSelectedItemsList = () => filteredOrders
        .filter(i => selectedItems.has(`${i.pedido}-${i.item}`))
        .map(i => ({ pedido: i.pedido, item: i.item }));

    // Filtered view: chained frontend filters (tipo + emissão)
    const filteredOrders = orders.filter(item => {
        if (tipoFilter.length > 0) {
            const tipo = item.status_tipo_item || 'PCP';
            if (!tipoFilter.includes(tipo)) return false;
        }
        if (emissaoFilter) {
            const formatted = formatProtheusDate(item.emissao);
            const [y, m, d] = emissaoFilter.split('-');
            if (formatted !== `${d}/${m}/${y}`) return false;
        }
        return true;
    });


    const fetchData = async (overrides = {}) => {
        setLoading(true);
        setError(null);
        try {
            const searchFilters = { ...filters, ...overrides };
            const searchPage = overrides.page || page;
            const result = await getPedidosFlat({ ...searchFilters, page: searchPage, limit });
            const { data, meta } = result;
            setOrders(data);
            setTotalPages(Math.ceil(meta.total / limit));
        } catch (err) {
            const serverError = err.response?.data;
            const errorMsg = serverError
                ? typeof serverError === 'object' ? JSON.stringify(serverError, null, 2) : serverError
                : err.message;
            setError(`Erro ao carregar dados: ${errorMsg}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        fetchActiveTimer();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, viewMode, filters.only_active]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchData({ page: 1 });
    };

    const handleOpenDocs = (code, name) => {
        setSelectedProductForDocs({ code, name });
        setIsDocsModalOpen(true);
    };

    const handleSaveEngineeringControl = (pedido, itemCode, newData) => {
        setOrders(prev => prev.map(i =>
            (i.pedido === pedido && i.item === itemCode) ? { ...i, ...newData } : i
        ));
    };

    // Exportar Espelho OS Corte Laser (MO0013) — requer filtro por pedido específico
    const handleDownloadLaserExport = () => {
        const pedido = (filters.pedido || '').trim();
        if (!pedido) {
            alert('Filtre por um número de pedido específico para gerar o Espelho OS Corte (Laser).');
            return;
        }
        const token = localStorage.getItem('@MetalFisa:token') || '';
        window.open(`/api/pedidos/op-mirror/${encodeURIComponent(pedido)}/export-laser?token=${token}`, '_blank');
    };

    // Excel — export ALL data matching current filters (no pagination limit)
    const handleDownloadExcel = () => {
        const reportFilters = {
            client: filters.cliente,
            order: filters.pedido,
            product: filters.produto,
            emission_start: filters.dataInicial,
            emission_end: filters.dataFinal,
            active_only: filters.only_active,
            // Request all pages
            limit: 99999,
            page: 1
        };
        const url = getReportDownloadUrl('xlsx', reportFilters, 'sales-planning');
        window.open(url, '_blank');
    };


    // Render cell content for a given column key and row
    const renderCell = (colKey, item) => {
        switch (colKey) {
            case 'pedido':
                return <span className="font-bold text-gray-900">{item.pedido}</span>;
            case 'emissao':
                return (
                    <div className="flex items-center justify-center gap-1 text-xs text-gray-600">
                        <Calendar className="h-3 w-3 text-gray-400" />
                        {formatProtheusDate(item.emissao)}
                    </div>
                );
            case 'cliente':
                return <div className="text-xs font-medium text-gray-700 truncate max-w-[160px]" title={item.nome_cliente}>{item.nome_cliente}</div>;
            case 'pc':
                return <span className="text-xs text-gray-600">{item.ped_cliente || '-'}</span>;
            case 'item':
                return <span className="text-xs font-mono text-gray-500">{item.item}</span>;
            case 'op':
                return <span className="text-xs font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{item.op_num || '-'}</span>;
            case 'codigo':
                return (
                    <Link
                        to={`/estrutura/${encodeURIComponent(item.codigo)}`}
                        state={{ from: location.pathname }}
                        className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 text-xs font-mono"
                    >
                        {item.codigo} <Layers className="h-3 w-3" />
                    </Link>
                );
            case 'c6_xrevm':
                return <span className="text-xs text-gray-500 font-mono">{item.rev_codigo || '-'}</span>;
            case 'tipo':
                return <TipoBadge tipo={item.status_tipo_item} detalhe={item.status_tipo_detalhe} />;
            case 'ref_cliente':
                return <span className="text-xs font-mono text-gray-600">{item.ref_cliente || '-'}</span>;
            case 'rev_cliente':
                return <span className="text-xs font-semibold text-gray-700">{item.c6_rev_cliente || '-'}</span>;
            case 'acoes':
                return (
                    <div className="flex items-center justify-center gap-1">
                        <button
                            onClick={() => {
                                if (item.has_drawing && item.drawing_url) {
                                    window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(item.drawing_url)}`), '_blank');
                                } else if (item.docs_count === 1 && item.first_doc) {
                                    window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(item.first_doc)}`), '_blank');
                                } else {
                                    handleOpenDocs(item.codigo, item.descricao);
                                }
                            }}
                            className={`p-1.5 rounded-lg transition-all relative ${item.has_docs ? 'text-red-600 bg-red-50 hover:bg-red-100 ring-1 ring-red-200' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}
                            title={item.has_docs ? `${item.docs_count} Documento(s)` : 'Documentos'}
                        >
                            <FileText className="h-4 w-4" />
                            {item.has_docs && (
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setEngineeringTarget({ orderId: item.pedido, item })}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 transition-all bg-gray-50/50 hover:bg-indigo-50 rounded"
                            title="Controle de Engenharia"
                        >
                            <Settings className="h-4 w-4" />
                        </button>
                        {activeTimer && activeTimer.pedido === item.pedido && activeTimer.item === item.item ? (
                            <button
                                onClick={() => toggleTimer(item.pedido, item.item)}
                                className="p-1.5 text-orange-600 bg-orange-100 hover:bg-orange-200 transition-all rounded ring-1 ring-orange-300 animate-pulse"
                                title="Parar Apontamento (Salva as horas gastas)"
                            >
                                <Square className="h-4 w-4 fill-current" />
                            </button>
                        ) : (
                            <button
                                onClick={() => toggleTimer(item.pedido, item.item)}
                                className="p-1.5 text-gray-400 hover:text-green-600 transition-all bg-gray-50/50 hover:bg-green-50 rounded"
                                title="Iniciar Apontamento (Pausa outros automaticamente)"
                            >
                                <Play className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                );
            case 'descricao':
                return <span className="text-xs text-gray-600 truncate max-w-[220px]" title={item.descricao}>{item.descricao}</span>;
            case 'status':
                return parseFloat(item.qtd_faturar) <= 0
                    ? <span className="px-2 py-0.5 text-[9px] font-bold bg-green-100 text-green-700 rounded border border-green-200">ENTREGUE</span>
                    : <span className="px-2 py-0.5 text-[9px] font-bold bg-orange-100 text-orange-700 rounded border border-orange-200">PENDENTE</span>;
            case 'qtd_entregue':
                return <span className="text-gray-600">{parseFloat(item.qtd_entreg || 0).toLocaleString('pt-BR')}</span>;
            case 'saldo':
                return (
                    <span className={`font-medium ${parseFloat(item.qtd_faturar) <= 0 ? 'text-green-600' : 'text-orange-600 font-bold'}`}>
                        {parseFloat(item.qtd_faturar || 0).toLocaleString('pt-BR')}
                    </span>
                );
            case 'valor_unitario':
                return <span className="font-mono text-gray-700 whitespace-nowrap">{formatCurrency(item.valor_unitario)}</span>;
            case 'valor_total':
                return <span className="font-mono font-bold text-gray-900 whitespace-nowrap">{formatCurrency(item.valor_total)}</span>;
            case 'quantidade':
                return (
                    <span className="font-medium">
                        {parseFloat(item.quantidade).toLocaleString('pt-BR')} <span className="text-[10px] text-gray-400">{item.unidade}</span>
                    </span>
                );
            case 'lib_producao': {
                const planned = item.pcp_planned_eng_date;
                const released = item.designer_production_release_date;
                return (
                    <div
                        className="flex flex-col gap-1 cursor-pointer group"
                        title="Clique para definir/editar data planejada"
                        onClick={() => setPlanModalTarget({
                            pedido: item.pedido,
                            item: item.item,
                            currentDate: planned,
                            currentObs: item.pcp_planned_eng_obs
                        })}
                    >
                        {/* Planejado line */}
                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-all ${planned
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 group-hover:bg-indigo-100'
                            : 'bg-gray-50 text-gray-400 border-dashed border-gray-200 group-hover:border-indigo-300'
                            }`}>
                            <Calendar className="h-2.5 w-2.5" />
                            <span>Plan: {planned ? new Date(planned).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Definir...'}</span>
                        </div>
                        {/* Realizado line */}
                        {released && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
                                <Calendar className="h-2.5 w-2.5" />
                                <span>Real: {new Date(released).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                            </div>
                        )}
                    </div>
                );
            }
            case 'entrega':
                return (
                    <div className="flex items-center justify-center gap-1 font-medium text-blue-800 bg-blue-50 rounded px-1.5 py-0.5 text-xs">
                        <Calendar className="h-3 w-3 text-blue-400" />
                        {item.entrega ? item.entrega.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1') : '-'}
                    </div>
                );
            case 'qtd_pcp':
                return (
                    <div
                        className="cursor-pointer hover:bg-teal-50 rounded px-1 py-0.5 transition-colors group/pcp"
                        onClick={() => setPcpForecastTarget(item)}
                        title="Clique para definir Qtd. PCP"
                    >
                        <span className="text-xs font-medium text-teal-700 group-hover/pcp:text-teal-900">
                            {item.pcp_delivery_forecast_qtd ? parseFloat(item.pcp_delivery_forecast_qtd).toLocaleString('pt-BR') : 'Definir...'}
                        </span>
                    </div>
                );
            case 'data_pcp':
                return (
                    <div
                        className="cursor-pointer hover:bg-teal-50 rounded px-1 py-0.5 transition-colors group/pcp"
                        onClick={() => setPcpForecastTarget(item)}
                        title="Clique para definir Data PCP"
                    >
                        {item.pcp_delivery_forecast_date ? (
                            <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-semibold group-hover/pcp:border-teal-400">
                                {new Date(item.pcp_delivery_forecast_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                            </span>
                        ) : <span className="text-xs text-gray-400 group-hover/pcp:text-teal-600">Definir...</span>}
                    </div>
                );
            default:
                return null;
        }
    };

    const visibleCols = colConfig.filter(c => c.visible !== false && (canViewFinancials || !['valor_unitario', 'valor_total'].includes(c.key)));

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:overflow-visible print:shadow-none print:border-none">
            {/* Header & Filters */}
            <div className="p-4 border-b border-gray-100 bg-white print:hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Layers className="h-6 w-6 text-indigo-600" />
                            Painel de Itens (Engenharia)
                        </h2>
                        <p className="text-sm text-gray-500">Visão plana de todos os componentes e produtos em desenvolvimento ou produção.</p>
                        {filters.only_active === 'true' && (
                            <div className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-md px-2 py-1 inline-flex items-center gap-1.5">
                                <AlertCircle className="h-3 w-3" />
                                <span>Visualizando apenas itens <strong>Ativos</strong> (não entregues) e <strong>Vendas</strong> (exclui orçamentos).</span>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setShowSettings(true)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition text-sm font-medium"
                        title="Configurar Colunas"
                    >
                        <Settings className="h-4 w-4" />
                        Colunas
                    </button>
                </div>

                <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-8 gap-3 items-end">
                    {/* Cliente */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-medium text-gray-600 ml-1">Cliente:</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                name="cliente"
                                placeholder="Cliente..."
                                value={filters.cliente}
                                onChange={handleFilterChange}
                                className="pl-9 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                            />
                        </div>
                    </div>

                    {/* Pedido */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-medium text-gray-600 ml-1">Pedido:</label>
                        <div className="relative">
                            <Filter className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                name="pedido"
                                placeholder="Nº Pedido..."
                                value={filters.pedido}
                                onChange={handleFilterChange}
                                className="pl-9 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                            />
                        </div>
                    </div>

                    {/* Produto */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-medium text-gray-600 ml-1">Produto:</label>
                        <div className="relative">
                            <Package className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                name="produto"
                                placeholder="Cód. Produto..."
                                value={filters.produto}
                                onChange={handleFilterChange}
                                className="pl-9 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                            />
                        </div>
                    </div>

                    {/* Data Início */}
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center mb-0.5">
                            <label className="text-[11px] font-medium text-gray-600">Início:</label>
                            <select
                                name="dateType"
                                value={filters.dateType}
                                onChange={handleFilterChange}
                                className="bg-transparent text-[11px] font-bold text-indigo-600 outline-none cursor-pointer p-0"
                            >
                                <option value="pedido">Emissão Pedido</option>
                                <option value="nf">Emissão NF</option>
                            </select>
                        </div>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                type="date"
                                name="dataInicial"
                                value={filters.dataInicial}
                                onChange={handleFilterChange}
                                className="pl-9 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all font-medium"
                            />
                        </div>
                    </div>

                    {/* Data Fim */}
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center mb-0.5">
                            <label className="text-[11px] font-medium text-gray-600">Fim:</label>
                            <span className="text-[11px] font-bold text-indigo-600">{filters.dateType === 'pedido' ? 'Emissão Pedido' : 'Emissão NF'}</span>
                        </div>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                type="date"
                                name="dataFinal"
                                value={filters.dataFinal}
                                onChange={handleFilterChange}
                                className="pl-9 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all font-medium"
                            />
                        </div>
                    </div>

                    {/* Emissão — frontend date filter */}
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center mb-0.5">
                            <label className="text-[11px] font-medium text-gray-600">Emissão:</label>
                            {emissaoFilter && (
                                <button type="button" onClick={() => setEmissaoFilter('')} className="text-[10px] text-indigo-500 hover:underline">✕ Limpar</button>
                            )}
                        </div>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                type="date"
                                value={emissaoFilter}
                                onChange={(e) => setEmissaoFilter(e.target.value)}
                                className="pl-9 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all font-medium"
                                title="Filtrar pela coluna Emissão"
                            />
                        </div>
                    </div>

                    {/* Tipo — multi-select pills */}
                    <div className="flex flex-col gap-1 md:col-span-2">
                        <label className="text-[11px] font-medium text-gray-600 ml-1">Tipo de Item:</label>
                        <div className="flex flex-wrap gap-1.5">
                            {['PCP', 'Revisão', 'Restrição', 'Novo'].map(tipo => {
                                const active = tipoFilter.includes(tipo);
                                const colors = {
                                    PCP: active ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500',
                                    Revisão: active ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-orange-600 border-orange-300 hover:border-orange-400',
                                    Restrição: active ? 'bg-red-500 text-white border-red-500' : 'bg-white text-red-600 border-red-300 hover:border-red-400',
                                    Novo: active ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-blue-600 border-blue-300 hover:border-blue-400',
                                };
                                return (
                                    <button
                                        key={tipo}
                                        type="button"
                                        onClick={() => setTipoFilter(prev =>
                                            prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
                                        )}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all select-none ${colors[tipo]}`}
                                    >
                                        {tipo}
                                    </button>
                                );
                            })}
                            {tipoFilter.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setTipoFilter([])}
                                    className="px-2 py-1.5 rounded-lg text-xs font-medium border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 transition-all"
                                    title="Limpar filtro de tipo"
                                >
                                    ✕ Limpar
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="md:col-span-2 flex gap-2">
                        <button
                            type="submit"
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors flex items-center justify-center gap-2"
                        >
                            <Search className="h-4 w-4" />
                            Filtrar
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadExcel}
                            className="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 font-medium rounded-lg text-sm px-3 py-2.5 transition-colors flex items-center justify-center"
                            title="Exportar Excel (todos os filtros)"
                        >
                            <FileSpreadsheet className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadLaserExport}
                            className="bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 font-medium rounded-lg text-sm px-3 py-2.5 transition-colors flex items-center justify-center"
                            title="Exportar OS Corte Laser (MO0013) — filtre por pedido específico"
                        >
                            <Scissors className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Toggle pendentes */}
                    <div className="md:col-span-6 flex flex-col gap-1 mt-1 bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={filters.only_active === 'true'}
                                    onChange={(e) => setFilters(prev => ({ ...prev, only_active: e.target.checked ? 'true' : 'false' }))}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                <span className="ml-3 text-sm font-medium text-gray-700">Apenas Pendentes (Filtro Pesado)</span>
                            </label>
                            <span className="text-[10px] text-gray-400 italic flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Desative para uma busca muito mais rápida.
                            </span>
                        </div>
                        <div className="text-[10px] text-gray-400 italic">
                            Datas do filtro = <span className="font-semibold text-gray-500">Entrada/Emissão do pedido</span> (Protheus).
                            {tipoFilter.length > 0 && <span className="ml-2 text-indigo-500 font-semibold">Tipo ativo: {tipoFilter.join(', ')} ({filteredOrders.length} itens)</span>}
                        </div>
                    </div>
                </form>
            </div>

            {/* Table */}
            <div className="overflow-x-scroll min-h-[400px] print:overflow-visible print:min-h-0">
                <table className="w-full text-sm text-left text-gray-500 print:w-full">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-3 py-3 w-10 print:hidden">
                                <input
                                    type="checkbox"
                                    title="Selecionar todos"
                                    checked={filteredOrders.length > 0 && selectedItems.size === filteredOrders.length}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                                />
                            </th>
                            {visibleCols.map(col => (
                                <th
                                    key={col.key}
                                    className={`px-4 py-3 font-semibold whitespace-nowrap ${col.key === 'acoes' ? 'print:hidden text-center' : ''} ${['qtd_entregue', 'saldo', 'quantidade', 'qtd_pcp', 'valor_unitario', 'valor_total'].includes(col.key) ? 'text-right' : ''} ${['emissao', 'op', 'c6_xrevm', 'tipo', 'item', 'status', 'lib_producao', 'entrega', 'data_pcp'].includes(col.key) ? 'text-center' : ''}`}
                                >
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr>
                                <td colSpan={visibleCols.length} className="px-6 py-12 text-center">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
                                        <span className="text-gray-400 font-medium">Carregando dados...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : error ? (
                            <tr>
                                <td colSpan={visibleCols.length} className="px-6 py-12 text-center text-red-500">
                                    <div className="flex flex-col items-center gap-2">
                                        <AlertCircle className="h-8 w-8" />
                                        <span className="font-semibold">{error}</span>
                                    </div>
                                </td>
                            </tr>
                        ) : filteredOrders.length === 0 ? (
                            <tr>
                                <td colSpan={visibleCols.length} className="px-6 py-12 text-center text-gray-400">
                                    Nenhum registro encontrado com estes filtros.
                                </td>
                            </tr>
                        ) : (
                            filteredOrders.map((item, idx) => {
                                const itemKey = `${item.pedido}-${item.item}`;
                                const isSelected = selectedItems.has(itemKey);
                                return (
                                    <tr
                                        key={`${item.pedido}-${item.item}-${idx}`}
                                        className={`transition-colors border-b border-gray-50 last:border-0 ${
                                            isSelected
                                                ? 'bg-indigo-50 hover:bg-indigo-100/70'
                                                : parseFloat(item.qtd_faturar) <= 0
                                                    ? 'bg-green-50/40 hover:bg-green-100/50 opacity-80'
                                                    : 'bg-white hover:bg-slate-50'
                                        }`}
                                    >
                                        <td className="px-3 py-2 print:hidden">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleItemSelection(itemKey)}
                                                onClick={e => e.stopPropagation()}
                                                className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
                                            />
                                        </td>
                                        {visibleCols.map(col => (
                                            <td
                                                key={col.key}
                                                className={`px-4 py-2 ${col.key === 'acoes' ? 'text-center print:hidden' : ''} ${['qtd_entregue', 'saldo', 'quantidade', 'qtd_pcp'].includes(col.key) ? 'text-right' : ''} ${['emissao', 'op', 'c6_xrevm', 'tipo', 'item', 'status', 'lib_producao', 'entrega', 'ref_cliente', 'rev_cliente', 'data_pcp'].includes(col.key) ? 'text-center' : ''}`}
                                            >
                                                {renderCell(col.key, item)}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {!loading && !error && orders.length > 0 && (
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between print:hidden">
                    <span className="text-sm text-gray-500">
                        Página <span className="font-semibold text-gray-900">{page}</span> de <span className="font-semibold text-gray-900">{totalPages}</span>
                        {tipoFilter.length > 0 && <span className="ml-2 text-xs text-indigo-600 font-medium">({filteredOrders.length} itens filtrados por: {tipoFilter.join(', ')})</span>}
                    </span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                            <ChevronLeft className="h-5 w-5 text-gray-600" />
                        </button>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                            <ChevronRight className="h-5 w-5 text-gray-600" />
                        </button>
                    </div>
                </div>
            )}

            {/* Column Settings Panel */}
            {showSettings && (
                <ColumnSettingsPanel
                    columns={colConfig}
                    onChange={setColConfig}
                    onClose={() => setShowSettings(false)}
                />
            )}

            {/* Modals */}
            {isDocsModalOpen && (
                <DocsModal
                    isOpen={isDocsModalOpen}
                    onClose={() => setIsDocsModalOpen(false)}
                    productCode={selectedProductForDocs.code}
                    productName={selectedProductForDocs.name}
                />
            )}
            {showImageModal && (
                <ProductImageModal
                    product={selectedProductForImage}
                    onClose={() => setShowImageModal(false)}
                    onSuccess={() => setShowImageModal(false)}
                />
            )}
            {notesTarget && (
                <NotesDrawer
                    isOpen={Boolean(notesTarget)}
                    onClose={() => setNotesTarget(null)}
                    orderId={notesTarget.order}
                    itemId={notesTarget.item}
                    productCode={notesTarget.product}
                />
            )}
            {engineeringTarget && (
                <EngineeringControlModal
                    isOpen={Boolean(engineeringTarget)}
                    onClose={() => setEngineeringTarget(null)}
                    orderId={engineeringTarget.orderId}
                    item={engineeringTarget.item}
                    onSave={handleSaveEngineeringControl}
                />
            )}
            {pcpForecastTarget && (
                <PCPForecastModal
                    isOpen={Boolean(pcpForecastTarget)}
                    onClose={() => setPcpForecastTarget(null)}
                    item={pcpForecastTarget}
                    onSaveSuccess={() => fetchData()}
                />
            )}
            {selectedInvoice && invoiceModalItem && (
                <InvoiceDetailsModal
                    isOpen={Boolean(selectedInvoice)}
                    onClose={() => { setSelectedInvoice(null); setInvoiceModalItem(null); }}
                    invoice={selectedInvoice}
                    item={invoiceModalItem}
                />
            )}
            {showReportModal && (
                <MeetingReportModal
                    isOpen={showReportModal}
                    onClose={() => setShowReportModal(false)}
                    globalFilters={filters}
                    isGlobal={isGlobalReport}
                />
            )}
            {pcpmetalOpen && (
                <PCPMetalDrawer
                    isOpen={pcpmetalOpen}
                    onClose={() => setPcpmetalOpen(false)}
                    context={pcpmetalContext}
                />
            )}
            {planModalTarget && (
                <EngineeringPlanModal
                    isOpen={Boolean(planModalTarget)}
                    onClose={() => setPlanModalTarget(null)}
                    pedido={planModalTarget.pedido}
                    item={planModalTarget.item}
                    currentDate={planModalTarget.currentDate}
                    currentObs={planModalTarget.currentObs}
                    onSave={(newData) => {
                        setOrders(prev => prev.map(o =>
                            (o.pedido === planModalTarget.pedido && o.item === planModalTarget.item)
                                ? { ...o, ...newData }
                                : o
                        ));
                    }}
                />
            )}

            {/* Batch Lote Modal */}
            {batchModalOpen && (
                <EngineeringControlModal
                    isOpen={batchModalOpen}
                    onClose={() => { setBatchModalOpen(false); setSelectedItems(new Set()); }}
                    batchItems={getSelectedItemsList()}
                    onSave={() => fetchData()}
                />
            )}

            {/* Floating Batch Action Bar */}
            {selectedItems.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 text-white pl-5 pr-3 py-3 rounded-2xl shadow-2xl border border-slate-700/50">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-xs font-bold">
                            {selectedItems.size}
                        </div>
                        <span className="text-sm font-medium">
                            {selectedItems.size === 1 ? 'item selecionado' : 'itens selecionados'}
                        </span>
                    </div>
                    <div className="w-px h-5 bg-slate-600" />
                    <button
                        onClick={() => setBatchModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-1.5 bg-indigo-500 hover:bg-indigo-400 rounded-xl text-sm font-bold transition-all shadow-md"
                    >
                        <Settings className="h-4 w-4" />
                        Controle de Engenharia em Lote
                    </button>
                    <button
                        onClick={() => setSelectedItems(new Set())}
                        className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors ml-1"
                        title="Limpar seleção"
                    >
                        <X className="h-4 w-4 text-slate-400" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default EngineeringOrdersPage;
