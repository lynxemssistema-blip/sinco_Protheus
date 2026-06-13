import React, { useState, useEffect } from 'react';
import { Search, List, CheckCircle, Clock, AlertTriangle, Calendar, Play, History, Filter, FileText, Printer } from 'lucide-react';
import { getProcessList, getVerticalProduction, getVerticalPendencies, saveAppointment, saveProductionPlanBatch, getFileUrl, getCompanySettings, reportSystemError } from '../services/api';
import { toast } from 'react-toastify';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ProductionAppointmentModal from '../components/ProductionAppointmentModal';
import ProductionHistoryModal from '../components/ProductionHistoryModal';
import RNCModal from '../components/RNCModal';
import ErrorStateOverlay from '../components/ErrorStateOverlay';
import useStickyState from '../hooks/useStickyState';
import { generateVerticalPendingPdf } from '../services/verticalPendingPdfGenerator';
import { useAuth } from '../contexts/AuthContext';

export default function VerticalAppointmentPage() {
    const { user } = useAuth();
    const [groupByResource, setGroupByResource] = useState(false);
    const [pageBreakPerGroup, setPageBreakPerGroup] = useState(false);
    const [operations, setOperations] = useState([]);
    const [selectedOp, setSelectedOp] = useStickyState('', '@metalfisa:vert_selectedOp');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState(null);
    const [wasSearched, setWasSearched] = useState(false);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ hasMore: false, total: 0, limit: 200 });

    // Filtros rápidos
    const [filterStatus, setFilterStatus] = useStickyState('ABERTOS', '@metalfisa:vert_statusFilter_v2');
    const [filters, setFilters] = useStickyState({
        op: '',
        pedido: '',
        produto: '',
        cliente: '',
        plan_inicio_de: '',
        plan_inicio_ate: ''
    }, '@metalfisa:vert_mainFilters_v4');

    const [appointingOp, setAppointingOp] = useState(null);
    const [historyTarget, setHistoryTarget] = useState(null);
    const [rncTarget, setRncTarget] = useState(null);
    const [appointmentMode, setAppointmentMode] = useState(null);

    // Estado local para datas de planejamento em edição
    const [draftPlans, setDraftPlans] = useState({});
    const [sortConfig, setSortConfig] = useState({ key: 'planejamento_inicio', direction: 'asc' });

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <span className="ml-1 opacity-0 group-hover:opacity-50">↕</span>;
        if (sortConfig.direction === 'asc') return <span className="ml-1">↑</span>;
        return <span className="ml-1">↓</span>;
    };

    useEffect(() => {
        loadOperations();
        getCompanySettings()
            .then(d => setAppointmentMode(d?.general_config?.production_appointment_mode || 'free'))
            .catch(() => setAppointmentMode('free'));
    }, []);

    const loadOperations = async () => {
        try {
            const list = await getProcessList();
            setOperations(Array.isArray(list) ? list : (list?.data || []));
        } catch (err) {
            console.error('Erro ao carregar operações', err);
        }
    };

    const loadData = async (showLoader = true, targetPage = page) => {
        if (!selectedOp) return;

        const hasFilter = filters.op || filters.pedido || filters.produto || filters.cliente || filters.plan_inicio_de || filters.plan_inicio_ate;
        if (!hasFilter) {
            setData([]);
            setWasSearched(false);
            if (showLoader) setLoading(false);
            return;
        }

        if (showLoader) { setLoading(true); setData([]); }
        setApiError(null);
        try {
            const params = { ...filters, page: targetPage, limit: 200 };
            Object.keys(params).forEach(key => !params[key] && delete params[key]);

            const result = await getVerticalProduction(selectedOp, params);
            const rows = result?.data ?? (Array.isArray(result) ? result : []);
            setData(rows);
            if (result?.pagination) setPagination(result.pagination);
            setWasSearched(true);
            setDraftPlans({});
        } catch (err) {
            console.error('Erro ao carregar fila vertical', err);
            setApiError(err.message || 'Erro desconhecido');
            reportSystemError('Apontamento Vertical', err, { op: selectedOp, ...filters });
        } finally {
            if (showLoader) setLoading(false);
        }
    };

    const handleSearch = () => {
        if (!selectedOp) {
            toast.warning('Selecione um Recurso antes de buscar.');
            return;
        }
        if (!filters.op && !filters.pedido && !filters.produto && !filters.cliente && !filters.plan_inicio_de && !filters.plan_inicio_ate) {
            toast.warning('Informe ao menos um filtro (OP, Pedido, Cliente, Produto ou Período) para buscar.');
            return;
        }
        setPage(1);
        loadData(true, 1);
    };

    const handlePageChange = (newPage) => {
        setPage(newPage);
        loadData(true, newPage);
    };


    const handlePlanChange = (opKey, dateStr) => {
        setDraftPlans(prev => ({ ...prev, [opKey]: dateStr }));
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
            // now
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
        setFilters(prev => ({ ...prev, plan_inicio_de: fmt(start), plan_inicio_ate: fmt(end) }));
    };

    const savePlan = async (row) => {
        const opKey = `${row.op}_${row.item_op}_${row.sequen_op}`;
        const newDate = draftPlans[opKey];
        if (!newDate) return;

        try {
            const planPayload = [{
                op_numero: row.op,
                op_item: row.item_op,
                op_sequencia: row.sequen_op,
                operacao_codigo: row.operacao_codigo,
                data_planejada_inicio: newDate,
                data_planejada_fim: newDate
            }];

            await saveProductionPlanBatch(planPayload);
            toast.success('Planejamento salvo com sucesso!');
            loadData(false);
        } catch (err) {
            console.error(err);
            toast.error('Erro ao salvar planejamento');
        }
    };

    const buildOpObj = (row) => ({
        op: row.op,
        item_op: row.item_op,
        sequen: row.sequen_op,
        operacao: row.operacao_codigo,
        operacao_coluna: row.operacao_codigo,
        recurso: row.operacao_codigo,
        cod_produto_op: row.produto,
        desc_produto: row.desc_produto,
        desc_operacao: row.operacao_desc || row.operacao_codigo,
        qtd_planejada_op: parseFloat(row.qtd_op) || 0,
        qtd_produzida_real: row.qtd_apontada || 0,
        pedido: row.pedido,
        item_pedido: row.item_pedido,
        cliente: row.cliente || row.nome_cliente,
    });

    const handleOpenAppointment = (row) => {
        setAppointingOp(buildOpObj(row));
    };

    const handleOpenHistory = (row) => {
        setHistoryTarget(buildOpObj(row));
    };

    const handleOpenRnc = (row) => {
        setRncTarget(buildOpObj(row));
    };

    const handleAppointmentSave = async (dataPayload) => {
        // API chamada movida para dentro do Modal
        setAppointingOp(null);
        loadData(false);
    };

    const handleGeneratePendingReport = async () => {
        if (!filters.op && !filters.pedido && !filters.produto && !filters.cliente && !filters.plan_inicio_de && !filters.plan_inicio_ate) {
            toast.warning('Informe ao menos um filtro para buscar pendências no relatório.');
            return;
        }

        try {
            toast.info('Gerando relatório...', { autoClose: 2000 });
            const params = { ...filters };
            Object.keys(params).forEach(key => !params[key] && delete params[key]);

            const pendencies = await getVerticalPendencies(params);

            if (!pendencies || pendencies.length === 0) {
                toast.warning('Não há operações pendentes no roteiro para os filtros atuais.');
                return;
            }

            generateVerticalPendingPdf(pendencies, filters, user, groupByResource, pageBreakPerGroup);

        } catch (err) {
            console.error('Erro ao gerar relatório de pendências', err);
            toast.error('Falha ao exportar PDF de Pendências.');
        }
    };

    const getStatusColor = (status) => {
        if (status === 'CONCLUIDO') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        if (status === 'PARCIAL') return 'bg-amber-100 text-amber-800 border-amber-200';
        return 'bg-rose-50 text-rose-600 border-rose-200';
    };

    const getStatusIcon = (status) => {
        if (status === 'CONCLUIDO') return <CheckCircle className="w-4 h-4" />;
        if (status === 'PARCIAL') return <Clock className="w-4 h-4" />;
        return <AlertTriangle className="w-4 h-4" />;
    };

    // Filter logic
    const filteredData = data.filter(row => {
        if (filterStatus === 'ABERTOS' && row.status === 'CONCLUIDO') return false;
        if (filterStatus !== 'ALL' && filterStatus !== 'ABERTOS' && row.status !== filterStatus) return false;
        return true;
    }).sort((a, b) => {
        if (sortConfig.key === 'planejamento_inicio') {
            const dateA = a.planejamento_inicio ? new Date(a.planejamento_inicio).getTime() : (sortConfig.direction === 'asc' ? Infinity : -Infinity);
            const dateB = b.planejamento_inicio ? new Date(b.planejamento_inicio).getTime() : (sortConfig.direction === 'asc' ? Infinity : -Infinity);
            if (dateA !== dateB) return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
            return a.op.localeCompare(b.op);
        }
        if (sortConfig.key === 'data_entrega') {
            const dateA = a.data_entrega ? new Date(a.data_entrega).getTime() : (sortConfig.direction === 'asc' ? Infinity : -Infinity);
            const dateB = b.data_entrega ? new Date(b.data_entrega).getTime() : (sortConfig.direction === 'asc' ? Infinity : -Infinity);
            return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
        }

        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key === 'progresso') {
            aVal = a.qtd_op > 0 ? (a.qtd_apontada / a.qtd_op) : 0;
            bVal = b.qtd_op > 0 ? (b.qtd_apontada / b.qtd_op) : 0;
        }

        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        if (typeof aVal === 'string') {
            return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <List className="w-7 h-7 text-blue-600" />
                        Fila de Produção por Setor (Vertical)
                    </h1>
                    <p className="text-sm text-slate-600 mt-1">Selecione uma operação para planejar e apontar a fila de trabalho.</p>
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

            <div className="bg-white rounded-lg shadow-sm border p-4 space-y-4">
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="w-full md:w-[350px]">
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center gap-2" title="Filtra por código de Recurso do roteiro (ex: MO0003). Cada recurso representa um setor ou máquina.">
                                <List className="w-3.5 h-3.5 text-blue-500" />
                                Recurso <span className="text-red-500">*</span>
                                <span className="text-[10px] font-normal text-slate-400 normal-case tracking-normal">(setor/máquina)</span>
                            </label>
                            <select
                                className="w-full border-2 border-slate-100 rounded-lg p-2.5 text-sm bg-slate-50 font-bold text-slate-800 focus:border-blue-500 focus:ring-0 transition-all cursor-pointer shadow-sm"
                                value={selectedOp}
                                onChange={(e) => setSelectedOp(e.target.value)}
                            >
                                <option value="">-- Selecione o Recurso --</option>
                                {operations.map((op, index) => (
                                    <option
                                        key={op.codigo || index}
                                        value={op.codigo}
                                    >
                                        {op.codigo}{op.descricao ? ` — ${op.descricao}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex-1 grid grid-cols-2 md:grid-cols-6 gap-3 bg-slate-50/50 p-3 rounded-xl border border-dashed border-slate-200">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">OP</label>
                                <input
                                    type="text"
                                    placeholder="Ex: 001234"
                                    value={filters.op}
                                    onChange={(e) => setFilters(prev => ({ ...prev, op: e.target.value.toUpperCase() }))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="w-full px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Pedido</label>
                                <input
                                    type="text"
                                    placeholder="PV..."
                                    value={filters.pedido}
                                    onChange={(e) => setFilters(prev => ({ ...prev, pedido: e.target.value.toUpperCase() }))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="w-full px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Produto</label>
                                <input
                                    type="text"
                                    placeholder="Nome/Código"
                                    value={filters.produto}
                                    onChange={(e) => setFilters(prev => ({ ...prev, produto: e.target.value.toUpperCase() }))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="w-full px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Cliente</label>
                                <input
                                    type="text"
                                    placeholder="Razão Social"
                                    value={filters.cliente}
                                    onChange={(e) => setFilters(prev => ({ ...prev, cliente: e.target.value.toUpperCase() }))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="w-full px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Plan. Início De</label>
                                <input
                                    type="date"
                                    value={filters.plan_inicio_de}
                                    onChange={(e) => setFilters(prev => ({ ...prev, plan_inicio_de: e.target.value }))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="w-full px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Plan. Início Até</label>
                                <input
                                    type="date"
                                    value={filters.plan_inicio_ate}
                                    onChange={(e) => setFilters(prev => ({ ...prev, plan_inicio_ate: e.target.value }))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    className="w-full px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm"
                                />
                            </div>
                            <div className="flex gap-2 justify-start col-span-2 md:col-span-6 w-full pt-1">
                                <button onClick={() => setDateShortcut('today')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors shadow-sm">Hoje</button>
                                <button onClick={() => setDateShortcut('this_week')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors shadow-sm">Semana</button>
                                <button onClick={() => setDateShortcut('next_week')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors shadow-sm">Próx. Sem.</button>
                                <button onClick={() => setDateShortcut('this_month')} className="text-[10px] uppercase font-bold text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-blue-50 transition-colors shadow-sm">Mês</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center pt-3 border-t gap-3">
                    <div className="flex gap-2 text-sm flex-wrap">
                        <button
                            onClick={() => setFilterStatus('ALL')}
                            className={`px-3 py-1 rounded-full border ${filterStatus === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setFilterStatus('ABERTOS')}
                            className={`px-3 py-1 rounded-full border border-blue-200 ${filterStatus === 'ABERTOS' ? 'bg-blue-100 text-blue-800 font-medium' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                        >
                            Em Aberto
                        </button>
                        <button
                            onClick={() => setFilterStatus('PENDENTE')}
                            className={`px-3 py-1 rounded-full border border-rose-200 ${filterStatus === 'PENDENTE' ? 'bg-rose-100 text-rose-800 font-medium' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                        >
                            Pendentes
                        </button>
                        <button
                            onClick={() => setFilterStatus('PARCIAL')}
                            className={`px-3 py-1 rounded-full border border-amber-200 ${filterStatus === 'PARCIAL' ? 'bg-amber-100 text-amber-800 font-medium' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                        >
                            Parciais
                        </button>
                        <button
                            onClick={() => setFilterStatus('CONCLUIDO')}
                            className={`px-3 py-1 rounded-full border border-emerald-200 ${filterStatus === 'CONCLUIDO' ? 'bg-emerald-100 text-emerald-800 font-medium' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                        >
                            Concluídos
                        </button>
                    </div>

                    <div className="flex gap-2 items-center w-full md:w-auto mt-2 md:mt-0">
                        <button
                            onClick={() => {
                                setFilters({ op: '', pedido: '', produto: '', cliente: '', plan_inicio_de: '', plan_inicio_ate: '' });
                                setFilterStatus('ABERTOS');
                                setData([]);
                                setWasSearched(false);
                                setPage(1);
                                setPagination({ hasMore: false, total: 0, limit: 200 });
                            }}
                            className="px-4 py-2 border rounded text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                        >
                            Limpar Filtros
                        </button>
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-50 px-3 py-2 rounded border cursor-pointer hover:bg-slate-100 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={groupByResource} 
                                onChange={(e) => {
                                    setGroupByResource(e.target.checked);
                                    if (!e.target.checked) setPageBreakPerGroup(false);
                                }}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            Agrupar por Operação
                        </label>
                        {groupByResource && (
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-50 px-3 py-2 rounded border cursor-pointer hover:bg-slate-100 transition-colors" title="Imprimir cada recurso em uma folha separada">
                                <input 
                                    type="checkbox" 
                                    checked={pageBreakPerGroup} 
                                    onChange={(e) => setPageBreakPerGroup(e.target.checked)}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                Folhas Individuais
                            </label>
                        )}
                        <button
                            onClick={handleGeneratePendingReport}
                            className="bg-slate-800 text-white px-4 py-2 rounded text-sm font-medium hover:bg-slate-900 transition-colors flex items-center justify-center gap-2 flex-1 md:flex-none"
                            title="Emitir PDF com as pendencias gerais ignorando o Centro de Custo atual"
                        >
                            <Printer className="w-4 h-4" />
                            Gerar Relatório
                        </button>
                        <button
                            onClick={handleSearch}
                            disabled={loading || !selectedOp}
                            className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 flex-1 md:flex-none"
                        >
                            <Filter className="w-4 h-4" />
                            Buscar
                        </button>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            <ErrorStateOverlay error={apiError} onRetry={loadData} />

            {/* Grid */}
            {!apiError && (loading ? (
                <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
                    <div className="animate-pulse text-slate-500 font-medium">Carregando fila de trabalho...</div>
                </div>
            ) : !selectedOp ? (
                <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
                            <List className="w-6 h-6 text-blue-500" />
                        </div>
                        <div className="font-semibold text-slate-700 text-base">Selecione um Recurso para começar</div>
                        <div className="text-sm text-slate-500">Escolha o setor/máquina no campo <strong>Recurso</strong> acima e clique em <strong>Buscar</strong>.</div>
                    </div>
                </div>
            ) : data.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-slate-500">
                    {wasSearched ? (
                        /* Buscou mas não achou nada — mostrar diagnóstico útil */
                        <>
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6 text-amber-500" />
                                </div>
                                <div className="font-semibold text-slate-700 text-base">Nenhuma operação encontrada para estes filtros</div>
                            </div>
                            <div className="mt-4 max-w-md mx-auto text-sm text-slate-500 space-y-2 text-left bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <p className="font-semibold text-amber-800 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" /> Possíveis causas:
                                </p>
                                <ul className="list-disc list-inside space-y-1.5 text-amber-700">
                                    <li>O produto do pedido/OP informado <strong>não passa pelo recurso <span className="font-mono">{selectedOp}</span></strong> em seu roteiro de fabricação (SG2010).</li>
                                    <li>O filtro <strong>PEDIDO</strong> deve conter o número do Pedido de Venda (ex: <span className="font-mono">003731</span>) — não o número da OP.</li>
                                    <li>O filtro <strong>OP</strong> deve conter o número da Ordem de Produção (ex: <span className="font-mono">005909</span>).</li>
                                    <li>O pedido pode estar <strong>inativo/arquivado</strong> no sistema.</li>
                                </ul>
                                <p className="text-amber-600 text-xs pt-1 border-t border-amber-200">💡 Dica: Verifique em qual setor/recurso esse produto é fabricado e selecione-o no campo Recurso.</p>
                            </div>
                        </>
                    ) : (
                        /* Ainda não buscou — instrução padrão */
                        <>
                            <div className="font-medium text-slate-700 text-base">Nenhuma operação em exibição</div>
                            <div className="text-sm mt-1 mb-2">Por questões de performance, a busca não é automática. <br />Verifique se selecionou um <strong>Centro de Custo</strong> e informou ao menos <strong>um Filtro</strong> para buscar.</div>
                        </>
                    )}
                </div>
            ) : filteredData.length > 0 ? (
                <div className="bg-white rounded-lg shadow-sm border overflow-hidden flex-1 flex flex-col min-h-0">
                    <div className="overflow-auto h-[calc(100vh-320px)]">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                <tr className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-50">
                                    <th className="p-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('op')}>
                                        <div className="flex items-center gap-1">Ordem de Produção {getSortIcon('op')}</div>
                                    </th>
                                    <th className="p-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('pedido')}>
                                        <div className="flex items-center gap-1">Pedido {getSortIcon('pedido')}</div>
                                    </th>
                                    <th className="p-3">Cliente</th>
                                    <th className="p-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('produto')}>
                                        <div className="flex items-center gap-1">Produto {getSortIcon('produto')}</div>
                                    </th>
                                    <th className="p-3 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('data_entrega')}>
                                        <div className="flex items-center justify-center gap-1">Entrega {getSortIcon('data_entrega')}</div>
                                    </th>
                                    <th className="p-3 text-center w-10">PDF</th>
                                    <th className="p-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('recurso_codigo')}>
                                        <div className="flex items-center gap-1">Recurso {getSortIcon('recurso_codigo')}</div>
                                    </th>
                                    <th className="p-3 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('planejamento_inicio')}>
                                        <div className="flex items-center justify-center gap-1">Planejamento {getSortIcon('planejamento_inicio')}</div>
                                    </th>
                                    <th className="p-3 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('progresso')}>
                                        <div className="flex items-center justify-center gap-1">Produção {getSortIcon('progresso')}</div>
                                    </th>
                                    <th className="p-3 text-center">Tempos</th>
                                    <th className="p-3 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('status')}>
                                        <div className="flex items-center justify-center gap-1">Status {getSortIcon('status')}</div>
                                    </th>
                                    <th className="p-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredData.map(row => {
                                    const opKey = `${row.op}_${row.item_op}_${row.sequen_op}`;
                                    const percent = row.qtd_op > 0 ? Math.min(100, Math.round((row.qtd_apontada / parseFloat(row.qtd_op)) * 100)) : 0;
                                    const draftDate = draftPlans[opKey] !== undefined ? draftPlans[opKey] : (row.planejamento_inicio ? row.planejamento_inicio.substring(0, 10) : '');

                                    return (
                                        <tr key={opKey} className={`border-b border-slate-100 transition-colors ${row.sequen_op === '001' ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-slate-50'}`}>
                                            {/* 1. Ordem de Produção */}
                                            <td className="p-3">
                                                <div className="font-mono text-sm font-bold text-slate-900">{row.op} - Item {row.item_op}</div>
                                                <div className="text-xs text-slate-400">Seq: {row.sequen_op}</div>
                                            </td>
                                            {/* 2. Pedido */}
                                            <td className="p-3">
                                                {row.pedido ? (
                                                    <div>
                                                        <div className="font-semibold text-slate-700">{row.pedido}</div>
                                                        {row.item_pedido && <div className="text-xs text-slate-500">{row.item_pedido}</div>}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">-</span>
                                                )}
                                            </td>
                                            {/* 3. Cliente */}
                                            <td className="p-3">
                                                <div className="font-medium text-slate-700 max-w-[180px] truncate" title={row.nome_cliente}>{row.nome_cliente || '-'}</div>
                                            </td>
                                            {/* 4. Produto */}
                                            <td className="p-3">
                                                <div className="font-mono text-xs text-blue-600 font-semibold" title={row.produto}>{row.produto}</div>
                                                <div className="text-xs text-slate-500 truncate max-w-[220px] mt-0.5" title={row.desc_produto}>{row.desc_produto}</div>
                                                {row.componente_buscado && (
                                                    <div className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                        ⤷ {row.componente_buscado}
                                                    </div>
                                                )}
                                            </td>
                                            {/* 5. Entrega */}
                                            <td className="p-3 text-center">
                                                {row.data_entrega ? (
                                                    <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded whitespace-nowrap">
                                                        {new Date(row.data_entrega).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 text-xs">—</span>
                                                )}
                                            </td>
                                            {/* 6. PDF */}
                                            <td className="p-3 text-center">
                                                {row.tem_arquivos ? (
                                                    <div className="relative group flex justify-center">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (row.arquivos && row.arquivos.length === 1) {
                                                                    window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(row.arquivos[0].url_arquivo)}`), '_blank');
                                                                } else if (row.primeiro_arquivo && (!row.arquivos || row.arquivos.length === 0)) {
                                                                    window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(row.primeiro_arquivo)}`), '_blank');
                                                                }
                                                            }}
                                                            className="relative p-1 rounded hover:bg-red-50 transition-colors"
                                                            title={row.arquivos && row.arquivos.length > 1 ? 'Ver Arquivos' : 'Ver Desenho / PDF'}
                                                        >
                                                            <FileText className="w-4 h-4 text-red-500" />
                                                            {row.arquivos && row.arquivos.length > 1 && (
                                                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full shadow-sm ring-1 ring-white">
                                                                    {row.arquivos.length}
                                                                </span>
                                                            )}
                                                        </button>
                                                        {row.arquivos && row.arquivos.length > 1 && (
                                                            <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 flex flex-col p-1.5 gap-0.5">
                                                                <div className="px-2 py-1.5 border-b border-slate-100 mb-1">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Arquivos do Produto</span>
                                                                </div>
                                                                {row.arquivos.filter(arq => arq.url_arquivo && arq.url_arquivo.trim() !== '').map((arq, idx) => {
                                                                    const extMatch = (arq.url_arquivo || '').match(/\.([a-zA-Z0-9]+)$/);
                                                                    const ext = extMatch ? extMatch[1].toUpperCase() : 'DOC';
                                                                    let typeColor = 'bg-slate-100 text-slate-500';
                                                                    if (ext === 'PDF') typeColor = 'bg-red-100 text-red-600 border-red-200';
                                                                    else if (ext === 'DXF') typeColor = 'bg-blue-100 text-blue-600 border-blue-200';
                                                                    else if (ext === 'DWG') typeColor = 'bg-emerald-100 text-emerald-600 border-emerald-200';
                                                                    else if (ext === 'STEP' || ext === 'STP') typeColor = 'bg-indigo-100 text-indigo-600 border-indigo-200';
                                                                    const fileName = arq.titulo || `Arquivo ${idx + 1}`;
                                                                    return (
                                                                        <button key={idx} onClick={(e) => { e.stopPropagation(); window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(arq.url_arquivo)}`), '_blank'); }} className="text-left px-2 py-1.5 hover:bg-slate-50 rounded-md transition-colors flex flex-col group/item border border-transparent hover:border-slate-200" title={fileName}>
                                                                            <div className="flex items-center justify-between w-full">
                                                                                <span className="text-xs font-bold text-slate-700 group-hover/item:text-blue-600">{arq.tipo || 'Desenho'}</span>
                                                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${typeColor}`}>{ext}</span>
                                                                            </div>
                                                                            <span className="text-[10px] text-slate-400 truncate w-full mt-0.5">{fileName}</span>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <FileText className="w-4 h-4 text-slate-300 mx-auto" title="Sem PDF associado" />
                                                )}
                                            </td>
                                            {/* 7. Recurso */}
                                            <td className="p-3">
                                                <div className="bg-blue-50 text-blue-700 inline-block px-2 py-0.5 rounded text-xs font-bold border border-blue-100 mb-1">
                                                    {row.recurso_codigo || row.operacao_codigo}
                                                </div>
                                                <div className="text-xs text-slate-600 truncate max-w-[140px]" title={row.operacao_desc}>{row.operacao_desc}</div>
                                            </td>
                                            {/* 8. Planejamento */}
                                            <td className="p-3 text-center">
                                                {row.planejamento_inicio ? (
                                                    <div className="text-xs flex flex-col items-center gap-0.5">
                                                        <div className="text-green-700 font-medium whitespace-nowrap">
                                                            I: {row.planejamento_inicio.substring(0, 10).split('-').reverse().join('/')}
                                                        </div>
                                                        {row.dias_espera > 0 && (
                                                            <div className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-bold border border-amber-200" title="Dias aguardando entre recursos">
                                                                Espera: {row.dias_espera}d
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic text-xs">Não planejado</span>
                                                )}
                                                {row.ultima_data_apontamento && (
                                                    <div className="mt-1.5 text-[10px] text-slate-500 leading-tight border-t border-slate-100 pt-1.5">
                                                        <div className="text-slate-400 uppercase tracking-wider mb-0.5" style={{ fontSize: '9px' }}>Último Apontamento:</div>
                                                        <div className="font-semibold text-slate-600 truncate max-w-[130px]" title={row.usuarios_apontamento}>
                                                            {row.usuarios_apontamento?.split(',')[0]}
                                                        </div>
                                                        <div>{new Date(row.ultima_data_apontamento).toLocaleDateString('pt-BR')} às {new Date(row.ultima_data_apontamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                                                    </div>
                                                )}
                                            </td>
                                            {/* 9. Produção */}
                                            <td className="p-3 text-center">
                                                <div className="flex flex-col items-center justify-center">
                                                    <div
                                                        className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer mb-1 hover:underline"
                                                        title="Clique para ver histórico detalhado"
                                                        onClick={() => handleOpenHistory(row)}
                                                    >
                                                        {row.qtd_apontada} / {parseFloat(row.qtd_op).toFixed(0)}
                                                    </div>
                                                    <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                        <div className={`h-full ${percent === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${percent}%` }} />
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5">({percent}%)</div>
                                                </div>
                                            </td>
                                            {/* 10. Tempos */}
                                            <td className="p-3 text-center">
                                                <div className="flex flex-col items-center justify-center gap-1">
                                                    <div className="text-[10px] text-slate-500 font-bold uppercase" title="Tempo Padrão Unitário">
                                                        Unid: {row.tempad > 0 ? `${Number(row.tempad).toFixed(3).replace('.', ',')} min` : '-'}
                                                    </div>
                                                    <div className="text-xs text-indigo-700 font-bold" title="Tempo Total Pendente (Unitário x Saldo + Setup)">
                                                        Total: {row.tempad > 0 ? `${Number((row.tempad * Math.max(0, parseFloat(row.qtd_op) - row.qtd_apontada)) + (row.qtd_apontada === 0 ? (row.setup || 0) : 0)).toFixed(2).replace('.', ',')} min` : '-'}
                                                    </div>
                                                </div>
                                            </td>
                                            {/* 11. Status */}
                                            <td className="p-3 text-center">
                                                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border ${getStatusColor(row.status)}`}>
                                                    {getStatusIcon(row.status)}
                                                    <span>{row.status}</span>
                                                </div>
                                                {row.tem_pendencia_conferencia && (
                                                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                                        <Clock className="w-3 h-3" />
                                                        Conf. Pendente
                                                    </div>
                                                )}
                                            </td>
                                            {/* 12. Ações */}
                                            <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenHistory(row)}
                                                        className="text-sm font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1.5 rounded border border-slate-200 hover:border-indigo-200 transition-colors flex items-center gap-1.5"
                                                        title="Ver histórico de apontamentos"
                                                    >
                                                        <History className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenRnc(row)}
                                                        className="text-sm font-bold text-slate-500 hover:text-amber-600 hover:bg-amber-50 px-2 py-1.5 rounded border border-slate-200 hover:border-amber-200 transition-colors flex items-center gap-1.5"
                                                        title="Registro de Não-Conformidade (RNC)"
                                                    >
                                                        <AlertTriangle className="w-3.5 h-3.5" /> RNC
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenAppointment(row)}
                                                        className={`text-sm font-bold px-3 py-1.5 rounded shadow-sm transition-colors flex items-center justify-center gap-1.5 ${row.status === 'CONCLUIDO' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                                                        style={{ minWidth: '100px' }}
                                                    >
                                                        <Play className="w-3.5 h-3.5 fill-current" />
                                                        APONTAR
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                <tr>
                                    <td colSpan="8" className="px-4 py-3 text-right font-bold text-slate-700">
                                        TOTAL GERAL (Exibidos na Tela):
                                    </td>
                                    <td className="px-4 py-3 font-bold text-slate-800">
                                        {filteredData.reduce((acc, row) => acc + parseFloat(row.qtd_op || 0), 0).toFixed(2)} Plan. / {filteredData.reduce((acc, row) => acc + parseFloat(row.qtd_apontada || 0), 0).toFixed(2)} Apont.
                                    </td>
                                    <td colSpan="3" />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    {/* Paginação */}
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50 text-sm">
                        <div className="text-slate-600">
                            {pagination.hasMore ? (
                                <span>
                                    Mostrando <strong>{filteredData.length}</strong> de <strong>200+</strong> resultados (pág. {page})
                                    <span className="ml-2 text-amber-600 font-medium">— use filtros para refinar</span>
                                </span>
                            ) : (
                                <span>
                                    {pagination.total != null
                                        ? <><strong>{filteredData.length}</strong> resultado(s)</>
                                        : <><strong>{filteredData.length}</strong> resultado(s)</>}
                                    {page > 1 && <span className="ml-1 text-slate-400">(pág. {page})</span>}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={page <= 1 || loading}
                                onClick={() => handlePageChange(page - 1)}
                                className="px-3 py-1.5 border rounded text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                ← Anterior
                            </button>
                            <span className="px-3 py-1.5 bg-white border rounded font-medium text-slate-700">Pág. {page}</span>
                            <button
                                disabled={!pagination.hasMore || loading}
                                onClick={() => handlePageChange(page + 1)}
                                className="px-3 py-1.5 border rounded text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Próximo →
                            </button>
                        </div>
                    </div>
                </div>
            ) : null)}

            {/* Modals reutilizados da Matrix */}
            {appointingOp && (
                <ProductionAppointmentModal
                    op={appointingOp}
                    onClose={() => setAppointingOp(null)}
                    onSave={handleAppointmentSave}
                />
            )}

            {historyTarget && (
                <ProductionHistoryModal
                    opData={historyTarget}
                    onClose={() => setHistoryTarget(null)}
                />
            )}

            {rncTarget && (
                <RNCModal
                    op={rncTarget}
                    onClose={() => setRncTarget(null)}
                />
            )}
        </div>
    );
}
