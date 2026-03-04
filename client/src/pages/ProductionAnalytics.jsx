import React, { useState, useEffect, useMemo } from 'react';
import { getPedidosEvolution } from '../services/api';
import { RefreshCw, Search, ChevronDown, ChevronRight, Package, TrendingUp, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export default function ProductionAnalytics() {
    const [data, setData] = useState({ pedidos: [], resumo: {} });
    const [loading, setLoading] = useState(false);
    const [expandedPedidos, setExpandedPedidos] = useState(new Set());
    const [expandedItens, setExpandedItens] = useState(new Set());

    const [calcType, setCalcType] = useState('average'); // 'average' or 'sum'

    // Filters
    const [filters, setFilters] = useState({
        pedido: '',
        cliente: '',
        status: ''
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await getPedidosEvolution(filters);
            // Limit to first 20 for performance
            const limitedData = {
                ...res,
                pedidos: res.pedidos.slice(0, 20)
            };
            setData(limitedData);
        } catch (error) {
            console.error('Erro ao carregar evolução de pedidos:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSearch = () => {
        loadData();
    };

    const togglePedido = (pedidoNum) => {
        const newExpanded = new Set(expandedPedidos);
        if (newExpanded.has(pedidoNum)) {
            newExpanded.delete(pedidoNum);
        } else {
            newExpanded.add(pedidoNum);
        }
        setExpandedPedidos(newExpanded);
    };

    const toggleItem = (key) => {
        const newExpanded = new Set(expandedItens);
        if (newExpanded.has(key)) {
            newExpanded.delete(key);
        } else {
            newExpanded.add(key);
        }
        setExpandedItens(newExpanded);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'concluido': return 'bg-green-100 text-green-800 border-green-300';
            case 'em_andamento': return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'nao_iniciado': return 'bg-gray-100 text-gray-800 border-gray-300';
            default: return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'concluido': return <CheckCircle2 className="w-4 h-4" />;
            case 'em_andamento': return <Clock className="w-4 h-4" />;
            case 'nao_iniciado': return <AlertCircle className="w-4 h-4" />;
            default: return <AlertCircle className="w-4 h-4" />;
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'concluido': return 'Concluído';
            case 'em_andamento': return 'Em Andamento';
            case 'nao_iniciado': return 'Não Iniciado';
            default: return 'Desconhecido';
        }
    };

    const calculateProgress = React.useCallback((entity, type) => {
        // console.log('Calculating progress with type:', calcType);
        if (calcType === 'average') {
            if (type === 'pedido') return entity.percentual_geral;
            if (type === 'item') return entity.percentual_item;
            return 0;
        } else {
            // CALCULATION BY SUM OF QUANTITIES
            let totalPlanejado = 0;
            let totalApontado = 0;

            if (type === 'pedido') {
                if (!entity.itens) return 0;
                entity.itens.forEach(item => {
                    if (item.ops) {
                        item.ops.forEach(op => {
                            totalPlanejado += Number(op.qtd_planejada) || 0;
                            totalApontado += Number(op.qtd_apontada) || 0;
                        });
                    }
                });
            } else if (type === 'item') {
                if (!entity.ops) return 0;
                entity.ops.forEach(op => {
                    totalPlanejado += Number(op.qtd_planejada) || 0;
                    totalApontado += Number(op.qtd_apontada) || 0;
                });
            }

            if (totalPlanejado === 0) return 0;
            return Math.min(100, Math.round((totalApontado / totalPlanejado) * 100));
        }
    }, [calcType]);

    const ProgressBar = ({ percentage }) => {
        const color = percentage >= 100 ? 'bg-green-500' :
            percentage > 0 ? 'bg-blue-500' : 'bg-gray-300';

        return (
            <div className="flex items-center gap-3 w-full">
                <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                        className={`h-full transition-all duration-300 ${color}`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                </div>
                <span className="text-sm font-semibold text-slate-700 min-w-[50px] text-right">
                    {percentage}%
                </span>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Evolução de Pedidos</h1>
                    <p className="text-slate-500">Acompanhamento de produção por pedido e item</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white rounded-lg p-1 border shadow-sm">
                        <button
                            onClick={() => setCalcType('average')}
                            className={`px-3 py-1 text-sm rounded-md transition-colors ${calcType === 'average' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            Média Processos
                        </button>
                        <button
                            onClick={() => setCalcType('sum')}
                            className={`px-3 py-1 text-sm rounded-md transition-colors ${calcType === 'sum' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            Soma Qtd
                        </button>
                    </div>

                    <button
                        onClick={loadData}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                        disabled={loading}
                    >
                        <RefreshCw className={`w-5 h-5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Pedido</label>
                        <input
                            type="text"
                            placeholder="Nº do Pedido"
                            value={filters.pedido}
                            onChange={(e) => setFilters({ ...filters, pedido: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                        <input
                            type="text"
                            placeholder="Nome do Cliente"
                            value={filters.cliente}
                            onChange={(e) => setFilters({ ...filters, cliente: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">Todos</option>
                            <option value="concluido">Concluído</option>
                            <option value="em_andamento">Em Andamento</option>
                            <option value="nao_iniciado">Não Iniciado</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={handleSearch}
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                            disabled={loading}
                        >
                            <Search className="w-4 h-4" />
                            Buscar
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500">Total de Pedidos</p>
                            <p className="text-2xl font-bold text-slate-900">{data.resumo.total_pedidos || 0}</p>
                        </div>
                        <Package className="w-8 h-8 text-blue-500" />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500">Concluídos</p>
                            <p className="text-2xl font-bold text-green-600">{data.resumo.concluidos || 0}</p>
                        </div>
                        <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500">Em Andamento</p>
                            <p className="text-2xl font-bold text-blue-600">{data.resumo.em_andamento || 0}</p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-blue-500" />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500">Não Iniciados</p>
                            <p className="text-2xl font-bold text-gray-600">{data.resumo.nao_iniciados || 0}</p>
                        </div>
                        <Clock className="w-8 h-8 text-gray-500" />
                    </div>
                </div>
            </div>

            {/* Pedidos List */}
            <div className="space-y-3">
                {loading ? (
                    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center text-slate-500">
                        Carregando...
                    </div>
                ) : data.pedidos.length === 0 ? (
                    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center text-slate-500">
                        Nenhum pedido encontrado
                    </div>
                ) : (
                    data.pedidos.map((pedido) => (
                        <div key={pedido.numero} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            {/* Pedido Header */}
                            <div
                                className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                                onClick={() => togglePedido(pedido.numero)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 flex-1">
                                        {expandedPedidos.has(pedido.numero) ?
                                            <ChevronDown className="w-5 h-5 text-slate-400" /> :
                                            <ChevronRight className="w-5 h-5 text-slate-400" />
                                        }
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="font-bold text-slate-900">Pedido {pedido.numero}</h3>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${getStatusColor(pedido.status)}`}>
                                                    {getStatusIcon(pedido.status)}
                                                    {getStatusLabel(pedido.status)}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-600">
                                                {pedido.cliente.nome} • {pedido.total_itens} {pedido.total_itens === 1 ? 'item' : 'itens'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Datas Column */}
                                    <div className="w-48 text-xs text-slate-600 flex flex-col gap-1 border-l border-r border-slate-100 px-4 mx-2">
                                        <div className="flex justify-between">
                                            <span className="font-medium text-slate-500">Entrada:</span>
                                            <span className="font-mono text-slate-800">
                                                {pedido.data_emissao ? new Date(pedido.data_emissao).toLocaleDateString('pt-BR') : '-'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="font-medium text-slate-500">Entrega:</span>
                                            <span className="font-mono text-slate-800">
                                                {pedido.data_entrega ? new Date(pedido.data_entrega).toLocaleDateString('pt-BR') : '-'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="w-1/3">
                                        <ProgressBar percentage={pedido.percentual_geral || 0} />
                                    </div>
                                </div>
                            </div>
                            {/* Itens (Expanded) */}
                            {expandedPedidos.has(pedido.numero) && (
                                <div className="border-t border-slate-200 bg-slate-50">
                                    {pedido.itens.map((item) => {
                                        const itemKey = `${pedido.numero}_${item.item}`;
                                        return (
                                            <div key={itemKey} className="border-b border-slate-200 last:border-b-0">
                                                {/* Item Header */}
                                                <div
                                                    className="p-4 pl-12 hover:bg-slate-100 cursor-pointer transition-colors"
                                                    onClick={() => toggleItem(itemKey)}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-4 flex-1">
                                                            {expandedItens.has(itemKey) ?
                                                                <ChevronDown className="w-4 h-4 text-slate-400" /> :
                                                                <ChevronRight className="w-4 h-4 text-slate-400" />
                                                            }
                                                            <div className="flex-1">
                                                                <p className="font-semibold text-slate-800">
                                                                    Item {item.item} - {item.produto.codigo}
                                                                </p>
                                                                <p className="text-sm text-slate-600">
                                                                    {item.produto.descricao}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="w-1/3">
                                                            <ProgressBar percentage={item.percentual_item || 0} />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* OPs (Expanded) */}
                                                {expandedItens.has(itemKey) && item.ops.length > 0 && (
                                                    <div className="bg-white p-4 pl-20">
                                                        <table className="w-full text-sm">
                                                            <thead className="border-b border-slate-200">
                                                                <tr className="text-left text-slate-600">
                                                                    <th className="pb-2">OP</th>
                                                                    <th className="pb-2">Produto</th>
                                                                    <th className="pb-2">Operação</th>
                                                                    <th className="pb-2 text-right">Planejado</th>
                                                                    <th className="pb-2 text-right">Apontado</th>
                                                                    <th className="pb-2 text-right">%</th>
                                                                    <th className="pb-2">Última Atualização</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {item.ops.map((op, idx) => (
                                                                    <tr key={idx} className="border-b border-slate-100 last:border-b-0">
                                                                        <td className="py-2 font-mono text-slate-700">{op.op}</td>
                                                                        <td className="py-2 text-slate-600">{op.cod_produto}</td>
                                                                        <td className="py-2 text-slate-600 italic text-xs">{op.operacao}</td>
                                                                        <td className="py-2 text-right text-slate-700">{op.qtd_planejada.toFixed(2)}</td>
                                                                        <td className="py-2 text-right text-slate-700">{op.qtd_apontada.toFixed(2)}</td>
                                                                        <td className="py-2 text-right">
                                                                            <span className={`font-semibold ${op.percentual >= 100 ? 'text-green-600' :
                                                                                op.percentual > 0 ? 'text-blue-600' : 'text-gray-500'
                                                                                }`}>
                                                                                {op.percentual}%
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-2 text-slate-500">
                                                                            {op.ultima_atualizacao ?
                                                                                new Date(op.ultima_atualizacao).toLocaleString('pt-BR') :
                                                                                '-'
                                                                            }
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Info Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                <strong>Nota:</strong> Os percentuais são calculados com base nos apontamentos realizados no sistema de controle de produção.
            </div>
        </div>
    );
}
