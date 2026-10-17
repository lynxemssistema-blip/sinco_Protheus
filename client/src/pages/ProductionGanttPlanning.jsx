import React, { useState, useEffect } from 'react';
import { BarChart3, Search, AlertTriangle, RefreshCw } from 'lucide-react';
import { getProductionAnalyticsDashboard, reportSystemError } from '../services/api';
import ErrorStateOverlay from '../components/ErrorStateOverlay';
import useStickyState from '../hooks/useStickyState';
import { toast } from 'react-toastify';

export default function ProductionGanttPlanning() {
    const [pedido, setPedido] = useStickyState('', '@lynxems:gantt_pedido');
    const [filters, setFilters] = useStickyState({
        cliente: '',
        pedCliente: '',
        op: '',
        produto: '',
        dataInicio: '',
        dateType: 'planejada' // 'planejada' or 'apontada'
    }, '@lynxems:gantt_filters');
    const [data, setData] = useStickyState(null, '@lynxems:gantt_data');
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState(null);

    useEffect(() => {
        setLoading(false);
    }, []);

    const handleSearch = () => {
        if (!pedido && !filters.cliente && !filters.op && !filters.produto && !filters.pedCliente && !filters.dataInicio) {
            toast.warning('Por favor, preencha ao menos um filtro antes de buscar.');
            return;
        }
        fetchData();
    };

    const fetchData = async () => {
        setLoading(true);
        setApiError(null);
        const params = new URLSearchParams();
        try {
            if (pedido) params.append('pedido_venda', pedido);
            if (filters.cliente) params.append('cliente', filters.cliente);
            if (filters.pedCliente) params.append('ped_cliente', filters.pedCliente);
            if (filters.op) params.append('op', filters.op);
            if (filters.produto) params.append('produto', filters.produto);
            if (filters.dataInicio) params.append('data_inicio', filters.dataInicio);

            // Backend treats filters as "LIKE" automatically

            const res = await getProductionAnalyticsDashboard(Object.fromEntries(params));
            setData(res);
        } catch (err) {
            console.error('❌ [DEBUG] API Error:', err);
            setApiError(err.message || 'Erro desconhecido de comunicação');
            reportSystemError('Análise de Produção (Gantt)', err, Object.fromEntries(params));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b p-6">
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-6 h-6 text-slate-700" />
                    Análise de Produção
                </h1>
                <p className="text-sm text-slate-500 mt-1">Visão geral de processos e curvas de fabricação</p>
            </div>

            {/* Filters */}
            <div className="p-6">
                <div className="bg-white rounded-lg shadow p-4">
                    <div className="grid grid-cols-6 gap-3 items-end">
                        <div className="col-span-1">
                            <label className="block text-xs font-bold text-slate-600 mb-1">Pedido Venda</label>
                            <input
                                type="text"
                                className="w-full border border-slate-300 rounded px-4 py-2"
                                value={pedido}
                                onChange={(e) => setPedido(e.target.value)}
                            />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs font-bold text-slate-600 mb-1">Cliente</label>
                            <input
                                type="text"
                                className="w-full border border-slate-300 rounded px-4 py-2"
                                value={filters.cliente || ''}
                                onChange={(e) => setFilters({ ...filters, cliente: e.target.value })}
                            />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs font-bold text-slate-600 mb-1">OP</label>
                            <input
                                type="text"
                                className="w-full border border-slate-300 rounded px-4 py-2"
                                value={filters.op || ''}
                                onChange={(e) => setFilters({ ...filters, op: e.target.value })}
                            />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs font-bold text-slate-600 mb-1">Produto</label>
                            <input
                                type="text"
                                className="w-full border border-slate-300 rounded px-4 py-2"
                                value={filters.produto || ''}
                                onChange={(e) => setFilters({ ...filters, produto: e.target.value })}
                            />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-xs font-bold text-slate-600 mb-1">Pedido Cliente</label>
                            <input
                                type="text"
                                className="w-full border border-slate-300 rounded px-4 py-2"
                                value={filters.pedCliente || ''}
                                onChange={(e) => setFilters({ ...filters, pedCliente: e.target.value })}
                            />
                        </div>

                        <div className="col-span-1">
                            <label className="block text-xs font-bold text-slate-600 mb-1">Tipo de Data</label>
                            <select
                                className="w-full border border-slate-300 rounded px-4 py-2 bg-white"
                                value={filters.dateType}
                                onChange={(e) => setFilters({ ...filters, dateType: e.target.value })}
                            >
                                <option value="planejada">Data Planejada</option>
                                <option value="apontada">Data Apontamento</option>
                            </select>
                        </div>

                        <div className="col-span-1">
                            <label className="block text-xs font-bold text-slate-600 mb-1">Data Início</label>
                            <input
                                type="date"
                                className="w-full border border-slate-300 rounded px-4 py-2"
                                value={filters.dataInicio || ''}
                                onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })}
                            />
                        </div>

                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <Search className="w-4 h-4" />
                            {loading ? '...' : 'Buscar'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            <div className="px-6 pb-6 mt-4">
                <ErrorStateOverlay error={apiError} onRetry={fetchData} />
            </div>

            {/* Results */}
            {!apiError && data && (
                <div className="px-6 pb-6 space-y-6">
                    {/* Header Info (Only show if single order selected or returned) */}
                    {data.pedido && (
                        <div className="bg-white rounded-lg shadow p-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <div className="text-sm text-slate-500">Cliente (Filtro Principal)</div>
                                    <div className="font-bold text-lg">{data.cliente || 'Múltiplos / Não identificado'}</div>
                                </div>
                                {data.data_entrega && (
                                    <div className="text-right">
                                        <div className="text-sm text-slate-500">Data de Entrega</div>
                                        <div className="font-bold text-lg text-red-600">
                                            {new Date(data.data_entrega).toLocaleDateString('pt-BR')}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* KPIs */}
                    <div className="grid grid-cols-4 gap-4">
                        <KPICard title="Processos Listados" value={data.resumo?.total_processos || 0} />
                        <KPICard title="Concluídos" value={data.resumo?.concluidos || 0} color="green" />
                        <KPICard title="Em Andamento" value={data.resumo?.em_andamento || 0} color="blue" />
                        <KPICard title="Progresso Geral" value={`${data.resumo?.percentual_geral || 0}%`} color="indigo" />
                    </div>

                    {/* Table */}
                    {/* Grouped Lists (Order -> Item -> Operations) */}
                    <div className="space-y-6">
                        {Object.entries((data.processos || []).reduce((acc, p) => {
                            const itemKey = `${p.pedido}_${p.item_pedido || '00'}`;
                            if (!acc[itemKey]) {
                                acc[itemKey] = {
                                    item: p.item_pedido,
                                    produto: p.produto_item,
                                    descricao: p.desc_produto,
                                    pedido: p.pedido,
                                    processos: []
                                };
                            }
                            acc[itemKey].processos.push(p);
                            return acc;
                        }, {})).map(([key, group]) => (
                            <div key={key} className="bg-white rounded-lg shadow overflow-hidden border border-slate-200">
                                {/* Item Header */}
                                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                                    <div>
                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Item do Pedido</div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold text-slate-900">{group.produto || 'PRODUTO INDEFINIDO'}</span>
                                            <span className="text-sm text-slate-600">- {group.descricao || 'Sem descrição'}</span>
                                            <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">Item: {group.item || 'N/A'}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-slate-500">Pedido Venda</div>
                                        <div className="font-mono font-bold text-slate-700">{group.pedido}</div>
                                    </div>
                                </div>

                                {/* Operations Table */}
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-800 text-white">
                                        <tr>
                                            <th className="px-3 py-2 text-left w-16">Seq.</th>
                                            <th className="px-3 py-2 text-left">Processo</th>
                                            <th className="px-3 py-2 text-left">Recurso</th>
                                            <th className="px-3 py-2 text-left">Descrição</th>
                                            <th className="px-3 py-2 text-center w-20">Peças</th>
                                            <th className="px-3 py-2 text-center w-20">Prod.</th>
                                            <th className="px-3 py-2 text-center w-20">%</th>
                                            <th className="px-3 py-2 text-center w-28">Status</th>
                                            <th className="px-3 py-2 text-center w-24">Plan. Início</th>
                                            <th className="px-3 py-2 text-center w-24">Plan. Fim</th>
                                            <th className="px-3 py-2 text-center w-24">Real Início</th>
                                            <th className="px-3 py-2 text-center w-24">Real Fim</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {group.processos.map((p, idx) => (
                                            <tr key={`${p.key || idx}`} className="hover:bg-slate-50">
                                                <td className="px-3 py-2 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                                                <td className="px-3 py-2 font-mono font-bold text-blue-900">{p.codigo}</td>
                                                <td className="px-3 py-2 font-mono text-slate-600 text-xs">{p.recurso}</td>
                                                <td className="px-3 py-2">
                                                    <div>{p.descricao}</div>
                                                    {p.componentes && p.componentes.length > 0 && (
                                                        <div className="text-xs text-slate-500 mt-1">
                                                            {Array.from(new Set(p.componentes.map(c => c.codigo))).map(codigo => {
                                                                const count = p.componentes.filter(c => c.codigo === codigo).length;
                                                                return (
                                                                    <span key={codigo} className="inline-block bg-slate-100 px-1.5 py-0.5 rounded mr-1 mb-1 border border-slate-200">
                                                                        {codigo} {count > 1 ? `(${count})` : ''}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-center font-medium">{p.total_pecas}</td>
                                                <td className="px-3 py-2 text-center text-slate-600">{p.pecas_produzidas}</td>
                                                <td className="px-3 py-2 text-center">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${p.percentual === 100 ? 'bg-green-100 text-green-700' :
                                                        p.percentual > 0 ? 'bg-blue-100 text-blue-700' :
                                                            'bg-slate-100 text-slate-500'
                                                        }`}>
                                                        {p.percentual}%
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <StatusBadge status={p.status} />
                                                </td>
                                                <td className="px-3 py-2 text-center text-xs">
                                                    {p.planejado.inicio ? new Date(p.planejado.inicio).toLocaleDateString('pt-BR') : '-'}
                                                </td>
                                                <td className="px-3 py-2 text-center text-xs">
                                                    {p.planejado.fim ? new Date(p.planejado.fim).toLocaleDateString('pt-BR') : '-'}
                                                </td>
                                                <td className="px-3 py-2 text-center text-xs">
                                                    {p.real.inicio ? new Date(p.real.inicio).toLocaleDateString('pt-BR') : '-'}
                                                </td>
                                                <td className="px-3 py-2 text-center text-xs">
                                                    {p.real.fim ? new Date(p.real.fim).toLocaleDateString('pt-BR') : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function KPICard({ title, value, color = 'slate' }) {
    const colors = {
        slate: 'bg-slate-50 text-slate-900',
        green: 'bg-green-50 text-green-900',
        blue: 'bg-blue-50 text-blue-900',
        indigo: 'bg-indigo-50 text-indigo-900'
    };

    return (
        <div className={`${colors[color]} rounded-lg p-4`}>
            <div className="text-sm font-medium opacity-70">{title}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
        </div>
    );
}

function StatusBadge({ status }) {
    const styles = {
        'CONCLUIDO': 'bg-green-100 text-green-700',
        'EM_ANDAMENTO': 'bg-blue-100 text-blue-700',
        'NAO_INICIADO': 'bg-slate-100 text-slate-500'
    };

    const labels = {
        'CONCLUIDO': 'Concluído',
        'EM_ANDAMENTO': 'Em Andamento',
        'NAO_INICIADO': 'Não Iniciado'
    };

    return (
        <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status]}`}>
            {labels[status]}
        </span>
    );
}
