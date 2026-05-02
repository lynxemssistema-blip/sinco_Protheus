import React, { useState, useEffect, useRef } from 'react';
import {
    Calendar, Clock, CheckSquare, Search, Filter, AlertTriangle,
    ChevronDown, ChevronRight, MoreHorizontal, AlertOctagon, CheckCircle, List, Printer, FileText, HelpCircle
} from 'lucide-react';


import ProductionHistoryModal from '../components/ProductionHistoryModal';
import ProductionPrint from '../components/ProductionPrint';
import ProductionPlanningModal from '../components/ProductionPlanningModal';
import ProductionAppointmentModal from '../components/ProductionAppointmentModal';
import ProductionMacroModal from '../components/ProductionMacroModal';
import ProcessLegendModal from '../components/ProcessLegendModal';
import ErrorStateOverlay from '../components/ErrorStateOverlay';
import CurvaSPedido from './pcp/CurvaSPedido';
import api, { getProductionDashboard, saveProductionPlan, saveProductionPlanBatch, saveAppointment, getProductDocuments, getOperationById, getEstruturaProduto, getFileUrl, getCompanySettings, reportSystemError } from '../services/api';
import useStickyState from '../hooks/useStickyState';
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
        pending_delivery: true // Default: Only show items with balance to deliver
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
        const id = op.op + op.item_op;
        setSelectedOps(prev => prev.some(p => p.op + p.item_op === id)
            ? prev.filter(p => p.op + p.item_op !== id)
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

    useEffect(() => {
        // loadData(); // Lazy load: busca apenas quando o usuário utilizar os filtros
        getCompanySettings()
            .then(d => setAppointmentMode(d?.general_config?.production_appointment_mode || 'free'))
            .catch(() => setAppointmentMode('free'));
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

    const handlePlanSave = async (data) => {
        try {
            await saveProductionPlanBatch(data);
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
        await saveAppointment(data); // throws on validation error — modal handles display
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
    const handleMacroSaveBatch = async (plans) => {
        try {
            await saveProductionPlanBatch(plans);
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
                        <div className="flex items-center bg-white rounded-lg p-1 border shadow-sm">
                            <button
                                onClick={() => setCalcType('op_specific')}
                                className={`px-3 py-1 text-sm rounded-md transition-colors ${calcType === 'op_specific' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                Progresso por OP
                            </button>
                            <button
                                onClick={() => setCalcType('item_average')}
                                className={`px-3 py-1 text-sm rounded-md transition-colors ${calcType === 'item_average' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                Progresso por Item (Média)
                            </button>
                        </div>
                        <button onClick={() => setShowLegend(true)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-2">
                            <Filter className="w-4 h-4" />
                            Legenda de Processos
                        </button>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 shrink-0 flex flex-col gap-4">
                    {/* Linha 1: Campos básicos */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        <input type="text" placeholder="OP" value={filters.op} onChange={(e) => setFilters({ ...filters, op: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" onKeyPress={(e) => e.key === 'Enter' && handleSearch()} />
                        <input type="text" placeholder="Pedido" value={filters.pedido} onChange={(e) => setFilters({ ...filters, pedido: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" onKeyPress={(e) => e.key === 'Enter' && handleSearch()} />
                        <input type="text" placeholder="Item" value={filters.item} onChange={(e) => setFilters({ ...filters, item: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" onKeyPress={(e) => e.key === 'Enter' && handleSearch()} />
                        <input type="text" placeholder="Seq" value={filters.sequencia} onChange={(e) => setFilters({ ...filters, sequencia: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" onKeyPress={(e) => e.key === 'Enter' && handleSearch()} />
                        <input type="text" placeholder="Produto" value={filters.produto} onChange={(e) => setFilters({ ...filters, produto: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" onKeyPress={(e) => e.key === 'Enter' && handleSearch()} />
                        <input type="text" placeholder="Cliente" value={filters.cliente} onChange={(e) => setFilters({ ...filters, cliente: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" onKeyPress={(e) => e.key === 'Enter' && handleSearch()} />
                    </div>

                    {/* Linha 2: Operação e Planejado */}
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="flex flex-1 gap-2 relative">
                            <select
                                value={filters.setor || ''}
                                onChange={(e) => setFilters({ ...filters, setor: e.target.value })}
                                className="w-1/3 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 bg-white"
                            >
                                <option value="">Todos os Setores</option>
                                {sectors.map(s => (
                                    <option key={s.id} value={s.id}>{s.nome}</option>
                                ))}
                            </select>
                            <div className="w-2/3 relative">
                                <input type="text" placeholder="Operação ou Recurso (ex: 01, SOLDA)" value={filters.operacao || ''} onChange={(e) => setFilters({ ...filters, operacao: e.target.value })} className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" onKeyPress={(e) => e.key === 'Enter' && handleSearch()} />
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                            </div>
                        </div>
                        
                        <div className="flex items-center border border-slate-200 rounded-lg px-3 py-1 bg-slate-50 gap-2 shrink-0">
                            <Calendar className="w-4 h-4 text-slate-500" />
                            <span className="text-xs text-slate-600 font-medium uppercase tracking-wider">Planejado:</span>
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
                    </div>

                    {/* Linha 3: Status, Checkboxes, e Buscar */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-700 mr-2 flex items-center gap-1"><Filter className="w-3 h-3"/> Status:</span>
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
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={filters.pending_delivery}
                                    onChange={(e) => setFilters({ ...filters, pending_delivery: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                />
                                <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">
                                    Apenas Saldo a Entregar (Pendentes)
                                </span>
                            </label>

                            <div className="w-px h-6 bg-slate-200 hidden md:block"></div>

                            <button onClick={handleSearch} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm" disabled={loading}>
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
                        <button onClick={() => setActiveTab('curva_s')} className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'curva_s' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                            Curva S (Gráfico)
                            {activeTab === 'curva_s' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full"></div>}
                        </button>
                    </div>

                </div>

                <ErrorStateOverlay error={apiError} onRetry={loadData} />

                {!apiError && (activeTab === 'tabela' ? (
                    <>
                        {total > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-4 shrink-0 px-1">
                        <div className="text-sm font-medium text-slate-600">
                            {total} operação{total !== 1 ? 'ões' : ''} encontrada{total !== 1 ? 's' : ''}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(ops.reduce((acc, op) => {
                                const s = getOpStatus(op).text;
                                acc[s] = (acc[s] || 0) + Number(op.qtd_planejada_op || 0);
                                return acc;
                            }, {})).map(([status, qty]) => (
                                <div key={status} className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1 rounded-lg shadow-sm">
                                    <span className="text-xs text-slate-500 font-medium">{status}:</span>
                                    <span className="text-sm font-bold text-slate-800">{qty.toLocaleString('pt-BR')} <span className="text-[10px] font-normal text-slate-400">pçs</span></span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0">
                    {selectedOps.length > 0 && (
                        <div className="bg-blue-50 p-3 border-b border-blue-100 flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-800">
                                {selectedOps.length} ordens selecionadas
                            </span>
                            <button 
                                onClick={() => setPlanningOp(selectedOps)}
                                className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
                            >
                                <Calendar className="w-4 h-4" />
                                Planejar Lote
                            </button>
                        </div>
                    )}
                    <div ref={tableContainerRef} className="overflow-auto flex-1">
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
                                    <th className="p-3 text-center w-10">PDF</th>
                                    <th className="p-3">Recurso</th>
                                    <th className="p-3 text-center">Planejamento</th>
                                    <th className="p-3 text-center">Produção</th>
                                    <th className="p-3 text-center">Status</th>
                                    <th className="p-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                            {loading ? (
                                <tr><td colSpan="10" className="p-8 text-center text-slate-500">Carregando...</td></tr>
                            ) : ops.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="p-8 text-center text-slate-500">
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
                                                    checked={selectedOps.some(p => p.op === op.op && p.item_op === op.item_op)}
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
                                                        <Link to={`/estrutura/${encodeURIComponent(op.cod_produto_op.trim())}`} className="font-mono text-xs text-blue-600 font-semibold hover:underline" title="Ver Árvore do Produto (Estrutura/BOM)">
                                                            {op.cod_produto_op}
                                                        </Link>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-slate-500 truncate max-w-[250px]" title={op.desc_produto}>{op.desc_produto}</div>
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
                                                        <div className="text-red-700 font-medium">F: {new Date(op.data_planejada_fim).toLocaleDateString()}</div>
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
                                                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${status.color}`}>
                                                    {status.icon} {status.text}
                                                </div>
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <button onClick={() => {
                                                        const isSelected = selectedOps.some(s => s.op === op.op && s.item_op === op.item_op);
                                                        setPlanningOp(isSelected && selectedOps.length > 0 ? selectedOps : [op]);
                                                    }}
                                                        className="p-1.5 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm rounded text-slate-600 transition-all" title="Planejar Operação">
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
                        </tbody >
                    </table >
                </div >
            </div>



            {/* MODALS */}
                {
                    selectedOpHistory && (
                        <ProductionHistoryModal
                            opData={selectedOpHistory}
                            onClose={() => setSelectedOpHistory(null)}
                        />
                    )
                }
                {
                    planningOp && (
                        <ProductionPlanningModal
                            ops={planningOp}
                            onClose={() => setPlanningOp(null)}
                            onSave={handlePlanSave}
                        />
                    )
                }
                {
                    appointingOp && (
                        <ProductionAppointmentModal
                            op={appointingOp}
                            onClose={() => setAppointingOp(null)}
                            onSave={handleAppointmentSave}
                        />
                    )
                }
                {
                    macroModalOp && (
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
                    )
                }
                {
                    showLegend && (
                        <ProcessLegendModal
                            onClose={() => setShowLegend(false)}
                            onSelect={(code) => {
                                setFilters({ ...filters, operacao: code });
                                setShowLegend(false);
                            }}
                        />
                    )
                }
                </>
                ) : (
                    <CurvaSPedido filters={filters} />
                ))}
                
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

            {/* PRINT COMPONENT - Visible only when printing */}
            <div className="hidden print:block print:absolute print:top-0 print:left-0 print:w-full print:bg-white print:z-[9999]">
                <ProductionPrint ops={ops} filters={filters} />
            </div>
        </>
    );
}
