
import React, { useState, useEffect } from 'react';
import {
    TrendingUp, Filter, Calendar, User, Package, Factory,
    ChevronDown, RefreshCw, BarChart3, LayoutDashboard,
    ArrowRightLeft, FileSpreadsheet, ArrowRight, Users
} from 'lucide-react';
import {
    getPedidosEvolution,
    getTrackingHistory,
    getTrackingComparison
} from '../../services/api';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Status Badge Component
const StatusBadge = ({ status }) => {
    const statusConfig = {
        complete: { color: 'bg-green-100 text-green-800', icon: '✓', text: 'Completo' },
        partial: { color: 'bg-amber-100 text-amber-800', icon: '⚠️', text: 'Parcial' },
        low: { color: 'bg-orange-100 text-orange-800', icon: '⚠️', text: 'Baixo' },
        pending: { color: 'bg-slate-100 text-slate-800', icon: '⏳', text: 'Pendente' },
        extra: { color: 'bg-blue-100 text-blue-800', icon: '➕', text: 'Extra' }
    };

    const config = statusConfig[status] || statusConfig.pending;

    return (
        <span className={`px-2 py-1 rounded-sm text-xs font-bold uppercase tracking-wide flex items-center gap-1 w-fit ${config.color}`}>
            <span>{config.icon}</span>
            {config.text}
        </span>
    );
};

