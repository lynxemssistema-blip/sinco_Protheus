import React, { useState, useEffect } from 'react';
import { Search, TreeDeciduous, List, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import api from '../../services/api';

const MaterialExplosionTab = ({ filters }) => {
    const [viewMode, setViewMode] = useState('tree'); // 'tree' | 'flat'
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [selectedProduct, setSelectedProduct] = useState(null);

    useEffect(() => {
        if (filters.pedido) {
            fetchExplosion();
        }
    }, [filters, selectedProduct]);

    const fetchExplosion = async () => {
        setLoading(true);
        setError(null);
        try {
            // Se tivermos um produto selecionado via UI interna, usamos ele.
            // Caso contrário, usamos o do filtro (que pode vir vazio, acionando a busca de lista)
            const produtoParaBusca = selectedProduct?.produto || filters.produto;
            const qtdParaBusca = selectedProduct?.qtd || filters.quantidade || 1;

            const response = await api.post('/materials/explosion', {
                pedido: filters.pedido,
                produto_codigo: produtoParaBusca,
                quantidade_pedido: qtdParaBusca
            });

            if (response.data.multiplo_items) {
                setData({ ...response.data, isSelection: true });
            } else {
                setData(response.data);
            }
        } catch (err) {
            console.error('Erro ao buscar explosão:', err);
            setError('Falha ao carregar estrutura de materiais. Verifique os dados do pedido.');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectItem = (item) => {
        setSelectedProduct(item);
        // O useEffect vai disparar o fetch novamente
    };

    if (!filters.pedido) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <Search className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg">Selecione um Pedido para visualizar a estrutura.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-500">Buscando informações...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" />
                {error}
            </div>
        );
    }

    if (!data) return null;

    // View: Seleção de Item (quando retorna multiplos items e nenhum foi selecionado ainda)
    if (data.isSelection && !selectedProduct) {
        return (
            <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-800">Selecione um Produto do Pedido {filters.pedido}:</h3>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-3">Item</th>
                                <th className="px-6 py-3">Produto</th>
                                <th className="px-6 py-3">Descrição</th>
                                <th className="px-6 py-3 text-right">Qtd</th>
                                <th className="px-6 py-3 text-center">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-6 py-3 text-gray-500">{item.item}</td>
                                    <td className="px-6 py-3 font-medium text-gray-700">{item.produto}</td>
                                    <td className="px-6 py-3 text-gray-600">{item.descricao}</td>
                                    <td className="px-6 py-3 text-right">{item.qtd}</td>
                                    <td className="px-6 py-3 text-center">
                                        <button
                                            onClick={() => handleSelectItem(item)}
                                            className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium text-xs transition-colors"
                                        >
                                            Ver Estrutura
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    // View: Explosão de Materiais (normal)
    return (
        <div className="space-y-6">
            {/* Header / Controls */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center space-x-4">
                    {selectedProduct && (
                        <button
                            onClick={() => setSelectedProduct(null)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm mr-2 flex items-center"
                        >
                            ← Voltar para Lista
                        </button>
                    )}
                    <h3 className="font-semibold text-gray-800">Visualização: {selectedProduct ? `${selectedProduct.produto} - ${selectedProduct.descricao}` : filters.produto}</h3>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('tree')}
                            className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'tree' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <TreeDeciduous className="h-4 w-4 mr-2" />
                            Por Operação
                        </button>
                        <button
                            onClick={() => setViewMode('flat')}
                            className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'flat' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <List className="h-4 w-4 mr-2" />
                            Lista Plana
                        </button>
                    </div>
                </div>

                <div className="flex items-center space-x-6 text-sm">
                    <div className="flex items-center">
                        <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                        <span className="text-gray-600">Em Falta</span>
                    </div>
                    <div className="flex items-center">
                        <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                        <span className="text-gray-600">Solicitado</span>
                    </div>
                    <div className="flex items-center">
                        <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                        <span className="text-gray-600">Disponível</span>
                    </div>
                </div>
            </div>

            {/* Content */}
            {viewMode === 'tree' ? (
                <div className="space-y-6">
                    {data.por_operacao?.map((op) => (
                        <div key={op.operacao} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-gray-800 flex items-center">
                                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs mr-2">{op.operacao}</span>
                                        {op.descricao}
                                    </h4>
                                    <div className="text-xs text-gray-500 mt-1 flex gap-4">
                                        <span>Itens: {op.resumo.total_itens}</span>
                                        {op.resumo.materiais_em_falta > 0 && (
                                            <span className="text-red-600 font-medium">⚠️ {op.resumo.materiais_em_falta} itens em falta</span>
                                        )}
                                    </div>
                                </div>
                                <button className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                                    Solicitar Materiais desta OP
                                </button>
                            </div>

                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-3">Código</th>
                                        <th className="px-6 py-3">Descrição</th>
                                        <th className="px-6 py-3 text-right">Necessário</th>
                                        <th className="px-6 py-3 text-right">Disponível</th>
                                        <th className="px-6 py-3 text-center">Status</th>
                                        <th className="px-6 py-3 text-right">Compra</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {op.materiais.map((mat, idx) => (
                                        <tr key={`${op.operacao}-${mat.codigo}-${idx}`} className="hover:bg-gray-50">
                                            <td className="px-6 py-3 font-medium text-gray-700">{mat.codigo}</td>
                                            <td className="px-6 py-3 text-gray-600">{mat.descricao}</td>
                                            <td className="px-6 py-3 text-right font-medium">{Number(mat.qtd_total).toFixed(2)} {mat.unidade}</td>
                                            <td className={`px-6 py-3 text-right ${mat.saldo_disponivel < mat.qtd_total ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                                                {Number(mat.saldo_disponivel).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                {mat.necessidade_liquida <= 0 ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                        <CheckCircle className="w-3 h-3 mr-1" /> OK
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                                        Falta {Number(mat.necessidade_liquida).toFixed(2)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-3 text-right text-xs">
                                                {mat.compra ? (
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-medium text-gray-700">{mat.status_compra}</span>
                                                        <span className="text-gray-500">{mat.compra.data_entrega || 'S/ Data'}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-3">Nível</th>
                                <th className="px-6 py-3">Código</th>
                                <th className="px-6 py-3">Descrição</th>
                                <th className="px-6 py-3">Operação</th>
                                <th className="px-6 py-3 text-right">Qtd Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.lista_plana?.map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-6 py-3 text-gray-500 pl-8" style={{ paddingLeft: `${item.nivel * 20 + 24}px` }}>
                                        {item.nivel}
                                    </td>
                                    <td className="px-6 py-3 font-medium text-gray-700">{item.componente}</td>
                                    <td className="px-6 py-3 text-gray-600">{item.descricao}</td>
                                    <td className="px-6 py-3">
                                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                                            {item.operacao || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-right font-medium">{Number(item.qtd_total).toFixed(4)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default MaterialExplosionTab;
