import React, { useState, useEffect, useRef } from 'react';
import {
    Calendar, Clock, CheckSquare, Search, Filter, AlertTriangle,
    ChevronDown, ChevronRight, MoreHorizontal, AlertOctagon, CheckCircle, List, Printer, FileText, HelpCircle,
    Maximize2, Minimize2, Zap, Bot
} from 'lucide-react';


import ProductionHistoryModal from '../components/ProductionHistoryModal';
import ProductionPrint from '../components/ProductionPrint';
import ProductionPlanningModal from '../components/ProductionPlanningModal';
import ProductionAppointmentModal from '../components/ProductionAppointmentModal';
import ProductionMacroModal from '../components/ProductionMacroModal';
import ProcessLegendModal from '../components/ProcessLegendModal';
import PCPMetalDrawer from '../components/PCPMetalDrawer';
import PlanejamentoInteligenteModal from '../components/PlanejamentoInteligenteModal';
import ErrorStateOverlay from '../components/ErrorStateOverlay';
import CurvaSPedido from './pcp/CurvaSPedido';
import EvolucaoApontamentosView from './pcp/EvolucaoApontamentosView';
import PlanningAuditPanel from '../components/PlanningAuditPanel';
import ResumoPlanejamentoView from '../components/ResumoPlanejamentoView';
import ConsolidadoView from '../components/ConsolidadoView';
import api, { getProductionDashboard, saveProductionPlan, saveProductionPlanBatch, saveAppointment, getProductDocuments, getOperationById, getEstruturaProduto, getFileUrl, getCompanySettings, reportSystemError, getResourceCapacities } from '../services/api';
import useStickyState from '../hooks/useStickyState';
import { generateProductionControlPdf } from '../services/productionControlPdfGenerator';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';

// ... (other imports)

