import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Filter, Calendar, AlertCircle, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Package, Layers, FileText, StickyNote, List, AlignJustify, Image as ImageIcon, FileSpreadsheet, TrendingUp, BarChart3, Loader2, Bot, Settings, Printer, Factory, ClipboardList, MoreVertical, Lock } from 'lucide-react';
import { getPedidos, getItensPedido, getReportDownloadUrl, getPedidosFlat, getProdutos, getSalesPlanningReportData, getSalesNotes, api, getFileUrl, reportSystemError } from '../services/api';
import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import autoTable from 'jspdf-autotable';

import PCPExportTab from '../components/orders/PCPExportTab';
import DocsModal from '../components/DocsModal';
import NotesDrawer from '../components/NotesDrawer';
import MeetingReportModal from '../components/MeetingReportModal';
import ProductImageModal from '../components/ProductImageModal'; // Import Image Modal
import EngineeringControlModal from '../components/EngineeringControlModal';
import ProductionComparison from '../components/ProductionComparison';
import PCPForecastModal from '../components/PCPForecastModal';
import PCPMetalDrawer from '../components/PCPMetalDrawer';
import InvoiceDetailsModal from '../components/InvoiceDetailsModal';
import ErrorStateOverlay from '../components/ErrorStateOverlay';
import { useAuth } from '../contexts/AuthContext';
import { useFilters } from '../contexts/FilterContext';
import { generateOrderPDF } from '../services/orderPdfGenerator'; // Import new PDF service

