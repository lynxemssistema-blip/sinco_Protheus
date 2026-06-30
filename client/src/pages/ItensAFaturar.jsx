import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Search, Filter, Calendar, AlertCircle, ChevronLeft, ChevronRight, Package, FileText, Bot, Printer, Factory, ClipboardList, MoreVertical, LayoutList, Image as ImageIcon, ShoppingCart, CheckSquare, X, Save, History, BarChart2, ChevronUp, ChevronDown } from 'lucide-react';
import { getPedidosFlat, api, getProdutos, createFaturamentoSolicitacao, getProductDocs, getFileUrl } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import { downloadBlob } from '../utils/downloadHelper';
import useStickyState from '../hooks/useStickyState';

import ProductImageModal from '../components/ProductImageModal';
import InvoiceDetailsModal from '../components/InvoiceDetailsModal';
import { BillingForecastInput } from '../components/orders/BillingForecastInput';
import FinancialView from '../components/orders/FinancialView';
import LabelPrintModal from '../components/orders/LabelPrintModal';

const SortableHeader = ({ label, columnKey, sortConfig, requestSort, filterValue, onFilterChange, className = "", align = "left" }) => {
    return (
        <th className={`px-2 py-2 font-semibold ${className} align-top`}>
            <div className="flex flex-col gap-1">
                <div 
                    className={`flex items-center gap-1 cursor-pointer hover:bg-gray-200 p-1 rounded transition-colors ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}
                    onClick={() => columnKey && requestSort(columnKey)}
                    title={columnKey ? `Clique para ordenar por ${label}` : ''}
                >
                    <span className="whitespace-nowrap">{label}</span>
                    {columnKey && (
                        <div className="flex flex-col text-gray-400">
                            <ChevronUp strokeWidth={3} className={`h-2.5 w-2.5 -mb-[2px] ${sortConfig.key === columnKey && sortConfig.direction === 'asc' ? 'text-blue-600' : ''}`} />
                            <ChevronDown strokeWidth={3} className={`h-2.5 w-2.5 ${sortConfig.key === columnKey && sortConfig.direction === 'desc' ? 'text-blue-600' : ''}`} />
                        </div>
                    )}
                </div>
                {columnKey && (
                    <input
                        type="text"
                        className="w-full min-w-[60px] text-[10px] font-normal border border-gray-300 rounded px-1.5 py-1 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 text-gray-700 bg-white"
                        placeholder="Filtrar..."
                        value={filterValue || ''}
                        onChange={(e) => onFilterChange(columnKey, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                    />
                )}
            </div>
        </th>
    );
};

const ItensAFaturar = () => {
    const { user, hasPermission, isAdmin } = useAuth();
    const canViewFinancials = isAdmin || hasPermission('valores_financeiros', 'view');
    const canViewFinancialTab = isAdmin || hasPermission('aba_financeiro_faturar', 'view');
    
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);

    // Image & Invoice Modals
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedProductForImage, setSelectedProductForImage] = useState(null);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [invoiceModalItem, setInvoiceModalItem] = useState(null);

    // Active Tab State (with Sticky persistence)
    const [activeTab, setActiveTab] = useStickyState('itens', '@metalfisa:itensFat_activeTab');
    const [selectedRow, setSelectedRow] = useState(null);

    // Enforce tab security
    useEffect(() => {
        if (!canViewFinancialTab && activeTab !== 'itens') {
            setActiveTab('itens');
        }
    }, [canViewFinancialTab, activeTab, setActiveTab]);

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
    const [hasNextPage, setHasNextPage] = useState(false);
    const limit = 100;

    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [columnFilters, setColumnFilters] = useState({});

    // --- FATURAMENTO CART STATE ---
    const [selectedItems, setSelectedItems] = useState({}); // { 'pedido-item': orderObject }
    const [isCartModalOpen, setIsCartModalOpen] = useState(false);
    const [cartQuantities, setCartQuantities] = useState({}); // { 'pedido-item': qty }
    const [cartApontamentos, setCartApontamentos] = useState({}); // { 'pedido-item': boolean }
    const [cartApontarQuantities, setCartApontarQuantities] = useState({}); // { 'pedido-item': qty }
    const [cartObservacao, setCartObservacao] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [confirmationData, setConfirmationData] = useState(null);

    // --- LABEL PRINT STATE ---
    const [showLabelModal, setShowLabelModal] = useState(false);

    const fetchData = async (overrides = {}) => {
        const searchPage = overrides.page || page;
        if (searchPage === 1) setLoading(true);
        else setLoadingMore(true);
        
        setError(null);
        try {
            const searchFilters = { 
                ...filters, 
                op_status: 'com_op', 
                ...overrides 
            };

            const searchLimit = limit;

            const result = await getPedidosFlat({ ...searchFilters, page: searchPage, limit: searchLimit });

            const { data, meta } = result;
            if (searchPage === 1) {
                setOrders(data);
            } else {
                setOrders(prev => {
                    const idKey = d => `${d.pedido}-${d.item}-${d.op_num || ''}`;
                    const existingIds = new Set(prev.map(idKey));
                    const newRows = data.filter(d => !existingIds.has(idKey(d)));
                    return [...prev, ...newRows];
                });
            }
            
            const hnp = meta.hasNextPage ?? (data.length === searchLimit);
            setHasNextPage(hnp);
            setTotalPages(meta.total ? Math.ceil(meta.total / searchLimit) : (hnp ? searchPage + 1 : searchPage));
        } catch (err) {
            console.error(err);
            const serverError = err.response?.data;
            const errorMsg = serverError
                ? typeof serverError === 'object' ? JSON.stringify(serverError, null, 2) : serverError
                : err.message;

            setError(`Erro ao carregar dados: ${errorMsg}`);
        } finally {
            if (searchPage === 1) setLoading(false);
            else setLoadingMore(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, filters.only_active]);

    // Auto-load all batches sequentially
    useEffect(() => {
        if (loading || loadingMore) return;
        if (hasNextPage) {
            const timer = setTimeout(() => {
                setPage(p => p + 1);
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [hasNextPage, loading, loadingMore]);

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

    const handleUpdateFaturamentoDate = React.useCallback((pedidoId, itemId, dateValue, newId) => {
        setOrders(prev => prev.map(o => {
            if (o.pedido === pedidoId && o.item === itemId) {
                const updatedForecasts = Array.isArray(o.pcp_programacoes) ? o.pcp_programacoes.map(p => {
                    return {
                        ...p,
                        id: newId || p.id,
                        data_prevista_faturamento: dateValue
                    };
                }) : o.pcp_programacoes;

                return {
                    ...o,
                    pcp_delivery_forecast_id: newId || o.pcp_delivery_forecast_id,
                    data_prevista_faturamento: dateValue,
                    pcp_programacoes: updatedForecasts
                };
            }
            return o;
        }));

        setSelectedItems(prev => {
            const copy = { ...prev };
            let updated = false;
            Object.keys(copy).forEach(key => {
                const item = copy[key];
                if (item.pedido === pedidoId && item.item === itemId) {
                    const updatedForecasts = Array.isArray(item.pcp_programacoes) ? item.pcp_programacoes.map(p => {
                        return {
                            ...p,
                            id: newId || p.id,
                            data_prevista_faturamento: dateValue
                        };
                    }) : item.pcp_programacoes;

                    copy[key] = {
                        ...item,
                        pcp_delivery_forecast_id: newId || item.pcp_delivery_forecast_id,
                        data_prevista_faturamento: dateValue,
                        pcp_programacoes: updatedForecasts
                    };
                    updated = true;
                }
            });
            return updated ? copy : prev;
        });
    }, []);

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
        let result = rows;
        
        if (filters.somente_prontos === 'true') {
            result = result.filter(r => isLastOpConcluido(r));
        }

        const getNestedValue = (row, key) => {
            if (['data_entrega_pcp', 'serie_cliente', 'serie_metalfisa', 'numero_serie', 'lote'].includes(key)) {
                return row._pcp_prog ? row._pcp_prog[key] : '';
            }
            return row[key];
        };

        // Apply column filters
        Object.keys(columnFilters).forEach(key => {
            const filterValue = (columnFilters[key] || '').toLowerCase();
            if (filterValue) {
                // Suporte para múltiplos valores separados por vírgula no filtro local
                const filterTerms = filterValue.split(',').map(t => t.trim()).filter(Boolean);
                if (filterTerms.length > 0) {
                    result = result.filter(r => {
                        const cellValue = String(getNestedValue(r, key) || '').toLowerCase();
                        return filterTerms.some(term => cellValue.includes(term));
                    });
                }
            }
        });

        // Apply sorting
        if (sortConfig.key) {
            result = [...result].sort((a, b) => {
                const aValue = getNestedValue(a, sortConfig.key);
                const bValue = getNestedValue(b, sortConfig.key);

                // Handle numeric sorting for known numeric fields
                const numericFields = ['valor_unitario', 'valor_total', 'quantidade', 'qtd_entreg', 'qtd_faturar', 'saldo_produzido', 'op_qtd'];
                if (numericFields.includes(sortConfig.key)) {
                    const diff = parseFloat(aValue || 0) - parseFloat(bValue || 0);
                    return sortConfig.direction === 'asc' ? diff : -diff;
                }

                const strA = String(aValue || '').toLowerCase();
                const strB = String(bValue || '').toLowerCase();
                if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [rows, filters.somente_prontos, columnFilters, sortConfig]);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleColumnFilterChange = (key, value) => {
        setColumnFilters(prev => ({ ...prev, [key]: value }));
    };

    // --- FATURAMENTO LOGIC ---
    const handleSelectItem = (row) => {
        const key = row._row_key;
        if (parseFloat(row.qtd_faturar) <= 0) return toast.warning('Este item não possui saldo para faturamento.');

        setSelectedItems(prev => {
            const copy = { ...prev };
            if (copy[key]) {
                delete copy[key];
                setCartApontamentos(aPrev => {
                    const aCopy = { ...aPrev };
                    delete aCopy[key];
                    return aCopy;
                });
                setCartQuantities(qPrev => {
                    const qCopy = { ...qPrev };
                    delete qCopy[key];
                    return qCopy;
                });
                setCartApontarQuantities(aqPrev => {
                    const aqCopy = { ...aqPrev };
                    delete aqCopy[key];
                    return aqCopy;
                });
            } else {
                copy[key] = row;
                const defaultQty = calcMaxQtd(row);
                setCartQuantities(qPrev => ({ ...qPrev, [key]: defaultQty }));
                setCartApontarQuantities(aqPrev => ({ ...aqPrev, [key]: defaultQty }));
                if (row.op_num_completa || row.op_num) {
                    setCartApontamentos(aPrev => ({ ...aPrev, [key]: true }));
                }
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
                availableRows.forEach(r => {
                    delete copy[r._row_key];
                    setCartApontamentos(aPrev => {
                        const aCopy = { ...aPrev };
                        delete aCopy[r._row_key];
                        return aCopy;
                    });
                    setCartQuantities(qPrev => {
                        const qCopy = { ...qPrev };
                        delete qCopy[r._row_key];
                        return qCopy;
                    });
                    setCartApontarQuantities(aqPrev => {
                        const aqCopy = { ...aqPrev };
                        delete aqCopy[r._row_key];
                        return aqCopy;
                    });
                });
                return copy;
            });
        } else {
            setSelectedItems(prev => {
                const copy = { ...prev };
                availableRows.forEach(r => {
                    copy[r._row_key] = r;
                    const defaultQty = calcMaxQtd(r);
                    setCartQuantities(qPrev => ({ ...qPrev, [r._row_key]: defaultQty }));
                    setCartApontarQuantities(aqPrev => ({ ...aqPrev, [r._row_key]: defaultQty }));
                    if (r.op_num_completa || r.op_num) {
                        setCartApontamentos(aPrev => ({ ...aPrev, [r._row_key]: true }));
                    }
                });
                return copy;
            });
        }
    };

    const handleCartApontamentoChange = (key, value) => {
        setCartApontamentos(prev => ({ ...prev, [key]: value }));
    };

    const handleCartQuantityChange = (key, value, maxVal) => {
        let val = parseFloat(value);
        if (isNaN(val)) val = '';
        if (val !== '' && val < 0) val = 0;
        if (val !== '' && val > maxVal) val = maxVal; // Limitador

        setCartQuantities(prev => ({ ...prev, [key]: val }));
    };

    const handleCartApontarQuantityChange = (key, value) => {
        let val = parseFloat(value);
        if (isNaN(val)) val = '';
        if (val !== '' && val < 0) val = 0;

        setCartApontarQuantities(prev => ({ ...prev, [key]: val }));
    };

    const handleSubmitFaturamento = async () => {
        const itemsToSubmit = Object.values(selectedItems).map(row => {
            const key = row._row_key;
            const prog = row._pcp_prog;
            return {
                ...row,
                quantidade_solicitada: cartQuantities[key] || 0,
                executar_apontamento: !!cartApontamentos[key],
                quantidade_apontamento: cartApontarQuantities[key] !== undefined ? cartApontarQuantities[key] : (cartQuantities[key] || 0),
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
            const responseData = await createFaturamentoSolicitacao({
                usuario: user?.nome || 'Sistema',
                observacao: cartObservacao,
                items: itemsToSubmit
            });
            
            // Salvar e exibir a confirmação síncrona do Protheus
            setConfirmationData(responseData);
            setShowConfirmationModal(true);

            setIsCartModalOpen(false);
            setSelectedItems({});
            setCartObservacao('');
            setCartQuantities({});
            setCartApontarQuantities({});
            setCartApontamentos({});
            
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

    const handleExportExcel = () => {
        if (filteredRows.length === 0) {
            toast.warning('Nenhum dado disponível para exportação.');
            return;
        }

        setExporting(true);
        setTimeout(() => {
            try {
                // Map column headers and extract values
                const exportData = filteredRows.map(row => {
                    const prog = row._pcp_prog;
                    
                    const baseData = {
                        'Pedido': row.pedido,
                        'Item': row.item,
                        'OP Original': row.op_num_completa || '',
                        'Código Produto': row.codigo,
                        'Descrição': row.descricao,
                        'Cliente': row.nome_cliente,
                        'Emissão': formatProtheusDate(row.emissao),
                        'Ped. Cli': row.ped_cliente || '',
                        'Desenho Cli.': row.ref_cliente || ''
                    };

                    // Financial columns (conditional)
                    if (canViewFinancials) {
                        baseData['V. Unit (R$)'] = parseFloat(row.valor_unitario) || 0;
                        baseData['V. Total (R$)'] = parseFloat(row.valor_total) || 0;
                    }

                    // Quantities
                    baseData['Qtd Tot.'] = parseFloat(row.quantidade) || 0;
                    baseData['Qtd Entr.'] = parseFloat(row.qtd_entreg) || 0;
                    baseData['Saldo'] = parseFloat(row.qtd_faturar) || 0;
                    
                    // Dates and PCP
                    baseData['Dt. Entrega'] = row.entrega ? formatProtheusDate(row.entrega) : '';
                    baseData['Data PCP'] = prog?.data_entrega_pcp ? new Date(prog.data_entrega_pcp).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '';
                    baseData['Prev. Fat.'] = row.data_prevista_faturamento ? formatProtheusDate(row.data_prevista_faturamento) : '';
                    
                    // Series & Lote
                    baseData['Série Cli.'] = prog?.serie_cliente || '';
                    baseData['Série MF'] = prog?.serie_metalfisa || '';
                    baseData['Nº Série'] = prog?.numero_serie || '';
                    baseData['Lote'] = prog?.lote || '';
                    
                    // Status and NF/Solicitacoes info
                    let statusLabel = 'A Faturar';
                    if (parseFloat(row.qtd_faturar) <= 0) statusLabel = 'Faturado 100%';
                    else if (parseFloat(row.qtd_entreg) > 0) statusLabel = 'Fat. Parcial';
                    baseData['Status'] = statusLabel;

                    // Faturamentos Solicitados
                    const faturamentosValidos = Array.isArray(row.faturamentos_solicitados)
                        ? row.faturamentos_solicitados.filter(fat => {
                            if (fat.pcp_forecast_id) return prog && fat.pcp_forecast_id == prog.id;
                            return true;
                        })
                        : [];
                    baseData['Fat. Solicitados'] = faturamentosValidos.map(fat => `${fat.numero_solicitacao} (${parseFloat(fat.quantidade_solicitada).toLocaleString()})`).join(', ');

                    // NFs Anteriores
                    const nfs = Array.isArray(row.notas_fiscais) ? row.notas_fiscais.filter(nf => nf && nf.nota && nf.nota.trim()) : [];
                    baseData['NFs Anteriores'] = nfs.map(nf => nf.nota).join(', ');

                    return baseData;
                });

                // Generate worksheet
                const worksheet = XLSX.utils.json_to_sheet(exportData);
                
                // Define column widths dynamically
                const colWidths = Object.keys(exportData[0] || {}).map(key => {
                    const maxLength = Math.max(
                        key.length,
                        ...exportData.map(item => String(item[key] || '').length)
                    );
                    return { wch: Math.min(maxLength + 3, 50) }; // Max width 50, padding 3
                });
                worksheet['!cols'] = colWidths;

                // Generate workbook
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Itens a Faturar');

                // Trigger file download using SheetJS which internally manages browser downloads correctly
                const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
                const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                downloadBlob(blob, `itens_a_faturar_${new Date().toISOString().slice(0, 10)}.xlsx`);
                toast.success('Relatório em Excel gerado com sucesso!');
            } catch (err) {
                console.error(err);
                toast.error('Erro ao gerar relatório.');
            } finally {
                setExporting(false);
            }
        }, 50);
    };

    return (
        <div className="p-2 md:p-4 lg:p-6 w-full h-[calc(100vh-64px)] flex flex-col animate-fadeIn relative">
            
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
                                            <th className="px-4 py-3 font-semibold text-center w-28">Apontar Prod.?</th>
                                            <th className="px-4 py-3 font-semibold text-center w-48">Qtd. Apontar</th>
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
                                                        {order._pcp_prog?.grid_entrega_pcp || order._pcp_prog?.serie_cliente || <span className="text-gray-300">—</span>}
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
                                                     <td className="px-4 py-2 text-center">
                                                         {order.op_num_completa || order.op_num ? (
                                                             <input
                                                                 type="checkbox"
                                                                 className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                                                 checked={cartApontamentos[key] ?? true}
                                                                 onChange={(e) => handleCartApontamentoChange(key, e.target.checked)}
                                                             />
                                                         ) : (
                                                             <span className="text-gray-400 text-[10px]">— (Sem OP)</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        {order.op_num_completa || order.op_num ? (
                                                            <div className="flex flex-col items-center gap-1">
                                                                <input
                                                                    type="number"
                                                                    min="0.01"
                                                                    step="0.01"
                                                                    className="w-24 px-2 py-1 text-right text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow disabled:bg-gray-100 disabled:text-gray-400"
                                                                    value={cartApontarQuantities[key] ?? ''}
                                                                    disabled={!(cartApontamentos[key] ?? true)}
                                                                    onChange={(e) => handleCartApontarQuantityChange(key, e.target.value)}
                                                                />
                                                                {(cartApontamentos[key] ?? true) && (
                                                                    <div className="flex flex-col gap-0.5 mt-0.5">
                                                                        <div className="flex justify-center gap-1.5 text-[9px]">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleCartApontarQuantityChange(key, order.op_qtd || 0)}
                                                                                className="px-1 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold border border-blue-200 rounded transition-colors"
                                                                                title={`Preencher com a quantidade total planejada da OP (${order.op_qtd || 0})`}
                                                                            >
                                                                                Total ({order.op_qtd || 0})
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleCartApontarQuantityChange(key, cartQuantities[key] || 0)}
                                                                                className="px-1 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 rounded transition-colors"
                                                                                title="Preencher com a mesma quantidade solicitada de faturamento"
                                                                            >
                                                                                Parcial ({cartQuantities[key] || 0})
                                                                            </button>
                                                                        </div>
                                                                        {order.saldo_produzido !== undefined && (
                                                                            <div className="text-[9px] text-gray-400 text-center font-medium">
                                                                                Apontado: {parseFloat(order.saldo_produzido).toLocaleString()}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-300 text-xs">—</span>
                                                        )}
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

            {/* MODAL DE CONFIRMAÇÃO DO PROTHEUS */}
            {showConfirmationModal && confirmationData && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-gray-100 transform transition-all">
                        {/* Header com base no status do Protheus */}
                        <div className={`p-6 text-white flex flex-col items-center gap-2 ${
                            !confirmationData.apontamento 
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-700' 
                                : confirmationData.apontamento.sucesso 
                                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600' 
                                    : 'bg-gradient-to-r from-amber-500 to-orange-600'
                        }`}>
                            <div className="p-3 bg-white/20 rounded-full">
                                {!confirmationData.apontamento ? (
                                    <FileText className="h-8 w-8 text-white" />
                                ) : confirmationData.apontamento.sucesso ? (
                                    <CheckSquare className="h-8 w-8 text-white" />
                                ) : (
                                    <AlertCircle className="h-8 w-8 text-white" />
                                )}
                            </div>
                            <h2 className="text-xl font-bold text-center mt-2">
                                {!confirmationData.apontamento 
                                    ? 'Solicitação Gerada' 
                                    : confirmationData.apontamento.sucesso 
                                        ? 'Faturamento & Apontamento Concluídos' 
                                        : 'Solicitação Criada com Avisos'}
                            </h2>
                            <p className="text-xs text-white/80">
                                Nº {confirmationData.numero_solicitacao}
                            </p>
                        </div>
                        
                        {/* Body */}
                        <div className="p-6 space-y-4">
                            <div className="text-sm text-gray-600">
                                A solicitação de faturamento foi registrada com sucesso no sistema.
                            </div>

                            {/* Informações de Apontamento no Protheus */}
                            {confirmationData.apontamento && (
                                <div className={`p-4 rounded-xl border text-sm ${
                                    confirmationData.apontamento.sucesso 
                                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900' 
                                        : 'bg-amber-50/50 border-amber-200 text-amber-900'
                                }`}>
                                    <div className="font-bold mb-1 flex items-center gap-1.5">
                                        {confirmationData.apontamento.sucesso ? (
                                            <>
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                                                Apontamento no Protheus OK!
                                            </>
                                        ) : (
                                            <>
                                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                                Apontamento Pendente (Protheus)
                                            </>
                                        )}
                                    </div>
                                    <div className="text-xs leading-relaxed mt-2 bg-white/60 p-2.5 rounded-lg border border-black/5 font-mono overflow-x-auto max-h-[150px]">
                                        {confirmationData.apontamento.sucesso ? (
                                            <div>
                                                O apontamento de produção foi realizado com sucesso para as OPs enviadas.
                                                <pre className="mt-1 text-[10px] text-gray-500">
                                                    {JSON.stringify(confirmationData.apontamento.resposta, null, 2)}
                                                </pre>
                                            </div>
                                        ) : (
                                            <div>
                                                Ocorreu um erro no retorno da integração com o Protheus:
                                                <div className="mt-1 font-bold text-red-600">
                                                    {confirmationData.apontamento.erro || 'Erro desconhecido'}
                                                </div>
                                                {confirmationData.apontamento.detalhe && (
                                                    <pre className="mt-1 text-[10px] text-gray-500 bg-gray-50 p-1.5 rounded">
                                                        {typeof confirmationData.apontamento.detalhe === 'object' 
                                                            ? JSON.stringify(confirmationData.apontamento.detalhe, null, 2) 
                                                            : String(confirmationData.apontamento.detalhe)}
                                                    </pre>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {!confirmationData.apontamento && (
                                <div className="p-4 rounded-xl border border-blue-150 bg-blue-50/30 text-blue-900 text-sm">
                                    <div className="font-semibold mb-1">Nenhum Apontamento de Produção Solicitado.</div>
                                    <div className="text-xs text-gray-500">
                                        Os itens desta solicitação não continham ordens de produção ativas ou a opção de apontamento não foi selecionada pelo operador.
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => {
                                    setShowConfirmationModal(false);
                                    setConfirmationData(null);
                                }}
                                className="px-5 py-2.5 text-sm font-semibold text-white bg-gray-800 hover:bg-gray-900 rounded-xl transition-all shadow-sm"
                            >
                                Fechar Confirmação
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col flex-1 overflow-hidden relative">
                {canViewFinancialTab && (
                    <div className="flex border-b border-gray-200 bg-slate-50/80 px-4 shrink-0 gap-1">
                        <button
                            type="button"
                            onClick={() => setActiveTab('itens')}
                            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 -mb-px ${activeTab === 'itens' ? 'border-blue-600 text-blue-600 font-extrabold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            <LayoutList className="h-4 w-4" />
                            Itens a Faturar
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('financeiro')}
                            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 -mb-px ${activeTab === 'financeiro' ? 'border-blue-600 text-blue-600 font-extrabold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            <BarChart2 className="h-4 w-4" />
                            Dados Financeiros
                        </button>
                    </div>
                )}

                {activeTab === 'itens' ? (
                    <>
                        <div className="p-4 border-b border-gray-100 bg-white shrink-0 flex flex-col justify-between md:flex-row gap-4">
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
                        <button
                            type="button"
                            onClick={handleExportExcel}
                            disabled={exporting || filteredRows.length === 0}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-sm px-4 py-2 flex items-center gap-2 transition-colors shadow-sm whitespace-nowrap disabled:opacity-50"
                            title="Exportar dados filtrados do grid para Excel"
                        >
                            {exporting ? (
                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <FileText className="h-4 w-4" />
                            )}
                            Exportar Excel
                        </button>
                        <Link to="/vendas/faturamento-historico" className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-medium rounded-lg text-sm px-4 py-2 flex items-center gap-2 transition-colors shadow-sm whitespace-nowrap">
                            <History className="h-4 w-4 text-blue-600" /> Histórico de Solicitações
                        </Link>
                    </div>
                </div>

                <div className="p-4 border-b border-gray-100 bg-white shrink-0">
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
                            <label className="text-[11px] font-medium text-gray-600 ml-1">Pedido(s):</label>
                            <div className="relative">
                                <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                <input
                                    type="text"
                                    name="pedido"
                                    placeholder="Ex: 4002, 4951..."
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
                                        onChange={(e) => {
                                            setPage(1);
                                            setFilters(prev => ({ ...prev, only_active: e.target.checked ? 'true' : 'false' }));
                                        }}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                    <span className="ml-3 text-sm font-medium text-gray-700">Apenas Pendentes (Esconde o que j&aacute; foi faturado)</span>
                                </label>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={filters.somente_prontos === 'true'}
                                        onChange={(e) => {
                                            setPage(1);
                                            setFilters(prev => ({ ...prev, somente_prontos: e.target.checked ? 'true' : 'false' }));
                                        }}
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

                <div className="overflow-auto flex-1">
                    <table className="w-full text-sm text-left text-gray-500 whitespace-nowrap relative">
                        <thead className="text-[11px] text-gray-700 uppercase bg-slate-50 border-b border-gray-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-3 py-3 w-10 text-center align-top pt-5">
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
                                <th className="px-3 py-3 font-semibold text-center w-8 align-top pt-5">PDF</th>
                                <SortableHeader label="Pedido." columnKey="pedido" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['pedido']} onFilterChange={handleColumnFilterChange} />
                                <SortableHeader label="Item" columnKey="item" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['item']} onFilterChange={handleColumnFilterChange} />
                                <SortableHeader label="OP Original" columnKey="op_num_completa" align="center" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['op_num_completa']} onFilterChange={handleColumnFilterChange} />
                                <SortableHeader label="Cód. Produto" columnKey="codigo" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['codigo']} onFilterChange={handleColumnFilterChange} />
                                <SortableHeader label="Descrição" columnKey="descricao" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['descricao']} onFilterChange={handleColumnFilterChange} className="w-40" />
                                <SortableHeader label="Cliente" columnKey="nome_cliente" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['nome_cliente']} onFilterChange={handleColumnFilterChange} className="w-32" />
                                <SortableHeader label="Emissão" columnKey="emissao" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['emissao']} onFilterChange={handleColumnFilterChange} />
                                <SortableHeader label="Ped. Cli" columnKey="ped_cliente" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['ped_cliente']} onFilterChange={handleColumnFilterChange} />
                                <SortableHeader label="Desenho Cli." columnKey="ref_cliente" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['ref_cliente']} onFilterChange={handleColumnFilterChange} />
                                {canViewFinancials && <SortableHeader label="V. Unit (R$)" columnKey="valor_unitario" align="right" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['valor_unitario']} onFilterChange={handleColumnFilterChange} className="text-gray-700" />}
                                {canViewFinancials && <SortableHeader label="V. Total (R$)" columnKey="valor_total" align="right" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['valor_total']} onFilterChange={handleColumnFilterChange} className="text-gray-700" />}
                                <SortableHeader label="Qtd Tot." columnKey="quantidade" align="right" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['quantidade']} onFilterChange={handleColumnFilterChange} />
                                <SortableHeader label="Qtd Entr." columnKey="qtd_entreg" align="right" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['qtd_entreg']} onFilterChange={handleColumnFilterChange} />
                                <SortableHeader label="Saldo" columnKey="qtd_faturar" align="right" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['qtd_faturar']} onFilterChange={handleColumnFilterChange} className="text-blue-700" />
                                <SortableHeader label="Dt. Entrega" columnKey="entrega" align="center" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['entrega']} onFilterChange={handleColumnFilterChange} className="text-gray-600" />
                                <SortableHeader label="Data PCP" columnKey="data_entrega_pcp" align="center" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['data_entrega_pcp']} onFilterChange={handleColumnFilterChange} className="text-indigo-700" />
                                <SortableHeader label="Prev. Fat." columnKey="data_prevista_faturamento" align="center" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['data_prevista_faturamento']} onFilterChange={handleColumnFilterChange} className="text-teal-700" />
                                <SortableHeader label="Série Cli." columnKey="serie_cliente" align="center" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['serie_cliente']} onFilterChange={handleColumnFilterChange} className="text-indigo-700" />
                                <SortableHeader label="Série MF" columnKey="serie_metalfisa" align="center" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['serie_metalfisa']} onFilterChange={handleColumnFilterChange} className="text-indigo-700" />
                                <SortableHeader label="Nº Série" columnKey="numero_serie" align="center" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['numero_serie']} onFilterChange={handleColumnFilterChange} className="text-indigo-700" />
                                <SortableHeader label="Lote" columnKey="lote" align="center" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['lote']} onFilterChange={handleColumnFilterChange} className="text-indigo-700" />
                                <th className="px-3 py-3 font-semibold text-center align-top pt-5">Status</th>
                                <th className="px-3 py-3 font-semibold text-center text-cyan-700 align-top pt-5">Fat. Solicitados</th>
                                <SortableHeader label="NFs Anteriores" columnKey="nfs_anteriores" align="center" sortConfig={sortConfig} requestSort={requestSort} filterValue={columnFilters['nfs_anteriores']} onFilterChange={handleColumnFilterChange} />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-[13px]">
                            {loading ? (
                                <tr>
                                    <td colSpan={canViewFinancials ? 25 : 23} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                                            <span className="text-gray-400 font-medium">Carregando itens...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={canViewFinancials ? 25 : 23} className="px-6 py-12 text-center text-red-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <AlertCircle className="h-8 w-8" />
                                            <span className="font-semibold">{error}</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={canViewFinancials ? 25 : 23} className="px-6 py-12 text-center text-gray-400">
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
                                            <td className="px-2 py-2 text-center text-xs text-gray-500 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                {order.entrega ? formatProtheusDate(order.entrega) : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-2 py-2 text-center text-xs font-bold text-indigo-700 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                {prog?.data_entrega_pcp ? new Date(prog.data_entrega_pcp).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-2 py-2 text-center text-xs whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                <BillingForecastInput
                                                    item={order}
                                                    user={user}
                                                    onUpdateSuccess={handleUpdateFaturamentoDate}
                                                />
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

                {/* Status de Carregamento Contínuo */}
                {totalPages > 0 && (
                    <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50/50 pb-20">
                        <span className="text-sm text-gray-500">
                            Carregados <span className="font-medium text-gray-900">{orders.length}</span> registros 
                            (Página {page} de {totalPages})
                        </span>
                        <div className="flex gap-2 items-center">
                            {loadingMore && (
                                <div className="flex items-center gap-2 text-blue-600 text-sm">
                                    <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="font-medium">Carregando mais...</span>
                                </div>
                            )}
                            {!loadingMore && page >= totalPages && (
                                <span className="text-sm text-green-600 font-medium">Todos os itens carregados</span>
                            )}
                        </div>
                    </div>
                )}
                    </>
                ) : (
                    <FinancialView 
                        rows={rows} 
                        loading={loading} 
                        error={error} 
                    />
                )}
            </div>

            {/* FLOATING ACTION BAR FOR CART */}
            {activeTab === 'itens' && numSelected > 0 && (
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

                    <button
                        onClick={() => setShowLabelModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl px-5 py-2.5 flex items-center gap-2 transition-transform shadow-lg hover:scale-105"
                        title="Imprimir etiquetas de identificação dos itens selecionados"
                    >
                        <Printer className="h-5 w-5" />
                        Etiquetas
                    </button>
                </div>
            )}

            <style>{`
                @keyframes translateUp {
                    from { transform: translate(-50%, 100%); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
            `}</style>

            {/* LABEL PRINT MODAL */}
            {showLabelModal && Object.values(selectedItems).length > 0 && (
                <LabelPrintModal
                    items={Object.values(selectedItems)}
                    onClose={() => setShowLabelModal(false)}
                />
            )}
        </div>
    );
};

export default ItensAFaturar;