export default function ProductionControl() {
    const [ops, setOps] = useStickyState([], '@metalfisa:prod_control_ops');
    const [total, setTotal] = useStickyState(0, '@metalfisa:prod_control_total');
    const [selectedOpHistory, setSelectedOpHistory] = useState(null);
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState(null);
    const [planningOp, setPlanningOp] = useState(null);
    const [appointingOp, setAppointingOp] = useState(null);
    const [appointmentMode, setAppointmentMode] = useState(null);
    const [macroModalOp, setMacroModalOp] = useState(null);
    const [macroOperations, setMacroOperations] = useState([]);
    const [loadingMacro, setLoadingMacro] = useState(false);
    const [showLegend, setShowLegend] = useState(false);
    const [calcType, setCalcType] = useStickyState('op_specific', '@metalfisa:prod_calcType');
    const [isCargaFullscreen, setIsCargaFullscreen] = useState(false);
    const [isEvolutionFullscreen, setIsEvolutionFullscreen] = useState(false);
    const [isTabelaFullscreen, setIsTabelaFullscreen] = useState(false);

    // PCPMetal AI Drawer State
    const [pcpmetalOpen, setPcpmetalOpen] = useState(false);
    const [pcpmetalContext, setPcpmetalContext] = useState({});
    
    // Planejamento Inteligente State
    const [smartPlannerOpen, setSmartPlannerOpen] = useState(false);
    const [smartPlannerOps, setSmartPlannerOps] = useState([]);
    const [loadingAllOps, setLoadingAllOps] = useState(false);
    const [showSmartPlanMenu, setShowSmartPlanMenu] = useState(false);
    const smartPlanMenuRef = useRef(null);

    // Fecha o menu ao clicar fora
    useEffect(() => {
        if (!showSmartPlanMenu) return;
        const close = () => setShowSmartPlanMenu(false);
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [showSmartPlanMenu]);

    const handleOpenSmartPlannerWithSelected = () => {
        if (!selectedOps || selectedOps.length === 0) {
            toast.warning('Selecione pelo menos uma OP na tabela primeiro.');
            return;
        }
        setSmartPlannerOps(selectedOps);
        setSmartPlannerOpen(true);
        setShowSmartPlanMenu(false);
    };

    const handleOpenSmartPlannerWithAll = async () => {
        setShowSmartPlanMenu(false);
        setLoadingAllOps(true);
        try {
            // Busca todas as OPs ativas do banco (pending_delivery = com saldo pendente)
            const res = await getProductionDashboard({ pending_delivery: true, limit: 5000 });
            const allOps = res.data || [];
            if (allOps.length === 0) {
                toast.info('Nenhuma OP ativa com saldo pendente encontrada no banco.');
                return;
            }
            // Deduplica por OP número (o FCS trabalha por OP, não por linha de roteiro)
            const uniqueOps = Object.values(
                allOps.reduce((acc, op) => {
                    if (!acc[op.op]) acc[op.op] = op;
                    return acc;
                }, {})
            );
            toast.info(`${uniqueOps.length} OPs ativas carregadas do banco.`);
            setSmartPlannerOps(uniqueOps);
            setSmartPlannerOpen(true);
        } catch (err) {
            console.error('Erro ao carregar todas as OPs:', err);
            toast.error('Falha ao buscar OPs do banco.');
        } finally {
            setLoadingAllOps(false);
        }
    };

    const STATUS_OPTIONS = [
        { value: 'in_progress', label: 'Em Andamento', color: 'text-blue-700 bg-blue-100 border-blue-300' },
        { value: 'done', label: 'Concluídos', color: 'text-green-700 bg-green-100 border-green-300' },
        { value: 'waiting,planned', label: 'Não Iniciados', color: 'text-slate-700 bg-slate-100 border-slate-300' },
        { value: 'late_start,late_delivery', label: 'Atrasadas', color: 'text-red-700 bg-red-100 border-red-300' }
    ];

    const [filters, setFilters] = useStickyState({
        op: '',
        pedido: '',
        item: '',
        sequencia: '',
        produto: '',
        cliente: '',
        operacao: '',
        status: [],
        pending_delivery: true, // Default: Only show items with balance to deliver
        date_filter_type: 'inicio'
    }, '@metalfisa:prod_filters');

    // Migrate stale/invalid status values from localStorage
    useEffect(() => {
        if (typeof filters.status === 'string') {
            const arr = filters.status && filters.status !== 'TODOS' ? [filters.status] : [];
            setFilters(prev => ({ ...prev, status: arr }));
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleStatus = (val) => {
        setFilters(prev => {
            const currentStatus = Array.isArray(prev.status) ? prev.status : [];
            if (currentStatus.includes(val)) {
                return { ...prev, status: currentStatus.filter(s => s !== val) };
            } else {
                return { ...prev, status: [...currentStatus, val] };
            }
        });
    };


    const getWeekStart = (date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    };

    const setDateShortcut = (type) => {
        const now = new Date();
        let start = new Date(now);
        let end = new Date(now);

        const fmt = (d) => {
            const yr = d.getFullYear();
            const mo = String(d.getMonth() + 1).padStart(2, '0');
            const da = String(d.getDate()).padStart(2, '0');
            return `${yr}-${mo}-${da}`;
        };

        if (type === 'today') {
            // start and end are already now
        } else if (type === 'this_week') {
            start = getWeekStart(now);
            end = new Date(start);
            end.setDate(end.getDate() + 6);
        } else if (type === 'next_week') {
            start = getWeekStart(now);
            start.setDate(start.getDate() + 7);
            end = new Date(start);
            end.setDate(end.getDate() + 6);
        } else if (type === 'this_month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }
        setFilters(prev => ({ ...prev, planned_date_start: fmt(start), planned_date_end: fmt(end) }));
    };

    const [sortConfig, setSortConfig] = useStickyState(null, '@metalfisa:prod_sortConfig');
    // Map of cod_produto_op -> { hasDoc: bool, url: string|null }
    const [productDocs, setProductDocs] = useState({});
    const [expandedRows, setExpandedRows] = useState({});
    const [estruturaCache, setEstruturaCache] = useState({});

    const sortOps = (opsToSort) => {
        if (!sortConfig) return opsToSort;

        return [...opsToSort].sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (a[sortConfig.key] > b[sortConfig.key]) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });
    };

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const [sectors, setSectors] = useState([]);
    const [activeTab, setActiveTab] = useStickyState('tabela', '@metalfisa:prod_activeTab');
    const abortControllerRef = useRef(null);
    const tableContainerRef = useRef(null);
    const [visibleCount, setVisibleCount] = useState(100);
    const [selectedOps, setSelectedOps] = useState([]);

    const toggleOpSelection = (op) => {
        const id = `${op.op}|${op.item_op}|${op.sequen}|${op.operacao}`;
        setSelectedOps(prev => prev.some(p => `${p.op}|${p.item_op}|${p.sequen}|${p.operacao}` === id)
            ? prev.filter(p => `${p.op}|${p.item_op}|${p.sequen}|${p.operacao}` !== id)
            : [...prev, op]);
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedOps(ops);
        } else {
            setSelectedOps([]);
        }
    };

    useEffect(() => {
        api.get('/pcp-setores')
            .then(res => setSectors(res.data.filter(s => s.ativo)))
            .catch(err => console.error('Erro ao buscar setores:', err));
    }, []);

    const loadData = async () => {

        // Cancel any in-flight request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        
        const currentAbortController = new AbortController();
        abortControllerRef.current = currentAbortController;

        setLoading(true);
        setApiError(null);
        try {
            const params = { ...filters, limit: 5000 };
            
            // For status array, join it into a single string for backend if needed, 
            if (Array.isArray(params.status) && params.status.length > 0) {
                params.status = params.status.join(',');
            }

            Object.keys(params).forEach(key => {
                if (params[key] === '' || (Array.isArray(params[key]) && params[key].length === 0) || params[key] === 'TODOS') {
                    delete params[key];
                }
            });

            const res = await getProductionDashboard(params, currentAbortController.signal);
            
            // Only update state if this request wasn't aborted by a newer one
            if (abortControllerRef.current === currentAbortController) {
                setOps(res.data);
                setVisibleCount(100);
                setTotal(res.total);
            }
        } catch (error) {
            if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') {
                return; // aborted
            }
            console.error(error);
            setApiError(error.message || 'Erro desconhecido');
            reportSystemError('Controle de Produção', error, filters);
        } finally {
            if (abortControllerRef.current === currentAbortController) {
                setLoading(false);
            }
        }
    };

    const [capacities, setCapacities] = useState({});

    useEffect(() => {
        // loadData(); // Lazy load: busca apenas quando o usuário utilizar os filtros
        getCompanySettings()
            .then(d => setAppointmentMode(d?.general_config?.production_appointment_mode || 'free'))
            .catch(() => setAppointmentMode('free'));
            
        getResourceCapacities()
            .then(d => setCapacities(d || {}))
            .catch(err => console.error('Erro ao buscar capacidades:', err));
    }, []);

    // Fetch PDF docs for all visible products (background, cached)
    useEffect(() => {
        if (!ops || ops.length === 0) return;
        const uniqueCodes = [...new Set(ops.map(o => o.cod_produto_op).filter(Boolean))];
        const toFetch = uniqueCodes.filter(c => !(c in productDocs));
        if (toFetch.length === 0) return;

        // Mark as loading to avoid duplicate fetches
        setProductDocs(prev => {
            const next = { ...prev };
            toFetch.forEach(c => { if (!(c in next)) next[c] = null; });
            return next;
        });

        toFetch.forEach(async (codigo) => {
            try {
                const docs = await getProductDocuments(codigo);
                const drawing = Array.isArray(docs) ? docs.find(d => d.tipo === 'Desenho' || d.tipo === 'PDF') || docs[0] : null;
                setProductDocs(prev => ({
                    ...prev,
                    [codigo]: drawing ? { hasDoc: true, url: drawing.url_arquivo || drawing.caminho || null } : { hasDoc: false, url: null }
                }));
            } catch {
                setProductDocs(prev => ({ ...prev, [codigo]: { hasDoc: false, url: null } }));
            }
        });
    }, [ops]);

    // Infinite scroll for performance
    useEffect(() => {
        const handleScroll = () => {
            if (tableContainerRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = tableContainerRef.current;
                if (scrollTop + clientHeight >= scrollHeight - 300) {
                    setVisibleCount(prev => Math.min(prev + 100, ops.length));
                }
            }
        };
        const el = tableContainerRef.current;
        if (el) el.addEventListener('scroll', handleScroll);
        return () => {
            if (el) el.removeEventListener('scroll', handleScroll);
        };
    }, [ops.length]);

    const handleSearch = () => {
        if (!filters.op && !filters.pedido && !filters.item && !filters.produto && !filters.cliente && !filters.operacao && !filters.planned_date_start && !filters.planned_date_end) {
            toast.warning('Por favor, preencha ao menos um filtro antes de buscar.');
            return;
        }
        loadData();
    };

    const handlePlanSave = async (plans, observacao) => {
        try {
            await saveProductionPlanBatch(plans, observacao);
            setPlanningOp(null);
            setSelectedOps([]); // Clear selection after planning
            loadData();
        } catch (err) {
            console.error(err);
            alert('Erro ao salvar planejamento em lote');
        }
    };

    // Refresh single operation after appointment (incremental update)
    const refreshOperation = async (op) => {
        try {
            // Build composite ID: OP|ITEM|SEQUEN|OPERACAO
            const opId = `${op.op}|${op.item_op}|${op.sequen}|${op.operacao}`;
            console.log(`🔄 [REFRESH] Fetching updated operation: ${opId}`);

            const updatedOp = await getOperationById(opId);

            // Update state: replace only the specific operation
            setOps(prevOps => prevOps.map(o =>
                (o.op === op.op && o.item_op === op.item_op && o.sequen === op.sequen && o.operacao === op.operacao)
                    ? updatedOp
                    : o
            ));

            console.log(`✅ [REFRESH] Operation updated successfully`);
        } catch (err) {
            console.error(`⚠️ [REFRESH] Failed to refresh operation, falling back to full reload`, err);
            // Fallback: if incremental fails, reload everything
            loadData();
        }
    };

    const handleAppointmentSave = async (data) => {
        // API chamada movida para o Modal
        setAppointingOp(null);
        if (appointingOp) {
            await refreshOperation(appointingOp);
        } else {
            loadData();
        }
    };

    const handleOpenMacro = async (clickedOp) => {
        try {
            setLoadingMacro(true);
            
            let opsToFetch = [clickedOp.op];
            const isSelected = selectedOps.some(s => s.op === clickedOp.op && s.item_op === clickedOp.item_op);
            if (isSelected && selectedOps.length > 0) {
                opsToFetch = [...new Set(selectedOps.map(s => s.op))];
            }

            console.log('🔍 [MACRO] Loading all operations for OPs:', opsToFetch);
            // Request with high limit to get ALL operations for these OPs
            const res = await getProductionDashboard({ op: opsToFetch.join(','), limit: 5000 });
            console.log('✅ [MACRO] Loaded', res.data.length, 'operations');
            console.log('📊 [MACRO] Unique operation codes:', [...new Set(res.data.map(o => o.operacao))]);
            
            setMacroOperations(res.data);
            setMacroModalOp(opsToFetch.length > 1 ? { op: `LOTE (${opsToFetch.length} OPs)` } : clickedOp);
        } catch (err) {
            console.error('❌ [MACRO] Error loading operations:', err);
            alert('Erro ao carregar operações');
        } finally {
            setLoadingMacro(false);
        }
    };


    const toggleEstrutura = async (codProduto, rowKey) => {
        // Toggle off
        if (expandedRows[rowKey]) {
            setExpandedRows(prev => ({ ...prev, [rowKey]: false }));
            return;
        }
        // Toggle on
        setExpandedRows(prev => ({ ...prev, [rowKey]: true }));
        // Fetch if not cached
        if (!estruturaCache[codProduto]) {
            try {
                const data = await getEstruturaProduto(codProduto);
                setEstruturaCache(prev => ({ ...prev, [codProduto]: data }));
            } catch {
                setEstruturaCache(prev => ({ ...prev, [codProduto]: [] }));
            }
        }
    };
    const handleMacroSaveBatch = async (plans, observacao, modo_calculo, preferencias) => {
        try {
            await saveProductionPlanBatch(plans, observacao, modo_calculo, preferencias);
        } catch (err) {
            console.error(err);
            throw err;
        }
    };

    const getOpStatus = (op) => {
        const now = new Date();
        const start = op.data_planejada_inicio ? new Date(op.data_planejada_inicio) : null;
        let end = op.data_planejada_fim ? new Date(op.data_planejada_fim) : null;
        if (end) end.setHours(23, 59, 59, 999);

        const done = Number(op.qtd_produzida_real) >= Number(op.qtd_planejada_op);
        const started = Number(op.qtd_produzida_real) > 0;

        if (done) return { text: 'Concluída', icon: <CheckCircle className="w-3 h-3" />, color: 'bg-green-100 text-green-700 border border-green-300' };
        if (end && now > end) return { text: 'Atrasada (Entrega)', icon: <AlertOctagon className="w-3 h-3" />, color: 'bg-red-100 text-red-700 border border-red-300' };
        if (start && now > start && !started) return { text: 'Atrasada (Início)', icon: <AlertTriangle className="w-3 h-3" />, color: 'bg-orange-100 text-orange-700 border border-orange-300' };
        if (started) return { text: 'Em Andamento', icon: <Clock className="w-3 h-3" />, color: 'bg-blue-100 text-blue-700 border border-blue-300' };
        if (start && end) return { text: 'Planejada', icon: <Calendar className="w-3 h-3" />, color: 'bg-slate-100 text-slate-700 border border-slate-300' };
        return { text: 'Aguardando', icon: <Clock className="w-3 h-3" />, color: 'bg-gray-100 text-gray-600 border border-gray-300' };
    };

    const calculateProgress = (op) => {
        if (calcType === 'op_specific') {
            const planned = Number(op.qtd_planejada_op);
            const produced = Number(op.qtd_produzida_real);
            if (planned === 0) return 0;
            return Math.min(100, (produced / planned) * 100);
        } else if (calcType === 'item_average') {
            // This mode assumes 'op' might have a 'percentual_item' or similar
            // If not, we'd need to group OPs by item and calculate average here.
            // For now, let's assume 'op.percentual_item' is available from the backend
            // or we'd need to fetch/calculate all OPs for the item.
            // As per the instruction, the backend already provides 'percentual_item'.
            return op.percentual_item || 0;
        }
        return 0;
    };

    return (
        <>
            {loading && (
                <div className="fixed inset-0 z-[9999] bg-slate-900/30 backdrop-blur-sm flex items-center justify-center pointer-events-auto transition-opacity duration-200">
                    <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-blue-600"></div>
                        <span className="text-sm font-semibold text-slate-700">Processando pesquisa...</span>
                    </div>
                </div>
            )}
            <div className={`flex flex-col h-[calc(100vh-100px)] space-y-4 transition-opacity duration-200 ${loading ? 'pointer-events-none opacity-50' : ''}`}>
                <div className="flex justify-between items-center shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Controle de Produção</h1>
                        <p className="text-slate-500">Planejamento e Apontamento de OPs</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => {
                                setPcpmetalContext({ page: 'controle-producao', modulo: 'Controle de Produção', action: 'Geral' });
                                setPcpmetalOpen(true);
                            }}
                            className="flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg font-bold hover:bg-indigo-200 transition-colors"
                            title="Conversar com Agente PCPMetal"
                        >
                            <Zap className="w-5 h-5" />
                            PCPMetal AI
                        </button>
                        {/* Botão Planejamento Inteligente com dropdown */}
                        <div className="relative" ref={smartPlanMenuRef}>
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowSmartPlanMenu(v => !v); }}
                                disabled={loadingAllOps}
                                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60"
                                title="Motor FCS (Capacidade Finita): replaneja OPs não executadas do passado, ordena por data de entrega PCP (mais urgente primeiro) e aloca capacidade a partir da data informada. Itens sem data de entrega vão para o final da fila."
                            >
                                {loadingAllOps
                                    ? <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />Carregando...</>
                                    : <><Bot className="w-5 h-5" />Planejamento Inteligente<ChevronDown className="w-4 h-4 ml-1" /></>
                                }
                            </button>

                            {showSmartPlanMenu && (
                                <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                                    <button
                                        onClick={handleOpenSmartPlannerWithSelected}
                                        disabled={selectedOps.length === 0}
                                        className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed flex flex-col gap-0.5 border-b border-slate-100"
                                    >
                                        <span className="flex items-center gap-2"><CheckSquare className="w-4 h-4 text-blue-600" />Usar OPs Selecionadas</span>
                                        <span className="text-xs text-slate-400 font-normal ml-6">{selectedOps.length} OP(s) marcadas · ordenadas por entrega PCP</span>
                                    </button>
                                    <button
                                        onClick={handleOpenSmartPlannerWithAll}
                                        className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-indigo-50 flex flex-col gap-0.5"
                                    >
                                        <span className="flex items-center gap-2"><MoreHorizontal className="w-4 h-4 text-indigo-600" />Todas do Banco</span>
                                        <span className="text-xs text-slate-400 font-normal ml-6">Inclui OPs ativas + replaneja pendentes do passado · prioridade por data de entrega PCP</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        {appointmentMode && (
                            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                                appointmentMode === 'sequence' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                appointmentMode === 'balance'  ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                                  'bg-slate-100 text-slate-500 border-slate-300'
                            }`}>
                                Apontamento: {appointmentMode === 'sequence' ? 'Sequencia' :
                                              appointmentMode === 'balance'  ? 'Saldo' : 'Livre'}
                            </span>
                        )}
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 shrink-0 flex flex-col gap-4">
                    {/* Linha 1: Campos básicos */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        <input type="text" placeholder="OP (Exato, Sep. vírgula)" value={filters.op} onChange={(e) => setFilters({ ...filters, op: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" onKeyPress={(e) => e.key === 'Enter' && handleSearch()} title="Digite o número exato da OP. Para múltiplas, separe com vírgula." />
                        <input type="text" placeholder="Pedido (Exato)" value={filters.pedido} onChange={(e) => setFilters({ ...filters, pedido: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" onKeyPress={(e) => e.key === 'Enter' && handleSearch()} title="Digite o número exato do Pedido." />
                        <input type="text" placeholder="Item (Sep. vírgula)" value={filters.item} onChange={(e) => setFilters({ ...filters, item: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" onKeyPress={(e) => e.key === 'Enter' && handleSearch()} title="Digite o item do pedido. Para múltiplos, separe com vírgula. Ex: 01,02" />
                        <input type="text" placeholder="Seq" value={filters.sequencia} onChange={(e) => setFilters({ ...filters, sequencia: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" onKeyPress={(e) => e.key === 'Enter' && handleSearch()} />
                        <input type="text" placeholder="Produto (Exato)" value={filters.produto} onChange={(e) => setFilters({ ...filters, produto: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" onKeyPress={(e) => e.key === 'Enter' && handleSearch()} title="Digite o código exato do Produto." />
                        <input type="text" placeholder="Cliente" value={filters.cliente} onChange={(e) => setFilters({ ...filters, cliente: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" onKeyPress={(e) => e.key === 'Enter' && handleSearch()} />
                    </div>

                    {/* Linha 2: Operação e Planejado */}
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="flex flex-1 gap-2 relative">
                            {/* TEMPORARIAMENTE DESABILITADO — filtro por setor sem dados suficientes */}
                            <select
                                disabled
                                value=""
                                className="w-1/3 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-400 opacity-40 cursor-not-allowed"
                                title="Filtro por setor temporariamente desabilitado"
                            >
                                <option value="">Todos os Setores</option>
                            </select>
                            <div className="w-2/3 flex gap-2">
                                <div className="relative flex-1">
                                    <input type="text" placeholder="Operação ou Recurso (ex: 01, SOLDA)" value={filters.operacao || ''} onChange={(e) => setFilters({ ...filters, operacao: e.target.value })} className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" onKeyPress={(e) => e.key === 'Enter' && handleSearch()} />
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                </div>
                                <button onClick={() => setShowLegend(true)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-2 text-sm whitespace-nowrap" title="Ver legenda de processos">
                                    <Filter className="w-4 h-4" />
                                    Legenda de Processos
                                </button>
                            </div>
                        </div>
                        

                        <div className="flex flex-col gap-1 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 shrink-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <Calendar className="w-4 h-4 text-slate-500" />
                                <select
                                    value={filters.date_filter_type || 'inicio'}
                                    onChange={(e) => setFilters({ ...filters, date_filter_type: e.target.value })}
                                    className="px-2 py-1 border border-slate-200 rounded bg-white text-xs text-slate-700 font-bold outline-none focus:border-blue-500 transition-all cursor-pointer mr-1"
                                >
                                    <option value="inicio">Início Planejado</option>
                                    <option value="fim">Fim Planejado</option>
                                    <option value="intersection">Intersecção Período</option>
                                </select>
                                <input 
                                    type="date" 
                                    value={filters.planned_date_start || ''} 
                                    onChange={(e) => setFilters({ ...filters, planned_date_start: e.target.value })} 
                                    className="px-2 py-1 border border-slate-200 rounded bg-white text-sm text-slate-700 outline-none focus:border-blue-500 transition-all" 
                                />
                                <span className="text-slate-400 text-sm">até</span>
                                <input 
                                    type="date" 
                                    value={filters.planned_date_end || ''} 
                                    onChange={(e) => setFilters({ ...filters, planned_date_end: e.target.value })} 
                                    className="px-2 py-1 border border-slate-200 rounded bg-white text-sm text-slate-700 outline-none focus:border-blue-500 transition-all" 
                                />
                            </div>
                            <div className="flex gap-2 justify-center pt-1">
                                <button onClick={() => setDateShortcut('today')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors">Hoje</button>
                                <button onClick={() => setDateShortcut('this_week')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors">Semana</button>
                                <button onClick={() => setDateShortcut('next_week')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors">Próx. Sem.</button>
                                <button onClick={() => setDateShortcut('this_month')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors">Mês</button>
                            </div>
                        </div>
                    </div>

                    {/* Linha 3: Status + filtro de pendentes + Buscar */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1 flex items-center gap-1"><Filter className="w-3 h-3"/> Status:</span>
                            {STATUS_OPTIONS.map(opt => {
                                const isSelected = Array.isArray(filters.status) && filters.status.includes(opt.value);
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => toggleStatus(opt.value)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                                            isSelected
                                            ? opt.color
                                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}

                            {/* Toggle pill: Pendentes — ao lado dos status pills, mais natural */}
                            <button
                                onClick={() => setFilters(prev => ({ ...prev, pending_delivery: !prev.pending_delivery }))}
                                title="Exibe apenas OPs com quantidade de produção abaixo do previsto"
                                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                                    filters.pending_delivery
                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                Com saldo pendente
                            </button>
                        </div>


                        <div className="flex gap-2">
                            <button
                                onClick={() => setFilters(prev => ({ ...prev, status: [], planned_date_start: '', planned_date_end: '' }))}
                                className="px-3 py-2 bg-slate-100 text-slate-600 font-semibold rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1.5 text-sm shrink-0"
                                title="Limpar filtros de status e datas"
                            >
                                Limpar Filtros
                            </button>
                            <button onClick={async () => {
                                if (!ops || ops.length === 0) {
                                    toast.warning('Faça uma busca primeiro para gerar o relatório.');
                                    return;
                                }
                                try {
                                    const filterTexts = [];
                                    if (filters.planned_date_start) filterTexts.push(`De: ${filters.planned_date_start}`);
                                    if (filters.planned_date_end) filterTexts.push(`Até: ${filters.planned_date_end}`);
                                    if (filters.operacao) filterTexts.push(`Recurso: ${filters.operacao}`);
                                    
                                    await generateProductionControlPdf(ops, filterTexts);
                                    toast.success('Relatório gerado com sucesso!');
                                } catch (e) {
                                    toast.error('Erro ao gerar PDF');
                                }
                            }} className="px-4 py-2 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-900 transition-colors flex items-center gap-2 shadow-sm shrink-0" title="Imprimir Relatório (Separado por Recurso)">
                                <Printer className="w-4 h-4" />
                                Relatório
                            </button>
                            <button onClick={handleSearch} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm shrink-0" disabled={loading}>
                                <Search className="w-4 h-4" />
                                {loading ? 'Buscando...' : 'Buscar'}
                            </button>
                        </div>
                    </div>

                    <div className="flex border-b border-slate-200 mt-4 px-1 gap-6">
                        <button onClick={() => setActiveTab('tabela')} className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'tabela' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                            Tabela de Operações
                            {activeTab === 'tabela' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full"></div>}
                        </button>
                        <button onClick={() => setActiveTab('carga_recursos')} className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'carga_recursos' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                            Carga de Recursos
                            {activeTab === 'carga_recursos' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full"></div>}
                        </button>
                        <button onClick={() => setActiveTab('evolucao')} className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'evolucao' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                            Evolução de Apontamentos
                            {activeTab === 'evolucao' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full"></div>}
                        </button>
                        <button onClick={() => setActiveTab('curva_s')} className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'curva_s' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                            Curva S (Gráfico)
                            {activeTab === 'curva_s' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full"></div>}
                        </button>
                        <button onClick={() => setActiveTab('auditoria')} className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'auditoria' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                            Auditoria de Planejamento
                            {activeTab === 'auditoria' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full"></div>}
                        </button>
                        <button onClick={() => setActiveTab('resumo_pedidos')} className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'resumo_pedidos' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                            Resumo por Pedido
                            {activeTab === 'resumo_pedidos' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full"></div>}
                        </button>
                        <button onClick={() => setActiveTab('consolidado_produto')} className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'consolidado_produto' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                            Consolidado por Produto
                            {activeTab === 'consolidado_produto' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full"></div>}
                        </button>
                    </div>

                </div>

                {/* Aviso quando filtros de status estão ativos: OPs sem planejamento ficam ocultas */}
                {Array.isArray(filters.status) && filters.status.length > 0 && (
                    <div className="mx-4 mt-2 mb-1 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-700 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                            <strong>Filtro de status ativo:</strong> OPs sem planejamento de datas ficam ocultas.
                            {' '}Clique em <strong>Limpar Filtros</strong> ou desmarque os filtros de status para ver todas as OPs.
                        </span>
                    </div>
                )}

                <ErrorStateOverlay error={apiError} onRetry={loadData} />

                {!apiError && (activeTab === 'tabela' ? (
                    <div className={`flex flex-col transition-all duration-300 ${
                        isTabelaFullscreen
                            ? 'fixed inset-0 z-[9999] bg-white p-4 overflow-hidden flex'
                            : 'flex-1 min-h-0 flex flex-col'
                    }`}>
                        {/* Barra de contagem + ação de lote — compacta e contextual */}
                        <div className="flex items-center justify-between gap-3 shrink-0 px-1 py-1">
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-500 font-medium">
                                    {total > 0
                                        ? `${total} ${total !== 1 ? 'operações' : 'operação'} encontrada${total !== 1 ? 's' : ''}`
                                        : 'Nenhum resultado'}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                {selectedOps.length > 0 && (
                                    <>
                                        <span className="text-xs text-slate-600 font-medium">
                                            <strong className="text-blue-700">{selectedOps.length}</strong> OP{selectedOps.length !== 1 ? 's' : ''} selecionada{selectedOps.length !== 1 ? 's' : ''}
                                        </span>
                                        <button
                                            onClick={() => setPlanningOp(selectedOps)}
                                            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-sm"
                                            title="Abre o planejamento sequencial para as OPs selecionadas"
                                        >
                                            <Calendar className="w-3.5 h-3.5" />
                                            Sequenciar Planejamento
                                        </button>
                                        <button
                                            onClick={() => setSelectedOps([])}
                                            className="px-2 py-1.5 text-slate-500 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors border border-slate-200"
                                            title="Desmarcar todas"
                                        >
                                            Limpar
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={() => setIsTabelaFullscreen(!isTabelaFullscreen)}
                                    className="p-2 border border-slate-200 hover:bg-slate-100 hover:scale-105 active:scale-95 rounded-lg transition-all text-slate-600 bg-white flex items-center justify-center shadow-sm"
                                    title={isTabelaFullscreen ? 'Sair da Tela Inteira' : 'Ver em Tela Inteira'}
                                >
                                    {isTabelaFullscreen ? (
                                        <Minimize2 className="w-4 h-4" />
                                    ) : (
                                        <Maximize2 className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">
                            <div ref={tableContainerRef} className={`overflow-auto flex-1 ${isTabelaFullscreen ? 'h-full' : ''}`}>
                        <table className="w-full relative">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                <tr className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-50">
                                    <th className="p-3 w-10 text-center">
                                        <input type="checkbox" onChange={handleSelectAll} checked={selectedOps.length === ops.length && ops.length > 0} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                                    </th>
                                    <th className="p-3">Ordem de Produção</th>
                                    <th className="p-3">Pedido</th>
                                    <th className="p-3">Cliente</th>
                                    <th className="p-3">Produto</th>
                                    <th className="p-3 text-center">Entrega PCP</th>
                                    <th className="p-3 text-center w-10">PDF</th>
                                    <th className="p-3">Recurso</th>
                                    <th className="p-3 text-center">Planejamento</th>
                                    <th className="p-3 text-center">Produção</th>
                                    <th className="p-3 text-center">Tempos</th>
                                    <th className="p-3 text-center">Status</th>
                                    <th className="p-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                            {loading ? (
                                <tr><td colSpan="13" className="p-8 text-center text-slate-500">Carregando...</td></tr>
                            ) : ops.length === 0 ? (
                                <tr>
                                    <td colSpan="13" className="p-8 text-center text-slate-500">
                                        <div className="font-medium text-slate-700">Nenhuma operação encontrada</div>
                                        <div className="text-sm mt-1 text-slate-400">Ajuste os filtros ou clique em Buscar para carregar todas as OPs abertas.</div>
                                    </td>
                                </tr>
                            ) : (
                                sortOps(ops).slice(0, visibleCount).map((op, idx) => {
                                    const status = getOpStatus(op);
                                    const isPai = op.sequen === '001';
                                    return (
                                        <tr key={idx} className={`border-b border-slate-100 transition-colors ${isPai ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-slate-50'}`}>
                                            <td className="p-3 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedOps.some(p => p.op === op.op && p.item_op === op.item_op && p.sequen === op.sequen && p.operacao === op.operacao)}
                                                    onChange={() => toggleOpSelection(op)}
                                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" 
                                                />
                                            </td>
                                            <td className="p-3">
                                                <div className="font-mono text-sm font-bold text-slate-900">{op.op} - Item {op.item_op}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-semibold text-slate-700">{op.pedido_venda || '-'}</div>
                                                <div className="text-xs text-slate-500">{op.ped_cliente || '-'}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-medium text-slate-700 max-w-[200px] truncate" title={op.nome_cliente}>{op.nome_cliente || '-'}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <div>
                                                        <Link 
                                                            to={`/estrutura/${encodeURIComponent(op.cod_produto_op.trim())}`} 
                                                            state={{ from: location.pathname, pedido: op.pedido_venda, item: op.item_op }}
                                                            className="font-mono text-xs text-blue-600 font-semibold hover:underline" 
                                                            title="Ver Árvore do Produto (Estrutura/BOM)"
                                                        >
                                                            {op.cod_produto_op}
                                                        </Link>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-slate-500 truncate max-w-[250px]" title={op.desc_produto}>{op.desc_produto}</div>
                                            </td>
                                            {/* Entrega PCP */}
                                            <td className="p-3 text-center">
                                                {op.data_entrega_pcp ? (
                                                    <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded whitespace-nowrap">
                                                        {new Date(op.data_entrega_pcp).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 text-xs">—</span>
                                                )}
                                            </td>
                                            {/* PDF Column */}
                                            <td className="p-3 text-center">
                                                {(() => {
                                                    const docInfo = productDocs[op.cod_produto_op];
                                                    const hasDoc = docInfo?.hasDoc;
                                                    const url = docInfo?.url;
                                                    if (hasDoc && url) {
                                                        return (
                                                            <button
                                                                onClick={() => window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(url)}`), '_blank')}
                                                                className="p-1 rounded hover:bg-red-50 transition-colors"
                                                                title="Abrir Desenho/PDF"
                                                            >
                                                                <FileText className="w-4 h-4 text-red-500" />
                                                            </button>
                                                        );
                                                    }
                                                    return <FileText className="w-4 h-4 text-slate-300 mx-auto" title="Sem PDF associado" />;
                                                })()}
                                            </td>
                                            <td className="p-3">
                                                <div className="bg-blue-50 text-blue-700 inline-block px-2 py-0.5 rounded text-xs font-bold border border-blue-100 mb-1">
                                                    {op.recurso || op.operacao}
                                                </div>
                                                <div className="text-xs text-slate-600 truncate max-w-[150px]" title={op.desc_recurso || op.desc_operacao}>{op.desc_recurso || op.desc_operacao}</div>
                                            </td>
                                            <td className="p-3 text-center">
                                                {op.data_planejada_inicio ? (
                                                    <div className="text-xs">
                                                        <div className="text-green-700 font-medium">I: {new Date(op.data_planejada_inicio).toLocaleDateString()}</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic text-xs">Não planejado</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className="flex flex-col items-center justify-center">
                                                    <div
                                                        className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer mb-1 hover:underline"
                                                        title="Clique para ver histórico detalhado"
                                                        onClick={() => setSelectedOpHistory({
                                                            op: op.op,
                                                            item_op: op.item_op,
                                                            sequen: op.sequen,
                                                            operacao: op.operacao
                                                        })}
                                                    >
                                                        {Number(op.qtd_produzida_real).toFixed(0)} / {Number(op.qtd_planejada_op).toFixed(0)}
                                                    </div>
                                                    <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                        <div className={`h-full ${Number(op.qtd_produzida_real) >= Number(op.qtd_planejada_op) ? 'bg-green-500' : 'bg-blue-500'}`}
                                                            style={{ width: `${Math.min(100, (Number(op.qtd_produzida_real) / Number(op.qtd_planejada_op)) * 100)}%` }}></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className="flex flex-col items-center justify-center gap-1">
                                                    <div className="text-[10px] text-slate-500 font-bold uppercase" title="Tempo Padrão Unitário">
                                                        Unid: {op.tempad > 0 ? `${op.tempad.toFixed(2)} min` : '-'}
                                                    </div>
                                                    <div className="text-xs text-indigo-700 font-bold" title="Tempo Total Pendente (Unitário x Saldo + Setup)">
                                                        Total: {op.tempad > 0 ? `${((op.tempad * Math.max(0, Number(op.qtd_planejada_op) - Number(op.qtd_produzida_real))) + (Number(op.qtd_produzida_real) === 0 ? (op.setup || 0) : 0)).toFixed(0)} min` : '-'}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${status.color}`}>
                                                    {status.icon} {status.text}
                                                </div>
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <button onClick={() => {
                                                        setPlanningOp([op]);
                                                    }}
                                                        className="p-1.5 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm rounded text-slate-600 transition-all" title="Planejar Operação (Cascata)">
                                                        <Calendar className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleOpenMacro(op)}
                                                        className="p-1.5 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm rounded text-indigo-600 transition-all" title="Planejamento Macro (Toda OP)">
                                                        <List className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setAppointingOp(op)}
                                                        className="ml-1 px-2 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded shadow-sm flex items-center gap-1 text-xs" title="Apontar">
                                                        <CheckSquare className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr >
                                    );
                                })
                            )}
                            </tbody>
                            </table>
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'carga_recursos' ? (
                    <CargaRecursosView 
                        ops={ops} 
                        capacities={capacities}
                        isCargaFullscreen={isCargaFullscreen}
                        setIsCargaFullscreen={setIsCargaFullscreen}
                        onOpenHistory={(opData) => setSelectedOpHistory(opData)}
                        onOpenPlan={(opData) => setPlanningOp([opData])}
                        onOpenMacro={(opData) => handleOpenMacro(opData)}
                        onOpenAppointment={(opData) => setAppointingOp(opData)}
                        productDocs={productDocs || {}}
                        getFileUrl={getFileUrl}
                    />
                ) : activeTab === 'evolucao' ? (
                    <EvolucaoApontamentosView
                        globalFilters={filters}
                        isEvolutionFullscreen={isEvolutionFullscreen}
                        setIsEvolutionFullscreen={setIsEvolutionFullscreen}
                    />
                ) : activeTab === 'auditoria' ? (
                    <PlanningAuditPanel />
                ) : activeTab === 'resumo_pedidos' ? (
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-1">
                        <ResumoPlanejamentoView />
                    </div>
                ) : activeTab === 'consolidado_produto' ? (
                    <ConsolidadoView ops={ops} />
                ) : (
                    <CurvaSPedido filters={filters} />
                ))}


                {/* MODALS — global, independent of active tab */}
                {selectedOpHistory && (
                    <ProductionHistoryModal
                        opData={selectedOpHistory}
                        onClose={() => setSelectedOpHistory(null)}
                    />
                )}
                {planningOp && (
                    <ProductionPlanningModal
                        ops={planningOp}
                        onClose={() => setPlanningOp(null)}
                        onSave={handlePlanSave}
                    />
                )}
                {appointingOp && (
                    <ProductionAppointmentModal
                        op={appointingOp}
                        onClose={() => setAppointingOp(null)}
                        onSave={handleAppointmentSave}
                    />
                )}
                {macroModalOp && (
                    <ProductionMacroModal
                        op={macroModalOp}
                        operations={macroOperations}
                        onClose={(shouldRefresh = false) => {
                            setMacroModalOp(null);
                            setMacroOperations([]);
                            if (shouldRefresh) loadData();
                        }}
                        onSaveBatch={handleMacroSaveBatch}
                    />
                )}
                {showLegend && (
                    <ProcessLegendModal
                        onClose={() => setShowLegend(false)}
                        onSelect={(code) => {
                            setFilters({ ...filters, operacao: code });
                            setShowLegend(false);
                        }}
                    />
                )}

                {/* Full-screen Loading Overlay */}
                {(loading || loadingMacro) && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center pointer-events-auto transition-all">
                        <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200">
                            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                            <div className="text-slate-800 font-bold text-lg">
                                {loadingMacro ? 'Abrindo Planejamento Macro...' : 'Carregando Produção...'}
                            </div>
                            <div className="text-slate-500 text-sm">Aguarde enquanto processamos os dados.</div>
                        </div>
                    </div>
                )}

            </div>

            {pcpmetalOpen && (
                <PCPMetalDrawer
                    isOpen={pcpmetalOpen}
                    onClose={() => setPcpmetalOpen(false)}
                    context={pcpmetalContext}
                    pageData={{
                        ops,
                        selectedOps,
                        filters,
                        total
                    }}
                />
            )}

            {/* PRINT COMPONENT - Visible only when printing */}
            <div className="hidden print:block print:absolute print:top-0 print:left-0 print:w-full print:bg-white print:z-[9999]">
                <ProductionPrint ops={ops} filters={filters} />
            </div>

            <PlanejamentoInteligenteModal 
                isOpen={smartPlannerOpen}
                onClose={() => { setSmartPlannerOpen(false); setSmartPlannerOps([]); }}
                selectedOps={smartPlannerOps.length > 0 ? smartPlannerOps : selectedOps}
                onPlanSuccess={() => {
                    setSmartPlannerOpen(false);
                    setSmartPlannerOps([]);
                    setSelectedOps([]);
                    loadData();
                }}
            />
        </>
    );
}

