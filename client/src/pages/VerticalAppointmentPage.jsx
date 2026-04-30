import React, { useState, useEffect } from 'react';
import { Search, List, CheckCircle, Clock, AlertTriangle, Calendar, Play, History, Filter, FileText, Printer } from 'lucide-react';
import { getProcessList, getVerticalProduction, getVerticalPendencies, saveAppointment, saveProductionPlanBatch, getFileUrl, getCompanySettings } from '../services/api';
import { toast } from 'react-toastify';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ProductionAppointmentModal from '../components/ProductionAppointmentModal';
import ProductionHistoryModal from '../components/ProductionHistoryModal';
import useStickyState from '../hooks/useStickyState';
import { generateVerticalPendingPdf } from '../services/verticalPendingPdfGenerator';
import { useAuth } from '../contexts/AuthContext';

export default function VerticalAppointmentPage() {
    const { user } = useAuth();
    const [groupByResource, setGroupByResource] = useState(false);
    const [operations, setOperations] = useState([]);
    const [selectedOp, setSelectedOp] = useStickyState('', '@metalfisa:vert_selectedOp');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

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
    const [appointmentMode, setAppointmentMode] = useState(null);

    // Estado local para datas de planejamento em edição
    const [draftPlans, setDraftPlans] = useState({});

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

    const loadData = async (showLoader = true) => {
        if (!selectedOp) return;

        // Bloqueio de Performance
        if (!filters.op && !filters.pedido && !filters.produto && !filters.cliente && !filters.plan_inicio_de && !filters.plan_inicio_ate) {
            setData([]);
            if (showLoader) setLoading(false);
            return;
        }

        if (showLoader) setLoading(true);
        try {
            const params = { ...filters };
            Object.keys(params).forEach(key => !params[key] && delete params[key]);

            const result = await getVerticalProduction(selectedOp, params);
            setData(Array.isArray(result) ? result : (result?.data || []));
            setDraftPlans({});
        } catch (err) {
            console.error('Erro ao carregar fila vertical', err);
        } finally {
            if (showLoader) setLoading(false);
        }
    };

    const handleSearch = () => {
        if (!filters.op && !filters.pedido && !filters.produto && !filters.cliente && !filters.plan_inicio_de && !filters.plan_inicio_ate) {
            toast.warning('Por favor, informe ao menos um filtro (ex: OP, Pedido, Cliente, Produto ou Período de Planejamento) para buscar.');
            return;
        }
        loadData();
    };

    // Auto-load ao trocar a operação
    useEffect(() => {
        if (selectedOp) loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedOp]);

    const handlePlanChange = (opKey, dateStr) => {
        setDraftPlans(prev => ({ ...prev, [opKey]: dateStr }));
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
    });

    const handleOpenAppointment = (row) => {
        setAppointingOp(buildOpObj(row));
    };

    const handleOpenHistory = (row) => {
        setHistoryTarget(buildOpObj(row));
    };

    const handleAppointmentSave = async (payload) => {
        await saveAppointment(payload); // throws on validation error — modal handles display
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

            generateVerticalPendingPdf(pendencies, filters, user, groupByResource);

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
                                    onChange={(e) => setFilters(prev => ({ ...prev, op: e.target.value }))}
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
                                    onChange={(e) => setFilters(prev => ({ ...prev, pedido: e.target.value }))}
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
                                    onChange={(e) => setFilters(prev => ({ ...prev, produto: e.target.value }))}
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
                                    onChange={(e) => setFilters(prev => ({ ...prev, cliente: e.target.value }))}
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
                            }}
                            className="px-4 py-2 border rounded text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                        >
                            Limpar Filtros
                        </button>
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-50 px-3 py-2 rounded border cursor-pointer hover:bg-slate-100 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={groupByResource} 
                                onChange={(e) => setGroupByResource(e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            Agrupar por Recurso
                        </label>
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

            {/* Grid */}
            {loading ? (
                <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
                    <div className="animate-pulse text-slate-500 font-medium">Carregando fila de trabalho...</div>
                </div>
            ) : data.length === 0 && selectedOp ? (
                <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-slate-500">
                    <div className="font-medium text-slate-700 text-base">Nenhuma operação em exibição</div>
                    <div className="text-sm mt-1 mb-2">Por questões de performance, a busca não é automática. <br />Verifique se selecionou um <strong>Centro de Custo</strong> e informou ao menos <strong>um Filtro</strong> para buscar.</div>
                </div>
            ) : filteredData.length > 0 ? (
                <div className="bg-white rounded-lg shadow-sm border overflow-hidden flex-1 flex flex-col min-h-0">
                    <div className="overflow-auto h-[calc(100vh-320px)]">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-600 border-b sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Status</th>
                                    <th className="px-4 py-3 font-semibold">OP</th>
                                    <th className="px-4 py-3 font-semibold">Pedido</th>
                                    <th className="px-4 py-3 font-semibold">Entrega</th>
                                    <th className="px-4 py-3 font-semibold">Produto</th>
                                    <th className="px-4 py-3 font-semibold text-center">Progresso</th>
                                    <th className="px-4 py-3 font-semibold">Planejamento</th>
                                    <th className="px-4 py-3 font-semibold text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredData.map(row => {
                                    const opKey = `${row.op}_${row.item_op}_${row.sequen_op}`;
                                    const percent = row.qtd_op > 0 ? Math.min(100, Math.round((row.qtd_apontada / parseFloat(row.qtd_op)) * 100)) : 0;
                                    const draftDate = draftPlans[opKey] !== undefined ? draftPlans[opKey] : (row.planejamento_inicio ? row.planejamento_inicio.substring(0, 10) : '');

                                    return (
                                        <tr key={opKey} className={`transition-colors ${row.sequen_op === '001' ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-slate-50/80'}`}>
                                            <td className="px-4 py-3 align-top">
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(row.status)}`}>
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
                                            <td className="px-4 py-3 align-top">
                                                <div className="font-mono font-bold text-slate-800">{row.op}-{row.item_op} <span className="text-slate-400 font-normal">({row.sequen_op})</span></div>
                                            </td>
                                            <td className="px-4 py-3 align-top">
                                                {row.pedido ? (
                                                    <div className="text-xs text-blue-600 font-medium flex items-center gap-1">
                                                        <span>PV: {row.pedido}</span>
                                                        {row.item_pedido && <span className="opacity-60">/{row.item_pedido}</span>}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {row.data_entrega ? (
                                                    <span className="text-slate-700 font-medium flex items-center gap-1.5">
                                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                        {row.data_entrega.split('-').reverse().join('/')}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 text-xs text-center w-full block">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 max-w-[250px]">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="font-bold text-slate-800 text-xs truncate" title={row.produto}>{row.produto}</div>
                                                        <div className="text-xs text-slate-500 truncate mt-0.5" title={row.desc_produto}>{row.desc_produto}</div>
                                                    </div>
                                                    {row.tem_arquivos ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (row.primeiro_arquivo) {
                                                                    const viewUrl = getFileUrl(`/api/docs/view?path=${encodeURIComponent(row.primeiro_arquivo)}`);
                                                                    window.open(viewUrl, '_blank');
                                                                }
                                                            }}
                                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg flex-shrink-0 transition-colors"
                                                            title="Ver Desenho / PDF"
                                                        >
                                                            <FileText className="w-4 h-4" />
                                                        </button>
                                                    ) : (
                                                        <div className="text-slate-300 p-1.5 flex-shrink-0" title="Sem desenho anexado">
                                                            <FileText className="w-4 h-4" />
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col items-center">
                                                    <div className="text-xs font-bold text-slate-700 mb-1">
                                                        {row.qtd_apontada} / {parseFloat(row.qtd_op).toFixed(0)} <span className="text-slate-400 font-normal ml-1">({percent}%)</span>
                                                    </div>
                                                    <div className="w-32 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${percent === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                            style={{ width: `${percent}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-600">
                                                {row.planejamento_inicio ? (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="flex items-center gap-1.5" title="Início Planejado">
                                                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                            {row.planejamento_inicio.substring(0, 10).split('-').reverse().join('/')}
                                                        </span>
                                                        {row.planejamento_fim && (
                                                            <span className="flex items-center gap-1.5 text-xs text-slate-500" title="Fim Planejado">
                                                                <Clock className="w-3 h-3 text-slate-400" />
                                                                Até {row.planejamento_fim.substring(0, 10).split('-').reverse().join('/')}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}

                                                {/* Último apontamento inserido aqui embaixo da data planejada */}
                                                {row.ultima_data_apontamento && (
                                                    <div className="mt-1.5 text-[10px] text-slate-500 leading-tight border-t border-slate-100 pt-1.5">
                                                        <div className="text-slate-400 uppercase tracking-wider mb-0.5" style={{ fontSize: '9px' }}>Último Apontamento:</div>
                                                        <div className="font-semibold text-slate-600 truncate max-w-[140px]" title={row.usuarios_apontamento}>
                                                            {row.usuarios_apontamento?.split(',')[0]}
                                                        </div>
                                                        <div>
                                                            {new Date(row.ultima_data_apontamento).toLocaleDateString('pt-BR')} às {new Date(row.ultima_data_apontamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {/* Histórico sempre visível */}
                                                    <button
                                                        onClick={() => handleOpenHistory(row)}
                                                        className="text-sm font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1.5 rounded border border-slate-200 hover:border-indigo-200 transition-colors flex items-center gap-1.5"
                                                        title="Ver histórico de apontamentos"
                                                    >
                                                        <History className="w-3.5 h-3.5" />
                                                    </button>
                                                    {/* Apontar — disponível mesmo para CONCLUIDO (apontamento extra) */}
                                                    <button
                                                        onClick={() => handleOpenAppointment(row)}
                                                        className={`text-sm font-bold px-3 py-1.5 rounded shadow-sm transition-colors flex items-center justify-center gap-1.5 ${row.status === 'CONCLUIDO'
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                                                            }`}
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
                                    <td colSpan="5" className="px-4 py-3 text-right font-bold text-slate-700">
                                        TOTAL GERAL (Exibidos na Tela):
                                    </td>
                                    <td className="px-4 py-3 font-bold text-slate-800">
                                        {filteredData.reduce((acc, row) => acc + parseFloat(row.qtd_op || 0), 0).toFixed(2)} <span className="text-xs text-slate-500 font-normal">Plan.</span>
                                    </td>
                                    <td className="px-4 py-3 font-bold text-slate-800" colSpan="2">
                                        {filteredData.reduce((acc, row) => acc + parseFloat(row.qtd_apontada || 0), 0).toFixed(2)} <span className="text-xs text-slate-500 font-normal">Apont.</span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            ) : null}

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
        </div>
    );
}
