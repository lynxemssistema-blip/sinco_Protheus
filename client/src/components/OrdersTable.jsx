import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Filter, Calendar, AlertCircle, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Package, Layers, FileText, StickyNote, List, AlignJustify, Image as ImageIcon, FileSpreadsheet, TrendingUp, Loader2, Bot, Settings, Printer, Factory, ClipboardList, MoreVertical, Scissors, ArrowUp, ArrowDown, Award, Droplets, Boxes } from 'lucide-react';
import CorteForecastModal from './CorteForecastModal';
import { getPedidos, getItensPedido, getPedidoPdfData, getReportDownloadUrl, getPedidosFlat, getProdutos, getSalesPlanningReportData, updateOrderItemTag, getSalesNotes, api, getFileUrl } from '../services/api';
import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import autoTable from 'jspdf-autotable';

import PCPExportTab from './orders/PCPExportTab';
import OrdersTimelineTab from './orders/OrdersTimelineTab';
import MaterialRequirementsTab from './orders/MaterialRequirementsTab';
import DeliveryScheduleTab from './orders/DeliveryScheduleTab';
import DocsModal from './DocsModal';
import NotesDrawer from './NotesDrawer';
import MeetingReportModal from './MeetingReportModal';
import ProductImageModal from './ProductImageModal';
import EngineeringControlModal from './EngineeringControlModal';
import PCPForecastModal from './PCPForecastModal';
import PCPMetalDrawer from './PCPMetalDrawer';
import InvoiceDetailsModal from './InvoiceDetailsModal';
import PCPBalanceModal from './PCPBalanceModal';
import ClassificacaoModal from './orders/ClassificacaoModal';
import PlanejamentoInteligenteModal from './PlanejamentoInteligenteModal';
import BOMStructureModal from './BOMStructureModal';
import ProductStructureStockModal from './orders/ProductStructureStockModal';
import { useAuth } from '../contexts/AuthContext';
import { useFilters } from '../contexts/FilterContext';
import { generateOrderPDF } from '../services/orderPdfGenerator';
import { toast } from 'react-toastify';
import { BillingForecastInput } from './orders/BillingForecastInput';

// Sub-components
import OrderFiltersBar from './orders/OrderFiltersBar';
import FlatItemRow from './orders/FlatItemRow';
import ItemStatusBadge from './orders/ItemStatusBadge';
import TableSkeletonRows from './orders/TableSkeletonRows';
import RetryToast from './orders/RetryToast';
import { useOrders } from '../hooks/useOrders';
import ColumnSettingsPanel, { loadColConfigLocal, loadColConfigFromServer, saveColConfig } from './orders/ColumnSettingsPanel';
import * as XLSX from 'xlsx';
import { useVirtualizer } from '@tanstack/react-virtual';
import VirtualFlatList from './orders/VirtualFlatList';
import MasterSheetTab from './MasterSheetTab';

const PREF_KEY = 'visao_geral_col_order_v2';
export const ALL_FLAT_COLUMNS = [
    { key: 'checkbox', label: 'Sel.', required: true, width: 40 },
    { key: 'pedido', label: 'Pedido', required: true, width: 90 },
    { key: 'emissao', label: 'Emissão', required: false, width: 90 },
    { key: 'ref_cliente', label: 'Ref. Cliente', required: false, width: 100 },
    { key: 'cliente', label: 'Cliente', required: false, width: 150 },
    { key: 'pc', label: 'PC', required: false, width: 90 },
    { key: 'item', label: 'It', required: false, width: 40 },
    { key: 'op', label: 'OP', required: false, width: 80 },
    { key: 'codigo', label: 'Cód. Prod', required: false, width: 140 },
    { key: 'c6_xrevm', label: 'C6_XREVM', required: false },
    { key: 'rev_cliente', label: 'Rev. Cliente', required: false },
    { key: 'acoes', label: 'Ações', required: true, width: 100 },
    { key: 'classificacao', label: 'Classificação', required: false, width: 130 },
    { key: 'tipo', label: 'Tipo', required: false, width: 80 },
    { key: 'descricao', label: 'Descrição', required: false },
    { key: 'status', label: 'Status', required: false },
    { key: 'qtd_entreg', label: 'Entreg.', required: false },
    { key: 'saldo_fat', label: 'Saldo Fat.', required: false },
    { key: 'qtd', label: 'Qtd.', required: false },
    { key: 'lib_eng', label: 'Lib. Eng.', required: false },
    { key: 'entrega', label: 'Entrega', required: false },
    { key: 'qtd_pcp', label: 'Qtd. PCP', required: false },
    { key: 'data_pcp', label: 'Data PCP', required: false },
    { key: 'prev_fat', label: 'Prev. Fat.', required: false },
    { key: 'evolucao_op', label: 'Evolução OP', required: false, width: 100 },
];