function CargaRecursosView({
    ops,
    capacities,
    isCargaFullscreen,
    setIsCargaFullscreen,
    onOpenHistory,
    onOpenPlan,
    onOpenMacro,
    onOpenAppointment,
    productDocs,
    getFileUrl
}) {
    const [expandedResource, setExpandedResource] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Agrupamento e processamento dos dados em tempo real
    const resourceMap = {};
    
    // Iteramos por todas as OPs retornadas pelos filtros globais
    ops.forEach(op => {
        const resourceCode = (op.recurso || op.operacao || 'SEM_RECURSO').trim().toUpperCase();
        const resourceDesc = (op.desc_recurso || op.desc_operacao || 'Sem Recurso Definido').trim();
        const key = `${resourceCode}|${resourceDesc}`;

        if (!resourceMap[key]) {
            resourceMap[key] = {
                recurso: resourceCode,
                descricao: resourceDesc,
                totalOps: 0,
                qtdPlanejada: 0,
                qtdProduzida: 0,
                qtdPendente: 0,
                horasPendente: 0,
                operacoes: []
            };
        }

        const planned = Number(op.qtd_planejada_op) || 0;
        const produced = Number(op.qtd_produzida_real) || 0;
        
        // Regra de saldo pendente individual: para cada OP, o saldo é planejado - produzido (min 0)
        // Isso evita que a superprodução de uma OP mascare a pendência de outra no mesmo recurso
        const pending = Math.max(0, planned - produced);
        
        // Cálculo de horas pendentes
        const tempad = parseFloat(op.tempad) || 0;
        const setup = parseFloat(op.setup) || 0;
        
        // Se a OP está 100% nova, consideramos o setup. Se já produziu algo, o setup já foi pago (heurística simples)
        const activeSetup = produced === 0 ? setup : 0;
        
        let horasNecessariasOp = 0;
        if (tempad > 0) {
            horasNecessariasOp = activeSetup + (pending * tempad);
        } else {
            // Fallback se não tiver tempad do Protheus
            const fallbackCap = capacities?.[resourceCode];
            if (fallbackCap && fallbackCap.default_tempo_peca) {
                horasNecessariasOp = pending * fallbackCap.default_tempo_peca;
            }
        }

        resourceMap[key].totalOps += 1;
        resourceMap[key].qtdPlanejada += planned;
        resourceMap[key].qtdProduzida += produced;
        resourceMap[key].qtdPendente += pending;
        resourceMap[key].horasPendente += horasNecessariasOp;
        
        resourceMap[key].operacoes.push({
            ...op,
            qtdPendente: pending,
            horasNecessarias: horasNecessariasOp
        });
    });

    // Converter para array e filtrar por busca de texto
    let resources = Object.values(resourceMap);
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        resources = resources.filter(r => 
            r.recurso.toLowerCase().includes(q) || 
            r.descricao.toLowerCase().includes(q)
        );
    }

    // Ordenar pelo saldo de peças pendentes descrescente (maiores gargalos no topo)
    resources.sort((a, b) => b.qtdPendente - a.qtdPendente);

    const toggleExpandResource = (key) => {
        setExpandedResource(prev => prev === key ? null : key);
    };

    return (
        <div className={`flex flex-col bg-slate-50 border border-slate-200 rounded-xl overflow-hidden transition-all duration-300 ${
            isCargaFullscreen 
                ? 'fixed inset-0 z-[9999] p-6 bg-slate-50 overflow-auto' 
                : 'flex-1 min-h-0 mt-4'
        }`}>
            {/* Cabeçalho da Visão */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 border-b border-slate-200 bg-white">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-50 p-2.5 rounded-lg text-blue-600 border border-blue-100">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-900">Análise de Gargalos por Recurso</h2>
                        <p className="text-xs text-slate-500">Exibição global de carga planejada vs. apontada por recurso ordenado pelo maior gargalo pendente.</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {/* Input de Busca */}
                    <div className="relative flex-1 sm:w-64">
                        <input
                            type="text"
                            placeholder="Buscar recurso ou descrição..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all bg-slate-50 font-medium"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    </div>

                    {/* Botão Tela Cheia */}
                    <button
                        onClick={() => setIsCargaFullscreen(!isCargaFullscreen)}
                        className="p-2 border border-slate-200 hover:bg-slate-100 hover:scale-105 active:scale-95 rounded-lg transition-all text-slate-600 bg-white flex items-center justify-center shadow-sm"
                        title={isCargaFullscreen ? 'Sair da Tela Inteira' : 'Ver em Tela Inteira'}
                    >
                        {isCargaFullscreen ? (
                            <Minimize2 className="w-4.5 h-4.5" />
                        ) : (
                            <Maximize2 className="w-4.5 h-4.5" />
                        )}
                    </button>
                </div>
            </div>

            {/* Listagem de Recursos */}
            <div className="overflow-y-auto flex-1 p-4 space-y-3 min-h-[300px]">
                {resources.length === 0 ? (
                    <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400 font-semibold shadow-sm">
                        Nenhum recurso encontrado para os filtros selecionados.
                    </div>
                ) : (
                    resources.map(res => {
                        const key = `${res.recurso}|${res.descricao}`;
                        const isExpanded = expandedResource === key;
                        const pctEvolucao = res.qtdPlanejada > 0 ? Math.round((res.qtdProduzida / res.qtdPlanejada) * 100) : 0;
                        
                        // Determinar visual e criticidade do gargalo
                        let badgeClass = 'bg-slate-50 text-slate-700 border-slate-200';
                        if (res.qtdPendente > 500) {
                            badgeClass = 'bg-red-50 text-red-700 border-red-200';
                        } else if (res.qtdPendente > 100) {
                            badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                        } else if (res.qtdPendente > 0) {
                            badgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                        } else {
                            badgeClass = 'bg-green-50 text-green-700 border-green-200';
                        }

                        return (
                            <div key={key} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:border-slate-350 transition-all">
                                {/* Cabeçalho do Recurso */}
                                <div 
                                    className="p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                                    onClick={() => toggleExpandResource(key)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-1 rounded-md hover:bg-slate-100 transition-colors text-slate-500">
                                            {isExpanded ? (
                                                <ChevronDown className="w-4.5 h-4.5" />
                                            ) : (
                                                <ChevronRight className="w-4.5 h-4.5" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                                                    {res.recurso}
                                                </span>
                                                <h3 className="text-sm font-bold text-slate-800">{res.descricao}</h3>
                                            </div>
                                            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                                                <span>{res.totalOps} {res.totalOps === 1 ? 'operação ativa' : 'operações ativas'} agendada{res.totalOps === 1 ? '' : 's'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Métricas e Barra de Evolução */}
                                    <div className="flex flex-wrap items-center gap-4 sm:gap-6 w-full lg:w-auto mt-2 lg:mt-0 justify-between lg:justify-end">
                                        {/* Barra de Progresso Realizado */}
                                        <div className="flex flex-col w-36">
                                            <div className="flex justify-between text-[10px] text-slate-500 mb-1 font-bold">
                                                <span>Evolução</span>
                                                <span>{pctEvolucao}%</span>
                                            </div>
                                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                                                <div 
                                                    className={`h-full transition-all duration-300 ${pctEvolucao >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} 
                                                    style={{ width: `${Math.min(100, pctEvolucao)}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="text-center min-w-[70px]">
                                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Planejado</div>
                                            <div className="text-xs font-bold text-slate-700">{res.qtdPlanejada.toLocaleString()}</div>
                                        </div>

                                        <div className="text-center min-w-[70px]">
                                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Realizado</div>
                                            <div className="text-xs font-bold text-slate-700">{res.qtdProduzida.toLocaleString()}</div>
                                        </div>

                                        <div className={`text-center px-3.5 py-1.5 rounded-lg border min-w-[110px] ${badgeClass}`}>
                                            <div className="text-[9px] font-bold uppercase tracking-wider opacity-90">Saldo Pendente</div>
                                            <div className="text-sm font-extrabold">{res.qtdPendente.toLocaleString()}</div>
                                        </div>
                                        
                                        {/* Nova métrica: Ocupação e Carga (Gargalo real em tempo) */}
                                        <div className="text-center px-3.5 py-1.5 rounded-lg border bg-indigo-50 border-indigo-200 text-indigo-700 min-w-[110px]">
                                            <div className="text-[9px] font-bold uppercase tracking-wider opacity-90">Dias Estimados</div>
                                            <div className="text-sm font-extrabold">
                                                {capacities?.[res.recurso]?.horas_dia > 0 
                                                    ? (res.horasPendente / capacities[res.recurso].horas_dia).toFixed(1)
                                                    : '-'} d
                                            </div>
                                            <div className="text-[9px] font-medium opacity-80 mt-0.5">
                                                {res.horasPendente.toFixed(1)}h ttl / {capacities?.[res.recurso]?.horas_dia?.toFixed(1) || '?'}h dia
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Listagem detalhada das OPs vinculadas */}
                                {isExpanded && (
                                    <div className="border-t border-slate-200 bg-slate-50/30 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                                                    <tr>
                                                        <th className="p-2.5">OP - Seq</th>
                                                        <th className="p-2.5">Pedido / Cliente</th>
                                                        <th className="p-2.5">Produto</th>
                                                        <th className="p-2.5 text-center">Datas (Início / Fim)</th>
                                                        <th className="p-2.5 text-right">Planejado</th>
                                                        <th className="p-2.5 text-right">Apontado</th>
                                                        <th className="p-2.5 text-right">Saldo</th>
                                                        <th className="p-2.5 text-center">Status</th>
                                                        <th className="p-2.5 text-center">Ações</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {res.operacoes.map((op, idx) => {
                                                        const isDone = Number(op.qtd_produzida_real) >= Number(op.qtd_planejada_op);
                                                        const isStarted = Number(op.qtd_produzida_real) > 0;
                                                        const now = new Date();
                                                        const start = op.data_planejada_inicio ? new Date(op.data_planejada_inicio) : null;
                                                        const end = op.data_planejada_fim ? (() => { const d = new Date(op.data_planejada_fim); d.setHours(23,59,59,999); return d; })() : null;
                                                        
                                                        let statusText = 'Não Iniciada';
                                                        let statusClass = 'bg-slate-50 text-slate-600 border-slate-200';
                                                        
                                                        if (isDone) {
                                                            statusText = 'Concluído';
                                                            statusClass = 'bg-green-50 text-green-700 border-green-200';
                                                        } else if (end && now > end) {
                                                            statusText = 'Atraso Entrega';
                                                            statusClass = 'bg-red-50 text-red-700 border-red-200';
                                                        } else if (start && now > start && !isStarted) {
                                                            statusText = 'Atraso Início';
                                                            statusClass = 'bg-orange-50 text-orange-700 border-orange-200';
                                                        } else if (isStarted) {
                                                            statusText = 'Em Andamento';
                                                            statusClass = 'bg-blue-50 text-blue-700 border-blue-200';
                                                        } else if (start && end) {
                                                            statusText = 'Planejada';
                                                            statusClass = 'bg-slate-100 text-slate-700 border-slate-300';
                                                        }

                                                        const docInfo = productDocs[op.cod_produto_op];
                                                        const hasDoc = docInfo?.hasDoc;
                                                        const url = docInfo?.url;

                                                        return (
                                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                                <td className="p-2.5 font-mono font-bold text-slate-800">
                                                                    {op.op} - {op.item_op}
                                                                </td>
                                                                <td className="p-2.5">
                                                                    <div className="font-bold text-slate-700">{op.pedido_venda || '-'}</div>
                                                                    <div className="text-[10px] text-slate-400 truncate max-w-[140px]" title={op.nome_cliente}>{op.nome_cliente || '-'}</div>
                                                                </td>
                                                                <td className="p-2.5">
                                                                    <div className="font-mono font-semibold text-slate-700">{op.cod_produto_op}</div>
                                                                    <div className="text-[10px] text-slate-400 truncate max-w-[180px]" title={op.desc_produto}>{op.desc_produto}</div>
                                                                </td>
                                                                <td className="p-2.5 text-center whitespace-nowrap">
                                                                    {op.data_planejada_inicio ? (
                                                                        <div className="text-[10px] font-bold">
                                                                            <span className="text-green-600">{new Date(op.data_planejada_inicio).toLocaleDateString()}</span>
                                                                            <span className="text-slate-400 mx-1">/</span>
                                                                            <span className="text-red-500">{new Date(op.data_planejada_fim).toLocaleDateString()}</span>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-slate-400 italic text-[10px]">Não planejado</span>
                                                                    )}
                                                                </td>
                                                                <td className="p-2.5 text-right font-semibold text-slate-700">
                                                                    {Number(op.qtd_planejada_op).toLocaleString()}
                                                                </td>
                                                                <td className="p-2.5 text-right text-slate-600">
                                                                    {Number(op.qtd_produzida_real).toLocaleString()}
                                                                </td>
                                                                <td className={`p-2.5 text-right font-extrabold ${op.qtdPendente > 0 ? 'text-red-600 bg-red-50/20' : 'text-slate-500'}`}>
                                                                    {op.qtdPendente.toLocaleString()}
                                                                </td>
                                                                <td className="p-2.5 text-center">
                                                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border ${statusClass}`}>
                                                                        {statusText}
                                                                    </span>
                                                                </td>
                                                                <td className="p-2.5 text-center">
                                                                    <div className="flex justify-center gap-1.5">
                                                                        {hasDoc && url && (
                                                                            <button
                                                                                onClick={() => window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(url)}`), '_blank')}
                                                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-md hover:scale-110 active:scale-95 transition-all"
                                                                                title="Abrir Desenho/PDF"
                                                                            >
                                                                                <FileText className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        )}
                                                                        <button 
                                                                            onClick={() => onOpenPlan(op)}
                                                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-md hover:scale-110 active:scale-95 transition-all"
                                                                            title="Planejar Operação"
                                                                        >
                                                                            <Calendar className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => onOpenMacro(op)}
                                                                            className="p-1.5 text-slate-400 hover:text-blue-700 hover:bg-slate-100 rounded-md hover:scale-110 active:scale-95 transition-all"
                                                                            title="Planejamento Macro (Toda OP)"
                                                                        >
                                                                            <List className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => onOpenAppointment(op)}
                                                                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-md hover:scale-110 active:scale-95 transition-all"
                                                                            title="Apontar Produção"
                                                                        >
                                                                            <CheckSquare className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