const GestaoOPsPage = () => {

    const location = useLocation();

    const formatProtheusDate = (value) => {
        const raw = String(value ?? '').trim();
        if (!raw) return '-';
        if (/^\d{8}$/.test(raw)) return raw.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1');
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1');
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.substring(0, 10).replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1');
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
        if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) return raw.replace(/-/g, '/');
        return raw;
        if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) return raw.replace(/-/g, '/');
        return raw;
    };

    const { orderFilters, updateOrderFilters } = useFilters();

    // Mapping context to local names for easier migration
    const viewMode = 'flat'; // Forced flat view for Gestão de OPs
    const setViewMode = (val) => updateOrderFilters({ viewMode: val, page: 1 });

    const activeTab = orderFilters.activeTab || 'evolucao';
    const setActiveTab = (val) => updateOrderFilters({ activeTab: val });

    const [orders, setOrders] = useState([]);
    const [selectedFractions, setSelectedFractions] = useState(new Set());
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
    const [printingOrderId, setPrintingOrderId] = useState(null); // Local loading state for print button
    const [batchProgress, setBatchProgress] = useState(null);

    // PCPMetal AI Drawer State
    const [pcpmetalOpen, setPcpmetalOpen] = useState(false);
    const [pcpmetalContext, setPcpmetalContext] = useState({});

    // Invoice Modal State
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [invoiceModalItem, setInvoiceModalItem] = useState(null);

    // Action dropdown menu state
    const [openActionMenu, setOpenActionMenu] = useState(null);

    // PCP Release modal state
    const [pcpReleaseModal, setPcpReleaseModal] = useState({ open: false, targets: [], registerRelease: true });
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

    const filters = {
        cliente: orderFilters.cliente,
        pedido: orderFilters.pedido,
        produto: orderFilters.produto,
        dataInicial: orderFilters.dataInicial,
        dataFinal: orderFilters.dataFinal,
        dateType: orderFilters.dateType,
        tipo_item: orderFilters.tipo_item || '',
        only_active: orderFilters.only_active,
    };

    const setFilters = (val) => {
        // Handle full object or updater function
        if (typeof val === 'function') {
            updateOrderFilters(val(orderFilters));
        } else {
            updateOrderFilters(val);
        }
    };

    const [filterLote, setFilterLote] = useState('');

    // Flatten fractional orders so they render as discrete rows in the grid
    const flattenedFractionalOrders = useMemo(() => {
        if (!orders) return [];
        let flat = orders.reduce((acc, order) => {
            if (order.pcp_programacoes && order.pcp_programacoes.length > 0) {
                order.pcp_programacoes.forEach((fraction, index) => {
                    acc.push({
                        ...order,
                        ...fraction,
                        is_fraction: true,
                        // We store raw data under _pcp_prog to avoid collisions, similar to ItensAFaturar
                        _pcp_prog: fraction,
                        fraction_id: fraction.id || `${order.pedido}-${order.item}-${index}`,
                        visual_qtd: fraction.quantidade_pcp || order.qtd_faturar,
                        visual_op: `${order.op_num || order.pedido}-${fraction.numero_lote ? fraction.numero_lote : String.fromCharCode(65 + index)}`,
                        lpf_codigo: fraction.lpf_codigo || order.lpf_codigo_base
                    });
                });
            } else {
                acc.push({
                    ...order,
                    is_fraction: false,
                    fraction_id: `${order.pedido}-${order.item}-base`,
                    visual_qtd: order.qtd_faturar,
                    visual_op: order.op_num || '',
                    lpf_codigo: order.lpf_codigo_base
                });
            }
            return acc;
        }, []);

        if (filterLote) {
            const term = filterLote.toUpperCase().trim();
            return flat.filter((x) => x.visual_op && x.visual_op.toUpperCase().includes(term));
        }
        return flat;
    }, [orders, filterLote]);

    const flatGrouped = useMemo(() => {
        const groups = {};
        const ungrouped = [];
        flattenedFractionalOrders.forEach(f => {
            if (f.lpf_codigo) {
                if (!groups[f.lpf_codigo]) groups[f.lpf_codigo] = [];
                groups[f.lpf_codigo].push(f);
            } else {
                ungrouped.push(f);
            }
        });
        return { ObjectGroups: groups, ungrouped };
    }, [flattenedFractionalOrders]);

    const handleReprintLPF = async (codigo, items) => {
        try {
            setDownloadingPDF(true);
            setBatchProgress({ current: 1, total: 1, status: `Iniciando re-impressão LPF: ${codigo}` });
            const res = await api.get(`/pcp-releases/find/${codigo}`);
            if (res.data?.caminho_arquivo) {
                window.open(`${api.defaults.baseURL}/pcp-releases/download/${codigo}`, '_blank');
            } else {
                alert(`PDF para o Lote Aglutinado ${codigo} não encontrado.`);
            }
        } catch(err) {
            console.error('Erro na re-impressão.', err);
            // Fallback: silently trying to regenerate if fail? Or just show error
            alert('Não foi possível realizar o download. Erro: ' + err.message);
        } finally {
            setDownloadingPDF(false);
            setBatchProgress(null);
        }
    };

    // Pagination
    const page = orderFilters.page;
    const setPage = (val) => updateOrderFilters({ page: val });

    const [totalPages, setTotalPages] = useState(1);
    const [requiresFilter, setRequiresFilter] = useState(false);

    const limit = viewMode === 'flat' ? 100 : 100;
    const colSpanCount = viewMode === 'flat' ? 23 : 7;

    // Debug mount
    useEffect(() => {
        console.log('📦 [GestaoOPsPage] Component MOUNTED');
        return () => console.log('📦 [GestaoOPsPage] Component UNMOUNTED');
    }, []);

    const fetchData = async (overrides = {}) => {
        setLoading(true);
        setError(null);
        // Use overrides or current state/context values
        const searchFilters = {
            cliente: overrides.cliente !== undefined ? overrides.cliente : filters.cliente,
            pedido: overrides.pedido !== undefined ? overrides.pedido : filters.pedido,
            produto: overrides.produto !== undefined ? overrides.produto : filters.produto,
            dataInicial: overrides.dataInicial !== undefined ? overrides.dataInicial : filters.dataInicial,
            dataFinal: overrides.dataFinal !== undefined ? overrides.dataFinal : filters.dataFinal,
            dateType: overrides.dateType !== undefined ? overrides.dateType : filters.dateType,
            tipo_item: overrides.tipo_item !== undefined ? overrides.tipo_item : filters.tipo_item,
            only_active: overrides.only_active !== undefined ? overrides.only_active : filters.only_active,
        };
        const searchPage = overrides.page || page;
        const searchViewMode = overrides.viewMode || viewMode;

        try {
            console.log(`📡 [GestaoOPsPage] Fetching data... Page: ${searchPage}, View: ${searchViewMode}`);

            const searchLimit = searchFilters.pedido ? 5000 : limit;

            let result;
            if (searchViewMode === 'flat') {
                result = await getPedidosFlat({ ...searchFilters, page: searchPage, limit: searchLimit });
            } else {
                result = await getPedidos({ ...searchFilters, page: searchPage, limit: searchLimit });
            }


            const { data, meta } = result;
            setOrders(data);
            setRequiresFilter(!!meta.requiresFilter);
            setTotalPages(Math.ceil(meta.total / searchLimit) || 1);
        } catch (err) {
            console.error(err);
            const serverError = err.response?.data;
            const errorMsg = serverError
                ? typeof serverError === 'object' ? JSON.stringify(serverError, null, 2) : serverError
                : err.message;

            setError(`Erro ao carregar dados: ${errorMsg}`);
            reportSystemError('Gestão OPs', err, { filters: searchFilters, page: searchPage, viewMode: searchViewMode });
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
        console.log('🚀 [GestaoOPsPage] Component rendered - DateType filter active', filters.dateType);
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

    const handlePrintOrder = async (e, orderId) => {
        e.stopPropagation(); // Prevenir expansão da linha
        if (printingOrderId === orderId) return;

        setPrintingOrderId(orderId);
        try {
            // Fetch complete order details (capa + itens) and Notes (Ata)
            const [capaResult, itensResult, notesResult] = await Promise.all([
                getPedidos({ pedido: orderId, limit: 1 }), // Pega a capa
                getItensPedido(orderId), // Pega os itens
                getSalesNotes([orderId]) // Pega Ata
            ]);

            const capa = capaResult.data && capaResult.data.length > 0 ? capaResult.data[0] : null;
            if (!capa) {
                alert('Número do pedido não encontrado ou sem permissão.');
                return;
            }

            const orderData = {
                capa,
                itens: itensResult || [],
                notes: Array.isArray(notesResult) ? notesResult : []
            };

            await generateOrderPDF(orderData);
        } catch (err) {
            console.error('Erro ao imprimir pedido:', err);
            alert('Falha ao gerar o PDF do pedido: ' + err.message);
        } finally {
            setPrintingOrderId(null);
        }
    };


    const handleBatchPrintOPByOperationWithDrawings = async (inputArgs) => {
        let targets = [];
        if (Array.isArray(inputArgs)) {
            targets = inputArgs;
        } else if (selectedFractions.size > 0) {
            targets = Array.from(selectedFractions).map(id => flattenedFractionalOrders.find(f => f.fraction_id === id)).filter(Boolean);
        }

        if (!targets || targets.length === 0) {
            alert('Nenhuma OP disponível para impressão nesse filtro/seleção.');
            return;
        }

        if (!confirm(`Deseja gerar o documento de Rastreabilidade das Operações para as ${targets.length} peças selecionadas?`)) return;

        try {
            setDownloadingPDF(true);
            setPrintingOrderId('batch');
            setBatchProgress({ current: 0, total: targets.length, status: 'Iniciando montagem...' });

            const { PDFDocument } = await import('pdf-lib');
            const { generateOPByOperationWithDrawingsPdf } = await import('../services/opByOperationWithDrawingsPdfGenerator');

            const finalPdf = await PDFDocument.create();

            for (let i = 0; i < targets.length; i++) {
                const order = targets[i];
                const visualOpInfo = order.visual_op || order.op_num || order.pedido;
                setBatchProgress({ current: i + 1, total: targets.length, status: `Adicionando OP Lote ${visualOpInfo}...` });

                const endpoint = order.is_fraction && order.visual_qtd
                    ? `/pedidos/op-mirror/${order.pedido}?item=${order.item}&qtd_lote=${order.visual_qtd}`
                    : `/pedidos/op-mirror/${order.pedido}?item=${order.item}`;
                
                const response = await api.get(endpoint);
                const orderPdfBytes = await generateOPByOperationWithDrawingsPdf(response.data, user?.nome || 'Usuário', order, true);

                if (orderPdfBytes) {
                    const orderDoc = await PDFDocument.load(orderPdfBytes, { ignoreEncryption: true });
                    const copiedPages = await finalPdf.copyPages(orderDoc, orderDoc.getPageIndices());
                    copiedPages.forEach(p => finalPdf.addPage(p));
                }
            }

            setBatchProgress({ current: targets.length, total: targets.length, status: 'Finalizando arquivo...' });
            const mergedPdfBytes = await finalPdf.save({ useObjectStreams: false });

            const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const loteInfo = targets[0]?.lote || targets[0]?.raw_numero_lote || 'Geral';
            link.download = `Pacote_Rastreabilidade_LOTE_${loteInfo}.pdf`;
            document.body.appendChild(link);
            link.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(link);

        } catch (error) {
            console.error('Erro na impressão em lote com desenhos:', error);
            alert(`Erro na impressão em lote: ${error.message}`);
        } finally {
            setDownloadingPDF(false);
            setPrintingOrderId(null);
            setBatchProgress(null);
        }
    };

    const handleBatchPrintOPByOperationAglutinado = async (inputArgs) => {
        let targets = [];
        if (Array.isArray(inputArgs)) {
            targets = inputArgs;
        } else if (selectedFractions.size > 0) {
            targets = Array.from(selectedFractions).map(id => flattenedFractionalOrders.find(f => f.fraction_id === id)).filter(Boolean);
        }

        if (!targets || targets.length === 0) {
            alert('Nenhuma OP dispon��vel para impressão nesse filtro/seleção.');
            return;
        }

        // Show optional release modal instead of confirm()
        setPcpReleaseModal({ open: true, targets, registerRelease: true });
    };

    const executeBatchPrintAglutinado = async (targets, registerRelease) => {
        setPcpReleaseModal({ open: false, targets: [], registerRelease: true });
        try {
            setDownloadingPDF(true);
            setPrintingOrderId('batch');
            setBatchProgress({ current: 1, total: targets.length, status: 'Consolidando Lote Aglutinado e extraindo desenhos...' });

            // Step 1: Register liberation FIRST to get the unique code
            let codigoLiberacao = null;
            if (registerRelease) {
                try {
                    const loteInfoStr = targets.map(t => t.visual_op || t.op_num || t.pedido).join(', ');
                    const dataPcpGeral = targets[0]?.data_entrega_pcp
                        ? new Date(targets[0].data_entrega_pcp).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                        : '-';
                    const opsPayload = targets.map(t => ({
                        pedido:      t.pedido,
                        item:        t.item,
                        fraction_id: t.fraction_id,
                        is_fraction: !!t.is_fraction,
                        visual_op:   t.visual_op || t.op_num,
                        produto:     t.cod_produto || t.produto || t.codigo,
                        descricao:   t.descricao || t.desc_produto || '',
                        qtd:         t.visual_qtd || t.qtd_faturar
                    }));
                    const logRes = await api.post('/pcp-releases/log', {
                        lote_info:  loteInfoStr,
                        data_pcp:   dataPcpGeral,
                        usuario:    user?.nome || 'Usuário',
                        qtd_ops:    targets.length,
                        ops_json:   JSON.stringify(opsPayload)
                    });
                    codigoLiberacao = logRes.data?.codigo_liberacao || null;
                    console.log(`✅ Liberação PCP registrada: ${codigoLiberacao}`);
                } catch (logErr) {
                    console.warn('⚠️ Falha ao registrar liberação PCP (não crítico):', logErr.message);
                }
            }

            // Step 2: Generate PDF with the liberation code embedded in all headers
            const { generateLoteWithDrawingsPdf } = await import('../services/loteWithDrawingsPdfGenerator');
            const pdfBytes = await generateLoteWithDrawingsPdf(targets, user?.nome || 'Usuário', codigoLiberacao);
            
            if (pdfBytes) {
                const loteInfo = targets[0]?.lote || targets[0]?.raw_numero_lote || 'Geral';
                const fileName = codigoLiberacao ? `${codigoLiberacao}_LOTE_${loteInfo}.pdf` : `LOTE_${loteInfo}_AGRUPADO.pdf`;

                // Download locally (browser)
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(link);

                // Save to network share via server (only when liberation is registered)
                if (codigoLiberacao) {
                    try {
                        setBatchProgress({ current: targets.length, total: targets.length, status: 'Salvando na pasta de OS...' });
                        // Convert ArrayBuffer to base64
                        const uint8 = new Uint8Array(pdfBytes);
                        let binary = '';
                        uint8.forEach(b => { binary += String.fromCharCode(b); });
                        const pdfBase64 = btoa(binary);

                        await api.post('/pcp-releases/save-pdf', {
                            codigo_liberacao: codigoLiberacao,
                            filename: fileName,
                            pdfBase64
                        });
                        console.log(`✅ PDF salvo na pasta de OS: ${codigoLiberacao}`);
                    } catch (saveErr) {
                        console.warn('⚠️ Falha ao salvar PDF na rede (não crítico):', saveErr.message);
                    }
                }
            }
        } catch (error) {
            console.error('Erro na impressão em lote aglutinado:', error);
            alert(`Erro na impressão em lote: ${error.message}`);
        } finally {
            setDownloadingPDF(false);
            setPrintingOrderId(null);
            setBatchProgress(null);
        }
    };


    const handlePrintOPMirror = async (pedido, e, itemId = null, itemObj = null) => {
        if (e) e.stopPropagation();
        const loadKey = itemId ? `op-${pedido}-${itemId}` : `op-${pedido}`;
        setPrintingOrderId(loadKey);
        try {
            const endpoint = itemId
                ? `/pedidos/op-mirror/${pedido}?item=${itemId}`
                : `/pedidos/op-mirror/${pedido}`;

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

    const handlePrintFichas = async (pedido, e, itemId = null, itemObj = null) => {
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

    const handlePrintOPByOperationWithDrawings = async (pedido, e, itemId = null, itemObj = null) => {
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
            await generateOPByOperationWithDrawingsPdf(mirrorData, userName, itemObj);

        } catch (error) {
            const msg = error.response?.data?.error || error.message;
            console.error('Error generating OP by Operation PDF with Drawings:', error);
            alert(`Erro ao gerar Espelho com Desenhos: ${msg}`);
        } finally {
            setPrintingOrderId(null);
        }
    };

    const handlePrintOPByResourceWithDrawings = async (pedido, e, itemId = null, itemObj = null) => {
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
            await generateOPDrawingsByResourcePdf(mirrorData, userName, itemObj);

        } catch (error) {
            const msg = error.response?.data?.error || error.message;
            console.error('Error generating OP by Resource PDF with Drawings:', error);
            alert(`Erro ao gerar Espelho por Recurso com Desenhos: ${msg}`);
        } finally {
            setPrintingOrderId(null);
        }
    };

    const handlePrintOPWithOpsStampWithDrawings = async (pedido, e, itemId = null, itemObj = null) => {
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
            await generateOPDrawingsWithOpsStampPdf(mirrorData, userName, itemObj);

        } catch (error) {
            const msg = error.response?.data?.error || error.message;
            console.error('Error generating OP PDF with Ops Stamp Drawings:', error);
            alert(`Erro ao gerar Espelho com Roteiro no Carimbo: ${msg}`);
        } finally {
            setPrintingOrderId(null);
        }
    };

    const handlePrintOPByOperation = async (pedido, e, itemId = null, itemObj = null) => {
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
            generateOPByOperationPdf(mirrorData, false, itemObj);

        } catch (error) {
            const msg = error.response?.data?.error || error.message;
            console.error('Error generating OP by Operation PDF:', error);
            alert(`Erro ao gerar Espelho por Operação: ${msg}`);
        } finally {
            setPrintingOrderId(null);
        }
    };

    const handleExportOPByOperationExcel = async (pedido, e, itemId = null, itemObj = null) => {
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
        setOrderItems(prev => ({
            ...prev,
            [pedido]: prev[pedido].map(i =>
                i.item === itemCode ? { ...i, ...newData } : i
            )
        }));
    };

    const getAIContext = (item = {}) => {
        return {
            source: 'GestaoOPsPage',
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

    const renderFlatRow = (item, isGrouped = false) => (
        <tr key={item.fraction_id} className={`transition-colors border-b border-gray-50 last:border-0 ${parseFloat(item.qtd_faturar) <= 0 ? 'bg-green-50/40 hover:bg-green-100/50 opacity-80' : 'bg-white hover:bg-slate-50'}`}>
            <td className="px-4 py-2 text-center w-10 print:hidden text-xs">
                {(!isGrouped && item.is_fraction) ? (
                    <input
                        type="checkbox"
                        checked={selectedFractions.has(item.fraction_id)}
                        onChange={() => {
                            const newSet = new Set(selectedFractions);
                            if (newSet.has(item.fraction_id)) {
                                newSet.delete(item.fraction_id);
                            } else {
                                newSet.add(item.fraction_id);
                            }
                            setSelectedFractions(newSet);
                        }}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                ) : isGrouped ? (
                    <Lock className="w-4 h-4 text-emerald-600/70 mx-auto" />
                ) : null}
            </td>
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
            <td className="px-4 py-2 text-center text-xs font-mono bg-blue-50 text-blue-700 rounded px-1">{item.visual_op || item.op_num || '-'}</td>
            <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">
                <Link
                    to={`/estrutura/${encodeURIComponent(item.codigo)}?pedido=${encodeURIComponent(item.pedido || '')}&item=${encodeURIComponent(item.item || '')}`}
                    state={{ from: location.pathname }}
                    className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                >
                    {item.codigo} <Layers className="h-3 w-3" />
                </Link>
            </td>
            <td className="px-4 py-2 text-xs text-gray-600 truncate max-w-[250px]" title={item.descricao}>
                {item.descricao}
            </td>
            <td className={`px-4 py-2 text-right font-medium ${parseFloat(item.qtd_faturar) <= 0 ? 'text-green-600' : 'text-orange-600 font-bold'}`}>
                {parseFloat(item.visual_qtd || item.qtd_faturar || 0).toLocaleString('pt-BR')}
            </td>
            <td className={`px-4 py-2 text-right text-xs font-medium ${isGrouped ? 'text-gray-500' : 'text-teal-700'}`}>
                {isGrouped ? (
                    <span>{parseFloat((item.is_fraction ? item.quantidade_pcp : null) || item.pcp_delivery_forecast_qtd || 0).toLocaleString('pt-BR')}</span>
                ) : (
                    <div
                        className="cursor-pointer hover:bg-teal-50 rounded px-1 py-0.5 transition-colors group/pcp inline-block"
                        onClick={() => setPcpForecastTarget(item)}
                        title="Clique para definir Qtd. PCP"
                    >
                        <span className="group-hover/pcp:text-teal-900">
                            {(item.is_fraction && item.quantidade_pcp) || item.pcp_delivery_forecast_qtd
                                ? parseFloat((item.is_fraction ? item.quantidade_pcp : null) || item.pcp_delivery_forecast_qtd).toLocaleString('pt-BR')
                                : 'Definir...'}
                        </span>
                    </div>
                )}
            </td>
            <td className={`px-4 py-2 text-center text-xs ${isGrouped ? 'text-gray-500' : ''}`}>
                {isGrouped ? (
                    <span>
                        {((item.is_fraction && item.data_entrega_pcp) || item.pcp_delivery_forecast_date)
                            ? new Date((item.is_fraction ? item.data_entrega_pcp : null) || item.pcp_delivery_forecast_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                            : '-'}
                    </span>
                ) : (
                    <div
                        className="cursor-pointer hover:bg-teal-50 rounded px-1 py-0.5 transition-colors group/pcp inline-block"
                        onClick={() => setPcpForecastTarget(item)}
                        title="Clique para definir Data PCP"
                    >
                        {(item.is_fraction && item.data_entrega_pcp) || item.pcp_delivery_forecast_date ? (
                            <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-semibold group-hover/pcp:border-teal-400">
                                {new Date((item.is_fraction ? item.data_entrega_pcp : null) || item.pcp_delivery_forecast_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                            </span>
                        ) : <span className="text-gray-400 group-hover/pcp:text-teal-600">Definir...</span>}
                    </div>
                )}
            </td>
        </tr>
    );

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:overflow-visible print:shadow-none print:border-none relative">
            {/* Global Overlay for PDF Generation */}
            {printingOrderId && (
                <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gray-900/50 backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center max-w-md border border-gray-100">
                        <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Processando PDF...</h3>
                        {batchProgress ? (
                            <div className="w-full mt-2">
                                <p className="text-sm font-semibold text-blue-700 mb-2">{batchProgress.status}</p>
                                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                                    <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}></div>
                                </div>
                                <p className="text-xs text-gray-500">{batchProgress.current} de {batchProgress.total} Concluídos</p>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-600">Por favor, aguarde enquanto o sistema consolida a Estrutura da OP e anexa todos os Desenhos. Isso pode demorar alguns segundos e o download iniciará automaticamente.</p>
                        )}
                    </div>
                </div>
            )}
            {/* Header & Filtros */}
            <div className="p-4 border-b border-gray-100 bg-white print:hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Gestão de OPs por Lote</h2>
                        <p className="text-sm text-gray-500">Gerencie OPs e estabeleça lotes de liberação de produção</p>
                        {filters.only_active === 'true' && (
                            <div className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-md px-2 py-1 inline-flex items-center gap-1.5">
                                <AlertCircle className="h-3 w-3" />
                                <span>Visualizando apenas pedidos <strong>Ativos</strong> (não entregues) e <strong>Vendas</strong> (exclui orçamentos).</span>
                            </div>
                        )}
                    </div>

                    {/* View Mode Locked to Flat for OP Batch Processing */}
                </div>

                <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-10 gap-4 items-end">
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
                                aria-label={`Data final (${filters.dateType === 'pedido' ? 'Emissão Pedido' : 'Emiss��o NF'})`}
                                className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                                title={`Data final (${filters.dateType === 'pedido' ? 'Emissão Pedido' : 'Emissão NF'})`}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-medium text-gray-600 ml-1">Status:</label>
                        <select
                            name="only_active"
                            value={filters.only_active || 'true'}
                            onChange={handleFilterChange}
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium h-[42px]"
                        >
                            <option value="false">Todos</option>
                            <option value="true">Pendentes</option>
                        </select>
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

                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-medium text-gray-600 ml-1">Lote:</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                name="lote"
                                placeholder="Lote..."
                                value={filterLote}
                                onChange={(e) => setFilterLote(e.target.value)}
                                className="pl-10 w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium h-[42px]"
                            />
                        </div>
                    </div>

                    <div className="md:col-span-2 flex gap-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors flex items-center justify-center gap-2 h-[42px] flex-1 ${
                                loading ? 'bg-blue-400 cursor-not-allowed opacity-80 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            {loading ? 'Buscando...' : 'Filtrar'}
                        </button>

                        <button
                            type="button"
                            onClick={() => handleBatchPrintOPByOperationWithDrawings(flattenedFractionalOrders)}
                            disabled={downloadingPDF}
                            className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-medium rounded-lg text-sm px-3 py-2.5 text-center transition-colors flex items-center justify-center disabled:opacity-50 h-[42px] flex-1"
                            title="Imprimir Todos Lotes da Tela"
                        >
                            {downloadingPDF ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <>
                                    <Printer className="h-4 w-4 mr-1" /> Imprimir 
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Tab Navigation Removed - Locked to Evolução */}

            {/* Evolução Content */}
            {(
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
                                        <th scope="col" className="w-12 px-4 py-3 print:hidden"></th>
                                        <th className="px-4 py-3 font-semibold">Pedido</th>
                                        <th className="px-4 py-3 font-semibold text-center">Emissão</th>
                                        <th className="px-4 py-3 font-semibold">Ref. Cliente</th>
                                        <th className="px-4 py-3 font-semibold">Cliente</th>
                                        <th className="px-4 py-3 font-semibold">PC</th>
                                        <th className="px-4 py-3 font-semibold text-center w-8">It</th>
                                        <th className="px-4 py-3 font-semibold text-center">OP</th>
                                        <th className="px-4 py-3 font-semibold">Cód. Prod</th>
                                        <th className="px-4 py-3 font-semibold">Descrição</th>
                                        <th className="px-4 py-3 font-semibold text-right">Saldo Fat.</th>
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
                                        <td colSpan={colSpanCount} className="px-6 py-6 text-center">
                                            <ErrorStateOverlay error={error} onRetry={() => fetchData()} />
                                        </td>
                                    </tr>
                                ) : requiresFilter ? (
                                    <tr>
                                        <td colSpan={colSpanCount} className="px-6 py-16 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
                                                    <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>
                                                </div>
                                                <p className="text-gray-600 font-medium text-sm">Aplique ao menos um filtro para carregar os dados</p>
                                                <p className="text-gray-400 text-xs">Use Pedido, Cliente, Produto ou Per�odo de Emiss�o</p>
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
                                                                <button
                                                                    title="Consultar PCPMetal AI"
                                                                    onClick={(e) => { e.stopPropagation(); setPcpmetalContext(getAIContext(order)); setPcpmetalOpen(true); }}
                                                                    className="text-blue-400 hover:text-blue-700 transition-colors p-1 rounded hover:bg-blue-50"
                                                                >
                                                                    <Bot className="w-4 h-4" />
                                                                </button>
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
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {Array.isArray(orderItems[order.pedido]) && orderItems[order.pedido].length > 0 ? (
                                                                                        orderItems[order.pedido]
                                                                                            .filter(item => filters.only_active === 'false' || parseFloat(item.qtd_faturar || 0) > 0)
                                                                                            .map((item, i) => (
                                                                                                <tr key={`${order.pedido}-${item.item}-${i}`} className={`border-b border-gray-50 last:border-0 transition-colors ${parseFloat(item.qtd_faturar || 0) <= 0 ? 'bg-green-50/40 hover:bg-green-100/50 opacity-80' : 'hover:bg-gray-50/50'}`}>
                                                                                                    <td className="px-4 py-2">{item.item}</td>
                                                                                                    <td className="px-4 py-2 text-center text-xs font-mono bg-blue-50 text-blue-700 rounded px-1">{item.visual_op || item.op_num || '-'}</td>
                                                                                                    <td className="px-4 py-2 font-mono text-xs">
                                                                                                        <Link
                                                                                                            to={`/estrutura/${encodeURIComponent(item.codigo)}?pedido=${encodeURIComponent(item.pedido || order.pedido || '')}&item=${encodeURIComponent(item.item || '')}`}
                                                                                                            state={{ from: location.pathname }}
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
                                                                                                                            onClick={(e) => { handlePrintOPByOperation(order.pedido, e, item.item, item); setOpenActionMenu(null); }}
                                                                                                                            disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-oper-${order.pedido}-${item.item}`}
                                                                                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                                                                                        >
                                                                                                                            {printingOrderId === `op-oper-${order.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <Layers className="h-4 w-4 flex-shrink-0 text-blue-500" />}
                                                                                                                            <span>Por Operações (PDF)</span>
                                                                                                                        </button>
                                                                                                                        <button
                                                                                                                            onClick={(e) => { handlePrintOPByOperationWithDrawings(order.pedido, e, item.item, item); setOpenActionMenu(null); }}
                                                                                                                            disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-drawings-${order.pedido}-${item.item}`}
                                                                                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                                                                                        >
                                                                                                                            {printingOrderId === `op-drawings-${order.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ImageIcon className="h-4 w-4 flex-shrink-0 text-indigo-500" />}
                                                                                                                            <span>OP + Desenhos (PDF)</span>
                                                                                                                        </button>
                                                                                                                        <button
                                                                                                                            onClick={(e) => { handlePrintOPByResourceWithDrawings(order.pedido, e, item.item, item); setOpenActionMenu(null); }}
                                                                                                                            disabled={!item.op_num || item.op_num.trim() === '' || printingOrderId === `op-resource-drawings-${order.pedido}-${item.item}`}
                                                                                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-cyan-50 hover:text-cyan-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                                                                                        >
                                                                                                                            {printingOrderId === `op-resource-drawings-${order.pedido}-${item.item}` ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" /> : <ImageIcon className="h-4 w-4 flex-shrink-0 text-cyan-500" />}
                                                                                                                            <span>OP + Desenhos (Por Recurso)</span>
                                                                                                                        </button>
                                                                                                                        <button
                                                                                                                            onClick={(e) => { handlePrintOPWithOpsStampWithDrawings(order.pedido, e, item.item, item); setOpenActionMenu(null); }}
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
                                                                                                    <td className="px-4 py-2 text-right font-semibold">{item.visual_qtd ? parseFloat(item.visual_qtd).toLocaleString('pt-BR') : parseFloat(item.quantidade || 0).toLocaleString('pt-BR')}</td>
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
                                            <>
                                                {Object.keys(flatGrouped.ObjectGroups).map(lpf_codigo => (
                                                    <React.Fragment key={`lpf-${lpf_codigo}`}>
                                                        <tr className="bg-emerald-50 border-y-2 border-emerald-500">
                                                            <td colSpan={colSpanCount} className="px-4 py-3 border-l-4 border-emerald-500">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-3">
                                                                        <Lock className="w-5 h-5 text-emerald-600" />
                                                                        <div>
                                                                            <span className="font-bold text-emerald-900 shadow-sm leading-tight text-lg">Lote Aglutinado</span>
                                                                            <span className="ml-2 font-mono bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded text-sm font-semibold">{lpf_codigo}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <button
                                                                            onClick={() => handleReprintLPF(lpf_codigo, flatGrouped.ObjectGroups[lpf_codigo])}
                                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-full text-sm font-medium shadow-sm transition-all focus:ring-2 focus:ring-emerald-500 flex items-center gap-2"
                                                                        >
                                                                            <Printer className="w-4 h-4" /> REIMPRIMIR LOTE
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {flatGrouped.ObjectGroups[lpf_codigo].map(item => renderFlatRow(item, true))}
                                                    </React.Fragment>
                                                ))}
                                                {flatGrouped.ungrouped.map(item => renderFlatRow(item, false))}
                                            </>
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
                                    onClick={() => setPage(Math.max(1, page - 1))}
                                    disabled={page === 1}
                                    className="p-2 rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronLeft className="h-5 w-5 text-gray-600" />
                                </button>
                                <button
                                    onClick={() => setPage(Math.min(totalPages, page + 1))}
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

            {/* Floating Batch Actions Bar */}
            {selectedFractions.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 z-50 animate-fadeIn border border-slate-700">
                    <div className="flex items-center gap-2">
                        <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">{selectedFractions.size}</span>
                        <span className="font-semibold text-sm">itens selecionados</span>
                    </div>
                    <div className="h-6 w-px bg-slate-700"></div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleBatchPrintOPByOperationAglutinado()}
                            disabled={downloadingPDF}
                            className="bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-full text-sm px-4 py-2 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {downloadingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                            Lote Aglutinado (Resumido)
                        </button>
                        <button
                            onClick={() => handleBatchPrintOPByOperationWithDrawings()}
                            disabled={downloadingPDF}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-full text-sm px-4 py-2 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {downloadingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                            OP + Desenhos (Rastreabilidade)
                        </button>
                        <button
                            onClick={() => setSelectedFractions(new Set())}
                            className="text-slate-300 hover:text-white px-3 py-2 text-sm transition-colors"
                        >
                            Limpar
                        </button>
                    </div>
                </div>
            )}


            {/* Extra tabs removed */}

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
            {/* Modal de Liberação PCP (Lote Aglutinado) */}
            {pcpReleaseModal.open && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center gap-3 p-5 bg-gradient-to-r from-slate-800 to-slate-700">
                            <div className="p-2 bg-green-500 rounded-xl">
                                <Factory className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Lote Aglutinado</h2>
                                <p className="text-slate-300 text-xs">{pcpReleaseModal.targets.length} OP(s) selecionada(s)</p>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                            <p className="text-slate-600 text-sm">
                                Será gerado o PDF consolidado com capa, operações, resumo de materiais e desenhos.
                            </p>

                            {/* OPs resumo */}
                            <div className="bg-slate-50 rounded-xl p-3 max-h-32 overflow-y-auto border border-slate-100">
                                {pcpReleaseModal.targets.map((t, i) => (
                                    <div key={i} className="flex items-center gap-2 py-0.5">
                                        <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                                            {t.visual_op || t.op_num || t.pedido}
                                        </span>
                                        <span className="text-xs text-slate-500 truncate">{t.descricao || t.desc_produto || ''}</span>
                                        <span className="text-xs font-bold text-slate-700 ml-auto">{t.visual_qtd}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Checkbox opcional */}
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <div className="relative mt-0.5">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={pcpReleaseModal.registerRelease}
                                        onChange={e => setPcpReleaseModal(prev => ({ ...prev, registerRelease: e.target.checked }))}
                                    />
                                    <div className="w-5 h-5 rounded-md border-2 border-slate-300 peer-checked:bg-green-500 peer-checked:border-green-500 flex items-center justify-center transition-all">
                                        {pcpReleaseModal.registerRelease && (
                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-700">Registrar como Liberação para Produção</p>
                                    <p className="text-xs text-slate-400">O evento será registrado no Relatório de Liberação (Engenharia �� PCP)</p>
                                </div>
                            </label>
                        </div>

                        {/* Footer */}
                        <div className="flex gap-3 px-6 pb-6 pt-2">
                            <button
                                onClick={() => setPcpReleaseModal({ open: false, targets: [], registerRelease: true })}
                                className="flex-1 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all border border-slate-200"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => executeBatchPrintAglutinado(pcpReleaseModal.targets, pcpReleaseModal.registerRelease)}
                                className="flex-1 py-2.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-2"
                            >
                                <Factory className="w-4 h-4" />
                                Gerar PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div >
    );
};

export default GestaoOPsPage;
