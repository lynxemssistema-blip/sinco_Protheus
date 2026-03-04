import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Filter, Calendar, AlertCircle, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Package, Layers, FileText, StickyNote, List, AlignJustify, Image as ImageIcon, FileSpreadsheet, TrendingUp, BarChart3, Loader2, Bot, Settings } from 'lucide-react';
import { getPedidos, getItensPedido, getReportDownloadUrl, getPedidosFlat, getProdutos, getSalesPlanningReportData } from '../services/api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import PCPExportTab from './orders/PCPExportTab';
import DocsModal from './DocsModal';
import NotesDrawer from './NotesDrawer';
import MeetingReportModal from './MeetingReportModal';
import ProductImageModal from './ProductImageModal'; // Import Image Modal
import EngineeringControlModal from './EngineeringControlModal';
import ProductionComparison from './ProductionComparison';
import PCPForecastModal from './PCPForecastModal';
import PCPMetalDrawer from './PCPMetalDrawer';
import InvoiceDetailsModal from './InvoiceDetailsModal';
import { useAuth } from '../contexts/AuthContext';
import { useFilters } from '../contexts/FilterContext';

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
    const setViewMode = (val) => updateOrderFilters({ viewMode: val });

    const activeTab = orderFilters.activeTab || 'evolucao';
    const setActiveTab = (val) => updateOrderFilters({ activeTab: val });

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Tree Mode: Expanded Rows
    const expandedRow = orderFilters.expandedOrderId;
    const setExpandedRow = (val) => updateOrderFilters({ expandedOrderId: val });

    const [itemsLoading, setItemsLoading] = useState(false);
    const [orderItems, setOrderItems] = useState({});

    // Docs Modal State
    const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
    const [selectedProductForDocs, setSelectedProductForDocs] = useState({ code: '', name: '' });

    // Image Modal State
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedProductForImage, setSelectedProductForImage] = useState(null);

    // Notes Drawer State (Ata Viva)
    const [notesTarget, setNotesTarget] = useState(null); // { order, item, product }
    const [engineeringTarget, setEngineeringTarget] = useState(null); // { orderId, item object }
    const [showReportModal, setShowReportModal] = useState(false);
    const [isGlobalReport, setIsGlobalReport] = useState(false);
    const { user } = useAuth();
    const [pcpForecastTarget, setPcpForecastTarget] = useState(null);
    const [downloadingPDF, setDownloadingPDF] = useState(false);

    // PCPMetal AI Drawer State
    const [pcpmetalOpen, setPcpmetalOpen] = useState(false);
    const [pcpmetalContext, setPcpmetalContext] = useState({});

    // Invoice Modal State
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [invoiceModalItem, setInvoiceModalItem] = useState(null);

    const filters = {
        cliente: orderFilters.cliente,
        pedido: orderFilters.pedido,
        produto: orderFilters.produto,
        dataInicial: orderFilters.dataInicial,
        dataFinal: orderFilters.dataFinal,
        dateType: orderFilters.dateType,
        only_active: orderFilters.only_active
    };

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

    const [totalPages, setTotalPages] = useState(1);
    const limit = viewMode === 'flat' ? 50 : 20;
    const colSpanCount = viewMode === 'flat' ? 23 : 7;

    // Debug mount
    useEffect(() => {
        console.log('📦 [OrdersTable] Component MOUNTED');
        return () => console.log('📦 [OrdersTable] Component UNMOUNTED');
    }, []);

    const fetchData = async (overrides = {}) => {
        setLoading(true);
        setError(null);
        try {
            // Use overrides or current state/context values
            const searchFilters = {
                cliente: overrides.cliente !== undefined ? overrides.cliente : filters.cliente,
                pedido: overrides.pedido !== undefined ? overrides.pedido : filters.pedido,
                produto: overrides.produto !== undefined ? overrides.produto : filters.produto,
                dataInicial: overrides.dataInicial !== undefined ? overrides.dataInicial : filters.dataInicial,
                dataFinal: overrides.dataFinal !== undefined ? overrides.dataFinal : filters.dataFinal,
                dateType: overrides.dateType !== undefined ? overrides.dateType : filters.dateType,
                only_active: overrides.only_active !== undefined ? overrides.only_active : filters.only_active,
            };
            const searchPage = overrides.page || page;
            const searchViewMode = overrides.viewMode || viewMode;

            console.log(`📡 [OrdersTable] Fetching data... Page: ${searchPage}, View: ${searchViewMode}`);

            let result;
            if (searchViewMode === 'flat') {
                result = await getPedidosFlat({ ...searchFilters, page: searchPage, limit });
            } else {
                result = await getPedidos({ ...searchFilters, page: searchPage, limit });
            }

            const { data, meta } = result;
            setOrders(data);
            setTotalPages(Math.ceil(meta.total / limit));
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

    const handleExpandRow = async (pedidoId) => {
        if (expandedRow === pedidoId) {
            setExpandedRow(null);
            return;
        }

        setExpandedRow(pedidoId);

        // If items already loaded for this order, just expand
        if (orderItems[pedidoId]) {
            setItemsLoading(false);
            return;
        }

        setItemsLoading(true);
        try {
            console.log(`📡 Buscando itens para pedido: ${pedidoId}`);
            const itens = await getItensPedido(pedidoId);

            if (Array.isArray(itens)) {
                setOrderItems(prev => ({ ...prev, [pedidoId]: itens }));
            } else {
                console.warn(`Resposta inesperada para itens do pedido ${pedidoId}:`, itens);
                setOrderItems(prev => ({ ...prev, [pedidoId]: [] }));
            }
        } catch (err) {
            console.error(`Erro ao buscar itens do pedido ${pedidoId}:`, err);
            setError(`Falha ao carregar itens do pedido ${pedidoId}.`);
        } finally {
            setItemsLoading(false);
        }
    };

    // Fetch on filter/page change
    useEffect(() => {
        console.log('🚀 [OrdersTable] Component rendered - DateType filter active', filters.dateType);
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, viewMode, filters.only_active]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleSearch = (e) => {
        e.preventDefault();
        // Set context page to 1
        setPage(1);
        // Execute fetch immediately with page 1 override to avoid closure lag
        fetchData({ page: 1 });
    };

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
        setOrderItems(prev => ({
            ...prev,
            [pedido]: prev[pedido].map(i =>
                i.item === itemCode ? { ...i, ...newData } : i
            )
        }));
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

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:overflow-visible print:shadow-none print:border-none">
            {/* Header & Filtros */}
            <div className="p-4 border-b border-gray-100 bg-white print:hidden">
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

                <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-7 gap-4 items-end">
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
                                aria-label={`Data inicial (${filters.dateType === 'pedido' ? 'Emissão Pedido' : 'Emissão NF'})`}
                                className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                                title={`Data inicial (${filters.dateType === 'pedido' ? 'Emissão Pedido' : 'Emissão NF'})`}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-[11px] font-medium text-gray-600">Fim:</label>
                            <span className="text-[11px] font-bold text-blue-600">{filters.dateType === 'pedido' ? 'Emissão Pedido' : 'Emissão NF'}</span>
                        </div>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                            <input
                                type="date"
                                name="dataFinal"
                                value={filters.dataFinal}
                                onChange={handleFilterChange}
                                aria-label={`Data final (${filters.dateType === 'pedido' ? 'Emissão Pedido' : 'Emissão NF'})`}
                                className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                                title={`Data final (${filters.dateType === 'pedido' ? 'Emissão Pedido' : 'Emissão NF'})`}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-medium text-gray-600 ml-1">Tipo de Item:</label>
                        <select
                            name="tipo_item"
                            value={filters.tipo_item}
                            onChange={handleFilterChange}
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium h-[42px]"
                        >
                            <option value="">Todos</option>
                            <option value="PCP">PCP</option>
                            <option value="Restrição">Restrição</option>
                            <option value="Revisão">Revisão</option>
                            <option value="Novo">Novo</option>
                        </select>
                    </div>

                    <div className="md:col-span-1 flex gap-2">
                        <button
                            type="submit"
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors flex items-center justify-center gap-2"
                        >
                            <Search className="h-4 w-4" />
                            Filtrar
                        </button>

                        <button
                            type="button"
                            onClick={handleDownloadExcel}
                            className="bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 font-medium rounded-lg text-sm px-3 py-2.5 text-center transition-colors flex items-center justify-center"
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
                            className="bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 font-medium rounded-lg text-sm px-3 py-2.5 text-center transition-colors flex items-center justify-center gap-2"
                            title="Gerar Ata (Pedidos da Tela)"
                        >
                            <StickyNote className="h-4 w-4" />
                            <span>Ata</span>
                        </button>
                    </div>

                    <div className="md:col-span-6 flex flex-col gap-1 mt-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={filters.only_active === 'true'}
                                    onChange={(e) => setFilters(prev => ({ ...prev, only_active: e.target.checked ? 'true' : 'false' }))}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                <span className="ml-3 text-sm font-medium text-gray-700">Apenas Pendentes (Filtro Pesado)</span>
                            </label>
                            <span className="text-[10px] text-gray-400 italic flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Desative para uma busca muito mais rápida.
                            </span>
                        </div>
                        <div className="text-[10px] text-gray-400 italic">
                            Datas do filtro = <span className="font-semibold text-gray-500">Entrada/Emissão do pedido</span> (Protheus).
                        </div>
                    </div>
                </form>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-gray-100 bg-white print:hidden">
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
                    onClick={() => setActiveTab('comparativo')}
                    className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'comparativo'
                        ? 'border-blue-600 text-blue-600 bg-blue-50/30'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                >
                    <BarChart3 className="w-4 h-4" />
                    Comparativo (Planejado vs Realizado)
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
            </div>

            {/* Evolução Content */}
            {activeTab === 'evolucao' && (
                <>
                    {/* Tabela */}
                    <div className="overflow-x-scroll min-h-[400px] print:overflow-visible print:min-h-0">
                        <table className="w-full text-sm text-left text-gray-500 print:w-full">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-100">
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
                                        <th className="px-4 py-3 font-semibold">Pedido</th>
                                        <th className="px-4 py-3 font-semibold text-center">Emissão</th>
                                        <th className="px-4 py-3 font-semibold">Ref. Cliente</th>
                                        <th className="px-4 py-3 font-semibold">Cliente</th>
                                        <th className="px-4 py-3 font-semibold">PC</th>
                                        <th className="px-4 py-3 font-semibold text-center w-8">It</th>
                                        <th className="px-4 py-3 font-semibold text-center">OP</th>
                                        <th className="px-4 py-3 font-semibold">Cód. Prod</th>
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
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan={colSpanCount} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                                                <span className="text-gray-400 font-medium">Carregando dados...</span>
                                            </div>
                                        </td>
                                    </tr>
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
                                                                    onClick={(e) => { e.stopPropagation(); setNotesTarget({ order: order.pedido }); }}
                                                                    className="text-gray-400 hover:text-blue-600 transition-colors p-1 rounded hover:bg-gray-100"
                                                                >
                                                                    <StickyNote className="w-5 h-5" />
                                                                </button>
                                                                <button
                                                                    title="Consultar PCPMetal AI"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setPcpmetalContext(getAIContext(order));
                                                                        setPcpmetalOpen(true);
                                                                    }}
                                                                    className="text-blue-400 hover:text-blue-700 transition-colors p-1 rounded hover:bg-blue-50"
                                                                >
                                                                    <Bot className="w-5 h-5" />
                                                                </button>
                                                                <button
                                                                    title="Exportar Materiais (PCP)"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        updateOrderFilters({ pedido: order.pedido, activeTab: 'pcp-export' });
                                                                    }}
                                                                    className="text-green-500 hover:text-green-700 transition-colors p-1 rounded hover:bg-green-50"
                                                                >
                                                                    <FileSpreadsheet className="w-5 h-5" />
                                                                </button>
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
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {Array.isArray(orderItems[order.pedido]) && orderItems[order.pedido].length > 0 ? (
                                                                                        orderItems[order.pedido]
                                                                                            .filter(item => filters.only_active === 'false' || parseFloat(item.qtd_faturar || 0) > 0)
                                                                                            .map((item, i) => (
                                                                                                <tr key={`${order.pedido}-${item.item}-${i}`} className={`border-b border-gray-50 last:border-0 transition-colors ${parseFloat(item.qtd_faturar || 0) <= 0 ? 'bg-green-50/40 hover:bg-green-100/50 opacity-80' : 'hover:bg-gray-50/50'}`}>
                                                                                                    <td className="px-4 py-2">{item.item}</td>
                                                                                                    <td className="px-4 py-2 text-center text-xs font-mono bg-blue-50 text-blue-700 rounded px-1">{item.op_num || '-'}</td>
                                                                                                    <td className="px-4 py-2 font-mono text-xs">
                                                                                                        <Link
                                                                                                            to={`/estrutura/${encodeURIComponent(item.codigo)}`}
                                                                                                            state={{ from: location.pathname }}
                                                                                                            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                                                                                        >
                                                                                                            {item.codigo} <Layers className="h-3 w-3" />
                                                                                                        </Link>
                                                                                                    </td>
                                                                                                    <td className="px-4 py-2 text-center text-xs text-gray-500">{item.rev_codigo || '-'}</td>
                                                                                                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{item.ref_cliente || '-'}</td>
                                                                                                    <td className="px-4 py-2 text-center text-xs text-gray-500">{item.c6_rev_cliente || '-'}</td>
                                                                                                    <td className="px-4 py-2">
                                                                                                        <div className="flex items-center justify-center gap-1">
                                                                                                            <button
                                                                                                                onClick={() => {
                                                                                                                    if (item.has_drawing && item.drawing_url) {
                                                                                                                        window.open(`http://${window.location.hostname}:3001/api/docs/view?path=${encodeURIComponent(item.drawing_url)}`, '_blank');
                                                                                                                    } else if (item.docs_count === 1 && item.first_doc) {
                                                                                                                        window.open(`http://${window.location.hostname}:3001/api/docs/view?path=${encodeURIComponent(item.first_doc)}`, '_blank');
                                                                                                                    } else {
                                                                                                                        handleOpenDocs(item.codigo, item.descricao);
                                                                                                                    }
                                                                                                                }}
                                                                                                                className={`p-1.5 rounded transition-all flex items-center justify-center relative ${item.has_docs
                                                                                                                    ? 'text-red-500 bg-red-50 hover:bg-red-100 ring-1 ring-red-200/50'
                                                                                                                    : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                                                                                                                    }`}
                                                                                                                title={item.has_docs
                                                                                                                    ? `${item.docs_count} Documento(s) - Clique para abrir`
                                                                                                                    : "Documentos"}
                                                                                                            >
                                                                                                                <FileText className="h-4 w-4" />
                                                                                                                {item.has_docs && (
                                                                                                                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                                                                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                                                                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                                                                                                    </span>
                                                                                                                )}
                                                                                                            </button>
                                                                                                            <button
                                                                                                                onClick={(e) => {
                                                                                                                    e.stopPropagation(); setNotesModal({
                                                                                                                        isOpen: true,
                                                                                                                        orderId: order.pedido,
                                                                                                                        itemId: item.item,
                                                                                                                        productCode: item.codigo,
                                                                                                                        currentNote: item.observacao || ''
                                                                                                                    })
                                                                                                                }}
                                                                                                                className={`p-1.5 rounded transition-all flex items-center justify-center ${item.observacao
                                                                                                                    ? 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100 ring-1 ring-yellow-200/50'
                                                                                                                    : 'text-gray-300 hover:text-yellow-600 hover:bg-yellow-50'
                                                                                                                    }`}
                                                                                                                title={item.observacao ? "Ver/Editar Observação" : "Adicionar Observação"}
                                                                                                            >
                                                                                                                <StickyNote className="h-4 w-4" />
                                                                                                            </button>
                                                                                                            <button
                                                                                                                onClick={() => setEngineeringTarget({ orderId: order.pedido, item })}
                                                                                                                className="p-1.5 text-gray-400 hover:text-blue-500 transition-all bg-gray-50/50 hover:bg-blue-50 rounded flex items-center justify-center"
                                                                                                                title="Controle Engenharia / BOM"
                                                                                                            >
                                                                                                                <Settings className="h-4 w-4" />
                                                                                                            </button>
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
                                                                                                        {parseFloat(item.qtd_faturar || 0) <= 0 ? (
                                                                                                            <div className="relative group inline-flex justify-center">
                                                                                                                <span className="px-2 py-1 text-[10px] font-bold bg-green-100 text-green-700 rounded border border-green-200 cursor-help">ENTREGUE</span>
                                                                                                                {item.notas_fiscais && item.notas_fiscais.length > 0 && (
                                                                                                                    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center">
                                                                                                                        <div className="bg-slate-800 text-slate-100 text-[10px] rounded p-2 shadow-xl border border-slate-700 whitespace-nowrap text-left min-w-[150px]">
                                                                                                                            <div className="font-bold text-white mb-1 border-b border-slate-600 pb-1">Notas Fiscais Emitidas:</div>
                                                                                                                            {item.notas_fiscais.map((nf, nfIdx) => (
                                                                                                                                <div
                                                                                                                                    key={nfIdx}
                                                                                                                                    className="py-0.5 flex justify-between gap-3 hover:bg-slate-700/50 cursor-pointer rounded px-1 transition-colors group/nf"
                                                                                                                                    onClick={(e) => {
                                                                                                                                        e.stopPropagation();
                                                                                                                                        setSelectedInvoice(nf);
                                                                                                                                        setInvoiceModalItem(item);
                                                                                                                                    }}
                                                                                                                                >
                                                                                                                                    <span><span className="text-slate-400">NF:</span> {nf.nota} <span className="text-slate-500">({nf.serie})</span> <span className="text-blue-300 ml-1">[{nf.natureza || '-'}]</span></span>
                                                                                                                                    <span><span className="text-slate-400">Emissão:</span> {nf.emissao} <span className="text-slate-500 ml-2">CFOP: {nf.cfop || '-'}</span></span>
                                                                                                                                    <span className="font-semibold text-blue-300 ml-2 flex items-center gap-1">
                                                                                                                                        {nf.qtd} {item.unidade}
                                                                                                                                        <FileText className="h-3 w-3 opacity-0 group-hover/nf:opacity-100 transition-opacity" />
                                                                                                                                    </span>
                                                                                                                                </div>
                                                                                                                            ))}
                                                                                                                        </div>
                                                                                                                        <div className="w-2 h-2 bg-slate-800 rotate-45 -mt-1 border-b border-r border-slate-700"></div>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                            </div>
                                                                                                        ) : !item.op_num || item.op_num === '-' ? (
                                                                                                            <div className="relative group inline-flex justify-center">
                                                                                                                <span className="px-2 py-1 text-[10px] font-bold bg-red-100 text-red-700 rounded border border-red-200">PENDENTE</span>
                                                                                                                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center">
                                                                                                                    <div className="bg-slate-800 text-slate-100 text-[10px] rounded p-2 shadow-xl border border-slate-700 whitespace-nowrap">
                                                                                                                        Aguardando abertura de OP
                                                                                                                    </div>
                                                                                                                    <div className="w-2 h-2 bg-slate-800 rotate-45 -mt-1 border-b border-r border-slate-700"></div>
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        ) : (
                                                                                                            <div className="relative group inline-flex justify-center">
                                                                                                                <span className={`px-2 py-1 text-[10px] font-bold rounded border ${item.notas_fiscais && item.notas_fiscais.length > 0 ? 'cursor-help' : ''} bg-orange-100 text-orange-700 border-orange-200`}>LIBERADO</span>
                                                                                                                {item.notas_fiscais && item.notas_fiscais.length > 0 && (
                                                                                                                    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center">
                                                                                                                        <div className="bg-slate-800 text-slate-100 text-[10px] rounded p-2 shadow-xl border border-slate-700 whitespace-nowrap text-left min-w-[150px]">
                                                                                                                            <div className="font-bold text-white mb-1 border-b border-slate-600 pb-1">Notas Fiscais Emitidas (Parciais):</div>
                                                                                                                            {item.notas_fiscais.map((nf, nfIdx) => (
                                                                                                                                <div
                                                                                                                                    key={nfIdx}
                                                                                                                                    className="py-0.5 flex justify-between gap-3 hover:bg-slate-700/50 cursor-pointer rounded px-1 transition-colors group/nf"
                                                                                                                                    onClick={(e) => {
                                                                                                                                        e.stopPropagation();
                                                                                                                                        setSelectedInvoice(nf);
                                                                                                                                        setInvoiceModalItem(item);
                                                                                                                                    }}
                                                                                                                                >
                                                                                                                                    <span><span className="text-slate-400">NF:</span> {nf.nota} <span className="text-slate-500">({nf.serie})</span> <span className="text-blue-300 ml-1">[{nf.natureza || '-'}]</span></span>
                                                                                                                                    <span><span className="text-slate-400">Emissão:</span> {nf.emissao} <span className="text-slate-500 ml-2">CFOP: {nf.cfop || '-'}</span></span>
                                                                                                                                    <span className="font-semibold text-blue-300 ml-2 flex items-center gap-1">
                                                                                                                                        {nf.qtd} {item.unidade}
                                                                                                                                        <FileText className="h-3 w-3 opacity-0 group-hover/nf:opacity-100 transition-opacity" />
                                                                                                                                    </span>
                                                                                                                                </div>
                                                                                                                            ))}
                                                                                                                        </div>
                                                                                                                        <div className="w-2 h-2 bg-slate-800 rotate-45 -mt-1 border-b border-r border-slate-700"></div>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                            </div>
                                                                                                        )}
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
                                                                                                        {item.entrega ? item.entrega.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1') : '-'}
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
                                            // FLAT VIEW IMPLEMENTATION
                                            orders.map((item, idx) => (
                                                <tr key={`${item.pedido}-${item.item}-${idx}`} className={`transition-colors border-b border-gray-50 last:border-0 ${parseFloat(item.qtd_faturar) <= 0 ? 'bg-green-50/40 hover:bg-green-100/50 opacity-80' : 'bg-white hover:bg-slate-50'}`}>
                                                    <td className="px-4 py-2 whitespace-nowrap">
                                                        <span className="font-bold text-gray-900">{item.pedido}</span>
                                                    </td>
                                                    <td className="px-4 py-2 text-center text-xs text-gray-600 whitespace-nowrap">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Calendar className="h-3 w-3 text-gray-400" />
                                                            {formatProtheusDate(item.emissao)}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 text-xs font-mono text-gray-600">
                                                        {item.ref_cliente || '-'}
                                                    </td>
                                                    <td className="px-4 py-2 max-w-[200px]">
                                                        <div className="text-xs font-medium text-gray-700 truncate" title={item.nome_cliente}>
                                                            {item.nome_cliente}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 text-xs text-gray-600">
                                                        {item.ped_cliente || '-'}
                                                    </td>
                                                    <td className="px-4 py-2 text-center text-xs font-mono text-gray-500">{item.item}</td>
                                                    <td className="px-4 py-2 text-center text-xs font-mono bg-blue-50 text-blue-700 rounded px-1">{item.op_num || '-'}</td>
                                                    <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">
                                                        <Link
                                                            to={`/estrutura/${encodeURIComponent(item.codigo)}`}
                                                            state={{ from: location.pathname }}
                                                            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                                        >
                                                            {item.codigo} <Layers className="h-3 w-3" />
                                                        </Link>
                                                    </td>
                                                    <td className="px-4 py-2 text-center text-xs text-gray-500 font-mono">
                                                        {item.rev_codigo || '-'}
                                                    </td>
                                                    <td className="px-4 py-2 font-mono text-xs text-gray-500 text-center">
                                                        {item.c6_rev_cliente || '-'}
                                                    </td>
                                                    <td className="px-4 py-2 text-center print:hidden">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                onClick={() => {
                                                                    if (item.has_drawing && item.drawing_url) {
                                                                        window.open(`http://${window.location.hostname}:3001/api/docs/view?path=${encodeURIComponent(item.drawing_url)}`, '_blank');
                                                                    } else if (item.docs_count === 1 && item.first_doc) {
                                                                        window.open(`http://${window.location.hostname}:3001/api/docs/view?path=${encodeURIComponent(item.first_doc)}`, '_blank');
                                                                    } else {
                                                                        handleOpenDocs(item.codigo, item.descricao);
                                                                    }
                                                                }}
                                                                className={`p-1.5 rounded-lg transition-all relative ${item.has_docs
                                                                    ? 'text-red-600 bg-red-50 hover:bg-red-100 ring-1 ring-red-200'
                                                                    : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                                                    }`}
                                                                title={item.has_docs
                                                                    ? `${item.docs_count} Documento(s) - Clique para abrir`
                                                                    : "Documentos"}
                                                            >
                                                                <FileText className="h-4 w-4" />
                                                                {item.has_docs && (
                                                                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                                                    </span>
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => setEngineeringTarget({ orderId: item.pedido, item })}
                                                                className="p-1.5 text-gray-400 hover:text-blue-500 transition-all bg-gray-50/50 hover:bg-blue-50 rounded flex items-center justify-center"
                                                                title="Controle Engenharia / BOM"
                                                            >
                                                                <Settings className="h-4 w-4" />
                                                            </button>
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
                                                                        <div className="absolute z-[60] bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tipo:flex flex-col items-center">
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
                                                    <td className="px-4 py-2 text-xs text-gray-600 truncate max-w-[250px]" title={item.descricao}>
                                                        {item.descricao}
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        {parseFloat(item.qtd_faturar) <= 0 ? (
                                                            <div className="relative group inline-flex justify-center">
                                                                <span className="px-2 py-0.5 text-[9px] font-bold bg-green-100 text-green-700 rounded border border-green-200 cursor-help">ENTREGUE</span>
                                                                {item.notas_fiscais && item.notas_fiscais.length > 0 && (
                                                                    <div className="absolute z-[60] bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center">
                                                                        <div className="bg-slate-800 text-slate-100 text-[10px] rounded p-2 shadow-xl border border-slate-700 whitespace-nowrap text-left min-w-[150px]">
                                                                            <div className="font-bold text-white mb-1 border-b border-slate-600 pb-1">Notas Fiscais Emitidas:</div>
                                                                            {item.notas_fiscais.map((nf, nfIdx) => (
                                                                                <div key={nfIdx} className="py-0.5 flex justify-between gap-3">
                                                                                    <span><span className="text-slate-400">NF:</span> {nf.nota} <span className="text-slate-500">({nf.serie})</span> <span className="text-blue-300 ml-1">[{nf.natureza || '-'}]</span></span>
                                                                                    <span><span className="text-slate-400">Emissão:</span> {nf.emissao} <span className="text-slate-500 ml-2">CFOP: {nf.cfop || '-'}</span></span>
                                                                                    <span className="font-semibold text-blue-300 ml-2">{nf.qtd} {item.unidade}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                        <div className="w-2 h-2 bg-slate-800 rotate-45 -mt-1 border-b border-r border-slate-700"></div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="relative group inline-flex justify-center">
                                                                <span className={`px-2 py-0.5 text-[9px] font-bold rounded border ${item.notas_fiscais && item.notas_fiscais.length > 0 ? 'cursor-help' : ''} bg-orange-100 text-orange-700 border-orange-200`}>PENDENTE</span>
                                                                {item.notas_fiscais && item.notas_fiscais.length > 0 && (
                                                                    <div className="absolute z-[60] bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center">
                                                                        <div className="bg-slate-800 text-slate-100 text-[10px] rounded p-2 shadow-xl border border-slate-700 whitespace-nowrap text-left min-w-[150px]">
                                                                            <div className="font-bold text-white mb-1 border-b border-slate-600 pb-1">Notas Fiscais Emitidas (Parciais):</div>
                                                                            {item.notas_fiscais.map((nf, nfIdx) => (
                                                                                <div key={nfIdx} className="py-0.5 flex justify-between gap-3">
                                                                                    <span><span className="text-slate-400">NF:</span> {nf.nota} <span className="text-slate-500">({nf.serie})</span> <span className="text-blue-300 ml-1">[{nf.natureza || '-'}]</span></span>
                                                                                    <span><span className="text-slate-400">Emissão:</span> {nf.emissao} <span className="text-slate-500 ml-2">CFOP: {nf.cfop || '-'}</span></span>
                                                                                    <span className="font-semibold text-blue-300 ml-2">{nf.qtd} {item.unidade}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                        <div className="w-2 h-2 bg-slate-800 rotate-45 -mt-1 border-b border-r border-slate-700"></div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-gray-600">
                                                        {parseFloat(item.qtd_entreg || 0).toLocaleString('pt-BR')}
                                                    </td>
                                                    <td className={`px-4 py-2 text-right font-medium ${parseFloat(item.qtd_faturar) <= 0 ? 'text-green-600' : 'text-orange-600 font-bold'}`}>
                                                        {parseFloat(item.qtd_faturar || 0).toLocaleString('pt-BR')}
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-medium">
                                                        {parseFloat(item.quantidade).toLocaleString('pt-BR')} <span className="text-[10px] text-gray-400">{item.unidade}</span>
                                                    </td>
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
                                                        {item.entrega ? item.entrega.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1') : '-'}
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-xs font-medium text-teal-700">
                                                        <div
                                                            className="cursor-pointer hover:bg-teal-50 rounded px-1 py-0.5 transition-colors group/pcp inline-block"
                                                            onClick={() => setPcpForecastTarget(item)}
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
                                                            onClick={() => setPcpForecastTarget(item)}
                                                            title="Clique para definir Data PCP"
                                                        >
                                                            {item.pcp_delivery_forecast_date ? (
                                                                <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-semibold group-hover/pcp:border-teal-400">
                                                                    {new Date(item.pcp_delivery_forecast_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                                                </span>
                                                            ) : <span className="text-gray-400 group-hover/pcp:text-teal-600">Definir...</span>}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer / Paginação */}
                    {!loading && !error && orders.length > 0 && (
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between print:hidden">
                            <span className="text-sm text-gray-500">
                                {viewMode === 'tree' ? 'Página' : 'Página de Itens'} <span className="font-semibold text-gray-900">{page}</span> de <span className="font-semibold text-gray-900">{totalPages}</span>
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-2 rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronLeft className="h-5 w-5 text-gray-600" />
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="p-2 rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronRight className="h-5 w-5 text-gray-600" />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )
            }

            {/* Comparativo Content */}
            {
                activeTab === 'comparativo' && (
                    <ProductionComparison filters={filters} />
                )
            }

            {/* Exportação Materiais PCP */}
            {activeTab === 'pcp-export' && (
                <div className="p-4">
                    <PCPExportTab />
                </div>
            )}

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
                pcpForecastTarget && (
                    <PCPForecastModal
                        isOpen={true}
                        onClose={() => setPcpForecastTarget(null)}
                        item={pcpForecastTarget}
                        onSaveSuccess={async () => {
                            // Refresh appropriate view
                            if (viewMode === 'tree') {
                                if (expandedRow) {
                                    try {
                                        const updatedItems = await getItensPedido(expandedRow);
                                        setOrderItems(prev => ({ ...prev, [expandedRow]: updatedItems }));
                                    } catch (error) {
                                        console.error('Erro ao atualizar itens:', error);
                                    }
                                }
                                fetchData();
                            } else {
                                fetchData();
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
        </div >
    );
};

export default OrdersTable;
