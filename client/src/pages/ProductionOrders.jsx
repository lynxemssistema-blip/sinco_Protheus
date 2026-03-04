import React, { useState, useMemo } from 'react';
import { Search, Loader2, Hash, FileText, ChevronDown, ChevronUp, Package, Calendar, AlertCircle } from 'lucide-react';
import { getProductionOrders } from '../services/api';
import DocsModal from '../components/DocsModal';

export default function ProductionOrders() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchOrder, setSearchOrder] = useState('');
    const [hasSearched, setHasSearched] = useState(false);

    // Estado para linhas expandidas (agora controlamos quais pedidos estão abertos)
    // Usamos um Set para permitir múltiplos pedidos abertos simultaneamente se desejar
    const [expandedOrders, setExpandedOrders] = useState(new Set());

    // Estado para o Modal de Documentos
    const [docsModal, setDocsModal] = useState({ isOpen: false, code: null, name: null });

    const handleSearch = async (e) => {
        e.preventDefault();
        setLoading(true);
        setHasSearched(true);
        setExpandedOrders(new Set());
        try {
            const data = await getProductionOrders({ pedido: searchOrder });
            setOrders(data);

            // Se buscou um pedido específico e retornou dados, expande automaticamente
            if (searchOrder && data.length > 0) {
                const uniquePedidos = new Set(data.map(d => d.pedido));
                setExpandedOrders(uniquePedidos);
            }
        } catch (error) {
            console.error('Erro ao buscar ordens de produção:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleOrder = (pedido) => {
        setExpandedOrders(prev => {
            const next = new Set(prev);
            if (next.has(pedido)) {
                next.delete(pedido);
            } else {
                next.add(pedido);
            }
            return next;
        });
    };

    const openDocs = (code, name) => {
        setDocsModal({ isOpen: true, code, name });
    };

    // Agrupar dados por Pedido
    const groupedOrders = useMemo(() => {
        const groups = {};
        orders.forEach(row => {
            if (!groups[row.pedido]) {
                groups[row.pedido] = {
                    pedido: row.pedido,
                    cliente: row.nomecliente,
                    // Poderíamos pegar outras infos se viessem do backend, como emissão e valor
                    items: []
                };
            }
            groups[row.pedido].items.push(row);
        });
        return Object.values(groups);
    }, [orders]);

    return (
        <div className="space-y-6">
            <DocsModal
                isOpen={docsModal.isOpen}
                onClose={() => setDocsModal({ ...docsModal, isOpen: false })}
                productCode={docsModal.code}
                productName={docsModal.name}
            />

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                        Ordens de Produção
                    </h1>
                    <p className="text-slate-500">
                        Visualize a estrutura de produção e BOM por pedido.
                    </p>
                </div>
            </div>

            {/* Filter Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 md:items-end">
                    <div className="flex-1 max-w-sm">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Número do Pedido
                        </label>
                        <div className="relative">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchOrder}
                                onChange={(e) => setSearchOrder(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                                placeholder="Ex: 003664"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full md:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        Buscar
                    </button>
                </form>
            </div>

            {/* Master-Detail List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
                {/* Header Global da Tabela Principal */}
                <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[800px]">
                    <div className="col-span-1 text-center"></div> {/* Chevron */}
                    <div className="col-span-2">Nº Pedido</div>
                    <div className="col-span-7">Cliente</div>
                    <div className="col-span-2 text-right">Ações</div>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                        <Loader2 className="h-8 w-8 animate-spin mb-3 text-blue-500" />
                        <span>Carregando ordens...</span>
                    </div>
                ) : groupedOrders.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                        <AlertCircle className="h-8 w-8 text-slate-300 mb-2" />
                        <span>{hasSearched ? 'Nenhum pedido encontrado com este número.' : 'Utilize o filtro acima para buscar.'}</span>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {groupedOrders.map((group) => {
                            const isExpanded = expandedOrders.has(group.pedido);
                            return (
                                <div key={group.pedido} className="bg-white transition-colors hover:bg-slate-50">
                                    {/* Linha Mestra (Cabeçalho do Pedido) */}
                                    <div
                                        className={`grid grid-cols-12 gap-4 px-6 py-4 items-center cursor-pointer transition-colors min-w-[800px] ${isExpanded ? 'bg-slate-50' : ''}`}
                                        onClick={() => toggleOrder(group.pedido)}
                                    >
                                        <div className="col-span-1 text-center flex justify-center">
                                            {isExpanded ?
                                                <ChevronUp className="h-5 w-5 text-blue-600" /> :
                                                <ChevronDown className="h-5 w-5 text-slate-400" />
                                            }
                                        </div>
                                        <div className="col-span-2 font-medium text-slate-900 text-sm">
                                            {group.pedido}
                                        </div>
                                        <div className="col-span-7 font-medium text-slate-700 text-sm truncate">
                                            {group.cliente}
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <span className="text-xs text-slate-400">
                                                {group.items.length} item(s)
                                            </span>
                                        </div>
                                    </div>

                                    {/* Área de Detalhes (Expandida) */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4 bg-slate-50 border-t border-slate-100 animate-fadeIn">
                                            <div className="mt-4 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                                                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2">
                                                    <Package className="h-4 w-4 text-blue-500" />
                                                    <h4 className="text-sm font-semibold text-slate-700">
                                                        Estrutura de Produção - Pedido {group.pedido}
                                                    </h4>
                                                </div>

                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left text-sm">
                                                        <thead>
                                                            <tr className="bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase">
                                                                <th className="px-4 py-3 text-center w-16">Docs</th>
                                                                <th className="px-4 py-3">Item Ped.</th>
                                                                <th className="px-4 py-3 pl-8">Estrutura / Descrição</th>
                                                                <th className="px-4 py-3">OP</th>
                                                                <th className="px-4 py-3 text-right">Qtd. Rel</th>
                                                                <th className="px-4 py-3 text-right">Qtd. Total</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-50">
                                                            {group.items.map((row, idx) => (
                                                                <tr key={idx} className="hover:bg-slate-50/80">
                                                                    {/* Botão Docs */}
                                                                    <td className="px-4 py-2 text-center">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (row.arquivos_count === 1 && row.primeiro_arquivo) {
                                                                                    // Abrir direto
                                                                                    window.open(`http://${window.location.hostname}:3001/api/docs/view?path=${encodeURIComponent(row.primeiro_arquivo)}`, '_blank');
                                                                                } else {
                                                                                    openDocs(row.codnoarvore, row.descnoarvore);
                                                                                }
                                                                            }}
                                                                            className={`inline-flex items-center justify-center p-1.5 rounded-lg transition-all relative ${row.tem_arquivos
                                                                                ? 'text-red-600 bg-red-50 hover:bg-red-100 ring-1 ring-red-200'
                                                                                : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                                                                                }`}
                                                                            title={row.tem_arquivos
                                                                                ? `${row.arquivos_count} Documento(s) - Clique para abrir`
                                                                                : "Ver Desenhos/Documentos"}
                                                                        >
                                                                            <FileText className="h-4 w-4" />
                                                                            {row.tem_arquivos && (
                                                                                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                                                                </span>
                                                                            )}
                                                                        </button>
                                                                    </td>

                                                                    <td className="px-4 py-2 text-slate-500 text-xs">
                                                                        {row.item_ord}
                                                                    </td>

                                                                    <td className="px-4 py-2">
                                                                        <div
                                                                            className="flex flex-col"
                                                                            style={{ paddingLeft: `${row.nivel * 24}px` }}
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                {row.nivel > 0 && <span className="text-slate-300 text-xs">┕</span>}
                                                                                <span className={`font-mono text-xs ${row.nivel === 0 ? 'text-blue-700 font-bold' : 'text-slate-500'}`}>
                                                                                    {row.codnoarvore}
                                                                                </span>
                                                                            </div>
                                                                            <span className={`text-sm ${row.nivel === 0 ? 'font-semibold text-slate-900' : 'text-slate-700 pl-3'}`}>
                                                                                {row.nivel === 0 ? row.nomecliente : row.descnoarvore}
                                                                            </span>
                                                                        </div>
                                                                    </td>

                                                                    <td className="px-4 py-2">
                                                                        {row.ops ? (
                                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 border border-green-200">
                                                                                {row.ops}
                                                                            </span>
                                                                        ) : '-'}
                                                                    </td>

                                                                    <td className="px-4 py-2 text-right text-slate-500 text-xs">
                                                                        {Number(row.qtdrelativabom).toLocaleString('pt-BR')}
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right font-medium text-slate-900 text-sm">
                                                                        {Number(row.qtdtotalparaopedido).toLocaleString('pt-BR')}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