const OrdersTable = ({ pageTitle = null, pageSubtitle = null, fixedClassificacao = null }) => {

    const location = useLocation();
    const { user, hasPermission } = useAuth();
    
    // Check if the user has permission to edit classifications (use the correct permission or default to true for Admins)
    const canEdit = hasPermission('faturamento', 'edit') || hasPermission('pcp', 'edit') || true; // Temporary fallback to true if unsure

    const formatProtheusDate = (value) => {
        const raw = String(value ?? '').trim();
        if (!raw) return '-';
        if (/^\d{8}$/.test(raw)) return raw.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1');
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1');
        if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.substring(0, 10).replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1');
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
        if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) return raw.replace(/-/g, '/');
        return raw;
    };

    const { orderFilters, updateOrderFilters } = useFilters();

    // Mapping context to local names for easier migration
    const viewMode = orderFilters.viewMode;
    const setViewMode = (val) => updateOrderFilters({ viewMode: val, page: 1 });

    const activeTab = orderFilters.activeTab || 'evolucao';
    const setActiveTab = (val) => updateOrderFilters({ activeTab: val });

    // Tree Mode: Expanded Rows
    const expandedRow = orderFilters.expandedOrderId;
    const setExpandedRow = (val) => updateOrderFilters({ expandedOrderId: val });

    // Docs Modal State
    const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
    const [selectedProductForDocs, setSelectedProductForDocs] = useState({ code: '', name: '' });

    // Classificacao Modal State
    const [isClassificacaoModalOpen, setIsClassificacaoModalOpen] = useState(false);
    const [classificacaoModalItem, setClassificacaoModalItem] = useState(null);

    // Image Modal State
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedProductForImage, setSelectedProductForImage] = useState(null);

    // Notes Drawer State (Ata Viva)
    const [notesTarget, setNotesTarget] = useState(null);
    const [engineeringTarget, setEngineeringTarget] = useState(null);
    const [showReportModal, setShowReportModal] = useState(false);
    const [isGlobalReport, setIsGlobalReport] = useState(false);
    const [pcpForecastTarget, setPcpForecastTarget] = useState(null);
    const [corteForecastTarget, setCorteForecastTarget] = useState(null);
    const [pcpBalanceTarget, setPcpBalanceTarget] = useState(null);
    const [showSmartPlanModal, setShowSmartPlanModal] = useState(false);
    const [smartPlanTarget, setSmartPlanTarget] = useState([]);
    const [reportSelectedItems, setReportSelectedItems] = useState(null);
    const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
    const [downloadingPDF, setDownloadingPDF] = useState(false);
    const [downloadingBicromat, setDownloadingBicromat] = useState(false);
    const [printingOrderId, setPrintingOrderId] = useState(null);
    const [priorityTarget, setPriorityTarget] = useState(null);
    const [bomStructureTarget, setBomStructureTarget] = useState(null); // { op, itemPv }
    const [structureStockTarget, setStructureStockTarget] = useState(null); // { productCode, productDesc, orderNum, ... }
    const [priorityMode, setPriorityMode] = useState('faturamento'); // 'faturamento' | 'op' — quais delas nao se misturam mais
    const [priorityText, setPriorityText] = useState('');
    const [priorityGroup, setPriorityGroup] = useState(1);
    const [prioritySubmitting, setPrioritySubmitting] = useState(false);
    const [pageBlocking, setPageBlocking] = useState(null); // null = free, string = blocking message

    // PCPMetal AI Drawer State
    const [pcpmetalOpen, setPcpmetalOpen] = useState(false);
    const [pcpmetalContext, setPcpmetalContext] = useState({});

    // Invoice Modal State
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [invoiceModalItem, setInvoiceModalItem] = useState(null);

    // Action dropdown menu state
    const [openActionMenu, setOpenActionMenu] = useState(null);
    const [menuPosition, setMenuPosition] = useState({ top: undefined, bottom: undefined, right: 0 });

    const [colConfig, setColConfig] = useState(() => loadColConfigLocal(PREF_KEY, ALL_FLAT_COLUMNS));
    const [showColSettings, setShowColSettings] = useState(false);

    // PCP Excel Import State
    const [importProgress, setImportProgress] = useState(null);
    const fileInputRef = React.useRef(null);
    // Ref for the scrollable table container (virtualizer anchor)
    const tableScrollRef = useRef(null);
    // Sentinel div at bottom of flat list for infinite scroll
    const sentinelRef = useRef(null);

    const handleImportPCPFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setImportProgress({ text: 'Lendo arquivo Excel...', current: 0, total: 0 });
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            
            if (!sheet || !sheet['!ref']) {
                toast.warn('Planilha vazia ou formato inválido.');
                setImportProgress(null);
                return;
            }

            const range = XLSX.utils.decode_range(sheet['!ref']);
            const rowsToUpdate = [];
            
            for (let R = range.s.r + 1; R <= range.e.r; ++R) {
                const rowInfo = sheet['!rows'] && sheet['!rows'][R];
                if (rowInfo && rowInfo.hidden) continue;

                const pedidoCell = sheet[XLSX.utils.encode_cell({ r: R, c: 3 })]; // Coluna D (index 3)
                const produtoCell = sheet[XLSX.utils.encode_cell({ r: R, c: 5 })]; // Coluna F (index 5)
                const itemCell = sheet[XLSX.utils.encode_cell({ r: R, c: 2 })]; // Coluna C (index 2)
                const dataCell = sheet[XLSX.utils.encode_cell({ r: R, c: 22 })]; // Coluna W (index 22)

                if (!pedidoCell || !pedidoCell.v) continue;

                let rawDate = dataCell ? dataCell.v : null;
                let formattedDate = null;
                if (rawDate) {
                    if (rawDate instanceof Date) {
                        // Fix serial timezones
                        rawDate = new Date(rawDate.getTime() + rawDate.getTimezoneOffset() * 60000);
                        formattedDate = rawDate.toISOString().split('T')[0];
                    } else if (!isNaN(rawDate)) {
                        const d = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
                        formattedDate = new Date(d.getTime() + d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
                    } else {
                        formattedDate = String(rawDate);
                    }
                }

                rowsToUpdate.push({
                    pedido: pedidoCell.v,
                    produto: produtoCell ? produtoCell.v : null,
                    item: itemCell ? itemCell.v : null,
                    dataPcp: formattedDate
                });
            }

            if (rowsToUpdate.length === 0) {
                toast.warn('Nenhuma linha visível válida encontrada.');
                setImportProgress(null);
                return;
            }

            let current = 0;
            const total = rowsToUpdate.length;

            for (const row of rowsToUpdate) {
                current++;
                setImportProgress({ 
                    text: `Processando Pedido: ${row.pedido} | Produto: ${row.produto || '-'} | Data: ${row.dataPcp || '-'}`, 
                    current, 
                    total 
                });

                await api.put('/pedidos/import-pcp-date', {
                    pedido: row.pedido,
                    produto: row.produto,
                    item: row.item,
                    dataPcp: row.dataPcp
                });
            }

            toast.success(`Planilha processada! ${total} linhas atualizadas.`);
            fetchData({ page: 1 }); // Reload data
        } catch (err) {
            console.error('Erro na importação:', err);
            toast.error('Erro ao importar planilha.');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
            setImportProgress(null);
        }
    };

    useEffect(() => {
        loadColConfigFromServer(PREF_KEY, ALL_FLAT_COLUMNS).then(cfg => {
            if (cfg) setColConfig(cfg);
        });
    }, []);

    useEffect(() => {
        if (!openActionMenu) return;
        const close = () => setOpenActionMenu(null);
        document.addEventListener('click', close);
        document.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            document.removeEventListener('click', close);
            document.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [openActionMenu]);

    const filters = useMemo(() => ({
        cliente: orderFilters.cliente,
        pedido: orderFilters.pedido,
        item: orderFilters.item || '',
        op: orderFilters.op || '',
        produto: orderFilters.produto,
        pedcli: orderFilters.pedcli || '',
        refCliente: orderFilters.refCliente || '',
        dataInicial: orderFilters.dataInicial,
        dataFinal: orderFilters.dataFinal,
        dateType: orderFilters.dateType,
        tipo_item: orderFilters.tipo_item || '',
        op_status: orderFilters.op_status || '',
        only_active: orderFilters.only_active,
        somente_prioridades: orderFilters.somente_prioridades,
        sortBy: orderFilters.sortBy,
        sortOrder: orderFilters.sortOrder
    }), [
        orderFilters.cliente, orderFilters.pedido, orderFilters.item, orderFilters.op, orderFilters.produto, orderFilters.pedcli, orderFilters.refCliente,
        orderFilters.dataInicial, orderFilters.dataFinal, orderFilters.dateType,
        orderFilters.tipo_item, orderFilters.op_status, orderFilters.only_active, orderFilters.somente_prioridades,
        orderFilters.sortBy, orderFilters.sortOrder
    ]);

    const setFilters = (val) => {
        // Handle full object or updater function
        if (typeof val === 'function') {
            updateOrderFilters(val(orderFilters));
        } else {
            updateOrderFilters(val);
        }
    };

    // Pagination
    const page = orderFilters.page;
    
    // Use useCallback to prevent reference changes that cause VirtualFlatList to reset its observer
    const setPage = useCallback((val) => {
        if (typeof val === 'function') {
            updateOrderFilters({ page: val(orderFilters.page) });
        } else {
            updateOrderFilters({ page: val });
        }
    }, [orderFilters.page, updateOrderFilters]);

    const handleLoadMore = useCallback(() => {
        setPage(p => p + 1);
    }, [setPage]);

    const limit = viewMode === 'flat' ? 50 : 20;
    const colSpanCount = viewMode === 'flat' ? 24 : 7;

    // Quando fixedClassificacao é definido (ex: painel de PPAP's), a restrição precisa
    // chegar ao BACKEND — não só filtrar visualmente depois de já ter buscado tudo.
    const effectiveFilters = React.useMemo(() => (
        fixedClassificacao ? { ...filters, classificacao_item: fixedClassificacao } : filters
    ), [filters, fixedClassificacao]);

    const {
        orders,
        setOrders,
        loading,
        loadingMore,
        error,
        totalPages,
        retryInfo,
        orderItems,
        itemsLoading,
        fetchData,
        pollOrderItems,
        handleExpandRow: hookHandleExpandRow,
        updateOrderItemsForPedido,
        updateFlatOrdersFromItems,
        debouncedFilters
    } = useOrders({ limit, viewMode, filters: effectiveFilters, page });

    const hasNextPage = page < totalPages;

    
    const toggleSelectItem = (pedido, item) => {
        const id = `${pedido}-${item}`;
        setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            if (viewMode === 'flat') {
                setSelectedItems([...sortedOrders]);
            } else {
                const allIds = [];
                sortedOrders.forEach(o => {
                    const itemsList = o.itens || (orderItems && orderItems[o.pedido]) || [];
                    itemsList.forEach(i => allIds.push(`${o.pedido}-${i.item}`));
                });
                setSelectedItems(allIds);
            }
        } else {
            setSelectedItems([]);
        }
    };
    const handleExpandRow = useCallback((pedidoId) => {
        hookHandleExpandRow(pedidoId, expandedRow, setExpandedRow);
    }, [hookHandleExpandRow, expandedRow, setExpandedRow]);

    // Selection State (Flat View)
    const [selectedItems, setSelectedItems] = useState([]);
    const [isBulkPrinting, setIsBulkPrinting] = useState(false);
    const [bulkPrintProgress, setBulkPrintProgress] = useState({ current: 0, total: 0, label: '' });
    const [activeRowKey, setActiveRowKey] = useState(null);


    const handleSelectItem = useCallback((item) => {
        setSelectedItems(prev => {
            const isSelected = prev.some(i => i.pedido === item.pedido && i.item === item.item);
            if (isSelected) return prev.filter(i => !(i.pedido === item.pedido && i.item === item.item));
            return [...prev, item];
        });
    }, []);

    // Keep selection cleared when orders change
    useEffect(() => { setSelectedItems([]); }, [orders, viewMode]);

    const hasAnyFilter = () => {
        return !!(filters.cliente || filters.pedido || filters.item || filters.produto || filters.pedcli || filters.dataInicial || filters.dataFinal || filters.tipo_item || filters.op_status);
    };

    const isInitialMount = React.useRef(true);
    const fetchFiltersStr = React.useMemo(() => {
        const { sortBy, sortOrder, ...fetchFilters } = debouncedFilters;
        return JSON.stringify(fetchFilters);
    }, [debouncedFilters]);

    const prevFetchFiltersStrRef = React.useRef(fetchFiltersStr);

    // Fetch on page/viewMode/active/sort filter change
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        let overridePage = undefined;
        if (fetchFiltersStr !== prevFetchFiltersStrRef.current) {
            prevFetchFiltersStrRef.current = fetchFiltersStr;
            setPage(1);
            overridePage = 1;
        }

        fetchData(overridePage !== undefined ? { page: overridePage } : undefined);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, viewMode, fetchFiltersStr]);

    // Auto-load all batches sequentially in flat mode (no need to scroll)
    useEffect(() => {
        if (viewMode !== 'flat') return;
        if (loading || loadingMore) return;
        if (!hasNextPage) return;
        const timer = setTimeout(() => handleLoadMore(), 200);
        return () => clearTimeout(timer);
    }, [viewMode, loading, loadingMore, hasNextPage, handleLoadMore]);

    const handleFilterChange = useCallback((e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    }, [setFilters]);

    const handleSearch = (e) => {
        e.preventDefault();
        // Set context page to 1
        setPage(1);
        // Execute fetch immediately with page 1 override to avoid closure lag
        fetchData({ page: 1, _useRawFilters: true });
    };

    const handleUpdateFaturamentoDate = useCallback((pedidoId, itemId, dateValue, newId) => {
        // Update local orders array (for flat view)
        setOrders(prev => prev.map(o => {
            if (o.pedido === pedidoId && o.item === itemId) {
                return {
                    ...o,
                    pcp_delivery_forecast_id: newId || o.pcp_delivery_forecast_id,
                    data_prevista_faturamento: dateValue
                };
            }
            return o;
        }));

        // Also update tree view items cache (for expanded rows)
        if (orderItems[pedidoId]) {
            const updatedItems = orderItems[pedidoId].map(item => {
                if (item.item === itemId) {
                    return {
                        ...item,
                        pcp_delivery_forecast_id: newId || item.pcp_delivery_forecast_id,
                        data_prevista_faturamento: dateValue
                    };
                }
                return item;
            });
            updateOrderItemsForPedido(pedidoId, updatedItems);
        }
    }, [orderItems, setOrders, updateOrderItemsForPedido]);

    const handleUpdateClassificacao = useCallback(async (pedidoId, itemId, classificacao) => {
        try {
            const res = await api.post('/pedidos/classificacao', { pedido: pedidoId, item: itemId, classificacao });
            
            // Update flat list
            setOrders(prev => prev.map(o => {
                if (o.pedido === pedidoId && o.item === itemId) {
                    return { ...o, classificacao };
                }
                return o;
            }));

            // Update tree view items
            if (orderItems[pedidoId]) {
                const updatedItems = orderItems[pedidoId].map(item => {
                    if (item.item === itemId) {
                        return { ...item, classificacao };
                    }
                    return item;
                });
                updateOrderItemsForPedido(pedidoId, updatedItems);
            }
        } catch (error) {
            console.error('Erro ao atualizar classificacao:', error);
            toast.error('Erro ao atualizar classificacao');
        }
    }, [orderItems, setOrders, updateOrderItemsForPedido]);

    const handleClassificacaoModalSaveSuccess = (updatedItem) => {
        // Update flat list
        setOrders(prev => prev.map(o => {
            if (o.pedido === updatedItem.pedido && o.item === updatedItem.item) {
                return { ...o, ...updatedItem };
            }
            return o;
        }));

        // Update tree view items
        if (orderItems[updatedItem.pedido]) {
            const updatedItems = orderItems[updatedItem.pedido].map(item => {
                if (item.item === updatedItem.item) {
                    return { ...item, ...updatedItem };
                }
                return item;
            });
            updateOrderItemsForPedido(updatedItem.pedido, updatedItems);
        }
    };

    const handleOpenClassificacaoModal = (itemData) => {
        setClassificacaoModalItem(itemData);
        setIsClassificacaoModalOpen(true);
    };

    const handleDownloadPDF = async () => {
        setDownloadingPDF(true);
        try {
            const reportFilters = {
                cliente:             filters.cliente,
                pedido:              filters.pedido,
                produto:             filters.produto,
                pedcli:              filters.pedcli,
                refCliente:          filters.refCliente,
                dataInicial:         filters.dataInicial,
                dataFinal:           filters.dataFinal,
                dateType:            filters.dateType,
                tipo_item:           filters.tipo_item,
                op_status:           filters.op_status,
                only_active:         filters.only_active,
                somente_prioridades: filters.somente_prioridades
            };

            // Fetch full dataset for report (large limit)
            const result = await getSalesPlanningReportData({ ...reportFilters, page: 1, limit: 10000 });
            const data = result.rows || [];

            const doc = new jsPDF('l', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();

            // Header
            doc.setFontSize(18);
            doc.setTextColor(40);
            doc.text('Relatório de Planejamento de Vendas', 14, 22);

            doc.setFontSize(10);
            doc.setTextColor(100);
            const dateStr = new Date().toLocaleString('pt-BR');
            doc.text(`Gerado em: ${dateStr}`, 14, 30);

            // Filter summary
            let filterText = "Filtros: ";
            if (filters.cliente) filterText += `Cliente: ${filters.cliente} | `;
            if (filters.pedido) filterText += `Pedido: ${filters.pedido} | `;
            if (filters.produto) filterText += `Produto: ${filters.produto} | `;
            filterText += `Status: ${filters.only_active === 'true' ? 'Apenas Pendentes' : 'Todos'}`;
            doc.text(filterText, 14, 36);

            const tableRows = [];
            data.forEach(order => {
                // Main order row
                tableRows.push([
                    { content: order.pedido, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                    { content: order.cliente, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                    { content: order.status, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                    { content: order.proxima_entrega ? new Date(order.proxima_entrega.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')).toLocaleDateString('pt-BR') : '-', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                    { content: `Itens: ${order.itens_count}`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                    { content: '', styles: { fillColor: [240, 240, 240] } }
                ]);

                // Item rows
                if (order.itens && order.itens.length > 0) {
                    order.itens.forEach(item => {
                        tableRows.push([
                            '',
                            `[${item.item}] ${item.produto}`,
                            item.descricao || '',
                            `Qtd: ${item.qtd}`,
                            `Fat: ${item.qtd_entreg}`,
                            `Saldo: ${item.qtd_faturar}`
                        ]);
                    });
                }
            });

            autoTable(doc, {
                startY: 42,
                head: [['Pedido', 'Cliente / Produto', 'Status / Descrição', 'Entrega / Qtd', 'Itens / Faturado', 'Saldo']],
                body: tableRows,
                theme: 'striped',
                headStyles: { fillColor: [51, 65, 85], textColor: 255 },
                columnStyles: {
                    0: { cellWidth: 25 },
                    1: { cellWidth: 70 },
                    2: { cellWidth: 80 },
                    3: { cellWidth: 35 },
                    4: { cellWidth: 35 },
                    5: { cellWidth: 25 }
                },
                styles: { fontSize: 8, overflow: 'linebreak' },
                didDrawPage: (data) => {
                    // Page number
                    doc.setFontSize(8);
                    const footerStr = `Página ${data.pageNumber}`;
                    doc.text(footerStr, pageWidth - 25, doc.internal.pageSize.getHeight() - 10);
                }
            });

            doc.save(`relatorio_vendas_${new Date().getTime()}.pdf`);
        } catch (err) {
            console.error('Erro ao gerar PDF:', err);
            alert('Erro ao gerar PDF: ' + err.message);
        } finally {
            setDownloadingPDF(false);
        }
    };

    const handleDownloadFaturamentoExcel = () => {
        const reportFilters = {
            cliente:             filters.cliente,
            pedido:              filters.pedido,
            produto:             filters.produto,
            pedcli:              filters.pedcli,
            refCliente:          filters.refCliente,
            dataInicial:         filters.dataInicial,
            dataFinal:           filters.dataFinal,
            dateType:            filters.dateType,
            tipo_item:           filters.tipo_item,
            op_status:           filters.op_status,
            only_active:         filters.only_active,
            somente_prioridades: filters.somente_prioridades,
            data_0:              new Date().toISOString().split('T')[0]
        };

        const url = getReportDownloadUrl('faturamento-excel', reportFilters, 'sales-planning');
        window.open(url, '_blank');
    };

    const handleDownloadFaturamentoPDF = async () => {
        setDownloadingPDF(true);
        try {
            const reportFilters = {
                cliente:             filters.cliente,
                pedido:              filters.pedido,
                produto:             filters.produto,
                pedcli:              filters.pedcli,
                refCliente:          filters.refCliente,
                dataInicial:         filters.dataInicial,
                dataFinal:           filters.dataFinal,
                dateType:            filters.dateType,
                tipo_item:           filters.tipo_item,
                op_status:           filters.op_status,
                only_active:         filters.only_active,
                somente_prioridades: filters.somente_prioridades
            };
            
            const result = await api.get('/reports/sales-planning/faturamento-data', { params: { ...reportFilters, page: 1, limit: 10000 } }).then(res => res.data);
            const data = result.data || [];

            const doc = new jsPDF('l', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();

            doc.setFontSize(18);
            doc.setTextColor(40);
            doc.text('Relatório de Faturamento (Espelho de Pedido)', 14, 22);

            doc.setFontSize(10);
            doc.setTextColor(100);
            const dateStr = new Date().toLocaleString('pt-BR');
            doc.text(`Gerado em: ${dateStr}`, 14, 30);

            let filterText = "Filtros: ";
            if (filters.cliente) filterText += `Cliente: ${filters.cliente} | `;
            if (filters.pedido) filterText += `Pedido: ${filters.pedido} | `;
            if (filters.produto) filterText += `Produto: ${filters.produto} | `;
            filterText += `Status: ${filters.only_active === 'true' ? 'Apenas Pendentes' : 'Todos'}`;
            doc.text(filterText, 14, 36);

            const tableRows = [];
            data.forEach(order => {
                tableRows.push([
                    { content: order.pedido, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                    { content: order.cliente, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                    { content: order.status, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                    { content: order.proxima_entrega ? new Date(order.proxima_entrega.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')).toLocaleDateString('pt-BR') : '-', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                    { content: `Itens: ${order.itens_count}`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                    { content: '', styles: { fillColor: [240, 240, 240] } },
                    { content: '', styles: { fillColor: [240, 240, 240] } }
                ]);

                if (order.itens && order.itens.length > 0) {
                    order.itens.forEach(item => {
                        const priorityMapping = { 1: 'Urgente', 2: 'Alta', 3: 'Média', 4: 'Normal' };
                        const priorityStr = item.op_prioridade ? `Grupo ${item.op_prioridade} (${priorityMapping[item.op_prioridade] || ''})` : '-';
                        const nfStr = item.notas_fiscais && item.notas_fiscais.length > 0 ? item.notas_fiscais.map(n => n.nota).join(', ') : '-';
                        tableRows.push([
                            '',
                            `[${item.item}] ${item.produto}`,
                            item.descricao || '',
                            `Qtd: ${item.qtd}`,
                            `Fat: ${item.qtd_entreg}`,
                            `NF: ${nfStr} | Saldo: ${item.qtd_faturar}`,
                            priorityStr
                        ]);
                    });
                }
            });

            autoTable(doc, {
                startY: 42,
                head: [['Pedido', 'Cliente / Produto', 'Status / Descrição', 'Entrega / Qtd', 'Itens / Faturado', 'NF / Saldo', 'Prioridade']],
                body: tableRows,
                theme: 'striped',
                headStyles: { fillColor: [51, 65, 85], textColor: 255 },
                columnStyles: {
                    0: { cellWidth: 20 },
                    1: { cellWidth: 60 },
                    2: { cellWidth: 65 },
                    3: { cellWidth: 30 },
                    4: { cellWidth: 35 },
                    5: { cellWidth: 35 },
                    6: { cellWidth: 30 }
                },
                styles: { fontSize: 8, overflow: 'linebreak' },
                didDrawPage: (data) => {
                    doc.setFontSize(8);
                    const footerStr = `Página ${data.pageNumber}`;
                    doc.text(footerStr, pageWidth - 25, doc.internal.pageSize.getHeight() - 10);
                }
            });

            doc.save(`relatorio_faturamento_${new Date().getTime()}.pdf`);
        } catch (err) {
            console.error('Erro ao gerar PDF Faturamento:', err);
            alert('Erro ao gerar PDF: ' + err.message);
        } finally {
            setDownloadingPDF(false);
        }
    };

    const handlePrioritySubmit = async () => {
        if (!priorityTarget) return;
        setPrioritySubmitting(true);
        try {
            const isBatch = Array.isArray(priorityTarget) && priorityTarget.length > 1;
            const targets = isBatch ? priorityTarget : [Array.isArray(priorityTarget) ? priorityTarget[0] : priorityTarget];

            if (priorityMode === 'faturamento') {
                // Só marca o(s) item(ns) para faturamento (Hermes/TV). NÃO toca em app_op_priorities,
                // que é compartilhada por todos os itens da mesma OP.
                if (isBatch) {
                    const itensTarget = targets.map(target => ({
                        pedido: target.pedido,
                        item_pedido: target.item,
                        op_numero: target.op_num_completa || target.op_num,
                        produto: target.codigo || target.produto
                    }));
                    await api.post('/ata-viva/prioridade-lote', {
                        itens: itensTarget,
                        texto_livre: priorityText,
                        grupo: priorityGroup,
                        usuario: user?.nome
                    });
                } else {
                    const target = targets[0];
                    await api.post('/ata-viva/prioridade', {
                        pedido: target.pedido,
                        item_pedido: target.item,
                        op_numero: target.op_num_completa || target.op_num,
                        produto: target.codigo || target.produto,
                        texto_livre: priorityText,
                        grupo: priorityGroup,
                        usuario: user?.nome
                    });
                }
                toast.success('Prioridade de faturamento definida. Hermes notificado.');
            } else {
                // mode === 'op': prioriza a OP inteira na produção. NÃO cria tarefa/alerta de faturamento.
                const ops = [...new Set(targets.map(t => t.op_num_completa || t.op_num).filter(Boolean))];
                for (const op of ops) {
                    await api.post('/production/op-priority', { op_numero: op, prioridade: priorityGroup, usuario: user?.nome });
                }
                toast.success('Prioridade de OP atualizada.');
            }

            // Dynamic local state update to prevent full reload
            setOrders(prev => prev.map(o => {
                if (viewMode === 'flat') {
                    const isTarget = targets.some(t => t.pedido === o.pedido && t.item === o.item);
                    if (isTarget) {
                        return priorityMode === 'op'
                            ? { ...o, op_prioridade: priorityGroup }
                            : { ...o, fat_priority_group: priorityGroup, fat_priority_text: priorityText };
                    }
                    return o;
                } else {
                    const isTargetOrder = targets.some(t => t.pedido === o.pedido);
                    if (isTargetOrder && o.itens) {
                        const updatedItens = o.itens.map(it => {
                            const isTargetItem = targets.some(t => t.pedido === o.pedido && t.item === it.item);
                            if (isTargetItem) {
                                return priorityMode === 'op'
                                    ? { ...it, op_prioridade: priorityGroup }
                                    : { ...it, fat_priority_group: priorityGroup, fat_priority_text: priorityText };
                            }
                            return it;
                        });
                        return { ...o, itens: updatedItens };
                    }
                    return o;
                }
            }));

            setPriorityTarget(null);
            setPriorityText('');
            setPriorityGroup(1);
            if (isBatch) setSelectedItems([]);
            // Still trigger silent fetch in background to sync with server
            fetchData({ page: page || 1, silent: true });
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || 'Erro ao definir prioridade.');
        } finally {
            setPrioritySubmitting(false);
        }
    };

    const openPriorityModal = (target, mode = 'faturamento') => {
        setPriorityTarget(target);
        setPriorityMode(mode);
    };

    const handlePrintOrder = async (e, orderId) => {
        e.stopPropagation();
        if (printingOrderId === orderId) return;
        setPrintingOrderId(orderId);
        try {
            // Use lean /pdf-data endpoint: only 1 PG query + 1 MySQL notes query
            // Avoids the 8 enrichments of /itens that exhaust MySQL connection pool
            const pdfData = await getPedidoPdfData(orderId);
            if (!pdfData || !pdfData.itens || pdfData.itens.length === 0) {
                alert('Pedido não encontrado ou sem itens.');
                return;
            }
            await generateOrderPDF(pdfData);
        } catch (err) {
            console.error('Erro ao imprimir pedido:', err);
            alert('Falha ao gerar o PDF do pedido: ' + err.message);
        } finally {
            setPrintingOrderId(null);
        }
    };

    
    const handleBulkPrint = async (type) => {
        if (selectedItems.length === 0) return;
        setIsBulkPrinting(true);
        setBulkPrintProgress({ current: 0, total: selectedItems.length, label: '' });

        try {
            for (let i = 0; i < selectedItems.length; i++) {
                const sel = selectedItems[i];
                let pedido, item;
                if (typeof sel === 'string') {
                    [pedido, item] = sel.split('-');
                } else {
                    pedido = sel.pedido;
                    item = sel.item;
                }
                setBulkPrintProgress({ current: i + 1, total: selectedItems.length, label: `Pedido ${pedido} Item ${item}` });

                switch (type) {
                    case 'op_mirror':
                        await handlePrintOPMirror(pedido, null, item);
                        break;
                    case 'op_ficha':
                        await handlePrintFichas(pedido, null, item);
                        break;
                    case 'op_oper':
                        await handlePrintOPByOperation(pedido, null, item);
                        break;
                    case 'op_drawings':
                        await handlePrintOPByOperationWithDrawings(pedido, null, item);
                        break;
                    case 'op_resource_drawings':
                        await handlePrintOPByResourceWithDrawings(pedido, null, item);
                        break;
                    case 'op_stamp_drawings':
                        await handlePrintOPWithOpsStampWithDrawings(pedido, null, item);
                        break;
                    case 'op_stamp_resource_drawings':
                        await handlePrintOPWithOpsStampDrawingsByResource(pedido, null, item);
                        break;
                    case 'op_stamp_desc_drawings':
                        await handlePrintOPWithOpsStampWithDescDrawings(pedido, null, item);
                        break;
                    case 'op_stamp_desc_resource_drawings':
                        await handlePrintOPWithOpsStampWithDescDrawingsByResource(pedido, null, item);
                        break;
                }

                if (i < selectedItems.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
            }
        } catch (error) {
            console.error('Bulk print error:', error);
            alert('Erro durante a impressão em lote.');
        } finally {
            setIsBulkPrinting(false);
            setBulkPrintProgress({ current: 0, total: 0, label: '' });
            setSelectedItems([]);
        }
    };

    const handlePrintOPMirror = async (pedido, e, itemId = null) => {
        if (e) e.stopPropagation();
        // Guard: never call op-mirror with an empty pedido (would produce 500 or /op-mirror/?...)
        if (!pedido || String(pedido).trim() === '') {
            console.warn('[handlePrintOPMirror] pedido inválido â€” chamada cancelada.');
            return;
        }
        const loadKey = itemId ? `op-${pedido}-${itemId}` : `op-${pedido}`;
        setPrintingOrderId(loadKey);
        try {
            const endpoint = itemId
                ? `/pedidos/op-mirror/${encodeURIComponent(pedido)}?item=${encodeURIComponent(itemId)}`
                : `/pedidos/op-mirror/${encodeURIComponent(pedido)}`;

            const response = await api.get(endpoint);
            const mirrorData = response.data;
            const orderObj = orders.find(o => o.pedido === pedido);
            const targetItemObj = orderObj?.itens?.find(i => i.item === itemId);
            mirrorData.opNumFromTable = targetItemObj ? (targetItemObj.op_num_completa || targetItemObj.op_num || '') : '';


            const { generateOPMirrorPdf } = await import('../services/opMirrorPdfGenerator');
            generateOPMirrorPdf(mirrorData);

        } catch (error) {
            const msg = error.response?.data?.error || error.message;
            console.error('Error generating OP Mirror PDF:', error);
            alert(`Erro ao gerar Espelho da OP: ${msg}`);
        } finally {
            setPrintingOrderId(null);
        }
    };

    const handlePrintFichas = async (pedido, e, itemId = null) => {
        if (e) e.stopPropagation();
        const loadKey = itemId ? `ficha-${pedido}-${itemId}` : `ficha-${pedido}`;
        setPrintingOrderId(loadKey);
        try {
            const endpoint = itemId
                ? `/pedidos/op-mirror/${pedido}?item=${itemId}`
                : `/pedidos/op-mirror/${pedido}`;

            const response = await api.get(endpoint);
            const mirrorData = response.data;

            const { generateOPFichaPdf } = await import('../services/opFichaPdfGenerator');
            generateOPFichaPdf(mirrorData);

        } catch (error) {
            const msg = error.response?.data?.error || error.message;
            console.error('Error generating OP Fichas PDF:', error);
            alert(`Erro ao gerar Fichas de Operação: ${msg}`);
        } finally {
            setPrintingOrderId(null);
        }
    };

    const handlePrintOPByOperationWithDrawings = async (pedido, e, itemId = null, includeStock = false) => {
        if (e) e.stopPropagation();
        const loadKey = itemId ? `op-drawings-${pedido}-${itemId}${includeStock ? '-stock' : ''}` : `op-drawings-${pedido}${includeStock ? '-stock' : ''}`;
        setPrintingOrderId(loadKey);
        try {
            const endpoint = itemId
                ? `/pedidos/op-mirror/${pedido}?item=${itemId}`
                : `/pedidos/op-mirror/${pedido}`;

            const response = await api.get(endpoint);
            const mirrorData = response.data;
            const orderObj = orders.find(o => o.pedido === pedido);
            const targetItemObj = orderObj?.itens?.find(i => i.item === itemId);
            mirrorData.opNumFromTable = targetItemObj ? (targetItemObj.op_num_completa || targetItemObj.op_num || '') : '';

            const userName = user?.nome || 'Usuário';
            const { generateOPByOperationWithDrawingsPdf } = await import('../services/opByOperationWithDrawingsPdfGenerator');
            await generateOPByOperationWithDrawingsPdf(mirrorData, userName, null, false, includeStock);

        } catch (error) {
            const msg = error.response?.data?.error || error.message;
            console.error('Error generating OP by Operation PDF with Drawings:', error);
            alert(`Erro ao gerar Espelho com Desenhos: ${msg}`);
        } finally {
            setPrintingOrderId(null);
        }
    };

    const handlePrintOPByResourceWithDrawings = async (pedido, e, itemId = null, includeStock = false) => {
        if (e) e.stopPropagation();
        const loadKey = itemId ? `op-resource-drawings-${pedido}-${itemId}${includeStock ? '-stock' : ''}` : `op-resource-drawings-${pedido}${includeStock ? '-stock' : ''}`;
        setPrintingOrderId(loadKey);
        try {
            const endpoint = itemId
                ? `/pedidos/op-mirror/${pedido}?item=${itemId}`
                : `/pedidos/op-mirror/${pedido}`;

            const response = await api.get(endpoint);
            const mirrorData = response.data;

            const userName = user?.nome || 'Usuário';
            const { generateOPDrawingsByResourcePdf } = await import('../services/opDrawingsByResourceGenerator');
            await generateOPDrawingsByResourcePdf(mirrorData, userName, null, false, false, false, includeStock);

        } catch (error) {
            const msg = error.response?.data?.error || error.message;
            console.error('Error generating OP by Resource PDF with Drawings:', error);
            alert(`Erro ao gerar Espelho por Recurso com Desenhos: ${msg}`);
        } finally {
            setPrintingOrderId(null);
        }
    };

    const handlePrintOPWithOpsStampWithDescDrawingsByResource = async (pedido, e, itemId = null, includeStock = false) => {
        if (e) e.stopPropagation();
        const loadKey = itemId ? `op-stamp-desc-resource-drawings-${pedido}-${itemId}${includeStock ? '-stock' : ''}` : `op-stamp-desc-resource-drawings-${pedido}${includeStock ? '-stock' : ''}`;
        setPrintingOrderId(loadKey);
        try {
            const endpoint = itemId
                ? `/pedidos/op-mirror/${pedido}?item=${itemId}`
                : `/pedidos/op-mirror/${pedido}`;

            const response = await api.get(endpoint);
            const mirrorData = response.data;

            const userName = user?.nome || 'Usuário';
            const { generateOPDrawingsByResourcePdf } = await import('../services/opDrawingsByResourceGenerator');
            await generateOPDrawingsByResourcePdf(mirrorData, userName, null, false, true, true, includeStock);

        } catch (error) {
            const msg = error.response?.data?.error || error.message;
            console.error('Error generating OP by Resource PDF with Drawings (with Desc):', error);
            alert(`Erro ao gerar Espelho por Recurso com Desenhos (Roteiro/Descrição): ${msg}`);
        } finally {
            setPrintingOrderId(null);
        }
    };

    const handlePrintOPWithOpsStampDrawingsByResource = async (pedido, e, itemId = null, includeStock = false) => {
        if (e) e.stopPropagation();
        const loadKey = itemId ? `op-stamp-resource-drawings-${pedido}-${itemId}${includeStock ? '-stock' : ''}` : `op-stamp-resource-drawings-${pedido}${includeStock ? '-stock' : ''}`;
        setPrintingOrderId(loadKey);
        try {
            const endpoint = itemId
                ? `/pedidos/op-mirror/${pedido}?item=${itemId}`
                : `/pedidos/op-mirror/${pedido}`;

            const response = await api.get(endpoint);
            const mirrorData = response.data;

            const userName = user?.nome || 'Usuário';
            const { generateOPDrawingsByResourcePdf } = await import('../services/opDrawingsByResourceGenerator');
            await generateOPDrawingsByResourcePdf(mirrorData, userName, null, false, true, false, includeStock);

        } catch (error) {
            const msg = error.response?.data?.error || error.message;
            console.error('Error generating OP by Resource PDF with Drawings (Roteiro):', error);
            alert(`Erro ao gerar Espelho por Recurso com Desenhos (Roteiro): ${msg}`);
        } finally {
            setPrintingOrderId(null);
        }
    };

    const handlePrintOPWithOpsStampWithDrawings = async (pedido, e, itemId = null, includeStock = false) => {
        if (e) e.stopPropagation();
        const loadKey = itemId ? `op-stamp-drawings-${pedido}-${itemId}${includeStock ? '-stock' : ''}` : `op-stamp-drawings-${pedido}${includeStock ? '-stock' : ''}`;
        setPrintingOrderId(loadKey);
        try {
            const endpoint = itemId
                ? `/pedidos/op-mirror/${pedido}?item=${itemId}`
                : `/pedidos/op-mirror/${pedido}`;

            const response = await api.get(endpoint);
            const mirrorData = response.data;

            const userName = user?.nome || 'Usuário';
            const { generateOPDrawingsWithOpsStampPdf } = await import('../services/opDrawingsWithOpsStampGenerator');
            await generateOPDrawingsWithOpsStampPdf(mirrorData, userName, null, false, false, includeStock);

        } catch (error) {
            const msg = error.response?.data?.error || error.message;
            console.error('Error generating OP PDF with Ops Stamp Drawings:', error);
            alert(`Erro ao gerar Espelho com Roteiro no Carimbo: ${msg}`);
        } finally {
            setPrintingOrderId(null);
        }
    };

    const handlePrintOPWithOpsStampWithDescDrawings = async (pedido, e, itemId = null, includeStock = false) => {
        if (e) e.stopPropagation();
        const loadKey = itemId ? `op-stamp-desc-drawings-${pedido}-${itemId}${includeStock ? '-stock' : ''}` : `op-stamp-desc-drawings-${pedido}${includeStock ? '-stock' : ''}`;
        setPrintingOrderId(loadKey);
        try {
            const endpoint = itemId
                ? `/pedidos/op-mirror/${pedido}?item=${itemId}`
                : `/pedidos/op-mirror/${pedido}`;

            const response = await api.get(endpoint);
            const mirrorData = response.data;

            const userName = user?.nome || 'Usuário';
            const { generateOPDrawingsWithOpsStampPdf } = await import('../services/opDrawingsWithOpsStampGenerator');
            await generateOPDrawingsWithOpsStampPdf(mirrorData, userName, null, false, true, includeStock);

        } catch (error) {
            const msg = error.response?.data?.error || error.message;
            console.error('Error generating OP PDF with Ops Stamp Drawings (with Desc):', error);
            alert(`Erro ao gerar Espelho com Roteiro/Descrição no Carimbo: ${msg}`);
        } finally {
            setPrintingOrderId(null);
        }
    };

    const handlePrintOPByOperation = async (pedido, e, itemId = null) => {
        if (e) e.stopPropagation();
        const loadKey = itemId ? `op-oper-${pedido}-${itemId}` : `op-oper-${pedido}`;
        setPrintingOrderId(loadKey);
        try {
            const endpoint = itemId
                ? `/pedidos/op-mirror/${pedido}?item=${itemId}`
                : `/pedidos/op-mirror/${pedido}`;

            const response = await api.get(endpoint);
            const mirrorData = response.data;
            const orderObj = orders.find(o => o.pedido === pedido);
            const targetItemObj = orderObj?.itens?.find(i => i.item === itemId);
            mirrorData.opNumFromTable = targetItemObj ? (targetItemObj.op_num_completa || targetItemObj.op_num || '') : '';

            const { generateOPByOperationPdf } = await import('../services/opByOperationPdfGenerator');
            generateOPByOperationPdf(mirrorData);

        } catch (error) {
            const msg = error.response?.data?.error || error.message;
            console.error('Error generating OP by Operation PDF:', error);
            alert(`Erro ao gerar Espelho por Operação: ${msg}`);
        } finally {
            setPrintingOrderId(null);
        }
    };

    const handleExportOPByOperationExcel = async (pedido, e, itemId = null) => {
        if (e) e.stopPropagation();
        const loadKey = itemId ? `op-excel-${pedido}-${itemId}` : `op-excel-${pedido}`;
        setPrintingOrderId(loadKey);
        try {
            const endpoint = itemId
                ? `/pedidos/op-mirror/${pedido}?item=${itemId}`
                : `/pedidos/op-mirror/${pedido}`;

            const response = await api.get(endpoint);
            const mirrorData = response.data;

            const { opByOperationExcelGenerator } = await import('../services/opByOperationExcelGenerator');
            opByOperationExcelGenerator(mirrorData);

        } catch (error) {
            const msg = error.response?.data?.error || error.message;
            console.error('Error generating OP by Operation Excel:', error);
            alert(`Erro ao exportar Espelho para Excel: ${msg}`);
        } finally {
            setPrintingOrderId(null);
        }
    };

    const handleDownloadExcel = async () => {
        const reportFilters = {
            cliente:             filters.cliente,
            pedido:              filters.pedido,
            produto:             filters.produto,
            pedcli:              filters.pedcli,
            refCliente:          filters.refCliente,
            dataInicial:         filters.dataInicial,
            dataFinal:           filters.dataFinal,
            dateType:            filters.dateType,
            tipo_item:           filters.tipo_item,
            op_status:           filters.op_status,
            only_active:         filters.only_active,
            somente_prioridades: filters.somente_prioridades,
            data_0:              new Date().toISOString().split('T')[0]
        };

        const url = getReportDownloadUrl('xlsx', reportFilters, 'sales-planning');

        setIsGeneratingExcel(true);
        try {
            const response = await fetch(url);
            if (!response.ok) {
                let errMsg = `Erro ${response.status}`;
                try {
                    const errBody = await response.json();
                    errMsg = errBody.error || errBody.message || errMsg;
                    if (errBody.where) errMsg += ` | Em: ${errBody.where}`;
                } catch (_) {}
                throw new Error(errMsg);
            }
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const now = new Date();
            const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
            a.href = blobUrl;
            a.download = `Planejamento_Carga_${stamp}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('[Excel] Erro ao gerar:', err);
            alert(`Erro ao gerar Excel: ${err.message}`);
        } finally {
            setIsGeneratingExcel(false);
        }
    };

    const handleDownloadBicromatizacao = async () => {
        setDownloadingBicromat(true);
        try {
            const token = localStorage.getItem('@MetalFisa:token') || '';
            const url = `/api/reports/vmi-bicromatizacao/excel?token=${encodeURIComponent(token)}`;
            const response = await fetch(url, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (!response.ok) {
                let errMsg = `Erro ${response.status}`;
                try {
                    const errBody = await response.json();
                    errMsg = errBody.error || errBody.message || errMsg;
                } catch (_) {}
                throw new Error(errMsg);
            }
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const now = new Date();
            const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
            a.href = blobUrl;
            a.download = `Relatorio_Bicromatizacao_VMI_${stamp}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(blobUrl);
            toast.success('Relatório de Bicromatização baixado com sucesso!');
        } catch (err) {
            console.error('[Bicromatização] Erro ao gerar:', err);
            toast.error(`Erro ao gerar relatório: ${err.message}`);
        } finally {
            setDownloadingBicromat(false);
        }
    };

    const handleOpenDocs = (code, name) => {
        setSelectedProductForDocs({ code, name });
        setIsDocsModalOpen(true);
    };

    const handleViewImage = async (productCode) => {
        if (!productCode) return;
        try {
            // Fetch product details to get image URL
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

    // Update Item Control (Project Type, Eng Date)
    // Callback when Engineering Modal saves data
    const handleSaveEngineeringControl = (pedido, itemCode, newData) => {
        // Update local state to reflect changes immediately
        if (orderItems[pedido]) {
            const newItems = orderItems[pedido].map(i =>
                i.item === itemCode ? { ...i, ...newData } : i
            );
            updateOrderItemsForPedido(pedido, newItems);
        }
    };

    const getAIContext = (item = {}) => {
        return {
            source: 'OrdersTable',
            viewMode,
            activeTab,
            selection: {
                pedido: item.pedido || null,
                cliente: item.nome_cliente || null,
                item: item.item || null,
                produto: item.codigo || null
            },
            filters: {
                values: filters,
                metadata: {
                    cliente: "Filtra pelo nome ou CNPJ do cliente.",
                    pedido: "Filtra pelo número exato do Pedido de Venda no Protheus.",
                    produto: "Filtra pelo código do produto acabado ou componente.",
                    dataInicial: `Data inicial do período de ${filters.dateType === 'pedido' ? 'Emissão' : 'Faturamento'}.`,
                    dataFinal: `Data final do período de ${filters.dateType === 'pedido' ? 'Emissão' : 'Faturamento'}.`,
                    dateType: "Define se o filtro de data olha para a Emissão do Pedido ou Emissão da NF.",
                    only_active: "Se 'true', mostra apenas pedidos que ainda possuem saldo a faturar."
                }
            }
        };
    };

    const handleScroll = useCallback((e) => {
        if (viewMode === 'flat') return; // Let VirtualFlatList handle infinite scrolling in flat mode
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollHeight - scrollTop <= clientHeight * 1.5 && !loading && page < totalPages) {
            setPage(page + 1);
        }
    }, [loading, page, totalPages, viewMode, setPage]);

    const sortedOrders = React.useMemo(() => {
        let result = orders;

        // FILTER ITEMS for Flat View if classification is selected
        const effectiveClassifs = fixedClassificacao || filters.classificacao_item;
        if (viewMode === 'flat' && effectiveClassifs) {
            const activeClassifs = effectiveClassifs.split(',').filter(Boolean);
            if (activeClassifs.length > 0) {
                result = result.filter(o => {
                    const itemClassif = o.classificacao || 'Nenhum';
                    return activeClassifs.includes(itemClassif);
                });
            }
        }

        if (!filters.sortBy) return result;

        const keyMap = {
            'pedido': 'pedido',
            'emissao': 'data_emissao',
            'entrega': 'data_entrega',
            'entrega_pcp': 'data_entrega_pcp',
            'prev_fat': 'data_prevista_faturamento'
        };
        const objKey = keyMap[filters.sortBy] || filters.sortBy;

        return [...result].sort((a, b) => {
            let valA = a[objKey];
            let valB = b[objKey];

            // Special handling for dates
            if (['data_emissao', 'data_entrega', 'data_entrega_pcp', 'data_prevista_faturamento'].includes(objKey)) {
                valA = valA ? new Date(valA).getTime() : 0;
                valB = valB ? new Date(valB).getTime() : 0;
            } else if (objKey === 'pedido') {
                valA = parseInt(valA, 10) || 0;
                valB = parseInt(valB, 10) || 0;
            } else {
                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();
            }

            if (valA < valB) return filters.sortOrder === 'ASC' ? -1 : 1;
            if (valA > valB) return filters.sortOrder === 'ASC' ? 1 : -1;
            return 0;
        });
    }, [orders, filters.sortBy, filters.sortOrder, viewMode, fixedClassificacao, filters.classificacao_item]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-5rem)] md:h-[calc(100vh-2.5rem)] overflow-hidden print:overflow-visible print:shadow-none print:border-none relative">
            {/* Global Overlay for PDF Generation */}
            {printingOrderId && (
                <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gray-900/50 backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center max-w-md border border-gray-100">
                        <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Processando PDF...</h3>
                        <p className="text-sm text-gray-600">Por favor, aguarde enquanto o sistema consolida a Estrutura da OP e anexa todos os Desenhos. Isso pode demorar alguns segundos e o download iniciará automaticamente.</p>
                    </div>
                </div>
            )}

            {/* Overlay: Geração do Excel em andamento */}
            {isGeneratingExcel && (
                <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gray-900/60 backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center max-w-sm border border-blue-100">
                        <div className="relative mb-5">
                            <div className="w-16 h-16 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 mb-1">Gerando Excel…</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            O sistema está processando os pedidos e calculando a carga por recurso em todos os níveis da BOM.
                            Isso pode levar alguns segundos.
                        </p>
                        <div className="w-full text-left space-y-2">
                            {['Consultando dados do Protheus','Calculando carga por recurso (BOM + Roteiro)','Montando planilhas Excel','Preparando download…'].map((step, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                                    <div className="w-4 h-4 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: `${i * 0.5}s` }} />
                                    </div>
                                    {step}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── BLOQUEIO GLOBAL DE PÁGINA ── Evita consultas simultâneas pesadas */}
            {pageBlocking && (
                <div className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-gray-900/60 backdrop-blur-sm" style={{ pointerEvents: 'all' }}>
                    <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center max-w-md border border-gray-100">
                        <div className="relative mb-5">
                            <div className="w-16 h-16 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full border-4 border-transparent border-t-blue-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.7s' }} />
                            </div>
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 mb-2">Processando...</h3>
                        <p className="text-sm text-gray-500 leading-relaxed">{pageBlocking}</p>
                        <div className="mt-4 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                            âš ï¸  Página bloqueada para evitar consultas simultâneas. Aguarde.
                        </div>
                    </div>
                </div>
            )}

            {/* Overlay Progress Bar para Planilha PCP */}
            {importProgress && (
                <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gray-900/70 backdrop-blur-sm" style={{ pointerEvents: 'all' }}>
                    <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center max-w-lg w-full border border-gray-100 mx-4">
                        <div className="mb-6 w-full flex flex-col items-center">
                            <FileSpreadsheet className="h-12 w-12 text-green-600 mb-4 animate-pulse" />
                            <h3 className="text-xl font-bold text-gray-800 mb-2">Importando Planilha PCP</h3>
                            <p className="text-sm font-medium text-gray-600 mb-4 h-8 flex items-center justify-center px-4 bg-gray-50 rounded-lg w-full border border-gray-100">
                                {importProgress.text}
                            </p>
                            
                            {importProgress.total > 0 && (
                                <div className="w-full">
                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                        <span>Progresso</span>
                                        <span>{importProgress.current} de {importProgress.total}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                        <div 
                                            className="bg-green-500 h-3 rounded-full transition-all duration-300 ease-out" 
                                            style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 w-full">
                            âš ï¸  Por favor, não feche a página ou navegue para outra tela enquanto o processamento estiver em andamento.
                        </div>
                    </div>
                </div>
            )}

            {/* Header & Filtros */}
            <div className="border-b border-gray-100 bg-white print:hidden">
                {/* â”€â”€ Top loading progress bar â”€â”€ */}
                <div className={`h-0.5 w-full overflow-hidden transition-opacity duration-300 ${loading ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="h-full" style={{ width: '100%', backgroundImage: 'linear-gradient(90deg, transparent 0%, #3b82f6 30%, #60a5fa 50%, #3b82f6 70%, transparent 100%)', backgroundSize: '200% 100%', animation: 'shimmerBar 1.4s linear infinite' }} />
                </div>
                <div className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">{pageTitle || "Pedidos de Venda"}</h2>
                        <p className="text-sm text-gray-500">{pageSubtitle || "Gerencie e visualize os pedidos do Protheus"}</p>
                        {filters.only_active === 'true' && (
                            <div className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-md px-2 py-1 inline-flex items-center gap-1.5">
                                <AlertCircle className="h-3 w-3" />
                                <span>Visualizando apenas pedidos <strong>Ativos</strong> (não entregues) e <strong>Vendas</strong> (exclui orçamentos).</span>
                            </div>
                        )}
                    </div>

                    {/* View Mode Toggle & Top Action Buttons */}
                    <div className="flex gap-2 items-center">
                        <button
                            type="button"
                            onClick={handleDownloadBicromatizacao}
                            disabled={downloadingBicromat}
                            title="Baixar Estudo de Demanda de Bicromatização & Zincagens VMI (Excel)"
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-300 transition-all shadow-sm disabled:opacity-50"
                        >
                            {downloadingBicromat ? (
                                <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
                            ) : (
                                <Droplets className="w-4 h-4 text-amber-600" />
                            )}
                            <span className="hidden md:inline">Prev-Bicromatização</span>
                        </button>

                        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleImportPCPFile} />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            title="Importar Data PCP via Planilha Central"
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-all shadow-sm"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span className="hidden md:inline">Buscar Planilha Central</span>
                        </button>

                        <div className="bg-gray-100 p-1 rounded-lg flex items-center">
                            <button
                                onClick={() => setViewMode('tree')}
                                aria-label="Ver visão agrupada"
                                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'tree' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <AlignJustify className="w-4 h-4" />
                                Agrupado
                            </button>
                            <button
                                onClick={() => setViewMode('flat')}
                                aria-label="Ver visão de lista plana"
                                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'flat' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <List className="w-4 h-4" />
                                Lista Plana
                            </button>
                        </div>
                    </div>
                </div>

                {/* â”€â”€ Status bar while fetching â”€â”€ */}
                {loading && (
                    <div className="mb-3 flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                        <span>Buscando dados no servidorâ€¦ Aguarde.</span>
                        <span className="ml-auto text-xs text-blue-400 italic">Isso pode levar alguns segundos dependendo dos filtros.</span>
                    </div>
                )}
                <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-y-4 gap-x-3 items-end">
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-medium text-gray-600 ml-1">Cliente:</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                name="cliente"
                                placeholder="Buscar por Cliente..."
                                value={filters.cliente}
                                onChange={handleFilterChange}
                                className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
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
                                className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-medium text-gray-600 ml-1" title="Item do Pedido Metalfisa (SC6)">Item Pedido:</label>
                        <div className="relative">
                            <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                name="item"
                                placeholder="Item (ex: 01)..."
                                value={filters.item || ''}
                                onChange={handleFilterChange}
                                className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                title="Filtrar por item do pedido Metalfisa (ex: 01, 02)"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-medium text-gray-600 ml-1" title="Ordem de Produção (OP)">OP:</label>
                        <div className="relative">
                            <Factory className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                name="op"
                                placeholder="Nº OP..."
                                value={filters.op || ''}
                                onChange={handleFilterChange}
                                className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                title="Filtrar por número da Ordem de Produção (ex: 006806, 006807)"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-medium text-gray-600 ml-1">Ordem Compra:</label>
                        <div className="relative">
                            <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                name="pedcli"
                                placeholder="PC..."
                                value={filters.pedcli || ''}
                                onChange={handleFilterChange}
                                className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-medium text-gray-600 ml-1">Ref. Cliente:</label>
                        <div className="relative">
                            <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                name="refCliente"
                                placeholder="Ref..."
                                value={filters.refCliente || ''}
                                onChange={handleFilterChange}
                                className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-medium text-gray-600 ml-1">Produto:</label>
                        <div className="relative">
                            <Package className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                name="produto"
                                placeholder="Cód. Produto..."
                                value={filters.produto}
                                onChange={handleFilterChange}
                                className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-[11px] font-medium text-gray-600">Início:</label>
                            <select
                                name="dateType"
                                value={filters.dateType}
                                onChange={handleFilterChange}
                                className="bg-transparent text-[11px] font-bold text-blue-600 outline-none cursor-pointer p-0"
                            >
                                <option value="pedido">Emissão Pedido</option>
                                <option value="entrega">Data de Entrega</option>
                                <option value="nf">Emissão NF</option>
                                <option value="entrega_pcp">Data PCP</option>
                            </select>
                        </div>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                            <input
                                type="date"
                                name="dataInicial"
                                value={filters.dataInicial}
                                onChange={handleFilterChange}
                                aria-label={`Data inicial (${filters.dateType === 'pedido' ? 'Emissão Pedido' : filters.dateType === 'entrega' ? 'Data de Entrega' : filters.dateType === 'entrega_pcp' ? 'Data PCP' : 'Emissão NF'})`}
                                className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                                title={`Data inicial (${filters.dateType === 'pedido' ? 'Emissão Pedido' : filters.dateType === 'entrega' ? 'Data de Entrega' : filters.dateType === 'entrega_pcp' ? 'Data PCP' : 'Emissão NF'})`}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-[11px] font-medium text-gray-600">Fim:</label>
                            <span className="text-[11px] font-bold text-blue-600">
                                {filters.dateType === 'pedido' ? 'Emissão Pedido' : filters.dateType === 'entrega' ? 'Data de Entrega' : filters.dateType === 'entrega_pcp' ? 'Data PCP' : 'Emissão NF'}
                            </span>
                        </div>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                            <input
                                type="date"
                                name="dataFinal"
                                value={filters.dataFinal}
                                onChange={handleFilterChange}
                                aria-label={`Data final (${filters.dateType === 'pedido' ? 'Emissão Pedido' : filters.dateType === 'entrega' ? 'Data de Entrega' : filters.dateType === 'entrega_pcp' ? 'Data PCP' : 'Emissão NF'})`}
                                className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                                title={`Data final (${filters.dateType === 'pedido' ? 'Emissão Pedido' : filters.dateType === 'entrega' ? 'Data de Entrega' : filters.dateType === 'entrega_pcp' ? 'Data PCP' : 'Emissão NF'})`}
                            />
                        </div>
                        {['entrega', 'entrega_pcp'].includes(filters.dateType) && (
                            <div className="flex justify-between mt-0.5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const today = new Date().toISOString().split('T')[0];
                                        setFilters(f => ({ ...f, dataInicial: '', dataFinal: today }));
                                    }}
                                    className="text-[10px] text-red-600 hover:underline font-semibold"
                                >
                                    Atrasados/Hoje
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const today = new Date().toISOString().split('T')[0];
                                        setFilters(f => ({ ...f, dataInicial: today, dataFinal: '' }));
                                    }}
                                    className="text-[10px] text-green-600 hover:underline font-semibold"
                                >
                                    Hoje/Futuro
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Filtro Tipo de Item (Multi-select Pills) */}
                    <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
                        <label className="text-[11px] font-medium text-gray-600 ml-1">Tipo de Item:</label>
                        <div className="flex flex-wrap gap-1">
                            {['PCP', 'Restrição', 'Revisão', 'Novo'].map(tipo => {
                                const activeTipos = filters.tipo_item ? filters.tipo_item.split(',') : [];
                                const isActive = activeTipos.includes(tipo);
                                return (
                                    <button
                                        key={tipo}
                                        type="button"
                                        onClick={() => {
                                            let newTipos = [...activeTipos];
                                            if (isActive) newTipos = newTipos.filter(t => t !== tipo);
                                            else newTipos.push(tipo);
                                            setFilters({ tipo_item: newTipos.join(','), page: 1 });
                                        }}
                                        className={`px-3 py-1 flex items-center justify-center text-[11px] font-semibold rounded-full border transition-all ${
                                            isActive
                                                ? 'bg-blue-100 text-blue-700 border-blue-200 shadow-sm'
                                                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                        }`}
                                    >
                                        {tipo}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Filtro Classificacao (Multi-select Pills) — oculto quando a página tem classificação fixa (ex: PPAP's) */}
                    {!fixedClassificacao && (
                    <div className="flex flex-col gap-1 md:col-span-2">
                        <label className="text-[11px] font-medium text-gray-600 ml-1">Classificação:</label>
                        <div className="flex flex-wrap gap-1">
                            {['Todos', 'Jits', 'PPAP', 'Jits e PPAP', 'Nenhum'].map(classif => {
                                const activeClassifs = filters.classificacao_item ? filters.classificacao_item.split(',') : [];
                                const isActive = classif === 'Todos' ? activeClassifs.length === 0 : activeClassifs.includes(classif);
                                return (
                                    <button
                                        key={classif}
                                        type="button"
                                        onClick={() => {
                                            if (classif === 'Todos') {
                                                setFilters({ classificacao_item: '', page: 1 });
                                            } else {
                                                let newClassifs = [...activeClassifs];
                                                if (isActive) newClassifs = newClassifs.filter(c => c !== classif);
                                                else newClassifs.push(classif);
                                                setFilters({ classificacao_item: newClassifs.join(','), page: 1 });
                                            }
                                        }}
                                        className={`px-3 py-1 flex items-center justify-center text-[11px] font-semibold rounded-full border transition-all ${
                                            isActive
                                                ? 'bg-purple-100 text-purple-700 border-purple-200 shadow-sm'
                                                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                        }`}
                                    >
                                        {classif}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    )}

                    <div className="md:col-span-4 lg:col-span-5 flex flex-wrap gap-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`flex-1 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-all flex items-center justify-center gap-2 ${
                                loading
                                    ? 'bg-blue-400 cursor-not-allowed text-white opacity-80'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                        >
                            {loading
                                ? <><Loader2 className="h-4 w-4 animate-spin" /> Buscando...</>
                                : <><Search className="h-4 w-4" /> Filtrar</>
                            }
                        </button>

                        <button
                            type="button"
                            onClick={handleDownloadFaturamentoExcel}
                            disabled={loading}
                            className="bg-green-50 text-green-700 border border-green-300 hover:bg-green-100 font-medium rounded-lg text-sm px-2.5 py-2.5 text-center transition-colors flex items-center justify-center gap-1 disabled:opacity-40"
                            title="Faturamento Excel"
                        >
                            <FileSpreadsheet className="h-4 w-4" />
                            <span className="font-semibold text-xs tracking-tight">Fat.</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleDownloadFaturamentoPDF}
                            disabled={downloadingPDF}
                            className="bg-orange-50 text-orange-600 border border-orange-300 hover:bg-orange-100 font-medium rounded-lg text-sm px-2.5 py-2.5 text-center transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                            title="Faturamento PDF"
                        >
                            {downloadingPDF ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <FileText className="h-4 w-4" />
                            )}
                            <span className="font-semibold text-xs tracking-tight">Fat.</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleDownloadExcel}
                            disabled={loading}
                            className="bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 font-medium rounded-lg text-sm px-3 py-2.5 text-center transition-colors flex items-center justify-center disabled:opacity-40"
                            title="Exportar Excel"
                        >
                            <FileSpreadsheet className="h-4 w-4" />
                        </button>

                        <button
                            type="button"
                            onClick={handleDownloadPDF}
                            disabled={downloadingPDF}
                            className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-medium rounded-lg text-sm px-3 py-2.5 text-center transition-colors flex items-center justify-center disabled:opacity-50"
                            title="Exportar PDF"
                        >
                            {downloadingPDF ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <FileText className="h-4 w-4" />
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => { setIsGlobalReport(false); setShowReportModal(true); }}
                            disabled={loading}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 font-medium rounded-lg text-sm px-3 py-2.5 text-center transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
                            title="Gerar Ata (Pedidos da Tela)"
                        >
                            <StickyNote className="h-4 w-4" />
                            <span>Ata</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => { setPcpmetalContext({ page: 'visao-geral', modulo: 'Viso Geral', action: 'Geral' }); setPcpmetalOpen(true); }}
                            className="bg-blue-600 hover:bg-blue-700 text-white border border-blue-700 font-medium rounded-lg text-sm px-4 py-2.5 text-center transition-colors flex items-center justify-center gap-2 shadow-sm"
                            title="Abrir Assistente Hermes"
                        >
                            <Bot className="w-4 h-4" /> Hermes AI
                        </button>

                        {viewMode === 'flat' && (
                            <button
                                type="button"
                                onClick={() => setShowColSettings(true)}
                                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 font-medium rounded-lg text-sm px-3 py-2.5 text-center transition-colors flex items-center justify-center gap-2"
                                title="Configurar Colunas"
                            >
                                <Settings className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    <div className="md:col-span-8 lg:col-span-7 flex flex-col xl:flex-row gap-4 mt-2 bg-gray-50 p-2 rounded-lg border border-gray-100 items-start xl:items-center w-full">
                        <div className="flex flex-col gap-1 flex-1">
                            <div className="flex items-center gap-2">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={filters.only_active === 'true'}
                                        onChange={(e) => setFilters(prev => ({ ...prev, only_active: e.target.checked ? 'true' : 'false', page: 1 }))}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                    <span className="ml-3 text-sm font-medium text-gray-700">Apenas Pendentes (Filtro Pesado)</span>
                                </label>
                                <label className="block text-[11px] font-medium text-gray-600 ml-1">Filtro Prioridade:</label>
                                  <select
                                      value={filters.somente_prioridades || 'false'}
                                      onChange={(e) => setFilters(prev => ({ ...prev, somente_prioridades: e.target.value, page: 1 }))}
                                      className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                  >
                                      <option value="false">Todos (Com e Sem Prioridade)</option>
                                      <option value="true">Somente Prioridades (Qualquer)</option>
                                      <option value="1">Grupo 1 (Urgente)</option>
                                      <option value="2">Grupo 2 (Alta)</option>
                                      <option value="3">Grupo 3 (Média)</option>
                                      <option value="4">Grupo 4 (Normal)</option>
                                  </select>                              <span className="text-[10px] text-gray-400 italic flex items-center gap-1 hidden md:flex">
                                    <AlertCircle className="h-3 w-3" />
                                    Desative para uma busca muito mais rápida.
                                </span>
                            </div>
                            <div className="text-[10px] text-gray-400 italic">
                                Datas do filtro = <span className="font-semibold text-gray-500">Entrada/Emissão do pedido</span> (Protheus).
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-medium text-gray-600">Ordenar por:</label>
                            <div className="flex gap-2">
                                <select 
                                    name="sortBy" 
                                    value={filters.sortBy || 'emissao'} 
                                    onChange={handleFilterChange}
                                    className="w-40 rounded border border-gray-200 bg-white p-1 text-[11px] outline-none focus:border-blue-500"
                                >
                                    <option value="pedido">Pedido/Item</option>
                                    <option value="emissao">Data do Pedido</option>
                                    <option value="entrega">Data de Entrega (Pedido)</option>
                                    <option value="entrega_pcp">Data de Entrega PCP</option>
                                    <option value="prev_fat">Prev. Fat. (Faturamento)</option>
                                </select>
                                <select 
                                    name="sortOrder" 
                                    value={filters.sortOrder || 'DESC'} 
                                    onChange={handleFilterChange}
                                    className="w-24 rounded border border-gray-200 bg-white p-1 text-[11px] outline-none focus:border-blue-500"
                                >
                                    <option value="DESC">Recentes</option>
                                    <option value="ASC">Antigos</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </form>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-white print:hidden">
                <div className="flex">
                    <button
                        onClick={() => setActiveTab('evolucao')}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'evolucao'
                            ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        <TrendingUp className="w-4 h-4" />
                        Evolução da Carteira
                    </button>

                    <button
                        onClick={() => setActiveTab('pcp-export')}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'pcp-export'
                            ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Exportação Materiais
                    </button>

                    <button
                        onClick={() => setActiveTab('cronograma')}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'cronograma'
                            ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        <Calendar className="w-4 h-4" />
                        Cronograma / Gantt
                    </button>

                    <button
                        onClick={() => setActiveTab('mrp-bulk')}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'mrp-bulk'
                            ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        <Package className="w-4 h-4" />
                        ðŸ“¦ Necessidades MP (Almox 01/03)
                    </button>

                    <button
                        onClick={() => setActiveTab('programacao-entregas')}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'programacao-entregas'
                            ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        <Calendar className="w-4 h-4" />
                        Programação de Entregas
                    </button>

                    <button
                        onClick={() => setActiveTab('planilha-mestra')}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'planilha-mestra'
                            ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Planilha Mestra
                    </button>
                </div>
                
                {/* Lote Actions */}
                {selectedItems.length > 0 && (
                    <div className="px-4 flex items-center gap-2">
                        <button
                            onClick={() => openPriorityModal(selectedItems, 'faturamento')}
                            className="flex items-center gap-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded shadow text-sm font-medium transition-colors"
                        >
                            <AlertCircle className="w-4 h-4" />
                            Faturamento ({selectedItems.length})
                        </button>
                        <button
                            onClick={() => openPriorityModal(selectedItems, 'op')}
                            className="flex items-center gap-2 px-4 py-1.5 bg-rose-800 hover:bg-rose-900 text-white rounded shadow text-sm font-medium transition-colors"
                        >
                            <Factory className="w-4 h-4" />
                            Prioridade OP ({selectedItems.length})
                        </button>
                        <button
                            onClick={() => { setReportSelectedItems(selectedItems); setShowReportModal(true); }}
                            className="flex items-center gap-2 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded shadow text-sm font-medium transition-colors"
                        >
                            <StickyNote className="w-4 h-4" />
                            Ata ({selectedItems.length})
                        </button>
                                                <button
                            onClick={() => { setSmartPlanTarget(selectedItems); setShowSmartPlanModal(true); }}
                            className="flex items-center gap-2 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded shadow text-sm font-medium transition-colors"
                        >
                            <Bot className="w-4 h-4" />
                            Planejamento Inteligente ({selectedItems.length})
                        </button>
                        <button
                            onClick={() => setPcpBalanceTarget(selectedItems)}
                            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded shadow text-sm font-medium transition-colors"
                        >
                            <Calendar className="w-4 h-4" />
                            Planejamento PCP ({selectedItems.length})
                        </button>
                        <button
                            onClick={() => setPcpForecastTarget(selectedItems)}
                            className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow text-sm font-medium transition-colors"
                        >
                            <Package className="w-4 h-4" />
                            Gerar Lote de O.P. ({selectedItems.length})
                        </button>
                        <button
                            onClick={() => setCorteForecastTarget(selectedItems)}
                            className="flex items-center gap-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded shadow text-sm font-medium transition-colors"
                        >
                            <Scissors className="w-4 h-4" />
                            Gerar Lote de Corte ({selectedItems.length})
                        </button>
                        
                        {/* Imprimir OPs Dropdown */}
                        <div className="relative group z-[100]">
                            <button className="flex items-center gap-2 px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded shadow text-sm font-medium transition-colors">
                                <Printer className="w-4 h-4" />
                                Imprimir OPs ({selectedItems.length})
                                <ChevronDown className="w-4 h-4 ml-1" />
                            </button>
                            <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-2xl py-2 hidden group-hover:block z-[100]">
                                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Formatos de Impressão</div>
                                <button onClick={() => handleBulkPrint('op_mirror')} className="w-full flex text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors">Espelho OP</button>
                                <button onClick={() => handleBulkPrint('op_ficha')} className="w-full flex text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors">Fichas de Operação</button>
                                <button onClick={() => handleBulkPrint('op_oper')} className="w-full flex text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors">OP por Operações</button>
                                <button onClick={() => handleBulkPrint('op_drawings')} className="w-full flex text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors">OP + Desenhos</button>
                                <button onClick={() => handleBulkPrint('op_resource_drawings')} className="w-full flex text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors">OP + Desenhos (Por Recurso)</button>
                                <button onClick={() => handleBulkPrint('op_stamp_drawings')} className="w-full flex text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors">OP + Desenhos (Carimbo)</button>
                                <button onClick={() => handleBulkPrint('op_stamp_resource_drawings')} className="w-full flex text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors">OP + Desenhos (Por Recurso + Carimbo)</button>
                                <button onClick={() => handleBulkPrint('op_stamp_desc_drawings')} className="w-full flex text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors">OP + Desenhos (Carimbo + Descrição)</button>
                                <button onClick={() => handleBulkPrint('op_stamp_desc_resource_drawings')} className="w-full flex text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors">OP + Desenhos (Por Recurso + Carimbo + Descrição)</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Evolução Content */}
            {activeTab === 'evolucao' && (
                <>
                    {/* Tabela */}
                    <div ref={tableScrollRef} className="flex-1 overflow-auto min-h-0 print:overflow-visible print:min-h-0" onScroll={handleScroll}>
                        <table className="w-full text-sm text-left text-gray-500 print:w-full">
                            <thead className="sticky top-0 z-10 text-xs text-gray-700 uppercase bg-gray-50 outline outline-1 outline-gray-200">
                                {viewMode === 'tree' ? (
                                    <tr>
                                        <th scope="col" className="w-12 px-4 py-3"></th>
                                        <th scope="col" className="px-4 py-3 font-semibold w-24">NÂº Pedido</th>
                                        <th scope="col" className="px-4 py-3 font-semibold w-32">Emissão</th>
                                        <th scope="col" className="px-4 py-3 font-semibold w-32">Entrega Prev.</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Cliente</th>
                                        <th scope="col" className="px-4 py-3 font-semibold text-center w-24">Status</th>
                                        <th scope="col" className="px-4 py-3 font-semibold text-center w-32">Obs</th>
                                    </tr>
                                ) : (
                                    <tr>
                                        {colConfig.filter(c => c.visible).map(col => {
                                            const isSortable = ['pedido', 'emissao', 'entrega', 'data_pcp', 'prev_fat'].includes(col.key);
                                            const sortKeyMap = { 'pedido': 'pedido', 'emissao': 'emissao', 'entrega': 'entrega', 'data_pcp': 'entrega_pcp', 'prev_fat': 'prev_fat' };
                                            const isActiveSort = isSortable && filters.sortBy === sortKeyMap[col.key];
                                            const sortIcon = isActiveSort ? (filters.sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3 ml-1 inline text-blue-600" /> : <ArrowDown className="w-3 h-3 ml-1 inline text-blue-600" />) : null;
                                            
                                            const thProps = isSortable ? {
                                                onClick: () => {
                                                    const mapped = sortKeyMap[col.key];
                                                    setFilters(prev => ({
                                                        ...prev,
                                                        sortBy: mapped,
                                                        sortOrder: prev.sortBy === mapped && prev.sortOrder === 'ASC' ? 'DESC' : 'ASC',
                                                        page: 1
                                                    }));
                                                },
                                                className: "cursor-pointer hover:bg-gray-100 transition-colors select-none",
                                                title: `Ordenar por ${col.label}`
                                            } : {};

                                            switch (col.key) {
                                                case 'checkbox':
                                                    return (
                                                        <th key="checkbox" className="px-2 py-3 border-b border-slate-700 text-center sticky left-0 z-20 bg-gray-50 min-w-[40px] max-w-[40px] w-[40px]">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={orders.length > 0 && selectedItems.length === orders.length}
                                                                onChange={handleSelectAll}
                                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                            />
                                                        </th>
                                                    );
                                                case 'pedido':
                                                    return <th key="pedido" {...thProps} className={`px-3 py-3 font-semibold sticky left-[40px] z-20 bg-gray-50 min-w-[90px] max-w-[90px] w-[90px] ${thProps.className || ''}`}>Pedido{sortIcon}</th>;
                                                case 'emissao':
                                                    return <th key="emissao" {...thProps} className={`px-3 py-3 font-semibold text-center bg-gray-50 min-w-[90px] max-w-[90px] w-[90px] ${thProps.className || ''}`}>Emissão{sortIcon}</th>;
                                                case 'ref_cliente':
                                                    return <th key="ref_cliente" className="px-3 py-3 font-semibold bg-gray-50 min-w-[100px] max-w-[100px] w-[100px] truncate">Ref. Cliente</th>;
                                                case 'cliente':
                                                    return <th key="cliente" className="px-3 py-3 font-semibold bg-gray-50 min-w-[150px] max-w-[150px] w-[150px] truncate">Cliente</th>;
                                                case 'pc':
                                                    return <th key="pc" className="px-3 py-3 font-semibold bg-gray-50 min-w-[90px] max-w-[90px] w-[90px] truncate">PC</th>;
                                                case 'item':
                                                    return <th key="item" className="px-2 py-3 font-semibold text-center bg-gray-50 min-w-[40px] max-w-[40px] w-[40px]">It</th>;
                                                case 'op':
                                                    return <th key="op" className="px-3 py-3 font-semibold text-center bg-gray-50 min-w-[80px] max-w-[80px] w-[80px]">OP</th>;
                                                case 'codigo':
                                                    return <th key="codigo" className="px-3 py-3 font-semibold bg-gray-50 min-w-[140px] max-w-[140px] w-[140px]">Cód. Prod</th>;
                                                case 'c6_xrevm':
                                                    return <th key="c6_xrevm" className="px-4 py-3 font-semibold">C6_XREVM</th>;
                                                case 'rev_cliente':
                                                    return <th key="rev_cliente" className="px-4 py-3 font-semibold">Rev. Cliente</th>;
                                                case 'acoes':
                                                    return <th key="acoes" className="px-4 py-3 font-semibold text-center w-8 print:hidden text-[10px]">Ações</th>;
                                                case 'classificacao':
                                                    return <th key="classificacao" className="px-4 py-3 font-semibold text-center w-32">Classificação</th>;
                                                case 'tipo':
                                                    return <th key="tipo" className="px-4 py-3 font-semibold text-center w-16">Tipo</th>;
                                                case 'descricao':
                                                    return <th key="descricao" className="px-4 py-3 font-semibold">Descrição</th>;
                                                case 'status':
                                                    return <th key="status" className="px-4 py-3 font-semibold text-center">Status</th>;
                                                case 'qtd_entreg':
                                                    return <th key="qtd_entreg" className="px-4 py-3 font-semibold text-right">Entreg.</th>;
                                                case 'saldo_fat':
                                                    return <th key="saldo_fat" className="px-4 py-3 font-semibold text-right">Saldo Fat.</th>;
                                                case 'qtd':
                                                    return <th key="qtd" className="px-4 py-3 font-semibold text-right">Qtd.</th>;
                                                case 'lib_eng':
                                                    return <th key="lib_eng" className="px-4 py-3 font-semibold text-center">Lib. Eng.</th>;
                                                case 'entrega':
                                                    return <th key="entrega" {...thProps} className={`px-4 py-3 font-semibold text-center ${thProps.className || ''}`}>Entrega{sortIcon}</th>;
                                                case 'qtd_pcp':
                                                    return <th key="qtd_pcp" className="px-4 py-3 font-semibold text-right text-xs">Qtd. PCP</th>;
                                                case 'data_pcp':
                                                    return <th key="data_pcp" {...thProps} className={`px-4 py-3 font-semibold text-center text-xs ${thProps.className || ''}`}>Data PCP{sortIcon}</th>;
                                                case 'prev_fat':
                                                    return <th key="prev_fat" {...thProps} className={`px-4 py-3 font-semibold text-center text-xs text-teal-800 ${thProps.className || ''}`}>Prev. Fat.{sortIcon}</th>;
                                                case 'evolucao_op':
                                                    return <th key="evolucao_op" className="px-4 py-3 font-semibold text-center text-xs w-[100px]">Evolução OP</th>;
                                                default: return null;
                                            }
                                        })}
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <TableSkeletonRows count={8} isFlat={viewMode === 'flat'} />
                                ) : error ? (
                                    <tr>
                                        <td colSpan={colSpanCount} className="px-6 py-12 text-center text-red-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <AlertCircle className="h-8 w-8" />
                                                <span className="font-semibold">{error}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : orders.length === 0 ? (
                                    <tr>
                                        <td colSpan={colSpanCount} className="px-6 py-12 text-center text-gray-400">
                                            Nenhum registro encontrado.
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {viewMode === 'tree' ? (
                                            // TREE VIEW IMPLEMENTATION
                                            sortedOrders.map((order, idx) => (
                                                <React.Fragment key={`${order.pedido}-${idx}`}>
                                                    <tr
                                                        className={`
                                                    border-b border-gray-50 transition-colors cursor-pointer 
                                                    ${expandedRow === order.pedido ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'}
                                                `}
                                                        onClick={() => handleExpandRow(order.pedido)}
                                                    >
                                                        <td className="px-4 py-3 text-center">
                                                            {expandedRow === order.pedido ? (
                                                                <ChevronUp className="h-4 w-4 text-blue-600 mx-auto" />
                                                            ) : (
                                                                <ChevronDown className="h-4 w-4 text-gray-400 mx-auto" />
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 font-medium text-gray-900">{order.pedido}</td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                                                <span>{formatProtheusDate(order.emissao)}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 font-medium text-blue-600 bg-blue-50/30">
                                                            <div className="flex items-center gap-2">
                                                                <Calendar className="h-4 w-4 flex-shrink-0" />
                                                                <span>{order.entrega ? order.entrega.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1') : '-'}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 font-medium">
                                                            <div className="truncate max-w-[250px]" title={order.nome_cliente}>{order.nome_cliente}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {order.status_cor === 'red' || order.itens_count === 0 ? (
                                                                <span className="text-red-700 text-xs font-bold px-2 py-0.5 rounded border border-red-300 bg-red-100">Pendente</span>
                                                            ) : order.status_cor === 'orange' ? (
                                                                <span className="text-orange-800 text-xs font-bold px-2 py-0.5 rounded border border-orange-300 bg-orange-100">Atenção</span>
                                                            ) : (
                                                                <>
                                                                    {order.status_cor === 'green' && <span className="text-green-800 text-xs font-bold px-2 py-0.5 rounded border border-green-300 bg-green-200">Aberto</span>}
                                                                    {order.status_cor === 'yellow' && <span className="text-yellow-800 text-xs font-bold px-2 py-0.5 rounded border border-yellow-300 bg-yellow-200">Liberado</span>}
                                                                </>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button
                                                                    title="Anotações / Ata Viva"
                                                                    onClick={(e) => { e.stopPropagation(); setNotesTarget({ order: order.pedido }); }}
                                                                    className="text-gray-400 hover:text-blue-600 transition-colors p-1 rounded hover:bg-gray-100"
                                                                >
                                                                    <StickyNote className="w-4 h-4" />
                                                                </button>

                                                                {/* Dropdown de impressão/exportação */}
                                                                <div className="relative" onClick={e => e.stopPropagation()}>
                                                                    <button
                                                                        title="Imprimir / Exportar"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (openActionMenu === `order-${order.pedido}`) {
                                                                                setOpenActionMenu(null);
                                                                            } else {
                                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                                setMenuPosition({ top: rect.bottom + 4, bottom: undefined, right: window.innerWidth - rect.right });
                                                                                setOpenActionMenu(`order-${order.pedido}`);
                                                                            }
                                                                        }}
                                                                        className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded hover:bg-gray-100"
                                                                    >
                                                                        <MoreVertical className="w-4 h-4" />
                                                                    </button>
                                                                    {openActionMenu === `order-${order.pedido}` && (
                                                                        <div 
                                                                            className="fixed z-[9999] bg-white rounded-lg border border-gray-200 shadow-xl py-1 min-w-[210px]"
                                                                            style={{ 
                                                                                top: menuPosition.top !== undefined ? `${menuPosition.top}px` : 'auto', 
                                                                                bottom: menuPosition.bottom !== undefined ? `${menuPosition.bottom}px` : 'auto', 
                                                                                right: `${menuPosition.right}px` 
                                                                            }}
                                                                        >
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); updateOrderFilters({ pedido: order.pedido, activeTab: 'pcp-export' }); setOpenActionMenu(null); }}
                                                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-green-50 hover:text-green-700 transition-colors"
                                                                            >
                                                                                <FileSpreadsheet className="h-4 w-4 flex-shrink-0 text-green-600" />
                                                                                <span>Exportar Materiais (PCP)</span>
                                                                            </button>
                                                                            <div className="border-t border-gray-100 my-1" />
                                                                            <button
                                                                                onClick={(e) => { handlePrintOrder(e, order.pedido); setOpenActionMenu(null); }}
                                                                                disabled={printingOrderId === order.pedido}
                                                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-40"
                                                                            >
                                                                                {printingOrderId === order.pedido ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <Printer className="h-4 w-4 flex-shrink-0 text-red-500" />}
                                                                                <span>Imprimir Pedido de Venda</span>
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => { handlePrintOPMirror(order.pedido, e); setOpenActionMenu(null); }}
                                                                                disabled={printingOrderId === `op-${order.pedido}`}
                                                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-teal-50 hover:text-teal-700 transition-colors disabled:opacity-40"
                                                                            >
                                                                                {printingOrderId === `op-${order.pedido}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <Factory className="h-4 w-4 flex-shrink-0 text-teal-500" />}
                                                                                <span>Espelho OP (BOM + Roteiro)</span>
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => { handlePrintFichas(order.pedido, e); setOpenActionMenu(null); }}
                                                                                disabled={printingOrderId === `ficha-${order.pedido}`}
                                                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-amber-50 hover:text-amber-700 transition-colors disabled:opacity-40"
                                                                            >
                                                                                {printingOrderId === `ficha-${order.pedido}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ClipboardList className="h-4 w-4 flex-shrink-0 text-amber-500" />}
                                                                                <span>Fichas de Operação</span>
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => { handlePrintOPByOperation(order.pedido, e); setOpenActionMenu(null); }}
                                                                                disabled={printingOrderId === `op-oper-${order.pedido}`}
                                                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors disabled:opacity-40"
                                                                            >
                                                                                {printingOrderId === `op-oper-${order.pedido}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <Layers className="h-4 w-4 flex-shrink-0 text-blue-500" />}
                                                                                <span>Por Operações (PDF)</span>
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => { handlePrintOPByOperationWithDrawings(order.pedido, e); setOpenActionMenu(null); }}
                                                                                disabled={printingOrderId === `op-drawings-${order.pedido}`}
                                                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors disabled:opacity-40"
                                                                            >
                                                                                {printingOrderId === `op-drawings-${order.pedido}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ImageIcon className="h-4 w-4 flex-shrink-0 text-indigo-500" />}
                                                                                <span>OP + Desenhos (PDF)</span>
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => { handlePrintOPByResourceWithDrawings(order.pedido, e); setOpenActionMenu(null); }}
                                                                                disabled={printingOrderId === `op-resource-drawings-${order.pedido}`}
                                                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-cyan-50 hover:text-cyan-700 transition-colors disabled:opacity-40"
                                                                            >
                                                                                {printingOrderId === `op-resource-drawings-${order.pedido}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ImageIcon className="h-4 w-4 flex-shrink-0 text-cyan-500" />}
                                                                                <span>OP + Desenhos (Por Recurso)</span>
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => { handlePrintOPWithOpsStampWithDrawings(order.pedido, e); setOpenActionMenu(null); }}
                                                                                disabled={printingOrderId === `op-stamp-drawings-${order.pedido}`}
                                                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-pink-50 hover:text-pink-700 transition-colors disabled:opacity-40"
                                                                            >
                                                                                {printingOrderId === `op-stamp-drawings-${order.pedido}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ImageIcon className="h-4 w-4 flex-shrink-0 text-pink-500" />}
                                                                                <span>OP + Desenhos (Roteiro no Carimbo)</span>
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => { handlePrintOPWithOpsStampWithDescDrawings(order.pedido, e); setOpenActionMenu(null); }}
                                                                                disabled={!order.has_op || printingOrderId === `op-stamp-desc-drawings-${order.pedido}`}
                                                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-purple-50 hover:text-purple-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                                            >
                                                                                {printingOrderId === `op-stamp-desc-drawings-${order.pedido}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ImageIcon className="h-4 w-4 flex-shrink-0 text-purple-500" />}
                                                                                <span>OP + Desenhos (Roteiro/Descrição no Carimbo)</span>
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => { handlePrintOPWithOpsStampWithDescDrawingsByResource(order.pedido, e); setOpenActionMenu(null); }}
                                                                                disabled={!order.has_op || printingOrderId === `op-stamp-desc-resource-drawings-${order.pedido}`}
                                                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-fuchsia-50 hover:text-fuchsia-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                                            >
                                                                                {printingOrderId === `op-stamp-desc-resource-drawings-${order.pedido}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ImageIcon className="h-4 w-4 flex-shrink-0 text-fuchsia-500" />}
                                                                                <span>OP + Desenhos (Roteiro/Descrição no Carimbo) - Por Recurso</span>
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => { handleExportOPByOperationExcel(order.pedido, e); setOpenActionMenu(null); }}
                                                                                disabled={printingOrderId === `op-excel-${order.pedido}`}
                                                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors disabled:opacity-40"
                                                                            >
                                                                                {printingOrderId === `op-excel-${order.pedido}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <FileSpreadsheet className="h-4 w-4 flex-shrink-0 text-emerald-600" />}
                                                                                <span>Por Operações (Excel)</span>
                                                                            </button>
                                                                            <div className="border-t border-gray-100 my-1" />
                                                                            <div className="px-3 py-1 text-[10px] font-bold text-emerald-800 bg-emerald-50/70 uppercase tracking-wider flex items-center gap-1.5">
                                                                                <Boxes size={12} className="text-emerald-600" />
                                                                                <span>Com Estudo de Estoque</span>
                                                                            </div>
                                                                            <button 
                                                                                onClick={(e) => { handlePrintOPByOperationWithDrawings(order.pedido, e, null, true); setOpenActionMenu(null); }} 
                                                                                disabled={printingOrderId === `op-drawings-${order.pedido}-stock`} 
                                                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-medium"
                                                                            >
                                                                                {printingOrderId === `op-drawings-${order.pedido}-stock` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0 text-emerald-600" /> : <Boxes className="h-4 w-4 flex-shrink-0 text-emerald-600" />} 
                                                                                <span>OP + Desenhos + Estoque</span>
                                                                            </button>
                                                                            <button 
                                                                                onClick={(e) => { handlePrintOPWithOpsStampWithDescDrawings(order.pedido, e, null, true); setOpenActionMenu(null); }} 
                                                                                disabled={!order.has_op || printingOrderId === `op-stamp-desc-drawings-${order.pedido}-stock`} 
                                                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-medium"
                                                                            >
                                                                                {printingOrderId === `op-stamp-desc-drawings-${order.pedido}-stock` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0 text-purple-600" /> : <Boxes className="h-4 w-4 flex-shrink-0 text-purple-600" />} 
                                                                                <span>OP + Desenhos (Carimbo) + Estoque</span>
                                                                            </button>
                                                                            <button 
                                                                                onClick={(e) => { handlePrintOPWithOpsStampWithDescDrawingsByResource(order.pedido, e, null, true); setOpenActionMenu(null); }} 
                                                                                disabled={!order.has_op || printingOrderId === `op-stamp-desc-resource-drawings-${order.pedido}-stock`} 
                                                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-medium"
                                                                            >
                                                                                {printingOrderId === `op-stamp-desc-resource-drawings-${order.pedido}-stock` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0 text-fuchsia-600" /> : <Boxes className="h-4 w-4 flex-shrink-0 text-fuchsia-600" />} 
                                                                                <span>OP + Desenhos (Por Recurso) + Estoque</span>
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {expandedRow === order.pedido && (
                                                        <tr className="bg-slate-50 border-b border-gray-100 animate-fadeIn">
                                                            <td colSpan="6" className="px-4 py-4 md:px-12">
                                                                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                                                                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                                                        <Package className="h-4 w-4 text-blue-500" />
                                                                        Itens do Pedido {order.pedido}
                                                                    </h4>

                                                                    {itemsLoading && !orderItems[order.pedido] ? (
                                                                        <div className="flex justify-center py-4">
                                                                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="overflow-x-scroll max-h-[calc(100vh-250px)]">
                                                                            <table className="w-full text-sm text-left text-gray-500">
                                                                                <thead className="text-xs text-gray-400 uppercase bg-gray-50/50 border-b border-gray-100">
                                                                                    <tr>
                                                                                        <th className="px-3 py-2 w-10 text-center"><input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" onChange={handleSelectAll} checked={selectedItems.length > 0 && selectedItems.length >= orders.reduce((acc, o) => acc + (orderItems[o.pedido] ? orderItems[o.pedido].length : 0), 0)} /></th>
                                                                                        <th className="px-4 py-2">Item</th>
                                                                                        <th className="px-4 py-2 text-center">OP</th>
                                                                                        <th className="px-4 py-2">Cód. Produto</th>
                                                                                        <th className="px-4 py-2">C6_XREVM</th>
                                                                                        <th className="px-4 py-2">Cód. Prod. Cliente</th>
                                                                                        <th className="px-4 py-2">Rev. Cliente</th>
                                                                                        <th className="px-4 py-2 text-center">Ações</th>
                                                                                        <th className="px-4 py-2 text-center">Classificação</th>
                                                                                        <th className="px-4 py-2 text-center w-16">Tipo</th>
                                                                                        <th className="px-4 py-2">Descrição</th>
                                                                                        <th className="px-4 py-2 text-center">Status</th>
                                                                                        <th className="px-4 py-2 w-32 text-center text-xs">Início Eng.</th>
                                                                                        <th className="px-4 py-2 text-center text-xs">UM</th>
                                                                                        <th className="px-4 py-2 text-center">Ped. Cli.</th>
                                                                                        <th className="px-4 py-2 text-right">Entreg.</th>
                                                                                        <th className="px-4 py-2 text-right">Saldo Fat.</th>
                                                                                        <th className="px-4 py-2 text-right">Qtd.</th>
                                                                                        <th className="px-4 py-2 text-center text-xs">Lib. Eng.</th>
                                                                                        <th className="px-4 py-2 text-center">Entrega</th>
                                                                                        <th className="px-4 py-2 text-right text-xs">Qtd. PCP</th>
                                                                                        <th className="px-4 py-2 text-center text-xs">Data PCP</th>
                                                                                        <th className="px-4 py-2 text-center text-xs text-teal-800">Prev. Fat.</th>
                                                                                        <th className="px-4 py-2 text-center text-xs">Evolução OP</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {Array.isArray(orderItems[order.pedido]) && orderItems[order.pedido].length > 0 ? (
                                                                                        orderItems[order.pedido]
                                                                                            .filter(item => filters.only_active === 'false' || parseFloat(item.qtd_faturar || 0) > 0)
                                                                                            .filter(item => {
                                                                                                const effectiveClassifs = fixedClassificacao || filters.classificacao_item;
                                                                                                if (!effectiveClassifs) return true;
                                                                                                const activeClassifs = effectiveClassifs.split(',').filter(Boolean);
                                                                                                if (activeClassifs.length === 0) return true;
                                                                                                return activeClassifs.includes(item.classificacao || 'Nenhum');
                                                                                            })
                                                                                            .map((item, i) => (
                                                                                                <tr key={`${order.pedido}-${item.item}-${i}`} className={`border-b border-gray-50 last:border-0 transition-colors ${parseFloat(item.qtd_faturar || 0) <= 0 ? 'bg-green-50/40 hover:bg-green-100/50 opacity-80' : 'hover:bg-gray-50/50'}`}>
                                                                                                    <td className="px-4 py-2">
                                                                                                        <div className="flex items-center gap-1">
                                                                                                            {item.item}
                                                                                                            {['Jits', 'PPAP', 'Jits e PPAP'].includes(item.classificacao) && (
                                                                                                                <Award className="h-3 w-3 text-purple-600 flex-shrink-0" title={`Classificação: ${item.classificacao}`} />
                                                                                                            )}
                                                                                                        </div>
                                                                                                    </td>
                                                                                                    <td className="px-4 py-2 text-center">
                                                                                                        <div className="flex items-center justify-center gap-1.5">
                                                                                                            <span
                                                                                                                className={`px-1.5 py-0.5 rounded text-xs font-mono ${String(item.op_tipo || '').trim().toUpperCase() === 'F' ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200' : 'bg-blue-50 text-blue-700 font-medium'} ${item.op_num ? 'cursor-pointer hover:underline' : ''}`}
                                                                                                                title={item.op_num ? 'Ver estrutura da OP' : undefined}
                                                                                                                onClick={item.op_num ? (e) => { e.stopPropagation(); setBomStructureTarget({ op: item.op_num, itemPv: item.item, pedido: order.pedido, produto: item.codigo }); } : undefined}
                                                                                                            >
                                                                                                                {item.op_num || '-'}
                                                                                                            </span>
                                                                                                            {item.op_num && item.op_num !== '-' && (
                                                                                                                String(item.op_tipo || '').trim().toUpperCase() === 'F' ? (
                                                                                                                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded shadow-sm border border-emerald-200" title="OP Firme">F</span>
                                                                                                                ) : String(item.op_tipo || '').trim().toUpperCase() === 'P' ? (
                                                                                                                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-800 rounded shadow-sm border border-orange-200" title="OP Prevista">P</span>
                                                                                                                ) : null
                                                                                                            )}
                                                                                                        </div>
                                                                                                    </td>
                                                                                                    <td className="px-4 py-2 font-mono text-xs">
                                                                                                        <Link
                                                                                                            to={`/estrutura/${encodeURIComponent(item.codigo)}?pedido=${encodeURIComponent(order.pedido || '')}&item=${encodeURIComponent(item.item || '')}`}
                                                                                                            state={{ from: location.pathname, pedido: order.pedido, item: item.item }}
                                                                                                            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                                                                                        >
                                                                                                            {item.codigo} <Layers className="h-3 w-3" />
                                                                                                        </Link>
                                                                                                    </td>
                                                                                                    <td className="px-4 py-2 text-center text-xs text-gray-500">{item.rev_codigo || '-'}</td>
                                                                                                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{item.ref_cliente || '-'}</td>
                                                                                                    <td className="px-4 py-2 text-center text-xs text-gray-500">{item.c6_rev_cliente || '-'}</td>
                                                                                                    <td className="px-2 py-2">
                                                                                                        <div className="flex items-center justify-center gap-0.5">
                                                                                                            {/* PDF/Docs - sempre visível */}
                                                                                                            <button
                                                                                                                onClick={() => {
                                                                                                                    if (item.has_drawing && item.drawing_url) {
                                                                                                                        window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(item.drawing_url)}`), '_blank');
                                                                                                                    } else if (item.docs_count === 1 && item.first_doc) {
                                                                                                                        window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(item.first_doc)}`), '_blank');
                                                                                                                    } else {
                                                                                                                        handleOpenDocs(item.codigo, item.descricao);
                                                                                                                    }
                                                                                                                }}
                                                                                                                className={`p-1.5 rounded transition-all flex items-center justify-center relative ${item.has_docs ? 'text-red-500 bg-red-50 hover:bg-red-100 ring-1 ring-red-200/50' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'}`}
                                                                                                                title={item.has_docs ? `${item.docs_count} Documento(s)` : "Documentos"}
                                                                                                            >
                                                                                                                <FileText className="h-3.5 w-3.5" />
                                                                                                                {item.has_docs && (
                                                                                                                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                                                                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                                                                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                                                                                                    </span>
                                                                                                                )}
                                                                                                            </button>
                                                                                                            {/* Obs - visível com destaque quando preenchido */}
                                                                                                            <button
                                                                                                                onClick={(e) => { e.stopPropagation(); setNotesTarget({ order: order.pedido, item: item.item, product: item.codigo, currentNote: item.observacao || '' }); }}
                                                                                                                className={`p-1.5 rounded transition-all flex items-center justify-center ${item.observacao ? 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100 ring-1 ring-yellow-200/50' : 'text-gray-300 hover:text-yellow-600 hover:bg-yellow-50'}`}
                                                                                                                title={item.observacao ? "Ver/Editar Observação" : "Observação"}
                                                                                                            >
                                                                                                                <StickyNote className="h-3.5 w-3.5" />
                                                                                                            </button>
                                                                                                            {/* Dropdown: Eng. + Impressão/Exportação */}
                                                                                                            <div className="relative" onClick={e => e.stopPropagation()}>
                                                                                                                <button
                                                                                                                    title="Mais ações"
                                                                                                                    onClick={(e) => { 
                                                                                                                        e.stopPropagation(); 
                                                                                                                        const key = `item-${order.pedido}-${item.item}`; 
                                                                                                                        if (openActionMenu === key) {
                                                                                                                            setOpenActionMenu(null);
                                                                                                                        } else {
                                                                                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                                                                                            const spaceBelow = window.innerHeight - rect.bottom;
                                                                                                                            const spaceAbove = rect.top;
                                                                                                                            const menuHeight = 350; // estimated max height
                                                                                                                            if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
                                                                                                                                // Open upwards
                                                                                                                                setMenuPosition({ top: undefined, bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right });
                                                                                                                            } else {
                                                                                                                                // Open downwards
                                                                                                                                setMenuPosition({ top: rect.bottom + 4, bottom: undefined, right: window.innerWidth - rect.right });
                                                                                                                            }
                                                                                                                            setOpenActionMenu(key);
                                                                                                                        }
                                                                                                                    }}
                                                                                                                    className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all flex items-center justify-center"
                                                                                                                >
                                                                                                                    <MoreVertical className="h-3.5 w-3.5" />
                                                                                                                </button>
                                                                                                                {openActionMenu === `item-${order.pedido}-${item.item}` && (
                                                                                                                    <div 
                                                                                                                        className="fixed z-[9999] bg-white rounded-lg border border-gray-200 shadow-xl py-1 min-w-[220px]"
                                                                                                                        style={{ 
                                                                                                                            top: menuPosition.top !== undefined ? `${menuPosition.top}px` : 'auto', 
                                                                                                                            bottom: menuPosition.bottom !== undefined ? `${menuPosition.bottom}px` : 'auto', 
                                                                                                                            right: `${menuPosition.right}px` 
                                                                                                                        }}
                                                                                                                    >
                                                                                                                        <button
                                                                                                                            onClick={(e) => {
                                                                                                                                e.stopPropagation();
                                                                                                                                setStructureStockTarget({
                                                                                                                                    productCode: item.codigo,
                                                                                                                                    productDesc: item.descricao,
                                                                                                                                    orderNum: order.pedido,
                                                                                                                                    orderItem: item.item,
                                                                                                                                    orderQty: item.qtd_faturar || item.quantidade,
                                                                                                                                    clientName: order.nome_cliente
                                                                                                                                });
                                                                                                                                setOpenActionMenu(null);
                                                                                                                            }}
                                                                                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50 font-bold transition-colors"
                                                                                                                        >
                                                                                                                            <Boxes className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                                                                                                                            <span>Estoque da Estrutura (BOM)</span>
                                                                                                                        </button>
                                                                                                                        <button
                                                                                                                            onClick={(e) => { e.stopPropagation(); setEngineeringTarget({ orderId: order.pedido, item }); setOpenActionMenu(null); }}
                                                                                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                                                                                                                        >
                                                                                                                            <Settings className="h-4 w-4 flex-shrink-0 text-blue-500" />
                                                                                                                            <span>Controle Engenharia</span>
                                                                                                                        </button>
                                                                                                                        <button
                                                                                                                            onClick={(e) => {
                                                                                                                                e.stopPropagation();
                                                                                                                                openPriorityModal({ pedido: order.pedido, item: item.item, codigo: item.codigo, op_num: item.op_num }, 'faturamento');
                                                                                                                                setOpenActionMenu(null);
                                                                                                                            }}
                                                                                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                                                                                                                        >
                                                                                                                            <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
                                                                                                                            <span>Prioridade Faturamento</span>
                                                                                                                        </button>
                                                                                                                        <button
                                                                                                                            onClick={(e) => {
                                                                                                                                e.stopPropagation();
                                                                                                                                openPriorityModal({ pedido: order.pedido, item: item.item, codigo: item.codigo, op_num: item.op_num }, 'op');
                                                                                                                                setOpenActionMenu(null);
                                                                                                                            }}
                                                                                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-rose-50 hover:text-rose-800 transition-colors"
                                                                                                                        >
                                                                                                                            <Factory className="h-4 w-4 flex-shrink-0 text-rose-700" />
                                                                                                                            <span>Prioridade de OP</span>
                                                                                                                        </button>
                                                                                                                        <div className="border-t border-gray-100 my-1" />
                                                                                                                        <button
                                                                                                                            onClick={(e) => { handlePrintOPMirror(order.pedido, e, item.item); setOpenActionMenu(null); }}
                                                                                                                            disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-${order.pedido}-${item.item}`}
                                                                                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-teal-50 hover:text-teal-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                                                                                        >
                                                                                                                            {printingOrderId === `op-${order.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <Factory className="h-4 w-4 flex-shrink-0 text-teal-500" />}
                                                                                                                            <span>Espelho OP</span>
                                                                                                                        </button>
                                                                                                                        <button
                                                                                                                            onClick={(e) => { handlePrintFichas(order.pedido, e, item.item); setOpenActionMenu(null); }}
                                                                                                                            disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `ficha-${order.pedido}-${item.item}`}
                                                                                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-amber-50 hover:text-amber-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                                                                                        >
                                                                                                                            {printingOrderId === `ficha-${order.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ClipboardList className="h-4 w-4 flex-shrink-0 text-amber-500" />}
                                                                                                                            <span>Fichas de Operação</span>
                                                                                                                        </button>
                                                                                                                        <button
                                                                                                                            onClick={(e) => { handlePrintOPByOperation(order.pedido, e, item.item); setOpenActionMenu(null); }}
                                                                                                                            disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-oper-${order.pedido}-${item.item}`}
                                                                                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                                                                                        >
                                                                                                                            {printingOrderId === `op-oper-${order.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <Layers className="h-4 w-4 flex-shrink-0 text-blue-500" />}
                                                                                                                            <span>Por Operações (PDF)</span>
                                                                                                                        </button>
                                                                                                                        <button
                                                                                                                            onClick={(e) => { handlePrintOPByOperationWithDrawings(order.pedido, e, item.item); setOpenActionMenu(null); }}
                                                                                                                            disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-drawings-${order.pedido}-${item.item}`}
                                                                                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                                                                                        >
                                                                                                                            {printingOrderId === `op-drawings-${order.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ImageIcon className="h-4 w-4 flex-shrink-0 text-indigo-500" />}
                                                                                                                            <span>OP + Desenhos (PDF)</span>
                                                                                                                        </button>
                                                                                                                        <button
                                                                                                                            onClick={(e) => { handlePrintOPByResourceWithDrawings(order.pedido, e, item.item); setOpenActionMenu(null); }}
                                                                                                                            disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-resource-drawings-${order.pedido}-${item.item}`}
                                                                                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-cyan-50 hover:text-cyan-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                                                                                        >
                                                                                                                            {printingOrderId === `op-resource-drawings-${order.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ImageIcon className="h-4 w-4 flex-shrink-0 text-cyan-500" />}
                                                                                                                            <span>OP + Desenhos (Por Recurso)</span>
                                                                                                                        </button>
                                                                                                                        <button
                                                                                                                            onClick={(e) => { handlePrintOPWithOpsStampWithDrawings(order.pedido, e, item.item); setOpenActionMenu(null); }}
                                                                                                                            disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-stamp-drawings-${order.pedido}-${item.item}`}
                                                                                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                                                                                        >
                                                                                                                            {printingOrderId === `op-stamp-drawings-${order.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ImageIcon className="h-4 w-4 flex-shrink-0 text-indigo-500" />}
                                                                                                                            <span>OP + Desenhos (Roteiro no Carimbo)</span>
                                                                                                                        </button>
                                                                                                                        <button
                                                                                                                            onClick={(e) => { handlePrintOPWithOpsStampDrawingsByResource(order.pedido, e, item.item); setOpenActionMenu(null); }}
                                                                                                                            disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-stamp-resource-drawings-${order.pedido}-${item.item}`}
                                                                                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                                                                                        >
                                                                                                                            {printingOrderId === `op-stamp-resource-drawings-${order.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ImageIcon className="h-4 w-4 flex-shrink-0 text-blue-500" />}
                                                                                                                            <span>OP + Desenhos (Roteiro no Carimbo) - Por Recurso</span>
                                                                                                                        </button>
                                                                                                                        <button
                                                                                                                            onClick={(e) => { handlePrintOPWithOpsStampWithDescDrawings(order.pedido, e, item.item); setOpenActionMenu(null); }}
                                                                                                                            disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-stamp-desc-drawings-${order.pedido}-${item.item}`}
                                                                                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-purple-50 hover:text-purple-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                                                                                        >
                                                                                                                            {printingOrderId === `op-stamp-desc-drawings-${order.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ImageIcon className="h-4 w-4 flex-shrink-0 text-purple-500" />}
                                                                                                                            <span>OP + Desenhos (Roteiro/Descrição no Carimbo)</span>
                                                                                                                        </button>
                                                                                                                        <button
                                                                                                                            onClick={(e) => { handlePrintOPWithOpsStampWithDescDrawingsByResource(order.pedido, e, item.item); setOpenActionMenu(null); }}
                                                                                                                            disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-stamp-desc-resource-drawings-${order.pedido}-${item.item}`}
                                                                                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-fuchsia-50 hover:text-fuchsia-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                                                                                        >
                                                                                                                            {printingOrderId === `op-stamp-desc-resource-drawings-${order.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ImageIcon className="h-4 w-4 flex-shrink-0 text-fuchsia-500" />}
                                                                                                                            <span>OP + Desenhos (Roteiro/Descrição no Carimbo) - Por Recurso</span>
                                                                                                                        </button>
                                                                                                                        <button
                                                                                                                            onClick={(e) => { handleExportOPByOperationExcel(order.pedido, e, item.item); setOpenActionMenu(null); }}
                                                                                                                            disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-excel-${order.pedido}-${item.item}`}
                                                                                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                                                                                        >
                                                                                                                            {printingOrderId === `op-excel-${order.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <FileSpreadsheet className="h-4 w-4 flex-shrink-0 text-emerald-600" />}
                                                                                                                            <span>Por Operações (Excel)</span>
                                                                                                                        </button>
                                                                                                                        <div className="border-t border-gray-100 my-1" />
                                                                                                                        <div className="px-3 py-1 text-[10px] font-bold text-emerald-800 bg-emerald-50/70 uppercase tracking-wider flex items-center gap-1.5">
                                                                                                                            <Boxes size={12} className="text-emerald-600" />
                                                                                                                            <span>Com Estudo de Estoque</span>
                                                                                                                        </div>
                                                                                                                        <button 
                                                                                                                            onClick={(e) => { handlePrintOPByOperationWithDrawings(order.pedido, e, item.item, true); setOpenActionMenu(null); }} 
                                                                                                                            disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-drawings-${order.pedido}-${item.item}-stock`} 
                                                                                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-medium"
                                                                                                                        >
                                                                                                                            {printingOrderId === `op-drawings-${order.pedido}-${item.item}-stock` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0 text-emerald-600" /> : <Boxes className="h-4 w-4 flex-shrink-0 text-emerald-600" />} 
                                                                                                                            <span>OP + Desenhos + Estoque</span>
                                                                                                                        </button>
                                                                                                                        <button 
                                                                                                                            onClick={(e) => { handlePrintOPWithOpsStampWithDescDrawings(order.pedido, e, item.item, true); setOpenActionMenu(null); }} 
                                                                                                                            disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-stamp-desc-drawings-${order.pedido}-${item.item}-stock`} 
                                                                                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-medium"
                                                                                                                        >
                                                                                                                            {printingOrderId === `op-stamp-desc-drawings-${order.pedido}-${item.item}-stock` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0 text-purple-600" /> : <Boxes className="h-4 w-4 flex-shrink-0 text-purple-600" />} 
                                                                                                                            <span>OP + Desenhos (Carimbo) + Estoque</span>
                                                                                                                        </button>
                                                                                                                        <button 
                                                                                                                            onClick={(e) => { handlePrintOPWithOpsStampWithDescDrawingsByResource(order.pedido, e, item.item, true); setOpenActionMenu(null); }} 
                                                                                                                            disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-stamp-desc-resource-drawings-${order.pedido}-${item.item}-stock`} 
                                                                                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-medium"
                                                                                                                        >
                                                                                                                            {printingOrderId === `op-stamp-desc-resource-drawings-${order.pedido}-${item.item}-stock` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0 text-fuchsia-600" /> : <Boxes className="h-4 w-4 flex-shrink-0 text-fuchsia-600" />} 
                                                                                                                            <span>OP + Desenhos (Por Recurso) + Estoque</span>
                                                                                                                        </button>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </td>
                                                                                                    <td className="px-4 py-2 text-center">
                                                                                                        <button
                                                                                                            onClick={() => {
                                                                                                                if (canEdit) {
                                                                                                                    handleOpenClassificacaoModal({ ...item, pedido: order.pedido });
                                                                                                                }
                                                                                                            }}
                                                                                                            className={`px-2 py-1 text-xs font-bold rounded shadow-sm border whitespace-nowrap flex items-center justify-center gap-1 mx-auto transition-colors
                                                                                                                ${!item.classificacao || item.classificacao === 'Nenhum' ? 'bg-slate-50 text-slate-500 border-slate-200 ' + (canEdit ? 'hover:bg-slate-100 cursor-pointer' : 'cursor-default') : ''}
                                                                                                                ${item.classificacao === 'Jits' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 ' + (canEdit ? 'hover:bg-indigo-100 cursor-pointer' : 'cursor-default') : ''}
                                                                                                                ${item.classificacao === 'PPAP' ? 'bg-orange-50 text-orange-700 border-orange-200 ' + (canEdit ? 'hover:bg-orange-100 cursor-pointer' : 'cursor-default') : ''}
                                                                                                                ${item.classificacao === 'Jits e PPAP' ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 ' + (canEdit ? 'hover:bg-fuchsia-100 cursor-pointer' : 'cursor-default') : ''}
                                                                                                            `}
                                                                                                            title={canEdit ? "Clique para editar Classificação e Anexos" : "Classificação da Peça"}
                                                                                                        >
                                                                                                            {item.classificacao && item.classificacao !== 'Nenhum' ? item.classificacao : 'Classificar'}
                                                                                                        </button>
                                                                                                    </td>
                                                                                                    <td className="px-4 py-2 text-center">
                                                                                                        {(() => {
                                                                                                            const tipo = item.status_tipo_item;
                                                                                                            const detalhe = item.status_tipo_detalhe;
                                                                                                            const cfgs = {
                                                                                                                Novo: { label: 'NOVO', bg: 'bg-blue-100 text-blue-700 border-blue-200' },
                                                                                                                'Revisão': { label: 'REVISÃO', bg: 'bg-orange-100 text-orange-700 border-orange-200' },
                                                                                                                'Restrição': { label: 'RESTRIÇÃO', bg: 'bg-red-100 text-red-700 border-red-200' },
                                                                                                            };
                                                                                                            const cfg = cfgs[tipo] || { label: 'PCP', bg: 'bg-gray-100 text-gray-700 border-gray-200' };
                                                                                                            return (
                                                                                                                <div className="relative group/tipo inline-flex justify-center">
                                                                                                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded border cursor-help ${cfg.bg}`}>{cfg.label}</span>
                                                                                                                    {detalhe && (
                                                                                                                        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tipo:flex flex-col items-center">
                                                                                                                            <div className="bg-slate-800 text-slate-100 text-[10px] rounded p-2 shadow-xl border border-slate-700 whitespace-nowrap text-left min-w-[150px] max-w-[300px]">
                                                                                                                                <div className="font-bold text-white mb-1 border-b border-slate-600 pb-1">Detalhes do Tipo:</div>
                                                                                                                                <div className="whitespace-normal">{detalhe}</div>
                                                                                                                            </div>
                                                                                                                            <div className="w-2 h-2 bg-slate-800 rotate-45 -mt-1 border-b border-r border-slate-700"></div>
                                                                                                                        </div>
                                                                                                                    )}
                                                                                                                </div>
                                                                                                            );
                                                                                                        })()}
                                                                                                    </td>
                                                                                                    <td className="px-4 py-2">{item.descricao}</td>
                                                                                                    <td className="px-4 py-2 text-center">
                                                                                                        <ItemStatusBadge
                                                                                                            item={item}
                                                                                                            onNfClick={(nf) => {
                                                                                                                setSelectedInvoice(nf);
                                                                                                                setInvoiceModalItem(item);
                                                                                                            }}
                                                                                                            index={i}
                                                                                                        />
                                                                                                    </td>
                                                                                                    <td className="px-4 py-2 text-center text-xs text-gray-600">
                                                                                                        {item.engineering_start_date ? new Date(item.engineering_start_date).toLocaleDateString('pt-BR') : '-'}
                                                                                                    </td>
                                                                                                    <td className="px-4 py-2 text-center text-xs text-gray-500">{item.unidade}</td>
                                                                                                    <td className="px-4 py-2 text-center text-gray-400">{item.ped_cliente || '-'}</td>
                                                                                                    <td className="px-4 py-2 text-right text-gray-600">{parseFloat(item.qtd_entreg || 0).toLocaleString('pt-BR')}</td>
                                                                                                    <td className={`px-4 py-2 text-right font-medium ${parseFloat(item.qtd_faturar || 0) <= 0 ? 'text-green-600' : 'text-orange-600 font-bold'}`}>{parseFloat(item.qtd_faturar || 0).toLocaleString('pt-BR')}</td>
                                                                                                    <td className="px-4 py-2 text-right font-semibold">{parseFloat(item.quantidade || 0).toLocaleString('pt-BR')}</td>
                                                                                                    <td className="px-4 py-2 text-center">
                                                                                                        <div className="flex flex-col gap-0.5">
                                                                                                            <div className={`flex items-center justify-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${item.pcp_planned_eng_date ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-gray-50 text-gray-400 border-dashed border-gray-200'}`}>
                                                                                                                <Calendar className="h-2.5 w-2.5" />
                                                                                                                <span>Plan: {item.pcp_planned_eng_date ? new Date(item.pcp_planned_eng_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}</span>
                                                                                                            </div>
                                                                                                            {item.designer_production_release_date && (
                                                                                                                <div className="flex items-center justify-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
                                                                                                                    <Calendar className="h-2.5 w-2.5" />
                                                                                                                    <span>Real: {new Date(item.designer_production_release_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                                                                                                                </div>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    </td>
                                                                                                    <td className="px-4 py-2 text-center flex items-center justify-center gap-1 font-medium bg-blue-50 text-blue-800 rounded">
                                                                                                        <Calendar className="h-3 w-3 text-blue-400" />
                                                                                                        {item.pcp_delivery_forecast_date ? new Date(item.pcp_delivery_forecast_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : (item.entrega ? item.entrega.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1') : '-')}
                                                                                                    </td>
                                                                                                    <td className="px-4 py-2 text-right text-xs font-medium text-teal-700">
                                                                                                        <div
                                                                                                            className="cursor-pointer hover:bg-teal-50 rounded px-1 py-0.5 transition-colors group/pcp inline-block"
                                                                                                            onClick={(e) => { e.stopPropagation(); setPcpForecastTarget(item); }}
                                                                                                            title="Clique para definir Qtd. PCP"
                                                                                                        >
                                                                                                            <span className="group-hover/pcp:text-teal-900">
                                                                                                                {item.pcp_delivery_forecast_qtd ? parseFloat(item.pcp_delivery_forecast_qtd).toLocaleString('pt-BR') : 'Definir...'}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                    </td>
                                                                                                    <td className="px-4 py-2 text-center text-xs">
                                                                                                        <div
                                                                                                            className="cursor-pointer hover:bg-teal-50 rounded px-1 py-0.5 transition-colors group/pcp inline-block"
                                                                                                            onClick={(e) => { e.stopPropagation(); setPcpForecastTarget(item); }}
                                                                                                            title="Clique para definir Data PCP"
                                                                                                        >
                                                                                                            {item.pcp_delivery_forecast_date ? (
                                                                                                                <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-semibold group-hover/pcp:border-teal-400">
                                                                                                                    {new Date(item.pcp_delivery_forecast_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                                                                                                </span>
                                                                                                            ) : <span className="text-gray-400 group-hover/pcp:text-teal-600">Definir...</span>}
                                                                                                        </div>
                                                                                                    </td>
                                                                                                    <td className="px-4 py-2 text-center text-xs">
                                                                                                        <BillingForecastInput
                                                                                                            item={item}
                                                                                                            user={user}
                                                                                                            onUpdateSuccess={handleUpdateFaturamentoDate}
                                                                                                        />
                                                                                                    </td>
                                                                                                    <td className="px-4 py-2 text-center text-xs min-w-[100px]">
                                                                                                        {(() => {
                                                                                                            const hasOP = !!item.op_num || !!item.op_protheus;
                                                                                                            const opQtd = parseFloat(item.op_qtd || 0);
                                                                                                            const saldoProd = parseFloat(item.saldo_produzido || 0);
                                                                                                            if (!hasOP) return <span className="text-gray-400">-</span>;
                                                                                                            if (opQtd <= 0) return <span className="text-gray-500">0%</span>;
                                                                                                            const pct = Math.min(100, Math.max(0, (saldoProd / opQtd) * 100));
                                                                                                            return (
                                                                                                                <div className="flex flex-col items-center justify-center gap-1 min-w-[60px]">
                                                                                                                    <span className={`font-bold ${pct >= 100 ? 'text-green-600' : pct > 0 ? 'text-blue-600' : 'text-gray-500'}`}>{pct.toFixed(0)}%</span>
                                                                                                                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                                                                                                        <div className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-blue-500' : 'bg-gray-400'}`} style={{ width: `${pct}%` }}></div>
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                            );
                                                                                                        })()}
                                                                                                    </td>
                                                                                                </tr>
                                                                                            ))
                                                                                    ) : (
                                                                                        <tr><td colSpan="18" className="px-4 py-4 text-center text-gray-400">Nenhum item encontrado.</td></tr>
                                                                                    )}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            ))
                                        ) : (
                                            // FLAT VIEW -- virtualized: only visible rows in DOM
                                            <VirtualFlatList
                                                orders={sortedOrders}
                                                scrollContainerRef={tableScrollRef}
                                                canEdit={canEdit}
                                                hasNextPage={hasNextPage}
                                                onLoadMore={handleLoadMore}
                                                loadingMore={loadingMore}
                                                colConfig={colConfig}
                                                locationPathname={location.pathname}
                                                selectedItems={selectedItems}
                                                activeRowKey={activeRowKey}
                                                setActiveRowKey={setActiveRowKey}
                                                printingOrderId={printingOrderId}
                                                openActionMenu={openActionMenu}
                                                menuPosition={menuPosition}
                                                handleSelectItem={handleSelectItem}
                                                handleOpenDocs={handleOpenDocs}
                                                setEngineeringTarget={setEngineeringTarget}
                                                setPcpForecastTarget={setPcpForecastTarget}
                                                setNotesTarget={setNotesTarget}
                                                setPriorityTarget={openPriorityModal}
                                                setSelectedInvoice={setSelectedInvoice}
                                                setInvoiceModalItem={setInvoiceModalItem}
                                                setOpenActionMenu={setOpenActionMenu}
                                                formatProtheusDate={formatProtheusDate}
                                                handlePrintOPMirror={handlePrintOPMirror}
                                                handlePrintFichas={handlePrintFichas}
                                                handlePrintOPByOperation={handlePrintOPByOperation}
                                                handlePrintOPByOperationWithDrawings={handlePrintOPByOperationWithDrawings}
                                                handlePrintOPByResourceWithDrawings={handlePrintOPByResourceWithDrawings}
                                                                handlePrintOPWithOpsStampWithDrawings={handlePrintOPWithOpsStampWithDrawings}
                                                handlePrintOPWithOpsStampDrawingsByResource={handlePrintOPWithOpsStampDrawingsByResource}
                                                handlePrintOPWithOpsStampWithDescDrawings={handlePrintOPWithOpsStampWithDescDrawings}
                                                handlePrintOPWithOpsStampWithDescDrawingsByResource={handlePrintOPWithOpsStampWithDescDrawingsByResource}
                                                handleExportOPByOperationExcel={handleExportOPByOperationExcel}
                                                setMenuPosition={setMenuPosition}
                                                handleUpdateFaturamentoDate={handleUpdateFaturamentoDate}
                                                onOpenClassificacaoModal={handleOpenClassificacaoModal}
                                                onOpenBomStructure={(op, itemPv, pedido, produto) => setBomStructureTarget({ op, itemPv, pedido, produto })}
                                                onOpenStructureStock={setStructureStockTarget}
                                            />
                                        )}
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer / Paginação */}
                    {loading && page > 1 && (
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-center print:hidden">
                            <div className="flex items-center gap-2 text-gray-500">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span className="text-sm font-medium">Carregando mais itens...</span>
                            </div>
                        </div>
                    )}

                    {!loading && !error && orders.length > 0 && (
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-center gap-2 print:hidden">
                            {viewMode === 'flat' && (loadingMore || hasNextPage) ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-500 flex-shrink-0" />
                                    <span className="text-sm text-blue-600 font-medium">
                                        Carregando dadosâ€¦ {orders.length} registros carregados até agora (lote {page})
                                    </span>
                                </>
                            ) : (
                                <span className="text-sm text-gray-400">
                                    Todos os {orders.length} registros foram carregados.
                                </span>
                            )}
                        </div>
                    )}
                </>
            )
            }



            {/* Exportação Materiais PCP */}
            {
                activeTab === 'pcp-export' && (
                    <div className="flex-1 overflow-hidden min-h-0 p-4 flex flex-col">
                        <PCPExportTab />
                    </div>
                )
            }

            {/* Cronograma / Gantt */}
            {
                activeTab === 'cronograma' && (
                    <OrdersTimelineTab filters={filters} />
                )
            }

            {/* MRP Bulk - Necessidades */}
            {
                activeTab === 'mrp-bulk' && (
                    <div className="flex-1 overflow-hidden min-h-0 bg-gray-50 flex flex-col">
                        <MaterialRequirementsTab setPageBlocking={setPageBlocking} />
                    </div>
                )
            }

            {/* Programação de Entregas Tab */}
            {
                activeTab === 'programacao-entregas' && (
                    <div className="flex-1 overflow-hidden min-h-0 p-4 flex flex-col">
                        <DeliveryScheduleTab />
                    </div>
                )
            }

            {/* Planilha Mestra Tab */}
            {
                activeTab === 'planilha-mestra' && (
                    <div className="flex-1 overflow-hidden min-h-0 p-4 flex flex-col">
                        <MasterSheetTab filterParams={filters} />
                    </div>
                )
            }

            {/* Modal de Documentos */}
            <DocsModal
                isOpen={isDocsModalOpen}
                onClose={() => setIsDocsModalOpen(false)}
                productCode={selectedProductForDocs.code}
                productName={selectedProductForDocs.name}
                canEdit={canEdit}
            />

            {/* Modal de Imagem */}
            {showImageModal && (
                <ProductImageModal
                    product={selectedProductForImage}
                    onClose={() => setShowImageModal(false)}
                    onSuccess={() => setShowImageModal(false)}
                />
            )}

            {/* Modal de Classificacao */}
            <ClassificacaoModal
                isOpen={isClassificacaoModalOpen}
                onClose={() => setIsClassificacaoModalOpen(false)}
                item={classificacaoModalItem}
                onSaveSuccess={handleClassificacaoModalSaveSuccess}
                canEdit={canEdit}
            />

            {/* Modal de Detalhes da NF */}
            <InvoiceDetailsModal
                isOpen={!!selectedInvoice}
                onClose={() => {
                    setSelectedInvoice(null);
                    setInvoiceModalItem(null);
                }}
                invoice={selectedInvoice}
                item={invoiceModalItem}
            />

            {/* Modal de Anotações (Ata Viva Drawer) */}
            <NotesDrawer
                isOpen={!!notesTarget}
                onClose={() => setNotesTarget(null)}
                target={notesTarget}
                currentUser={user?.nome || 'Usuário'}
                canEdit={canEdit}
            />

            {/* Modal de Relatório da Reunião */}
            <MeetingReportModal
                isOpen={showReportModal}
                onClose={() => { setShowReportModal(false); setReportSelectedItems(null); }}
                items={isGlobalReport ? orders : reportSelectedItems}
                isGlobal={isGlobalReport}
                canEdit={canEdit}
            />
            {/* Modal de Engenharia (Novo) */}
            {
                engineeringTarget && (
                    <div onClick={e => e.stopPropagation()}>
                        <EngineeringControlModal
                            isOpen={!!engineeringTarget}
                            onClose={() => setEngineeringTarget(null)}
                            target={engineeringTarget}
                            onSave={handleSaveEngineeringControl}
                            canEdit={canEdit}
                        />
                    </div>
                )
            }
            {
                corteForecastTarget && (
                    <CorteForecastModal
                        isOpen={true}
                        items={corteForecastTarget}
                        onClose={() => setCorteForecastTarget(null)}
                        onSaveSuccess={() => {
                            setCorteForecastTarget(null);
                            setSelectedItems([]);
                        }}
                        usuario={user?.nome}
                        canEdit={canEdit}
                    />
                )
            }
            {
                bomStructureTarget && (
                    <BOMStructureModal
                        opNum={bomStructureTarget.op}
                        itemPv={bomStructureTarget.itemPv}
                        pedido={bomStructureTarget.pedido}
                        produto={bomStructureTarget.produto}
                        onClose={() => setBomStructureTarget(null)}
                    />
                )
            }
            {
                structureStockTarget && (
                    <ProductStructureStockModal
                        productCode={structureStockTarget.productCode}
                        productDesc={structureStockTarget.productDesc}
                        orderNum={structureStockTarget.orderNum}
                        orderItem={structureStockTarget.orderItem}
                        orderQty={structureStockTarget.orderQty}
                        clientName={structureStockTarget.clientName}
                        onClose={() => setStructureStockTarget(null)}
                    />
                )
            }
            {
                pcpBalanceTarget && (
                    <PCPBalanceModal
                        isOpen={true}
                        onClose={() => setPcpBalanceTarget(null)}
                        selectedItems={pcpBalanceTarget}
                        onSaveSuccess={() => {
                            fetchData();
                        }}
                        usuario={user?.nome}
                        canEdit={canEdit}
                    />
                )
            }
            {
                showSmartPlanModal && (
                    <div onClick={e => e.stopPropagation()}>
                        <PlanejamentoInteligenteModal
                            isOpen={showSmartPlanModal}
                            onClose={() => setShowSmartPlanModal(false)}
                            selectedPedidos={smartPlanTarget}
                            onPlanSuccess={() => {
                                fetchData(); // atualiza dados mas NÃO fecha o modal — usuário precisa imprimir o relatório
                            }}
                        />
                    </div>
                )
            }
            {
                pcpForecastTarget && (
                    <div onClick={e => e.stopPropagation()}>
                        <PCPForecastModal
                            isOpen={true}
                            onClose={() => {
                                setPcpForecastTarget(null);
                            }}
                            canEdit={canEdit}
                        item={pcpForecastTarget}
                        onSaveSuccess={(newProgs) => {
                            const target = pcpForecastTarget;
                            if (!target) return;
                            if (Array.isArray(target) || !newProgs) {
                                fetchData();
                            } else {
                                let pcpDate = null;
                                let pcpQtd = 0;
                                if (newProgs && newProgs.length > 0) {
                                    pcpQtd = newProgs.reduce((sum, p) => sum + parseFloat(p.quantidade_pcp || 0), 0);
                                    const validProgs = newProgs.filter(p => p.data_entrega_pcp);
                                    if (validProgs.length > 0) {
                                        const sorted = [...validProgs].sort((a, b) => new Date(a.data_entrega_pcp) - new Date(b.data_entrega_pcp));
                                        pcpDate = sorted[0].data_entrega_pcp.split('T')[0];
                                    }
                                }
                                
                                const newData = {
                                    pcp_delivery_forecast_date: pcpDate,
                                    pcp_delivery_forecast_qtd: pcpQtd
                                };
                                
                                if (orderItems[target.pedido]) {
                                    const newItems = orderItems[target.pedido].map(i =>
                                        i.item === target.item ? { ...i, ...newData } : i
                                    );
                                    updateOrderItemsForPedido(target.pedido, newItems);
                                }
                                
                                if (viewMode === 'flat') {
                                    setOrders(prev => prev.map(o => {
                                        if (o.pedido === target.pedido && o.item === target.item) {
                                            return { ...o, ...newData };
                                        }
                                        return o;
                                    }));
                                }
                            }
                        }}
                    />
                    </div>
                )
            }

            {/* PCPMetal AI Drawer */}
            <PCPMetalDrawer
                isOpen={pcpmetalOpen}
                onClose={() => setPcpmetalOpen(false)}
                context={pcpmetalContext}
                pageData={{ ops: orders, total: orders?.length || 0 }}
            />
            
            {showColSettings && (
                <ColumnSettingsPanel
                    columns={colConfig}
                    allColumns={ALL_FLAT_COLUMNS}
                    prefKey={PREF_KEY}
                    onChange={setColConfig}
                    onClose={() => setShowColSettings(false)}
                />
            )}

            {priorityTarget && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-gray-200 bg-red-50 flex items-center gap-3">
                            <div className="p-2 bg-red-100 rounded-lg text-red-600">
                                {priorityMode === 'op' ? <Factory className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 leading-tight">
                                    {priorityMode === 'op' ? 'Prioridade de OP' : 'Prioridade de Faturamento'}
                                </h2>
                                <p className="text-xs text-slate-500">
                                    {priorityMode === 'op'
                                        ? 'Reordena a produção da OP inteira (afeta todos os itens da mesma OP).'
                                        : 'Notificará todos via Hermes Live Feed — não altera a fila de produção da OP.'}
                                </p>
                            </div>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                {Array.isArray(priorityTarget) ? (
                                    <div className="bg-slate-50 p-2 border border-slate-100 rounded col-span-2 flex flex-col py-2 max-h-40 overflow-y-auto">
                                        <span className="text-slate-400 block text-xs font-medium uppercase tracking-wider mb-2">Itens Selecionados ({priorityTarget.length})</span>
                                        <div className="space-y-1">
                                            {priorityTarget.map((t, idx) => (
                                                <div key={idx} className="bg-white p-1.5 border border-slate-200 rounded flex justify-between text-xs items-center">
                                                    <span className="font-semibold text-slate-700">{t.pedido} - {t.item}</span>
                                                    <span className="text-slate-500 text-right">{t.op_num_completa || t.op_num || '-'} ({t.codigo})</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="bg-slate-50 p-2 border border-slate-100 rounded">
                                            <span className="text-slate-400 block text-xs">Pedido / Item</span>
                                            <span className="font-semibold text-slate-700">{priorityTarget.pedido} - {priorityTarget.item}</span>
                                        </div>
                                        <div className="bg-slate-50 p-2 border border-slate-100 rounded">
                                            <span className="text-slate-400 block text-xs">OP / Produto</span>
                                            <span className="font-semibold text-slate-700">{priorityTarget.op_num_completa || priorityTarget.op_num || '-'} <span className="font-normal text-xs ml-1">({priorityTarget.codigo})</span></span>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className={priorityMode === 'op' ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-2 gap-4'}>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Grupo de Prioridade
                                    </label>
                                    <select
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm font-medium bg-white"
                                        value={priorityGroup}
                                        onChange={(e) => setPriorityGroup(parseInt(e.target.value))}
                                    >
                                        <option value={1}>Grupo 1 (Máxima)</option>
                                        <option value={2}>Grupo 2 (Alta)</option>
                                        <option value={3}>Grupo 3 (Média)</option>
                                        <option value={4}>Grupo 4 (Normal)</option>
                                        <option value={0}>0 (Remover Prioridade)</option>
                                    </select>
                                </div>
                                {priorityMode !== 'op' && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Motivo ou Observação Livre
                                        </label>
                                        <textarea
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm resize-none"
                                            rows="3"
                                            placeholder="Ex: Peça para montagem imediata, liberar corte..."
                                            value={priorityText}
                                            onChange={(e) => setPriorityText(e.target.value)}
                                        ></textarea>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                            <button
                                onClick={() => { setPriorityTarget(null); setPriorityText(''); setPriorityGroup(1); }}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                                disabled={prioritySubmitting}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handlePrioritySubmit}
                                disabled={prioritySubmitting}
                                className="px-5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                            >
                                {prioritySubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                {priorityMode === 'op' ? 'Aplicar Prioridade de OP' : 'Emitir Prioridade de Faturamento'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Retry Toast â€” shown during exponential backoff on 500 errors */}
            <RetryToast retryInfo={retryInfo} />
        
            {/* Bulk Printing Progress */}
            {isBulkPrinting && bulkPrintProgress.total > 0 && (
                <div className="fixed bottom-6 right-6 bg-emerald-600 text-white px-6 py-4 rounded-xl shadow-2xl z-50 flex items-center space-x-4 animate-bounce">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <div>
                        <div className="font-semibold text-lg">Gerando arquivo {bulkPrintProgress.current} de {bulkPrintProgress.total}...</div>
                        <div className="text-emerald-100 text-sm">{bulkPrintProgress.label}</div>
                    </div>
                </div>
            )}

                     </div>
    );
};

export default OrdersTable;