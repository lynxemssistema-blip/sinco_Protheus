import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Filter, Calendar, AlertCircle, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Package, Layers, FileText, StickyNote, List, AlignJustify, Image as ImageIcon, FileSpreadsheet, TrendingUp, Loader2, Bot, Settings, Printer, Factory, ClipboardList, MoreVertical, Scissors } from 'lucide-react';
import CorteForecastModal from './CorteForecastModal';
import { getPedidos, getItensPedido, getPedidoPdfData, getReportDownloadUrl, getPedidosFlat, getProdutos, getSalesPlanningReportData, getSalesNotes, api, getFileUrl } from '../services/api';
import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import autoTable from 'jspdf-autotable';

import PCPExportTab from './orders/PCPExportTab';
import OrdersTimelineTab from './orders/OrdersTimelineTab';
import MaterialRequirementsTab from './orders/MaterialRequirementsTab';
import DocsModal from './DocsModal';
import NotesDrawer from './NotesDrawer';
import MeetingReportModal from './MeetingReportModal';
import ProductImageModal from './ProductImageModal';
import EngineeringControlModal from './EngineeringControlModal';
import PCPForecastModal from './PCPForecastModal';
import PCPMetalDrawer from './PCPMetalDrawer';
import InvoiceDetailsModal from './InvoiceDetailsModal';
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