export default function TrackingEvolution() {
    // Filter states
    const [filters, setFilters] = useState({
        data_inicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        data_fim: new Date().toISOString().split('T')[0],
        pedido: '',
        op: '',
        produto: '',
        operacao: '',
        colaborador: ''
    });

    const [groupBy, setGroupBy] = useState('operacao');
    const [activeTab, setActiveTab] = useState('evolution'); // 'evolution' or 'comparison'

    // Evolution Data states
    const [summary, setSummary] = useState({
        total_pedidos: 0,
        concluidos: 0,
        em_andamento: 0,
        nao_iniciados: 0
    });
    const [groupedData, setGroupedData] = useState([]);

    // History Data states
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [historyTotalPages, setHistoryTotalPages] = useState(0);

    // Comparison Data states
    const [comparisonSummary, setComparisonSummary] = useState({ total_planejado: 0, total_apontado: 0, percentual: 0, diferenca: 0 });
    const [comparisonData, setComparisonData] = useState([]);

    // Loading states
    const [loading, setLoading] = useState(false);
    const [comparisonLoading, setComparisonLoading] = useState(false);

    // Fetch evolution data
    const fetchEvolutionData = async () => {
        setLoading(true);
        try {
            const params = {
                ...filters,
                grupo_por: groupBy,
                data_inicio: filters.data_inicio ? filters.data_inicio.replace(/-/g, '') : '',
                data_fim: filters.data_fim ? filters.data_fim.replace(/-/g, '') : ''
            };
            const response = await getPedidosEvolution(params);
            setSummary(response.resumo);
            setGroupedData(response.agrupado || []);
        } catch (error) {
            console.error('Error fetching evolution data:', error);
            alert('Erro ao carregar dados de evolução');
        } finally {
            setLoading(false);
        }
    };

    // Fetch history data
    const fetchHistory = async (page = 1) => {
        setLoading(true);
        try {
            const params = { ...filters, page, limit: 50 };
            const response = await getTrackingHistory(params);
            setHistory(response.data);
            setHistoryTotal(response.total);
            setHistoryPage(response.page);
            setHistoryTotalPages(response.totalPages);
        } catch (error) {
            console.error('Error fetching history:', error);
            // alert('Erro ao carregar histórico');
        } finally {
            setLoading(false);
        }
    };

    // Fetch comparison data
    const fetchComparisonData = async () => {
        setComparisonLoading(true);
        try {
            const params = { ...filters };
            const response = await getTrackingComparison(params);
            setComparisonSummary(response.resumo);
            setComparisonData(response.operacoes);
        } catch (error) {
            console.error('Error fetching comparison data:', error);
            alert('Erro ao carregar dados de comparação');
        } finally {
            setComparisonLoading(false);
        }
    };

    // Effects
    useEffect(() => {
        if (activeTab === 'evolution') {
            fetchEvolutionData();
        } else if (activeTab === 'comparison') {
            fetchComparisonData();
        }
    }, [activeTab, groupBy]);

    useEffect(() => {
        if (showHistory && activeTab === 'evolution') {
            fetchHistory(historyPage);
        }
    }, [showHistory, historyPage]);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const applyFilters = () => {
        if (activeTab === 'evolution') {
            fetchEvolutionData();
            if (showHistory) fetchHistory(1);
        } else {
            fetchComparisonData();
        }
    };

    const clearFilters = () => {
        setFilters({
            data_inicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            data_fim: new Date().toISOString().split('T')[0],
            pedido: '',
            op: '',
            produto: '',
            operacao: '',
            colaborador: ''
        });
    };

    // Chart Configuration
    const comparisonChartData = {
        labels: comparisonData.map(op => {
            // Shorten label if too long
            const label = op.descricao !== 'Sem descrição' ? op.descricao : op.codigo;
            return label.length > 20 ? label.substring(0, 20) + '...' : label;
        }),
        datasets: [
            {
                label: 'Planejado',
                data: comparisonData.map(op => op.planejado),
                backgroundColor: 'rgba(71, 85, 105, 0.6)', // Slate-600
                borderColor: 'rgb(71, 85, 105)',
                borderWidth: 1,
                borderRadius: 2
            },
            {
                label: 'Apontado',
                data: comparisonData.map(op => op.apontado),
                backgroundColor: 'rgba(16, 185, 129, 0.7)', // Emerald-500
                borderColor: 'rgb(16, 185, 129)',
                borderWidth: 1,
                borderRadius: 2
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                align: 'end',
                labels: {
                    usePointStyle: true,
                    boxWidth: 8,
                    font: { family: "'Inter', sans-serif", size: 11 }
                }
            },
            title: { display: false },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                padding: 12,
                cornerRadius: 4,
                titleFont: { family: "'Inter', sans-serif", weight: '600' },
                bodyFont: { family: "'Inter', sans-serif" },
                callbacks: {
                    title: (items) => {
                        const index = items[0].dataIndex;
                        const op = comparisonData[index];
                        return `${op.codigo} - ${op.descricao}`;
                    },
                    label: (context) => context.dataset.label + ': ' + context.parsed.y.toLocaleString() + ' pcs'
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(226, 232, 240, 0.6)', drawBorder: false },
                ticks: { font: { family: "'Inter', sans-serif", size: 10 } }
            },
            x: {
                grid: { display: false },
                ticks: { font: { family: "'Inter', sans-serif", size: 10 }, maxRotation: 45, minRotation: 0 }
            }
        }
    };

    return (
        <div className="flex bg-slate-50 min-h-screen">
            {/* Sidebar Navigation */}
            <div className="w-16 md:w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 transition-all duration-300">
                <div className="p-4 md:p-6 border-b border-slate-800">
                    <div className="flex items-center gap-2 text-white font-bold">
                        <TrendingUp className="w-6 h-6 text-emerald-500" />
                        <span className="hidden md:inline">Analytics</span>
                    </div>
                </div>

                <nav className="flex-1 p-2 md:p-4 space-y-1">
                    <button
                        onClick={() => setActiveTab('evolution')}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-md transition-all duration-200 ${activeTab === 'evolution'
                            ? 'bg-slate-800 text-white shadow-lg border-l-2 border-emerald-500'
                            : 'hover:bg-slate-800/50 hover:text-white'
                            }`}
                    >
                        <LayoutDashboard className="w-5 h-5" />
                        <span className="hidden md:inline font-medium">Evolução</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('comparison')}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-md transition-all duration-200 ${activeTab === 'comparison'
                            ? 'bg-slate-800 text-white shadow-lg border-l-2 border-emerald-500'
                            : 'hover:bg-slate-800/50 hover:text-white'
                            }`}
                    >
                        <ArrowRightLeft className="w-5 h-5" />
                        <span className="hidden md:inline font-medium">Comparativo</span>
                    </button>
                </nav>

                <div className="p-4 border-t border-slate-800 text-xs text-slate-500 hidden md:block">
                    PROTHEUS v12
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col h-screen">
                {/* Header */}
                <div aria-label="header" className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shadow-sm z-10">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">
                            {activeTab === 'evolution' ? 'Evolução de Apontamento' : 'Planejado vs Realizado'}
                        </h1>
                        <p className="text-sm text-slate-500">
                            {activeTab === 'evolution' ? 'Visão gerencial e histórico' : 'Comparativo de performance por operação'}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded">
                            {new Date().toLocaleDateString('pt-BR')}
                        </span>
                        <button
                            onClick={applyFilters}
                            className="bg-emerald-600 text-white px-4 py-2 rounded-sm hover:bg-emerald-700 flex items-center gap-2 transition-colors text-sm font-medium shadow-sm active:translate-y-px"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading || comparisonLoading ? 'animate-spin' : ''}`} />
                            Atualizar
                        </button>
                    </div>
                </div>

                <main className="flex-1 overflow-auto p-6 space-y-6">
                    {/* Common Filters - Always visible */}
                    <div className="bg-white p-5 rounded-sm shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                            <Filter className="w-4 h-4 text-slate-500" />
                            <h2 className="text-sm uppercase tracking-wider font-bold text-slate-500">Filtros Globais</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Início</label>
                                <input type="date" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-sm focus:border-emerald-500 outline-none transition-colors"
                                    value={filters.data_inicio} onChange={(e) => handleFilterChange('data_inicio', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Fim</label>
                                <input type="date" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-sm focus:border-emerald-500 outline-none transition-colors"
                                    value={filters.data_fim} onChange={(e) => handleFilterChange('data_fim', e.target.value)} />
                            </div>
                            <div className="lg:col-span-1">
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Pedido</label>
                                <input type="text" placeholder="Busca..." className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-sm focus:border-emerald-500 outline-none transition-colors"
                                    value={filters.pedido} onChange={(e) => handleFilterChange('pedido', e.target.value)} />
                            </div>
                            <div className="lg:col-span-1">
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">OP</label>
                                <input type="text" placeholder="123456" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-sm focus:border-emerald-500 outline-none transition-colors"
                                    value={filters.op} onChange={(e) => handleFilterChange('op', e.target.value)} />
                            </div>
                            <div className="lg:col-span-2">
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Produto</label>
                                <input type="text" placeholder="Código ou descrição..." className="w-full p-2 bg-slate-50 border border-slate-200 rounded-sm text-sm focus:border-emerald-500 outline-none transition-colors"
                                    value={filters.produto} onChange={(e) => handleFilterChange('produto', e.target.value)} />
                            </div>
                        </div>

                        <div className="flex justify-end mt-4 pt-2">
                            <button onClick={clearFilters} className="text-xs text-slate-400 hover:text-slate-600 underline">
                                Limpar filtros
                            </button>
                        </div>
                    </div>

                    {/* VIEW: EVOLUTION */}
                    {activeTab === 'evolution' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-white p-6 rounded-sm shadow-sm border-l-4 border-blue-500 relative overflow-hidden group">
                                    <div className="relative z-10">
                                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Pedidos</p>
                                        <p className="text-3xl font-bold text-slate-800">{(summary.total_pedidos || 0).toLocaleString()}</p>
                                    </div>
                                    <Package className="absolute right-4 bottom-4 w-12 h-12 text-slate-100 group-hover:text-blue-50 transition-colors" />
                                </div>
                                <div className="bg-white p-6 rounded-sm shadow-sm border-l-4 border-emerald-500 relative overflow-hidden group">
                                    <div className="relative z-10">
                                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Concluídos</p>
                                        <p className="text-3xl font-bold text-slate-800">{(summary.concluidos || 0).toLocaleString()}</p>
                                    </div>
                                    <FileSpreadsheet className="absolute right-4 bottom-4 w-12 h-12 text-slate-100 group-hover:text-emerald-50 transition-colors" />
                                </div>
                                <div className="bg-white p-6 rounded-sm shadow-sm border-l-4 border-yellow-500 relative overflow-hidden group">
                                    <div className="relative z-10">
                                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Em Andamento</p>
                                        <p className="text-3xl font-bold text-slate-800">{(summary.em_andamento || 0).toLocaleString()}</p>
                                    </div>
                                    <Users className="absolute right-4 bottom-4 w-12 h-12 text-slate-100 group-hover:text-yellow-50 transition-colors" />
                                </div>
                                <div className="bg-white p-6 rounded-sm shadow-sm border-l-4 border-slate-500 relative overflow-hidden group">
                                    <div className="relative z-10">
                                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Não Iniciados</p>
                                        <p className="text-3xl font-bold text-slate-800">{(summary.nao_iniciados || 0).toLocaleString()}</p>
                                    </div>
                                    <Users className="absolute right-4 bottom-4 w-12 h-12 text-slate-100 group-hover:text-slate-50 transition-colors" />
                                </div>
                            </div>

                            {/* Grouping Params */}
                            <div className="bg-white p-6 rounded-sm shadow-sm border border-slate-200">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-base font-bold text-slate-700 flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-slate-400" />
                                        Análise Agrupada
                                    </h3>
                                    <div className="flex items-center gap-2 bg-slate-50 p-1 rounded border border-slate-200">
                                        <span className="text-xs font-bold text-slate-500 uppercase px-2">Agrupar:</span>
                                        <select
                                            className="text-sm bg-transparent border-none focus:ring-0 text-slate-700 font-medium cursor-pointer"
                                            value={groupBy} onChange={(e) => setGroupBy(e.target.value)}
                                        >
                                            <option value="operacao">Operação</option>
                                            <option value="pedido">Pedido</option>
                                            <option value="op">OP</option>
                                            <option value="produto">Produto</option>
                                            <option value="colaborador">Colaborador</option>
                                            <option value="dia">Dia</option>
                                        </select>
                                    </div>
                                </div>

                                {loading ? (
                                    <div className="text-center py-20 bg-slate-50 rounded border border-dashed border-slate-200">
                                        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-slate-300" />
                                        <p className="text-slate-400 font-medium">Processando dados...</p>
                                    </div>
                                ) : (groupedData || []).length === 0 ? (
                                    <div className="text-center py-20 bg-slate-50 rounded border border-dashed border-slate-200">
                                        <p className="text-slate-400 font-medium">Nenhum dado encontrado para os filtros.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm border-collapse">
                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Pedido</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Progresso</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Entrega</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {groupedData.map((pedido, index) => (
                                                    <tr key={index} className="hover:bg-slate-50 transition-colors group">
                                                        <td className="px-4 py-3 font-semibold text-slate-700 bg-slate-50/50">
                                                            {pedido.numero}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600">
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-slate-900">{pedido.cliente?.fantasia || pedido.cliente?.nome || 'N/A'}</span>
                                                                <span className="text-xs text-slate-400">{pedido.cliente?.loja ? `Loja ${pedido.cliente.loja}` : ''}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 align-middle">
                                                            <div className="w-full max-w-xs mx-auto">
                                                                <div className="flex justify-between text-xs mb-1">
                                                                    <span className="font-semibold text-slate-700">{pedido.percentual_geral}%</span>
                                                                    <span className="text-slate-400">{pedido.total_itens} itens</span>
                                                                </div>
                                                                <div className="w-full bg-slate-200 rounded-full h-2">
                                                                    <div
                                                                        className={`h-2 rounded-full ${pedido.percentual_geral >= 100 ? 'bg-emerald-500' :
                                                                            pedido.percentual_geral > 0 ? 'bg-blue-500' : 'bg-slate-300'
                                                                            }`}
                                                                        style={{ width: `${pedido.percentual_geral}%` }}
                                                                    ></div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${pedido.status === 'concluido' ? 'bg-emerald-100 text-emerald-800' :
                                                                pedido.status === 'em_andamento' ? 'bg-blue-100 text-blue-800' :
                                                                    'bg-slate-100 text-slate-800'
                                                                }`}>
                                                                {pedido.status === 'concluido' ? 'Concluído' :
                                                                    pedido.status === 'em_andamento' ? 'Em Andamento' : 'Não Iniciado'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-slate-600 font-mono text-xs">
                                                            {pedido.data_entrega ? new Date(pedido.data_entrega).toLocaleDateString() : '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <button className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-blue-600 transition-colors">
                                                                <ArrowRight className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* History Toggle */}
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-sm font-medium transition-colors flex items-center justify-center gap-2 text-sm uppercase tracking-wide"
                            >
                                <ChevronDown className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                                {showHistory ? 'Ocultar Histórico Completo' : 'Carregar Histórico Detalhado'}
                            </button>

                            {/* History Table */}
                            {showHistory && (
                                <div className="bg-white p-6 rounded-sm shadow-sm border border-slate-200 animate-in slide-in-from-top-4 duration-300">
                                    <h3 className="text-base font-bold text-slate-700 mb-4">Registro Detalhado</h3>

                                    {loading ? (
                                        <div className="text-center py-12 text-slate-400">Carregando...</div>
                                    ) : (
                                        <>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-sm">
                                                    <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500">
                                                        <tr>
                                                            <th className="px-4 py-3">Data</th>
                                                            <th className="px-4 py-3">Colaborador</th>
                                                            <th className="px-4 py-3">OP</th>
                                                            <th className="px-4 py-3">Produto</th>
                                                            <th className="px-4 py-3">Operação</th>
                                                            <th className="px-4 py-3 text-right">Qtd</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {history.map((item) => (
                                                            <tr key={item.id} className="hover:bg-slate-50">
                                                                <td className="px-4 py-2 text-slate-500 text-xs font-mono">
                                                                    {new Date(item.data_hora).toLocaleString('pt-BR')}
                                                                </td>
                                                                <td className="px-4 py-2 font-medium text-slate-700">{item.colaborador}</td>
                                                                <td className="px-4 py-2 text-slate-600 font-mono text-xs">{item.op_numero}</td>
                                                                <td className="px-4 py-2 text-slate-600 text-xs max-w-[200px] truncate" title={item.desc_produto}>
                                                                    {item.produto} - {item.desc_produto}
                                                                </td>
                                                                <td className="px-4 py-2 text-slate-600 text-xs">
                                                                    {item.operacao} - {item.desc_operacao}
                                                                </td>
                                                                <td className="px-4 py-2 text-right font-bold text-slate-700">{item.quantidade}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Pagination (Simple) */}
                                            <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100">
                                                <span className="text-xs text-slate-400">Pág {historyPage} de {historyTotalPages}</span>
                                                <div className="flex gap-2">
                                                    <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1}
                                                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded text-xs">Ant</button>
                                                    <button onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))} disabled={historyPage === historyTotalPages}
                                                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded text-xs">Próx</button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* VIEW: COMPARISON */}
                    {activeTab === 'comparison' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Comparison Summary */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Large Main Card */}
                                <div className="md:col-span-1 bg-slate-800 text-white p-6 rounded-sm shadow-md relative overflow-hidden">
                                    <div className="relative z-10">
                                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Visão Geral</p>
                                        <div className="flex justify-between items-end mb-4">
                                            <div>
                                                <p className="text-sm text-slate-400">Total Planejado (Protheus)</p>
                                                <p className="text-3xl font-bold">{comparisonSummary.total_planejado.toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-slate-400">Total Apontado</p>
                                                <p className="text-3xl font-bold text-emerald-400">{comparisonSummary.total_apontado.toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${comparisonSummary.diferenca >= 0 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                                style={{ width: `${Math.min(comparisonSummary.percentual, 100)}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between mt-2 text-xs font-mono">
                                            <span>0%</span>
                                            <span>{comparisonSummary.percentual}% Concluído</span>
                                        </div>
                                    </div>
                                    {/* Abstract background shape */}
                                    <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-slate-700 opacity-20 blur-xl"></div>
                                </div>

                                {/* Deviation Card */}
                                <div className="bg-white p-6 rounded-sm shadow-sm border-l-4 border-amber-500 flex flex-col justify-center">
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Desvio / Saldo</p>
                                    <p className={`text-4xl font-bold ${comparisonSummary.diferenca >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                        {comparisonSummary.diferenca > 0 ? '+' : ''}{comparisonSummary.diferenca.toLocaleString()}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-2">Diferença entre peças produzidas e meta</p>
                                </div>

                                {/* Efficiency Card */}
                                <div className="bg-white p-6 rounded-sm shadow-sm border-l-4 border-blue-500 flex flex-col justify-center">
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Status Global</p>
                                    <p className="text-2xl font-bold text-slate-800">
                                        {comparisonSummary.percentual >= 100 ? 'Meta Atingida' :
                                            comparisonSummary.percentual >= 80 ? 'Dentro da Meta' : 'Abaixo da Meta'}
                                    </p>
                                    <div className="flex gap-2 mt-3">
                                        <StatusBadge status={
                                            comparisonSummary.percentual >= 100 ? 'complete' :
                                                comparisonSummary.percentual >= 50 ? 'partial' : 'low'
                                        } />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px] lg:h-[500px]">
                                {/* Chart Section - Takes 2/3 */}
                                <div className="lg:col-span-2 bg-white p-6 rounded-sm shadow-sm border border-slate-200 flex flex-col">
                                    <h3 className="text-base font-bold text-slate-700 mb-6 flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-slate-400" />
                                        Performance por Operação
                                    </h3>
                                    <div className="flex-1 min-h-0 w-full relative">
                                        {comparisonLoading ? (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <RefreshCw className="w-8 h-8 animate-spin text-slate-300" />
                                            </div>
                                        ) : (
                                            <Bar data={comparisonChartData} options={chartOptions} />
                                        )}
                                    </div>
                                </div>

                                {/* Detailed Table - Takes 1/3 */}
                                <div className="lg:col-span-1 bg-white p-0 rounded-sm shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                                    <div className="p-4 border-b border-slate-100 bg-slate-50">
                                        <h3 className="text-sm font-bold text-slate-700">Detalhamento</h3>
                                    </div>
                                    <div className="flex-1 overflow-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                                <tr>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Op</th>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase text-right">Progresso</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {comparisonData.map((op) => (
                                                    <tr key={op.codigo} className="hover:bg-slate-50">
                                                        <td className="px-4 py-3">
                                                            <div className="font-bold text-slate-700 text-xs">{op.codigo}</div>
                                                            <div className="text-xs text-slate-500 truncate max-w-[120px]" title={op.descricao}>
                                                                {op.descricao}
                                                            </div>
                                                            <div className="mt-1">
                                                                <StatusBadge status={op.status} />
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="text-xs font-mono mb-1">
                                                                <span className="text-emerald-600 font-bold">{op.apontado}</span>
                                                                <span className="text-slate-300 mx-1">/</span>
                                                                <span className="text-slate-500">{op.planejado}</span>
                                                            </div>
                                                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden ml-auto max-w-[100px]">
                                                                <div
                                                                    className={`h-full ${op.percentual >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                                    style={{ width: `${Math.min(op.percentual, 100)}%` }}
                                                                ></div>
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 mt-1">{op.percentual}%</div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
