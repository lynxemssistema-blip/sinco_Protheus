import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Calendar, AlertCircle, ChevronLeft, ChevronRight, Package, FileText, Bot, Printer, Factory, ClipboardList, MoreVertical, LayoutList, Image as ImageIcon, ShoppingCart, CheckSquare, X, Save, History } from 'lucide-react';
import { getPedidosFlat, api, getProdutos, createFaturamentoSolicitacao, getProductDocs, getFileUrl } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import useStickyState from '../hooks/useStickyState';

import ProductImageModal from '../components/ProductImageModal';
import InvoiceDetailsModal from '../components/InvoiceDetailsModal';

const ItensAFaturar = () => {
    const { user } = useAuth();
    const canViewFinancials = user?.permissoes?.some(p => p.page_id === 'valores_financeiros' && p.can_view);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Image & Invoice Modals
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedProductForImage, setSelectedProductForImage] = useState(null);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [invoiceModalItem, setInvoiceModalItem] = useState(null);

    // Filters
    const [filters, setFilters] = useStickyState({
        cliente: '',
        pedido: '',
        produto: '',
        dataInicial: '',
        dataFinal: '',
        dateType: 'pedido',
        only_active: 'true',
        somente_prontos: 'false',
        pcpDataInicial: '',
        pcpDataFinal: ''
    }, '@metalfisa:itensFat_filters');

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 100;

    // --- FATURAMENTO CART STATE ---
    const [selectedItems, setSelectedItems] = useState({}); // { 'pedido-item': orderObject }
    const [isCartModalOpen, setIsCartModalOpen] = useState(false);
    const [cartQuantities, setCartQuantities] = useState({}); // { 'pedido-item': qty }
    const [cartObservacao, setCartObservacao] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = async (overrides = {}) => {
        setLoading(true);
        setError(null);
        try {
            const searchFilters = { ...filters, op_status: 'com_op', ...overrides };
            const searchPage = overrides.page || page;
            const searchLimit = searchFilters.pedido ? 5000 : limit;

            const result = await getPedidosFlat({ ...searchFilters, page: searchPage, limit: searchLimit });

            const { data, meta } = result;
            setOrders(data);
            setTotalPages(Math.ceil(meta.total / searchLimit));
        } catch (err) {
            console.error(err);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, filters.only_active]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchData({ page: 1 });
    };

    const handleViewImage = async (productCode) => {
        if (!productCode) return;
        try {
            const result = await getProdutos({ code: productCode });
            if (result && result.data && result.data.length > 0) {
                setSelectedProductForImage(result.data[0]);
                setShowImageModal(true);
            } else {
                setSelectedProductForImage({ codigo: productCode, imagem_url: null });
                setShowImageModal(true);
            }
        } catch (err) {
            console.error('Error fetching product image:', err);
            setSelectedProductForImage({ codigo: productCode, imagem_url: null });
            setShowImageModal(true);
        }
    };

    const formatProtheusDate = (value) => {
        const raw = String(value ?? '').trim();
        if (!raw) return '-';
        if (/^\d{8}$/.test(raw)) return raw.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1');
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1');
        return raw;
    };

    const formatCurrency = (value) => {
        const num = parseFloat(value);
        if (isNaN(num)) return '-';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
    };

    const getStatusTypeColor = (tipo) => {
        switch (tipo) {
            case 'Novo': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
            case 'Restrição': return 'bg-red-100 text-red-800 border-red-200';
            case 'Revisão': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'PCP': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    // Calcula maxQtd por linha: quando op_qtd está disponível, limita ao planejado da OP
    // para evitar que múltiplas OPs do mesmo item somem mais do que o saldo total do SC6.
    const calcMaxQtd = (row) => {
        const opQtd = parseFloat(row.op_qtd || 0);
        const saldo = parseFloat(row.qtd_faturar || 0);
        return opQtd > 0 ? Math.min(opQtd, saldo) : saldo;
    };

    // Expande orders em rows: 1 linha por programação PCP, ou 1 linha normal se sem programação.
    // O backend agora retorna 1 row por OP (múltiplas OPs = múltiplas rows por item).
    // A chave inclui op_num para garantir unicidade mesmo sem forecast.
    const rows = React.useMemo(() => {
        const result = [];
        orders.forEach(order => {
            const progs = Array.isArray(order.pcp_programacoes) && order.pcp_programacoes.length > 0
                ? order.pcp_programacoes
                : null;
            if (progs) {
                progs.forEach(prog => {
                    result.push({
                        ...order,
                        _row_key: `${order.pedido}-${order.item}-${prog.id}`,
                        _pcp_prog: prog,
                        qtd_pcp_programada: prog.quantidade_pcp,
                    });
                });
            } else {
                // Inclui op_num na chave para evitar colisão quando múltiplas OPs não têm forecast
                result.push({
                    ...order,
                    _row_key: `${order.pedido}-${order.item}-op${order.op_num || '0'}`,
                    _pcp_prog: null,
                    qtd_pcp_programada: null,
                });
            }
        });
        return result;
    }, [orders]);

    // "Pronto" = última operação do roteiro com quantidade apontada >= quantidade planejada da OP.
    // Mesma regra usada em producao.js: CONCLUIDO quando qtd_apontada >= qtd_planejada > 0.
    const isLastOpConcluido = (row) => {
        const prod = Number(row.saldo_produzido || 0);
        const planned = Number(row.op_qtd || 0);
        return planned > 0 && prod >= planned;
    };

    // Filtro local "Apenas Prontos": mostra somente OPs com última operação CONCLUÍDA.
    const filteredRows = React.useMemo(() => {
        if (filters.somente_prontos !== 'true') return rows;
        return rows.filter(r => isLastOpConcluido(r));
    }, [rows, filters.somente_prontos]);

    // --- FATURAMENTO LOGIC ---
    const handleSelectItem = (row) => {
        const key = row._row_key;
        if (parseFloat(row.qtd_faturar) <= 0) return toast.warning('Este item não possui saldo para faturamento.');

        setSelectedItems(prev => {
            const copy = { ...prev };
            if (copy[key]) {
                delete copy[key];
            } else {
                copy[key] = row;
                // Pré-preenche com a quantidade máxima correta por OP para não ultrapassar o saldo
                setCartQuantities(qPrev => ({ ...qPrev, [key]: calcMaxQtd(row) }));
            }
            return copy;
        });
    };

    const handleSelectAllOnPage = () => {
        const availableRows = filteredRows.filter(r => parseFloat(r.qtd_faturar) > 0);
        const allSelected = availableRows.every(r => !!selectedItems[r._row_key]);

        if (allSelected) {
            setSelectedItems(prev => {
                const copy = { ...prev };
                availableRows.forEach(r => delete copy[r._row_key]);
                return copy;
            });
        } else {
            setSelectedItems(prev => {
                const copy = { ...prev };
                availableRows.forEach(r => {
                    copy[r._row_key] = r;
                    setCartQuantities(qPrev => ({ ...qPrev, [r._row_key]: calcMaxQtd(r) }));
                });
                return copy;
            });
        }
    };

    const handleCartQuantityChange = (key, value, maxVal) => {
        let val = parseFloat(value);
        if (isNaN(val)) val = '';
        if (val !== '' && val < 0) val = 0;
        if (val !== '' && val > maxVal) val = maxVal; // Limitador

        setCartQuantities(prev => ({ ...prev, [key]: val }));
    };

    const handleSubmitFaturamento = async () => {
        const itemsToSubmit = Object.values(selectedItems).map(row => {
            const key = row._row_key;
            const prog = row._pcp_prog;
            return {
                ...row,
                quantidade_solicitada: cartQuantities[key] || 0,
                pcp_forecast_id: prog?.id || null,
                pcp_data_entrega: prog?.data_entrega_pcp || null,
                pcp_serie_cliente: prog?.serie_cliente || null,
                pcp_serie_metalfisa: prog?.serie_metalfisa || null,
                pcp_numero_serie: prog?.numero_serie || null,
                pcp_lote: prog?.lote || null,
                pcp_numero_lote: prog?.numero_lote || null
            };
        }).filter(item => item.quantidade_solicitada > 0);

        if (itemsToSubmit.length === 0) {
            return toast.warning('Defina uma quantidade maior que zero para pelo menos um item.');
        }

        // Validação de integridade: a soma das quantidades de todas as OPs do mesmo
        // (pedido, item) não pode exceder o saldo total do SC6 (qtd_faturar).
        // Isso previne over-billing quando múltiplas OPs do mesmo item são selecionadas.
        const itemSaldoMap = {};
        for (const row of itemsToSubmit) {
            const k = `${String(row.pedido).trim()}-${String(row.item).trim()}`;
            if (!itemSaldoMap[k]) {
                itemSaldoMap[k] = { qtd_faturar: parseFloat(row.qtd_faturar), total: 0, pedido: row.pedido, item: row.item };
            }
            itemSaldoMap[k].total += parseFloat(row.quantidade_solicitada);
        }
        for (const v of Object.values(itemSaldoMap)) {
            if (v.total > v.qtd_faturar + 0.001) {
                return toast.error(
                    `Pedido ${v.pedido} / Item ${v.item}: total solicitado (${v.total.toLocaleString('pt-BR')}) excede o saldo disponível (${v.qtd_faturar.toLocaleString('pt-BR')}). Ajuste as quantidades.`
                );
            }
        }

        setIsSubmitting(true);
        try {
            await createFaturamentoSolicitacao({
                usuario: user?.nome || 'Sistema',
                observacao: cartObservacao,
                items: itemsToSubmit
            });
            toast.success('Solicitação de Faturamento gerada com sucesso!');
            setIsCartModalOpen(false);
            setSelectedItems({});
            setCartObservacao('');
            
            // Recarrega os dados pra certificar que está ok (opcional, o saldo só cai depois da NF faturada mesmo)
            fetchData();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || 'Erro ao gerar solicitação.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const numSelected = Object.keys(selectedItems).length;

    const totalSelectedValue = useMemo(() => {
        return Object.values(selectedItems).reduce((acc, row) => {
            const qty = parseFloat(cartQuantities[row._row_key] ?? row.qtd_faturar) || 0;
            const unit = parseFloat(row.valor_unitario) || 0;
            return acc + qty * unit;
        }, 0);
    }, [selectedItems, cartQuantities]);

    return (
        <div className="p-2 md:p-4 lg:p-6 w-full animate-fadeIn relative">
            
            {/* INVOICE MODAL */}
            {selectedInvoice && (
                <InvoiceDetailsModal
                    isOpen={!!selectedInvoice}
                    onClose={() => { setSelectedInvoice(null); setInvoiceModalItem(null); }}
                    invoiceData={selectedInvoice}
                    itemData={invoiceModalItem}
                />
            )}

            {/* IMAGE MODAL */}
            {showImageModal && (
                <ProductImageModal
                    product={selectedProductForImage}
                    onClose={() => {
                        setShowImageModal(false);
                        setSelectedProductForImage(null);
                    }}
                />
            )}

            {/* CART MODAL (REVISÃO DO PEDIDO DE FATURAMENTO) */}
            {isCartModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] xl:max-w-7xl max-h-[90vh] flex flex-col mx-4 overflow-hidden">
                        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-blue-50/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                                    <ShoppingCart className="h-6 w-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">Revisão do Lote de Faturamento</h2>
                                    <p className="text-xs text-gray-500">Ajuste as quantidades necessárias de faturamento para cada item.</p>
                                </div>
                            </div>
                            <button onClick={() => setIsCartModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        
                        <div className="p-4 flex-1 overflow-y-auto bg-gray-50/50">
                            <div className="bg-white border text-sm border-gray-200 rounded-lg overflow-x-auto shadow-sm">
                                <table className="w-full text-left whitespace-nowrap">
                                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold">Pedido/Item</th>
                                            <th className="px-4 py-3 font-semibold text-center">OP Original</th>
                                            <th className="px-4 py-3 font-semibold">Produto</th>
                                            <th className="px-4 py-3 font-semibold text-center text-indigo-700 whitespace-nowrap">Dt. Entrega</th>
                                            <th className="px-4 py-3 font-semibold text-center text-indigo-700">Série Cli.</th>
                                            <th className="px-4 py-3 font-semibold text-center text-indigo-700">Série MF</th>
                                            <th className="px-4 py-3 font-semibold text-center text-indigo-700">Nº Série</th>
                                            <th className="px-4 py-3 font-semibold text-center text-indigo-700">Lote / Nº Lote</th>
                                            <th className="px-4 py-3 font-semibold">Cliente / Ped. Cli / Des. Cli</th>
                                            <th className="px-4 py-3 font-semibold text-right">Saldo Faturar</th>
                                            <th className="px-4 py-3 font-semibold text-right w-40">Qtd. Solicitada</th>
                                            <th className="px-4 py-3 font-semibold text-center w-10">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {Object.values(selectedItems).map(order => {
                                            const key = order._row_key;
                                            const maxQtd = calcMaxQtd(order);
                                            const val = cartQuantities[key] ?? '';
                                            return (
                                                <tr key={key} className="hover:bg-blue-50/30 transition-colors group">
                                                    <td className="px-4 py-2 font-mono text-gray-900">{order.pedido} <span className="text-blue-500 font-bold mx-1">-</span> {order.item}</td>
                                                    <td className="px-4 py-2 font-mono text-xs text-cyan-700 font-bold text-center whitespace-nowrap">
                                                        {order.op_num_completa || '-'}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <div className="font-mono text-blue-700 font-semibold">{order.codigo}</div>
                                                        <div className="text-xs text-gray-500 truncate max-w-[200px]">{order.descricao}</div>
                                                    </td>
                                                    {/* Colunas PCP no modal */}
                                                    <td className="px-4 py-2 text-center text-xs font-bold text-indigo-700 whitespace-nowrap">
                                                        {order._pcp_prog?.data_entrega_pcp ? new Date(order._pcp_prog.data_entrega_pcp).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : <span className="text-gray-300">—</span>}
                                                    </td>
                                                    <td className="px-4 py-2 text-center text-xs text-indigo-600 font-medium">
                                                        {order._pcp_prog?.serie_cliente || <span className="text-gray-300">—</span>}
                                                    </td>
                                                    <td className="px-4 py-2 text-center text-xs text-indigo-600 font-medium">
                                                        {order._pcp_prog?.serie_metalfisa || <span className="text-gray-300">—</span>}
                                                    </td>
                                                    <td className="px-4 py-2 text-center text-xs text-indigo-600 font-medium">
                                                        {order._pcp_prog?.numero_serie || <span className="text-gray-300">—</span>}
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        {(order._pcp_prog?.lote || order._pcp_prog?.numero_lote) ? (
                                                            <div className="text-xs text-indigo-600">
                                                                {order._pcp_prog.lote && <div className="font-medium">{order._pcp_prog.lote}</div>}
                                                                {order._pcp_prog.numero_lote && <div className="text-[10px] text-gray-500">{order._pcp_prog.numero_lote}</div>}
                                                            </div>
                                                        ) : <span className="text-gray-300 text-[10px]">—</span>}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <div className="truncate max-w-[150px] font-semibold text-gray-800">{order.nome_cliente}</div>
                                                        <div className="text-[11px] text-gray-500 mt-0.5">
                                                            <span className="font-semibold text-gray-600">Ped:</span> {order.ped_cliente || '-'} <span className="mx-1 text-gray-300">|</span>
                                                            <span className="font-semibold text-gray-600">Des:</span> {order.ref_cliente || '-'}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-bold text-gray-600">
                                                        {maxQtd.toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        <div className="flex items-center justify-end">
                                                            <input
                                                                type="number"
                                                                min="0.01"
                                                                max={maxQtd}
                                                                step="0.01"
                                                                lang="en-US"
                                                                className="w-24 px-2 py-1 text-right text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                                                                value={val}
                                                                onChange={(e) => handleCartQuantityChange(key, e.target.value, maxQtd)}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <button 
                                                            onClick={() => handleSelectItem(order)} 
                                                            className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
                                                            title="Remover"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-4 bg-white p-4 border border-gray-200 rounded-lg shadow-sm">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Observações Adicionais (Opcional):</label>
                                <textarea
                                    className="w-full text-sm border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[80px] resize-y"
                                    placeholder="Instruções para a T.I, faturamento, prazo de entrega, ou referência do cliente..."
                                    value={cartObservacao}
                                    onChange={(e) => setCartObservacao(e.target.value)}
                                ></textarea>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3">
                            <button
                                onClick={() => setIsCartModalOpen(false)}
                                className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-colors"
                            >
                                Continuar Selecionando
                            </button>
                            <button
                                onClick={handleSubmitFaturamento}
                                disabled={isSubmitting}
                                className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                Gerar Solicitação de Faturamento
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative">
                <div className="p-4 border-b border-gray-100 bg-white flex flex-col justify-between md:flex-row gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <LayoutList className="h-6 w-6 text-blue-600" />    
                            Itens a Faturar
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Visão consolidada de saldos pendentes para faturamento</p>
                        {filters.only_active === 'true' && (
                            <div className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-md px-2 py-1 inline-flex items-center gap-1.5 animate-pulse">
                                <AlertCircle className="h-3 w-3" />
                                <span>Listando apenas itens com <strong>Saldo a Faturar &gt; 0</strong>.</span>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2">
                         <Link to="/vendas/faturamento-historico" className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-medium rounded-lg text-sm px-4 py-2 flex items-center gap-2 transition-colors shadow-sm whitespace-nowrap">
                            <History className="h-4 w-4 text-blue-600" /> Histórico de Solicitações
                        </Link>
                    </div>
                </div>

                <div className="p-4 border-b border-gray-100 bg-white">
                    <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-7 gap-4 items-end">
                        <div className="flex flex-col gap-1 md:col-span-2">
                            <label className="text-[11px] font-medium text-gray-600 ml-1">Cliente:</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                <input
                                    type="text"
                                    name="cliente"
                                    placeholder="Buscar por nome..."
                                    value={filters.cliente}
                                    onChange={handleFilterChange}
                                    className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-medium text-gray-600 ml-1">Pedido:</label>
                            <div className="relative">
                                <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                <input
                                    type="text"
                                    name="pedido"
                                    placeholder="Nº Pedido..."
                                    value={filters.pedido}
                                    onChange={handleFilterChange}
                                    className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1 md:col-span-2">
                            <label className="text-[11px] font-medium text-gray-600 ml-1">Produto:</label>
                            <div className="relative">
                                <Package className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                <input
                                    type="text"
                                    name="produto"
                                    placeholder="Código do Produto..."
                                    value={filters.produto}
                                    onChange={handleFilterChange}
                                    className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2 flex gap-2">
                            <button
                                type="submit"
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm px-5 py-2.5 text-center flex items-center justify-center gap-2 shadow-sm"
                            >
                                <Search className="h-4 w-4" /> Buscar Dados
                            </button>
                        </div>

                        <div className="md:col-span-7 flex flex-col gap-3 mt-1 bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <div className="flex flex-wrap items-center gap-6">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={filters.only_active === 'true'}
                                        onChange={(e) => setFilters(prev => ({ ...prev, only_active: e.target.checked ? 'true' : 'false' }))}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                    <span className="ml-3 text-sm font-medium text-gray-700">Apenas Pendentes (Esconde o que j&aacute; foi faturado)</span>
                                </label>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={filters.somente_prontos === 'true'}
                                        onChange={(e) => setFilters(prev => ({ ...prev, somente_prontos: e.target.checked ? 'true' : 'false' }))}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                                    <span className="ml-3 text-sm font-medium text-green-700">Mostrar Apenas Prontos (Produzidos)</span>
                                </label>
                            </div>
                            {/* Filtro de Data PCP */}
                            <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-gray-200">
                                <span className="text-xs font-semibold text-indigo-700 flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" /> Filtrar por Data PCP:
                                </span>
                                <div className="flex flex-col gap-0.5">
                                    <label className="text-[10px] font-medium text-gray-500">De:</label>
                                    <input type="date"
                                        value={filters.pcpDataInicial}
                                        onChange={e => setFilters(prev => ({ ...prev, pcpDataInicial: e.target.value }))}
                                        className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-400"
                                    />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <label className="text-[10px] font-medium text-gray-500">Até:</label>
                                    <input type="date"
                                        value={filters.pcpDataFinal}
                                        onChange={e => setFilters(prev => ({ ...prev, pcpDataFinal: e.target.value }))}
                                        className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-400"
                                    />
                                </div>
                                {(filters.pcpDataInicial || filters.pcpDataFinal) && (
                                    <button type="button"
                                        onClick={() => setFilters(prev => ({ ...prev, pcpDataInicial: '', pcpDataFinal: '' }))}
                                        className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors">
                                        <X className="h-3 w-3" /> Limpar
                                    </button>
                                )}
                            </div>
                        </div>
                    </form>
                </div>

                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-sm text-left text-gray-500 whitespace-nowrap">
                        <thead className="text-[11px] text-gray-700 uppercase bg-slate-50 border-b border-gray-200">
                            <tr>
                                <th className="px-3 py-3 w-10 text-center">
                                    <div className="flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded cursor-pointer"
                                            onChange={handleSelectAllOnPage}
                                            checked={filteredRows.length > 0 && filteredRows.filter(r => parseFloat(r.qtd_faturar) > 0).every(r => !!selectedItems[r._row_key])}
                                            disabled={filteredRows.length === 0}
                                        />
                                    </div>
                                </th>
                                <th className="px-3 py-3 font-semibold text-center w-8">PDF</th>
                                <th className="px-3 py-3 font-semibold">Pedido.</th>
                                <th className="px-3 py-3 font-semibold">Item</th>
                                <th className="px-3 py-3 font-semibold text-center">OP Original</th>
                                <th className="px-3 py-3 font-semibold">Cód. Produto</th>
                                <th className="px-3 py-3 font-semibold">Descrição</th>
                                <th className="px-3 py-3 font-semibold">Cliente</th>
                                <th className="px-3 py-3 font-semibold">Emissão</th>
                                <th className="px-3 py-3 font-semibold">Ped. Cli</th>
                                <th className="px-3 py-3 font-semibold">Desenho Cli.</th>
                                {canViewFinancials && <th className="px-3 py-3 font-semibold text-right text-gray-700">V. Unit (R$)</th>}
                                {canViewFinancials && <th className="px-3 py-3 font-semibold text-right text-gray-700">V. Total (R$)</th>}
                                <th className="px-3 py-3 font-semibold text-right">Qtd Tot.</th>
                                <th className="px-3 py-3 font-semibold text-right">Qtd Entr.</th>
                                <th className="px-3 py-3 font-semibold text-right text-blue-700">Saldo</th>
                                <th className="px-3 py-3 font-semibold text-center text-indigo-700 whitespace-nowrap">Dt. Entrega</th>
                                <th className="px-3 py-3 font-semibold text-center text-indigo-700">Série Cli.</th>
                                <th className="px-3 py-3 font-semibold text-center text-indigo-700">Série MF</th>
                                <th className="px-3 py-3 font-semibold text-center text-indigo-700">Nº Série</th>
                                <th className="px-3 py-3 font-semibold text-center text-indigo-700">Lote / Nº Lote</th>
                                <th className="px-3 py-3 font-semibold text-center">Status</th>
                                <th className="px-3 py-3 font-semibold text-center text-cyan-700">Fat. Solicitados</th>
                                <th className="px-3 py-3 font-semibold text-center">NFs Anteriores</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-[13px]">
                            {loading ? (
                                <tr>
                                    <td colSpan={canViewFinancials ? 24 : 22} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                                            <span className="text-gray-400 font-medium">Carregando itens...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={canViewFinancials ? 24 : 22} className="px-6 py-12 text-center text-red-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <AlertCircle className="h-8 w-8" />
                                            <span className="font-semibold">{error}</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={canViewFinancials ? 24 : 22} className="px-6 py-12 text-center text-gray-400">
                                        {rows.length > 0
                                            ? 'Nenhum item com Saldo Produzido > 0. Desative o filtro "Mostrar Apenas Prontos" para ver todos.'
                                            : 'Nenhum item encontrado com os filtros selecionados.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((order, idx) => {
                                    const key = order._row_key;
                                    const isSelected = !!selectedItems[key];
                                    const isFechado = parseFloat(order.qtd_faturar) <= 0;
                                    const prog = order._pcp_prog;
                                    const concluido = isLastOpConcluido(order);

                                    return (
                                        <tr
                                            key={`${key}-${idx}`}
                                            className={`${isSelected ? 'bg-blue-50/70 border-l-2 border-l-blue-500' : concluido ? 'bg-green-50/40 border-l-2 border-l-green-500 hover:bg-green-50/70' : 'bg-white hover:bg-gray-50/50'} ${isFechado ? 'opacity-60' : ''} transition-all cursor-pointer`}
                                            onClick={() => handleSelectItem(order)}
                                        >
                                            <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded cursor-pointer disabled:opacity-50"
                                                    checked={isSelected}
                                                    onChange={() => handleSelectItem(order)}
                                                    disabled={isFechado}
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                                {order.has_docs ? (
                                                    <FileText 
                                                        onClick={(e) => { e.stopPropagation(); if (order.drawing_url || order.first_doc) window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(order.drawing_url || order.first_doc)}`), '_blank'); else toast.info("A URL do arquivo PDF não está no cache da nuvem."); }}
                                                        className="w-4 h-4 mx-auto text-red-500 cursor-pointer hover:text-red-700 transition-colors tooltip-trigger" 
                                                        title="Visualizar Desenho Técnico" 
                                                    />
                                                ) : (
                                                    <FileText className="w-4 h-4 mx-auto text-gray-300" title="Arquivo PDF Ausente na Nuvem" />
                                                )}
                                            </td>
                                            <td className="px-3 py-2 font-medium text-gray-900">{order.pedido}</td>
                                            <td className="px-3 py-2 font-mono text-xs">{order.item}</td>
                                            <td className="px-3 py-2 font-mono text-xs text-cyan-700 font-bold text-center whitespace-nowrap">
                                                {order.op_num_completa || '-'}
                                            </td>
                                            <td className="px-3 py-2 font-mono text-xs text-blue-700 font-semibold">{order.codigo}</td>
                                            <td className="px-3 py-2">
                                                <div className="truncate max-w-[200px]" title={order.descricao}>{order.descricao}</div>
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="truncate max-w-[150px]" title={order.nome_cliente}>{order.nome_cliente}</div>
                                            </td>
                                            <td className="px-3 py-2 text-gray-500 text-xs">{formatProtheusDate(order.emissao)}</td>
                                            <td className="px-3 py-2 text-xs text-gray-500">{order.ped_cliente || '-'}</td>
                                            <td className="px-3 py-2 text-xs text-gray-500">{order.ref_cliente || '-'}</td>
                                            
                                            {canViewFinancials && <td className="px-3 py-2 text-right font-mono text-gray-700">{formatCurrency(order.valor_unitario)}</td>}
                                            {canViewFinancials && <td className="px-3 py-2 text-right font-mono font-bold text-gray-900">{formatCurrency(order.valor_total)}</td>}

                                            <td className="px-3 py-2 text-right">{parseFloat(order.quantidade).toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right text-gray-400">{parseFloat(order.qtd_entreg).toLocaleString()}</td>
                                            <td className={`px-3 py-2 text-right font-bold text-[14px] ${isSelected ? 'text-blue-800' : 'text-blue-600'}`}>
                                                {parseFloat(order.qtd_faturar).toLocaleString()}
                                            </td>
                                            {/* Colunas PCP */}
                                            <td className="px-2 py-2 text-center text-xs font-bold text-indigo-700 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                {prog?.data_entrega_pcp ? new Date(prog.data_entrega_pcp).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-2 py-2 text-center text-xs text-indigo-600 font-medium" onClick={(e) => e.stopPropagation()}>
                                                {prog?.serie_cliente || <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-2 py-2 text-center text-xs text-indigo-600 font-medium" onClick={(e) => e.stopPropagation()}>
                                                {prog?.serie_metalfisa || <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-2 py-2 text-center text-xs text-indigo-600 font-medium" onClick={(e) => e.stopPropagation()}>
                                                {prog?.numero_serie || <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                                {(prog?.lote || prog?.numero_lote) ? (
                                                    <div className="text-xs text-indigo-600">
                                                        {prog.lote && <div className="font-medium">{prog.lote}</div>}
                                                        {prog.numero_lote && <div className="text-[10px] text-gray-500">{prog.numero_lote}</div>}
                                                    </div>
                                                ) : <span className="text-gray-300 text-[10px]">—</span>}
                                            </td>
                                            <td className="px-2 py-2 text-center text-xs" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex flex-col items-center gap-1">
                                                    {parseFloat(order.qtd_faturar) <= 0 ? (
                                                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] uppercase font-bold py-1 px-1.5 rounded shadow-sm whitespace-nowrap">Faturado 100%</span>
                                                    ) : parseFloat(order.qtd_entreg) > 0 ? (
                                                        <span className="bg-orange-100 text-orange-800 border border-orange-200 text-[10px] uppercase font-bold py-1 px-1.5 rounded shadow-sm whitespace-nowrap">Fat. Parcial</span>
                                                    ) : (
                                                        <span className="bg-gray-100 text-gray-600 border border-gray-200 text-[10px] uppercase font-bold py-1 px-1.5 rounded shadow-sm whitespace-nowrap">A Faturar</span>
                                                    )}
                                                    {concluido && (
                                                        <span className="bg-green-100 text-green-800 border border-green-300 text-[9px] font-bold py-0.5 px-1.5 rounded-full whitespace-nowrap">
                                                            ✓ Pronto
                                                        </span>
                                                    )}
                                                    {/* NFs inline — visíveis para itens faturados (total ou parcial) */}
                                                    {(parseFloat(order.qtd_faturar) <= 0 || parseFloat(order.qtd_entreg) > 0) &&
                                                        Array.isArray(order.notas_fiscais) &&
                                                        order.notas_fiscais.filter(nf => nf?.nota?.trim()).length > 0 && (
                                                        <div className="flex flex-col gap-0.5 items-center mt-0.5">
                                                            {order.notas_fiscais.filter(nf => nf?.nota?.trim()).map((nf, nfIdx) => (
                                                                <button
                                                                    key={nfIdx}
                                                                    onClick={(e) => { e.stopPropagation(); setSelectedInvoice(nf); setInvoiceModalItem({ ...order, nf_selecionada: nf }); }}
                                                                    className="text-[9px] px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded text-emerald-700 font-mono font-bold transition-colors whitespace-nowrap"
                                                                    title={`NF ${nf.nota} | Emissão: ${nf.emissao || '-'} | Qtd: ${nf.qtd}`}
                                                                >
                                                                    NF {nf.nota}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex flex-col gap-1 items-center max-w-[150px]">
                                                    {(() => {
                                                        const faturamentosValidos = Array.isArray(order.faturamentos_solicitados)
                                                            ? order.faturamentos_solicitados.filter(fat => {
                                                                if (fat.pcp_forecast_id) return prog && fat.pcp_forecast_id == prog.id;
                                                                return true;
                                                            })
                                                            : [];

                                                        return faturamentosValidos.length > 0 ? (
                                                            faturamentosValidos.map((fat, fIdx) => (
                                                                <div key={fIdx} className="text-[9px] bg-cyan-50 text-cyan-700 border border-cyan-200 rounded px-1.5 py-0.5 whitespace-nowrap overflow-hidden" title={`Qtd: ${fat.quantidade_solicitada}`}>
                                                                    <span className="font-bold">{fat.numero_solicitacao}</span> ({parseFloat(fat.quantidade_solicitada).toLocaleString()})
                                                                </div>
                                                            ))
                                                        ) : <span className="text-gray-300 text-[10px] text-center">-</span>;
                                                    })()}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex justify-center gap-1 flex-wrap max-w-[120px]">
                                                    {Array.isArray(order.notas_fiscais) && order.notas_fiscais.some(nf => nf && nf.nota && nf.nota.trim()) ? (
                                                        order.notas_fiscais.filter(nf => nf && nf.nota && nf.nota.trim()).map((nf, nfIdx) => (
                                                            <button 
                                                                key={nfIdx}
                                                                onClick={(e) => { e.stopPropagation(); setSelectedInvoice(nf); setInvoiceModalItem({ ...order, nf_selecionada: nf }); }}
                                                                className="text-[9px] px-1.5 py-0.5 bg-gray-50 hover:bg-gray-200 border border-gray-200 rounded text-gray-600 transition-colors"
                                                                title={`Ver Nota Fiscal ${nf.nota}`}
                                                            >
                                                                {nf.nota}
                                                            </button>
                                                        ))
                                                    ) : <span className="text-gray-300 text-xs">-</span>}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 0 && (
                    <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50/50 pb-20">
                        <span className="text-sm text-gray-500">
                            Página <span className="font-medium text-gray-900">{page}</span> de <span className="font-medium text-gray-900">{totalPages}</span>
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors bg-white text-gray-700"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages || totalPages === 0}
                                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors bg-white text-gray-700"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* FLOATING ACTION BAR FOR CART */}
            {numSelected > 0 && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.3)] px-6 py-4 flex items-center gap-6 z-40 border border-slate-700 animate-[translateUp_0.3s_ease-out]">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-500/20 p-2 rounded-full text-blue-400">
                            <CheckSquare className="h-6 w-6" />
                        </div>
                        <div>
                            <span className="block text-2xl font-bold font-mono leading-none">{numSelected}</span>
                            <span className="text-xs text-slate-300 uppercase tracking-wider">Itens Selecionados</span>
                        </div>
                    </div>
                    
                    <div className="w-px h-10 bg-slate-600 hidden md:block"></div>

                    {canViewFinancials && totalSelectedValue > 0 && (
                        <>
                            <div className="hidden md:flex flex-col">
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Valor Total</span>
                                <span className="text-lg font-black text-emerald-400 leading-none">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalSelectedValue)}
                                </span>
                            </div>
                            <div className="w-px h-10 bg-slate-600 hidden md:block"></div>
                        </>
                    )}

                    <button
                        onClick={() => setIsCartModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl px-6 py-2.5 flex items-center gap-2 transition-transform shadow-lg hover:scale-105"
                    >
                        <ShoppingCart className="h-5 w-5" />
                        Avançar e Revisar
                    </button>
                </div>
            )}

            <style>{`
                @keyframes translateUp {
                    from { transform: translate(-50%, 100%); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default ItensAFaturar;