const OrdersTable = () => {

    const location = useLocation();

    const formatProtheusDate = (value) => {
        const raw = String(value ?? '').trim();
        if (!raw) return '-';
        if (/^\d{8}$/.test(raw)) return raw.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1');
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1');
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

    // Image Modal State
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedProductForImage, setSelectedProductForImage] = useState(null);

    // Notes Drawer State (Ata Viva)
    const [notesTarget, setNotesTarget] = useState(null);
    const [engineeringTarget, setEngineeringTarget] = useState(null);
    const [showReportModal, setShowReportModal] = useState(false);
    const [isGlobalReport, setIsGlobalReport] = useState(false);
    const { user } = useAuth();
    const [pcpForecastTarget, setPcpForecastTarget] = useState(null);
    const [corteForecastTarget, setCorteForecastTarget] = useState(null);
    const [downloadingPDF, setDownloadingPDF] = useState(false);
    const [printingOrderId, setPrintingOrderId] = useState(null);

    // Global page-blocking state: prevents simultaneous heavy DB queries
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
        produto: orderFilters.produto,
        pedcli: orderFilters.pedcli || '',
        dataInicial: orderFilters.dataInicial,
        dataFinal: orderFilters.dataFinal,
        dateType: orderFilters.dateType,
        tipo_item: orderFilters.tipo_item || '',
        op_status: orderFilters.op_status || '',
        only_active: orderFilters.only_active,
        sortBy: orderFilters.sortBy,
        sortOrder: orderFilters.sortOrder
    }), [
        orderFilters.cliente, orderFilters.pedido, orderFilters.produto, orderFilters.pedcli,
        orderFilters.dataInicial, orderFilters.dataFinal, orderFilters.dateType,
        orderFilters.tipo_item, orderFilters.op_status, orderFilters.only_active,
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
    const setPage = (val) => updateOrderFilters({ page: val });

    const limit = viewMode === 'flat' ? 50 : 20;
    const colSpanCount = viewMode === 'flat' ? 24 : 7;

    const {
        orders,
        setOrders,
        loading,
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
    } = useOrders({ limit, viewMode, filters, page });

    const handleExpandRow = useCallback((pedidoId) => {
        hookHandleExpandRow(pedidoId, expandedRow, setExpandedRow);
    }, [hookHandleExpandRow, expandedRow, setExpandedRow]);

    // Selection State (Flat View)
    const [selectedItems, setSelectedItems] = useState([]);

    const handleSelectAll = (e) => {
        if (e.target.checked) setSelectedItems([...orders]);
        else setSelectedItems([]);
    };

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
        return !!(filters.cliente || filters.pedido || filters.produto || filters.pedcli || filters.dataInicial || filters.dataFinal || filters.tipo_item || filters.op_status);
    };

    // Fetch on page/viewMode/active/sort filter change
    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, viewMode, filters.only_active, filters.sortBy, filters.sortOrder]);

    const handleFilterChange = useCallback((e) => {
        const { name, value } = e.target;
        
        // Se mudou a ordenação, volta para a página 1
        if (name === 'sortBy' || name === 'sortOrder') {
            setPage(1);
        }

        setFilters(prev => ({ ...prev, [name]: value }));
    }, [setFilters, setPage]);

    const handleSearch = (e) => {
        e.preventDefault();
        // Set context page to 1
        setPage(1);
        // Execute fetch immediately with page 1 override to avoid closure lag
        fetchData({ page: 1 });
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

    const handleDownloadPDF = async () => {
        setDownloadingPDF(true);
        try {
            const reportFilters = {
                client: filters.cliente,
                order: filters.pedido,
                product: filters.produto,
                emission_start: filters.dataInicial,
                emission_end: filters.dataFinal,
                active_only: filters.only_active
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
            const dateStr = new Date().toLocaleString();
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
                    { content: order.proxima_entrega ? new Date(order.proxima_entrega.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')).toLocaleDateString() : '-', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
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

    const handlePrintOPMirror = async (pedido, e, itemId = null) => {
        if (e) e.stopPropagation();
        // Guard: never call op-mirror with an empty pedido (would produce 500 or /op-mirror/?...)
        if (!pedido || String(pedido).trim() === '') {
            console.warn('[handlePrintOPMirror] pedido inválido — chamada cancelada.');
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

    const handlePrintOPByOperationWithDrawings = async (pedido, e, itemId = null) => {
        if (e) e.stopPropagation();
        const loadKey = itemId ? `op-drawings-${pedido}-${itemId}` : `op-drawings-${pedido}`;
        setPrintingOrderId(loadKey);
        try {
            const endpoint = itemId
                ? `/pedidos/op-mirror/${pedido}?item=${itemId}`
                : `/pedidos/op-mirror/${pedido}`;

            const response = await api.get(endpoint);
            const mirrorData = response.data;

            const userName = user?.nome || 'Usuário';
            const { generateOPByOperationWithDrawingsPdf } = await import('../services/opByOperationWithDrawingsPdfGenerator');
            await generateOPByOperationWithDrawingsPdf(mirrorData, userName);

        } catch (error) {
            const msg = error.response?.data?.error || error.message;
            console.error('Error generating OP by Operation PDF with Drawings:', error);
            alert(`Erro ao gerar Espelho com Desenhos: ${msg}`);
        } finally {
            setPrintingOrderId(null);
        }
    };

    const handlePrintOPByResourceWithDrawings = async (pedido, e, itemId = null) => {
        if (e) e.stopPropagation();
        const loadKey = itemId ? `op-resource-drawings-${pedido}-${itemId}` : `op-resource-drawings-${pedido}`;
        setPrintingOrderId(loadKey);
        try {
            const endpoint = itemId
                ? `/pedidos/op-mirror/${pedido}?item=${itemId}`
                : `/pedidos/op-mirror/${pedido}`;

            const response = await api.get(endpoint);
            const mirrorData = response.data;

            const userName = user?.nome || 'Usuário';
            const { generateOPDrawingsByResourcePdf } = await import('../services/opDrawingsByResourceGenerator');
            await generateOPDrawingsByResourcePdf(mirrorData, userName, null);

        } catch (error) {
            const msg = error.response?.data?.error || error.message;
            console.error('Error generating OP by Resource PDF with Drawings:', error);
            alert(`Erro ao gerar Espelho por Recurso com Desenhos: ${msg}`);
        } finally {
            setPrintingOrderId(null);
        }
    };

    const handlePrintOPWithOpsStampWithDrawings = async (pedido, e, itemId = null) => {
        if (e) e.stopPropagation();
        const loadKey = itemId ? `op-stamp-drawings-${pedido}-${itemId}` : `op-stamp-drawings-${pedido}`;
        setPrintingOrderId(loadKey);
        try {
            const endpoint = itemId
                ? `/pedidos/op-mirror/${pedido}?item=${itemId}`
                : `/pedidos/op-mirror/${pedido}`;

            const response = await api.get(endpoint);
            const mirrorData = response.data;

            const userName = user?.nome || 'Usuário';
            const { generateOPDrawingsWithOpsStampPdf } = await import('../services/opDrawingsWithOpsStampGenerator');
            await generateOPDrawingsWithOpsStampPdf(mirrorData, userName, null);

        } catch (error) {
            const msg = error.response?.data?.error || error.message;
            console.error('Error generating OP PDF with Ops Stamp Drawings:', error);
            alert(`Erro ao gerar Espelho com Roteiro no Carimbo: ${msg}`);
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

    const handleDownloadExcel = () => {
        const reportFilters = {
            client: filters.cliente,
            order: filters.pedido,
            product: filters.produto,
            emission_start: filters.dataInicial,
            emission_end: filters.dataFinal,
            active_only: filters.only_active
        };
        const url = getReportDownloadUrl('xlsx', reportFilters, 'sales-planning');
        window.open(url, '_blank');
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
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollHeight - scrollTop <= clientHeight * 1.5 && !loading && page < totalPages) {
            setPage(page + 1);
        }
    }, [loading, page, totalPages]);

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
                            ⚠️ Página bloqueada para evitar consultas simultâneas. Aguarde.
                        </div>
                    </div>
                </div>
            )}
            {/* Header & Filtros */}
            <div className="border-b border-gray-100 bg-white print:hidden">
                {/* ── Top loading progress bar ── */}
                <div className={`h-0.5 w-full overflow-hidden transition-opacity duration-300 ${loading ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="h-full" style={{ width: '100%', backgroundImage: 'linear-gradient(90deg, transparent 0%, #3b82f6 30%, #60a5fa 50%, #3b82f6 70%, transparent 100%)', backgroundSize: '200% 100%', animation: 'shimmerBar 1.4s linear infinite' }} />
                </div>
                <div className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Pedidos de Venda</h2>
                        <p className="text-sm text-gray-500">Gerencie e visualize os pedidos do Protheus</p>
                        {filters.only_active === 'true' && (
                            <div className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-md px-2 py-1 inline-flex items-center gap-1.5">
                                <AlertCircle className="h-3 w-3" />
                                <span>Visualizando apenas pedidos <strong>Ativos</strong> (não entregues) e <strong>Vendas</strong> (exclui orçamentos).</span>
                            </div>
                        )}
                    </div>

                    {/* View Mode Toggle */}
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

                {/* ── Status bar while fetching ── */}
                {loading && (
                    <div className="mb-3 flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                        <span>Buscando dados no servidor… Aguarde.</span>
                        <span className="ml-auto text-xs text-blue-400 italic">Isso pode levar alguns segundos dependendo dos filtros.</span>
                    </div>
                )}
                <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-10 gap-y-4 gap-x-3 items-end">
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
                            </select>
                        </div>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                            <input
                                type="date"
                                name="dataInicial"
                                value={filters.dataInicial}
                                onChange={handleFilterChange}
                                aria-label={`Data inicial (${filters.dateType === 'pedido' ? 'Emissão Pedido' : filters.dateType === 'entrega' ? 'Data de Entrega' : 'Emissão NF'})`}
                                className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                                title={`Data inicial (${filters.dateType === 'pedido' ? 'Emissão Pedido' : filters.dateType === 'entrega' ? 'Data de Entrega' : 'Emissão NF'})`}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-[11px] font-medium text-gray-600">Fim:</label>
                            <span className="text-[11px] font-bold text-blue-600">
                                {filters.dateType === 'pedido' ? 'Emissão Pedido' : filters.dateType === 'entrega' ? 'Data de Entrega' : 'Emissão NF'}
                            </span>
                        </div>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                            <input
                                type="date"
                                name="dataFinal"
                                value={filters.dataFinal}
                                onChange={handleFilterChange}
                                aria-label={`Data final (${filters.dateType === 'pedido' ? 'Emissão Pedido' : filters.dateType === 'entrega' ? 'Data de Entrega' : 'Emissão NF'})`}
                                className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                                title={`Data final (${filters.dateType === 'pedido' ? 'Emissão Pedido' : filters.dateType === 'entrega' ? 'Data de Entrega' : 'Emissão NF'})`}
                            />
                        </div>
                        {filters.dateType === 'entrega' && (
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
                    <div className="flex flex-col gap-1 md:col-span-2">
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

                    <div className="md:col-span-2 lg:col-span-2 flex gap-2">
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
                    </div>

                    <div className="md:col-span-10 lg:col-span-10 flex flex-col md:flex-row gap-4 mt-2 bg-gray-50 p-2 rounded-lg border border-gray-100 items-start md:items-center">
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
                                <span className="text-[10px] text-gray-400 italic flex items-center gap-1 hidden md:flex">
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
                        📦 Necessidades MP (Almox 01/03)
                    </button>
                </div>
                
                {/* Lote Actions */}
                {selectedItems.length > 0 && viewMode === 'flat' && (
                    <div className="px-4 flex items-center gap-2">
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
                    </div>
                )}
            </div>

            {/* Evolução Content */}
            {activeTab === 'evolucao' && (
                <>
                    {/* Tabela */}
                    <div className="flex-1 overflow-auto min-h-0 print:overflow-visible print:min-h-0" onScroll={handleScroll}>
                        <table className="w-full text-sm text-left text-gray-500 print:w-full">
                            <thead className="sticky top-0 z-10 text-xs text-gray-700 uppercase bg-gray-50 outline outline-1 outline-gray-200">
                                {viewMode === 'tree' ? (
                                    <tr>
                                        <th scope="col" className="w-12 px-4 py-3"></th>
                                        <th scope="col" className="px-4 py-3 font-semibold w-24">Nº Pedido</th>
                                        <th scope="col" className="px-4 py-3 font-semibold w-32">Emissão</th>
                                        <th scope="col" className="px-4 py-3 font-semibold w-32">Entrega Prev.</th>
                                        <th scope="col" className="px-4 py-3 font-semibold">Cliente</th>
                                        <th scope="col" className="px-4 py-3 font-semibold text-center w-24">Status</th>
                                        <th scope="col" className="px-4 py-3 font-semibold text-center w-32">Obs</th>
                                    </tr>
                                ) : (
                                    <tr>
                                        <th className="px-2 py-3 border-b border-slate-700 text-center sticky left-0 z-20 bg-gray-50 min-w-[40px] max-w-[40px] w-[40px]">
                                            <input 
                                                type="checkbox" 
                                                checked={orders.length > 0 && selectedItems.length === orders.length}
                                                onChange={handleSelectAll}
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                            />
                                        </th>
                                        <th className="px-3 py-3 font-semibold sticky left-[40px] z-20 bg-gray-50 min-w-[90px] max-w-[90px] w-[90px]">Pedido</th>
                                        <th className="px-3 py-3 font-semibold text-center sticky left-[130px] z-20 bg-gray-50 min-w-[90px] max-w-[90px] w-[90px]">Emissão</th>
                                        <th className="px-3 py-3 font-semibold sticky left-[220px] z-20 bg-gray-50 min-w-[100px] max-w-[100px] w-[100px] truncate">Ref. Cliente</th>
                                        <th className="px-3 py-3 font-semibold sticky left-[320px] z-20 bg-gray-50 min-w-[150px] max-w-[150px] w-[150px] truncate">Cliente</th>
                                        <th className="px-3 py-3 font-semibold sticky left-[470px] z-20 bg-gray-50 min-w-[90px] max-w-[90px] w-[90px] truncate">PC</th>
                                        <th className="px-2 py-3 font-semibold text-center sticky left-[560px] z-20 bg-gray-50 min-w-[40px] max-w-[40px] w-[40px]">It</th>
                                        <th className="px-3 py-3 font-semibold text-center sticky left-[600px] z-20 bg-gray-50 min-w-[80px] max-w-[80px] w-[80px]">OP</th>
                                        <th className="px-3 py-3 font-semibold sticky left-[680px] z-20 bg-gray-50 min-w-[140px] max-w-[140px] w-[140px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Cód. Prod</th>
                                        <th className="px-4 py-3 font-semibold">C6_XREVM</th>
                                        <th className="px-4 py-3 font-semibold">Rev. Cliente</th>
                                        <th className="px-4 py-3 font-semibold text-center w-8 print:hidden text-[10px]">Ações</th>
                                        <th className="px-4 py-3 font-semibold text-center w-16">Tipo</th>
                                        <th className="px-4 py-3 font-semibold">Descrição</th>
                                        <th className="px-4 py-3 font-semibold text-center">Status</th>
                                        <th className="px-4 py-3 font-semibold text-right">Entreg.</th>
                                        <th className="px-4 py-3 font-semibold text-right">Saldo Fat.</th>
                                        <th className="px-4 py-3 font-semibold text-right">Qtd.</th>
                                        <th className="px-4 py-3 font-semibold text-center">Lib. Eng.</th>
                                        <th className="px-4 py-3 font-semibold text-center">Entrega</th>
                                        <th className="px-4 py-3 font-semibold text-right text-xs">Qtd. PCP</th>
                                        <th className="px-4 py-3 font-semibold text-center text-xs">Data PCP</th>
                                        <th className="px-4 py-3 font-semibold text-center text-xs text-teal-800">Prev. Fat.</th>
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
                                            orders.map((order, idx) => (
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
                                                                                onClick={(e) => { handleExportOPByOperationExcel(order.pedido, e); setOpenActionMenu(null); }}
                                                                                disabled={printingOrderId === `op-excel-${order.pedido}`}
                                                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors disabled:opacity-40"
                                                                            >
                                                                                {printingOrderId === `op-excel-${order.pedido}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <FileSpreadsheet className="h-4 w-4 flex-shrink-0 text-emerald-600" />}
                                                                                <span>Por Operações (Excel)</span>
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
                                                                                        <th className="px-4 py-2">Item</th>
                                                                                        <th className="px-4 py-2 text-center">OP</th>
                                                                                        <th className="px-4 py-2">Cód. Produto</th>
                                                                                        <th className="px-4 py-2">C6_XREVM</th>
                                                                                        <th className="px-4 py-2">Cód. Prod. Cliente</th>
                                                                                        <th className="px-4 py-2">Rev. Cliente</th>
                                                                                        <th className="px-4 py-2 text-center">Ações</th>
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
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {Array.isArray(orderItems[order.pedido]) && orderItems[order.pedido].length > 0 ? (
                                                                                        orderItems[order.pedido]
                                                                                            .filter(item => filters.only_active === 'false' || parseFloat(item.qtd_faturar || 0) > 0)
                                                                                            .map((item, i) => (
                                                                                                <tr key={`${order.pedido}-${item.item}-${i}`} className={`border-b border-gray-50 last:border-0 transition-colors ${parseFloat(item.qtd_faturar || 0) <= 0 ? 'bg-green-50/40 hover:bg-green-100/50 opacity-80' : 'hover:bg-gray-50/50'}`}>
                                                                                                    <td className="px-4 py-2">{item.item}</td>
                                                                                                    <td className="px-4 py-2 text-center">
                                                                                                        <div className="flex items-center justify-center gap-1.5">
                                                                                                            <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${String(item.op_tipo || '').trim().toUpperCase() === 'F' ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200' : 'bg-blue-50 text-blue-700 font-medium'}`}>
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
                                                                                                            to={`/estrutura/${encodeURIComponent(item.codigo)}`}
                                                                                                            state={{ from: location.pathname, pedido: item.pedido, item: item.item }}
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
                                                                                                                            onClick={(e) => { e.stopPropagation(); setEngineeringTarget({ orderId: order.pedido, item }); setOpenActionMenu(null); }}
                                                                                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                                                                                                                        >
                                                                                                                            <Settings className="h-4 w-4 flex-shrink-0 text-blue-500" />
                                                                                                                            <span>Controle Engenharia</span>
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
                                                                                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-pink-50 hover:text-pink-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                                                                                        >
                                                                                                                            {printingOrderId === `op-stamp-drawings-${order.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ImageIcon className="h-4 w-4 flex-shrink-0 text-pink-500" />}
                                                                                                                            <span>OP + Desenhos (Roteiro no Carimbo)</span>
                                                                                                                        </button>
                                                                                                                        <button
                                                                                                                            onClick={(e) => { handleExportOPByOperationExcel(order.pedido, e, item.item); setOpenActionMenu(null); }}
                                                                                                                            disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-excel-${order.pedido}-${item.item}`}
                                                                                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                                                                                        >
                                                                                                                            {printingOrderId === `op-excel-${order.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <FileSpreadsheet className="h-4 w-4 flex-shrink-0 text-emerald-600" />}
                                                                                                                            <span>Por Operações (Excel)</span>
                                                                                                                        </button>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                            </div>
                                                                                                        </div>
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
                                            // FLAT VIEW — memoized rows prevent full-table re-renders
                                            orders.map((item, idx) => (
                                                <FlatItemRow
                                                    key={`${item.pedido}-${item.item}-${idx}`}
                                                    item={item}
                                                    locationPathname={location.pathname}
                                                    isSelected={selectedItems.some(i => i.pedido === item.pedido && i.item === item.item)}
                                                    printingOrderId={printingOrderId}
                                                    openActionMenu={openActionMenu}
                                                    menuPosition={menuPosition}
                                                    onSelectItem={handleSelectItem}
                                                    onOpenDocs={handleOpenDocs}
                                                    onSetEngineeringTarget={setEngineeringTarget}
                                                    onSetPcpForecastTarget={setPcpForecastTarget}
                                                    onSetNotesTarget={setNotesTarget}
                                                    onSetInvoiceModal={({ nf, item: it }) => { setSelectedInvoice(nf); setInvoiceModalItem(it); }}
                                                    onOpenActionMenu={setOpenActionMenu}
                                                    formatProtheusDate={formatProtheusDate}
                                                    onPrintOPMirror={handlePrintOPMirror}
                                                    onPrintFichas={handlePrintFichas}
                                                    onPrintOPByOperation={handlePrintOPByOperation}
                                                    onPrintOPByOperationWithDrawings={handlePrintOPByOperationWithDrawings}
                                                    onPrintOPByResourceWithDrawings={handlePrintOPByResourceWithDrawings}
                                                    onPrintOPWithOpsStampWithDrawings={handlePrintOPWithOpsStampWithDrawings}
                                                    onExportOPByOperationExcel={handleExportOPByOperationExcel}
                                                    onSetMenuPosition={setMenuPosition}
                                                    onUpdateFaturamentoDate={handleUpdateFaturamentoDate}
                                                />
                                            ))
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

                    {!loading && !error && orders.length > 0 && page >= totalPages && (
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-center print:hidden">
                            <span className="text-sm text-gray-400">
                                Todos os {orders.length} registros foram carregados.
                            </span>
                        </div>
                    )}
                </>
            )
            }



            {/* Exportação Materiais PCP */}
            {
                activeTab === 'pcp-export' && (
                    <div className="flex-1 overflow-auto min-h-0 p-4">
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
                    <div className="flex-1 overflow-auto min-h-0 bg-gray-50">
                        <MaterialRequirementsTab setPageBlocking={setPageBlocking} />
                    </div>
                )
            }

            {/* Modal de Documentos */}
            <DocsModal
                isOpen={isDocsModalOpen}
                onClose={() => setIsDocsModalOpen(false)}
                productCode={selectedProductForDocs.code}
                productName={selectedProductForDocs.name}
            />

            {/* Modal de Imagem */}
            {
                showImageModal && (
                    <ProductImageModal
                        product={selectedProductForImage}
                        onClose={() => setShowImageModal(false)}
                        onSuccess={() => setShowImageModal(false)}
                    />
                )
            }

            {/* Modal de Detalhes da NF */}
            <InvoiceDetailsModal
                isOpen={!!selectedInvoice}
                onClose={() => setSelectedInvoice(null)}
                invoice={selectedInvoice}
                item={invoiceModalItem}
            />

            {/* Modal de Anotações (Ata Viva Drawer) */}
            <NotesDrawer
                isOpen={!!notesTarget}
                onClose={() => setNotesTarget(null)}
                target={notesTarget}
                currentUser={user?.nome || 'Usuário'}
            />

            {/* Modal de Relatório da Reunião */}
            <MeetingReportModal
                isOpen={showReportModal}
                onClose={() => setShowReportModal(false)}
                orders={orders.map(o => o.pedido)}
                filteredData={orders.map(o => ({
                    pedido: o.pedido,
                    cliente: o.nome_cliente || 'N/A',
                    proxima_entrega: o.emissao || '-'
                }))}
                globalMode={isGlobalReport}
            />
            {/* Modal de Engenharia (Novo) */}
            {
                engineeringTarget && (
                    <EngineeringControlModal
                        isOpen={!!engineeringTarget}
                        onClose={() => setEngineeringTarget(null)}
                        orderId={engineeringTarget.orderId}
                        item={engineeringTarget.item}
                        onSave={handleSaveEngineeringControl}
                    />
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
                    />
                )
            }
            {
                pcpForecastTarget && (
                    <PCPForecastModal
                        isOpen={true}
                        onClose={() => {
                            setPcpForecastTarget(null);
                        }}
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
                                    const sorted = [...newProgs].sort((a, b) => new Date(a.data_entrega_pcp) - new Date(b.data_entrega_pcp));
                                    pcpDate = sorted[0].data_entrega_pcp.split('T')[0];
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
                )
            }

            {/* PCPMetal AI Drawer */}
            <PCPMetalDrawer
                isOpen={pcpmetalOpen}
                onClose={() => setPcpmetalOpen(false)}
                context={pcpmetalContext}
            />
            {/* Retry Toast — shown during exponential backoff on 500 errors */}
            <RetryToast retryInfo={retryInfo} />
        </div>
    );
};

export default OrdersTable;
