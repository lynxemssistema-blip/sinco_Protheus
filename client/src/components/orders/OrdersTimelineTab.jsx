import React, { useState, useEffect, useMemo } from 'react';
import { 
    Calendar, Mail, Send, FileText, CheckCircle, AlertCircle, Loader2, 
    ChevronDown, ChevronRight, Download, Eye, EyeOff, LayoutGrid, ListFilter,
    User, Folder, Tag, X, Plus, Trash2, Database, Filter, FileSpreadsheet
} from 'lucide-react';
import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { api } from '../../services/api';
import { toast } from 'react-toastify';
import { logoBase64 } from '../../services/metalfisaLogoBase64';

export default function OrdersTimelineTab({ filters }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Configuration / View Settings
    const [viewMode, setViewMode] = useState('client'); // 'client' | 'order'
    const [progressSource, setProgressSource] = useState('granular'); // 'granular' | 'agregado' | 'faturamento'
    const [loadAll, setLoadAll] = useState(false); // quando true, ignora filtros e busca tudo do banco
    
    // Toggles for dates to show
    const [showPcpDate, setShowPcpDate] = useState(true);
    const [showComercialDate, setShowComercialDate] = useState(true);
    const [showBillingDate, setShowBillingDate] = useState(true);

    // Expanded Nodes State
    const [expandedNodes, setExpandedNodes] = useState({});

    // Email Modal State
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [selectedEmailTarget, setSelectedEmailTarget] = useState(null); // { type: 'client'|'order', name: string, email: string, items: [...] }
    const [emailTo, setEmailTo] = useState(['']);
    const [emailSubject, setEmailSubject] = useState('');
    const [emailMessage, setEmailMessage] = useState('');
    const [sendingEmail, setSendingEmail] = useState(false);

    // Fetch timeline data from backend
    const fetchTimelineData = async () => {
        setLoading(true);
        setError(null);
        try {
            // Quando loadAll=true, ignora todos os filtros e busca tudo do banco
            const params = loadAll
                ? { only_active: 'true' }
                : {
                    pedido: filters.pedido || '',
                    cliente: filters.cliente || '',
                    produto: filters.produto || '',
                    pedcli: filters.pedcli || '',
                    dataInicial: filters.dataInicial || '',
                    dataFinal: filters.dataFinal || '',
                    dateType: filters.dateType || 'entrega',
                    only_active: filters.only_active !== undefined ? String(filters.only_active) : 'true',
                    tipo_item: filters.tipo_item || '',
                    op_status: filters.op_status || '',
                    sortBy: filters.sortBy || 'emissao',
                    sortOrder: filters.sortOrder || 'DESC'
                };
            const res = await api.get('/pcp-refinado/cronograma', { params });
            setData(res.data || []);
        } catch (err) {
            console.error('Erro ao buscar dados do cronograma:', err);
            setError('Falha ao carregar os dados do cronograma. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTimelineData();
    }, [filters, loadAll]);

    // Helpers to parse & format dates
    const parseProtheusDate = (dateStr) => {
        if (!dateStr || dateStr.length !== 8) return null;
        const y = parseInt(dateStr.substring(0, 4), 10);
        const m = parseInt(dateStr.substring(4, 6), 10) - 1;
        const d = parseInt(dateStr.substring(6, 8), 10);
        return new Date(y, m, d);
    };

    const parseISOorSQLDate = (dateStr) => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
    };

    const formatDate = (date) => {
        if (!date) return '-';
        if (typeof date === 'string') {
            if (date.length === 8 && /^\d{8}$/.test(date)) {
                return `${date.substring(6,8)}/${date.substring(4,6)}/${date.substring(0,4)}`;
            }
            const d = new Date(date);
            if (!isNaN(d.getTime())) {
                return d.toLocaleDateString('pt-BR');
            }
            return date;
        }
        return date.toLocaleDateString('pt-BR');
    };

    // Calculate progression percentage for a single item
    const getItemProgress = (item) => {
        if (progressSource === 'granular') return item.progresso_granular || 0;
        if (progressSource === 'agregado') return item.progresso_agregado || 0;
        // Faturamento progress: qtd_faturada / qtd_vendida
        if (item.qtd_vendida <= 0) return 0;
        return Math.round(Math.min(100, (item.qtd_faturada / item.qtd_vendida) * 100));
    };

    // Compute relative dates metrics for timeline rendering
    const getTimelineMetrics = (item, emissionDateStr) => {
        const start = parseProtheusDate(emissionDateStr) || new Date();
        const comercial = parseProtheusDate(item.data_entrega);
        const pcp = parseISOorSQLDate(item.data_entrega_pcp);
        const billing = parseISOorSQLDate(item.data_prevista_faturamento);

        // End date is the latest date of the selected milestones (focused on PCP but checking all to scale properly)
        const dates = [];
        if (comercial) dates.push(comercial);
        if (pcp) dates.push(pcp);
        if (billing) dates.push(billing);

        let end = pcp || comercial || billing || new Date();
        if (dates.length > 0) {
            end = new Date(Math.max(...dates.map(d => d.getTime())));
        }

        // Add a 7-day buffer to the end date
        end.setDate(end.getDate() + 7);

        const totalMs = end.getTime() - start.getTime();
        const totalDays = Math.max(1, Math.round(totalMs / (1000 * 60 * 60 * 24)));

        const getPercent = (targetDate) => {
            if (!targetDate) return null;
            const diffMs = targetDate.getTime() - start.getTime();
            const pct = (diffMs / totalMs) * 100;
            return Math.max(0, Math.min(100, Math.round(pct)));
        };

        return {
            start,
            end,
            totalDays,
            comercialPct: getPercent(comercial),
            pcpPct: getPercent(pcp),
            billingPct: getPercent(billing),
            comercialDate: comercial,
            pcpDate: pcp,
            billingDate: billing
        };
    };

    // Grouping & Aggregation Logic
    const groupedData = useMemo(() => {
        if (viewMode === 'client') {
            const clientMap = {};
            data.forEach(p => {
                const cName = p.cliente || 'CLIENTE NÃO IDENTIFICADO';
                if (!clientMap[cName]) {
                    clientMap[cName] = {
                        name: cName,
                        email: p.cliente_email || '',
                        pedidos: []
                    };
                }
                clientMap[cName].pedidos.push(p);
            });

            return Object.values(clientMap).map(client => {
                // aggregate progress
                let totalItems = 0;
                let sumGranular = 0;
                let sumAgregado = 0;
                let sumFaturamento = 0;

                client.pedidos.forEach(p => {
                    p.itens.forEach(item => {
                        totalItems++;
                        sumGranular += item.progresso_granular || 0;
                        sumAgregado += item.progresso_agregado || 0;
                        if (item.qtd_vendida > 0) {
                            sumFaturamento += (item.qtd_faturada / item.qtd_vendida) * 100;
                        }
                    });
                });

                const count = totalItems || 1;
                return {
                    ...client,
                    progresso_granular: Math.round(sumGranular / count),
                    progresso_agregado: Math.round(sumAgregado / count),
                    progresso_faturamento: Math.round(sumFaturamento / count),
                    total_pedidos: client.pedidos.length,
                    total_itens: totalItems
                };
            }).sort((a, b) => a.name.localeCompare(b.name));
        } else {
            // Group by Order directly
            return data.map(p => {
                let totalItems = 0;
                let sumGranular = 0;
                let sumAgregado = 0;
                let sumFaturamento = 0;

                p.itens.forEach(item => {
                    totalItems++;
                    sumGranular += item.progresso_granular || 0;
                    sumAgregado += item.progresso_agregado || 0;
                    if (item.qtd_vendida > 0) {
                        sumFaturamento += (item.qtd_faturada / item.qtd_vendida) * 100;
                    }
                });

                const count = totalItems || 1;
                return {
                    ...p,
                    progresso_granular: Math.round(sumGranular / count),
                    progresso_agregado: Math.round(sumAgregado / count),
                    progresso_faturamento: Math.round(sumFaturamento / count),
                    total_itens: totalItems
                };
            });
        }
    }, [data, viewMode]);

    // Node Expansion togglers
    const toggleNode = (nodeId) => {
        setExpandedNodes(prev => ({
            ...prev,
            [nodeId]: !prev[nodeId]
        }));
    };

    // ── Cabeçalho padrão MetalFisa ──────────────────────────────────────────
    const drawCronogramaHeader = (doc, pageWidth, title, subtitle) => {
        const ML = 10, y0 = 6, BRAND_W = 42, HDR_H = 28;
        const LOGO_W = 14, LOGO_H = 14;

        // Bloco azul escuro com logo
        doc.setFillColor(30, 58, 95);
        doc.rect(ML, y0, BRAND_W, HDR_H, 'F');
        doc.addImage(logoBase64, 'PNG', ML + 2, y0 + 2, LOGO_W, LOGO_H);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text('METALFISA', ML + 18, y0 + 11);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.text('Metalúrgica Ltda', ML + 18, y0 + 15.5);

        // Bloco cinza claro com título
        doc.setFillColor(245, 247, 250);
        doc.rect(ML + BRAND_W, y0, pageWidth - ML - 10 - BRAND_W, HDR_H, 'F');
        const blockCenter = ML + BRAND_W + (pageWidth - ML - 10 - BRAND_W) / 2;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(30, 58, 95);
        doc.text(title, blockCenter, y0 + 10, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        doc.text(subtitle, blockCenter, y0 + 17, { align: 'center' });

        // Data emissão
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text(`Emissão: ${new Date().toLocaleString('pt-BR')}`, pageWidth - 10, y0 + 7, { align: 'right' });

        // Borda
        doc.setDrawColor(200, 210, 220);
        doc.setLineWidth(0.3);
        doc.rect(ML, y0, pageWidth - ML - 10, HDR_H);

        return y0 + HDR_H + 4;
    };

    // Generate PDF in MetalFisa standard format
    const generateTimelinePDF = (target) => {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageWidth  = doc.internal.pageSize.getWidth();  // 297
        const pageHeight = doc.internal.pageSize.getHeight(); // 210

        // Tipo de progresso para legenda
        const progressLabel = progressSource === 'granular'
            ? 'Apontamento Granular (Roteiro)'
            : progressSource === 'agregado'
                ? 'Apontamento Agregado (OP)'
                : 'Faturamento (Faturado vs Vendido)';

        // Título do relatório
        const titleMain = 'CRONOGRAMA DE ENTREGA E PRODUÇÃO';
        const titleSub  = target.type === 'client'
            ? `Cliente: ${target.name}  |  Progresso: ${progressLabel}`
            : target.type === 'all'
                ? `Filtros Ativos  |  Progresso: ${progressLabel}`
                : `Pedido: ${target.pedido || ''}  |  Cliente: ${target.cliente || ''}  |  Progresso: ${progressLabel}`;

        let startY = drawCronogramaHeader(doc, pageWidth, titleMain, titleSub);

        // Construir lista de itens
        const itemsList = [];
        if (target.type === 'client') {
            (target.pedidos || []).forEach(p => {
                (p.itens || []).forEach(it => {
                    itemsList.push({
                        pedido:              p.pedido,
                        ped_cliente:         it.pedido_cliente || '-',
                        cod_prod_cliente:     it.cod_prod_cliente || '-',
                        produto:             it.produto,
                        descricao:           it.descricao,
                        qtd_vendida:         it.qtd_vendida,
                        qtd_faturada:        it.qtd_faturada,
                        data_entrega:        formatDate(it.data_entrega),
                        data_pcp:            formatDate(it.data_entrega_pcp),
                        data_faturamento:    formatDate(it.data_prevista_faturamento),
                        progresso:           `${getItemProgress(it)}%`,
                    });
                });
            });
        } else if (target.type === 'all') {
            data.forEach(p => {
                (p.itens || []).forEach(it => {
                    itemsList.push({
                        pedido:              p.pedido,
                        ped_cliente:         it.pedido_cliente || '-',
                        cod_prod_cliente:     it.cod_prod_cliente || '-',
                        produto:             it.produto,
                        descricao:           it.descricao,
                        qtd_vendida:         it.qtd_vendida,
                        qtd_faturada:        it.qtd_faturada,
                        data_entrega:        formatDate(it.data_entrega),
                        data_pcp:            formatDate(it.data_entrega_pcp),
                        data_faturamento:    formatDate(it.data_prevista_faturamento),
                        progresso:           `${getItemProgress(it)}%`,
                    });
                });
            });
        } else {
            (target.itens || []).forEach(it => {
                itemsList.push({
                    pedido:              target.pedido,
                    ped_cliente:         it.pedido_cliente || '-',
                    cod_prod_cliente:     it.cod_prod_cliente || '-',
                    produto:             it.produto,
                    descricao:           it.descricao,
                    qtd_vendida:         it.qtd_vendida,
                    qtd_faturada:        it.qtd_faturada,
                    data_entrega:        formatDate(it.data_entrega),
                    data_pcp:            formatDate(it.data_entrega_pcp),
                    data_faturamento:    formatDate(it.data_prevista_faturamento),
                    progresso:           `${getItemProgress(it)}%`,
                });
            });
        }

        const columns = [
            { header: 'Pedido',              dataKey: 'pedido' },
            { header: 'Ped. Cliente',        dataKey: 'ped_cliente' },
            { header: 'Cód. Prod. Cliente',  dataKey: 'cod_prod_cliente' },
            { header: 'Produto',             dataKey: 'produto' },
            { header: 'Descrição',           dataKey: 'descricao' },
            { header: 'Qtd. Vendida',        dataKey: 'qtd_vendida' },
            { header: 'Qtd. Faturada',       dataKey: 'qtd_faturada' },
            { header: 'Entrega Comercial',   dataKey: 'data_entrega' },
            { header: 'Dt. PCP',             dataKey: 'data_pcp' },
            { header: 'Previsão Faturamento',dataKey: 'data_faturamento' },
            { header: 'Progresso',           dataKey: 'progresso' },
        ];

        autoTable(doc, {
            columns,
            body: itemsList,
            startY,
            theme: 'grid',
            headStyles: {
                fillColor: [30, 58, 95],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 7,
                halign: 'center',
            },
            bodyStyles: { fontSize: 7, cellPadding: 2, lineColor: [210, 215, 220] },
            alternateRowStyles: { fillColor: [248, 250, 253] },
            columnStyles: {
                ped_cliente:         { cellWidth: 22, halign: 'center' },
                cod_prod_cliente:    { cellWidth: 24, halign: 'center' },
                descricao:           { cellWidth: 44 },
                data_entrega:        { halign: 'center', cellWidth: 24 },
                data_pcp:            { halign: 'center', cellWidth: 20 },
                data_faturamento:    { halign: 'center', cellWidth: 26 },
                qtd_vendida:         { halign: 'right',  cellWidth: 18 },
                qtd_faturada:        { halign: 'right',  cellWidth: 18 },
                progresso:           { fontStyle: 'bold', halign: 'center', cellWidth: 18 },
            },
            margin: { left: 10, right: 10, bottom: 14 },
            didDrawPage: ({ pageNumber }) => {
                // Re-desenha cabeçalho em quebras automáticas
                if (pageNumber > 1) drawCronogramaHeader(doc, pageWidth, titleMain, titleSub);
                // Rodapé
                const totalPages = doc.internal.getNumberOfPages();
                doc.setFontSize(7);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(150, 150, 150);
                doc.text('MetalFisa — Cronograma de Entrega e Produção', 10, pageHeight - 5);
                doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - 10, pageHeight - 5, { align: 'right' });
            },
        });

        // Rodapé última página
        const pageCount = doc.internal.getNumberOfPages();
        doc.setPage(pageCount);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        doc.text('MetalFisa — Cronograma de Entrega e Produção', 10, pageHeight - 5);
        doc.text(`Página ${pageCount} de ${pageCount}`, pageWidth - 10, pageHeight - 5, { align: 'right' });

        return {
            blob:     doc.output('blob'),
            fileName: target.type === 'all' ? `Cronograma_Geral.pdf` : `Cronograma_${target.name || target.pedido}.pdf`,
        };
    };

    // Export Node / Group to Excel
    const exportNodeToExcel = (target, type) => {
        const itemsList = [];
        if (type === 'client') {
            (target.pedidos || []).forEach(p => {
                (p.itens || []).forEach(it => {
                    itemsList.push({
                        'Pedido': p.pedido,
                        'Cliente': target.name || '-',
                        'Ped. Cliente': it.pedido_cliente || '-',
                        'Cód. Prod. Cliente': it.cod_prod_cliente || '-',
                        'Produto': it.produto,
                        'Descrição': it.descricao,
                        'Qtd. Vendida': Number(it.qtd_vendida) || 0,
                        'Qtd. Faturada': Number(it.qtd_faturada) || 0,
                        'Entrega Comercial': formatDate(it.data_entrega),
                        'Dt. PCP': formatDate(it.data_entrega_pcp),
                        'Previsão Faturamento': formatDate(it.data_prevista_faturamento),
                        'Progresso': `${getItemProgress(it)}%`,
                    });
                });
            });
        } else if (type === 'all') {
            data.forEach(p => {
                (p.itens || []).forEach(it => {
                    itemsList.push({
                        'Pedido': p.pedido,
                        'Cliente': p.cliente || '-',
                        'Ped. Cliente': it.pedido_cliente || '-',
                        'Cód. Prod. Cliente': it.cod_prod_cliente || '-',
                        'Produto': it.produto,
                        'Descrição': it.descricao,
                        'Qtd. Vendida': Number(it.qtd_vendida) || 0,
                        'Qtd. Faturada': Number(it.qtd_faturada) || 0,
                        'Entrega Comercial': formatDate(it.data_entrega),
                        'Dt. PCP': formatDate(it.data_entrega_pcp),
                        'Previsão Faturamento': formatDate(it.data_prevista_faturamento),
                        'Progresso': `${getItemProgress(it)}%`,
                    });
                });
            });
        } else {
            (target.itens || []).forEach(it => {
                itemsList.push({
                    'Pedido': target.pedido,
                    'Cliente': target.cliente || '-',
                    'Ped. Cliente': it.pedido_cliente || '-',
                    'Cód. Prod. Cliente': it.cod_prod_cliente || '-',
                    'Produto': it.produto,
                    'Descrição': it.descricao,
                    'Qtd. Vendida': Number(it.qtd_vendida) || 0,
                    'Qtd. Faturada': Number(it.qtd_faturada) || 0,
                    'Entrega Comercial': formatDate(it.data_entrega),
                    'Dt. PCP': formatDate(it.data_entrega_pcp),
                    'Previsão Faturamento': formatDate(it.data_prevista_faturamento),
                    'Progresso': `${getItemProgress(it)}%`,
                });
            });
        }

        if (itemsList.length === 0) {
            toast.warning('Nenhum item válido para exportar.');
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(itemsList);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Cronograma');

        // Auto-size columns slightly
        worksheet['!cols'] = [
            { wch: 15 }, // Pedido
            { wch: 35 }, // Cliente
            { wch: 18 }, // Ped. Cliente
            { wch: 22 }, // Cód. Prod. Cliente
            { wch: 20 }, // Produto
            { wch: 45 }, // Descrição
            { wch: 15 }, // Qtd. Vendida
            { wch: 15 }, // Qtd. Faturada
            { wch: 20 }, // Entrega Comercial
            { wch: 15 }, // Dt. PCP
            { wch: 22 }, // Previsão Faturamento
            { wch: 12 }, // Progresso
        ];

        const fileName = type === 'all' ? `Cronograma_Geral.xlsx` : `Cronograma_${target.name || target.pedido}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        toast.success('Cronograma exportado para Excel!');
    };

    // Open Email Modal and set target
    const handleOpenEmailModal = (node, type) => {
        let emailAddress = '';
        let targetName = '';
        let targetItems = [];

        if (type === 'client') {
            emailAddress = node.email || '';
            targetName = node.name;
            targetItems = node.pedidos;
        } else {
            emailAddress = node.cliente_email || '';
            targetName = node.pedido;
            targetItems = [node];
        }

        setSelectedEmailTarget({ type, name: targetName, email: emailAddress, rawNode: node });
        setEmailTo([emailAddress || '']);
        setEmailSubject(`Cronograma de Entrega / Produção - ${targetName}`);
        setEmailMessage(`Prezado Cliente,\n\nSegue em anexo o cronograma de entrega e progresso de produção dos seus pedidos na MetalFisa.\n\nQualquer dúvida, estamos à disposição.\n\nAtenciosamente,\nPlanejamento de Produção - MetalFisa`);
        setEmailModalOpen(true);
    };

    // Send the email with the generated PDF attachment
    const handleSendEmail = async () => {
        if (emailTo.some(e => !e.trim())) {
            toast.error('Por favor, preencha todos os destinatários de e-mail.');
            return;
        }
        setSendingEmail(true);

        try {
            // 1. Generate PDF Blob
            const pdfData = generateTimelinePDF({
                type: selectedEmailTarget.type,
                name: selectedEmailTarget.type === 'client' ? selectedEmailTarget.name : null,
                pedido: selectedEmailTarget.type === 'order' ? selectedEmailTarget.name : null,
                cliente: selectedEmailTarget.type === 'order' ? selectedEmailTarget.rawNode.cliente : null,
                pedidos: selectedEmailTarget.type === 'client' ? selectedEmailTarget.rawNode.pedidos : null,
                itens: selectedEmailTarget.type === 'order' ? selectedEmailTarget.rawNode.itens : null,
            });

            // 2. Build FormData
            const formData = new FormData();
            formData.append('to', emailTo.filter(e => e.trim()).join(','));
            formData.append('subject', emailSubject);
            formData.append('html', `<p>${emailMessage.replace(/\n/g, '<br/>')}</p>`);
            formData.append('text', emailMessage);
            formData.append('attachments', pdfData.blob, pdfData.fileName);

            // 3. Dispatch POST to /email/send
            await api.post('/email/send', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.success('Solicitação de envio de cronograma enviada com sucesso!');
            setEmailModalOpen(false);
        } catch (err) {
            console.error('Erro ao enviar e-mail com cronograma:', err);
            toast.error('Falha ao enviar e-mail. Verifique a configuração SMTP.');
        } finally {
            setSendingEmail(false);
        }
    };

    // Render single progress bar timeline
    const renderTimelineBar = (item, emissionDateStr) => {
        const metrics = getTimelineMetrics(item, emissionDateStr);
        const progress = getItemProgress(item);

        return (
            <div className="flex flex-col w-full gap-2 p-3 bg-gray-50/50 border border-gray-100 rounded-lg">
                <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-gray-400" /> Emissão: {formatDate(emissionDateStr)}</span>
                    <span className="font-semibold text-gray-700">Progresso: {progress}%</span>
                </div>
                
                {/* Gantt track */}
                <div className="relative w-full h-4 bg-gray-200/70 rounded-full border border-gray-300 overflow-visible mt-2">
                    {/* Fill progress */}
                    <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out shadow-inner"
                        style={{ width: `${progress}%` }}
                    />

                    {/* Milestone Pin: Comercial Date */}
                    {showComercialDate && metrics.comercialPct !== null && (
                        <div 
                            className="absolute top-1/2 -translate-y-1/2 group"
                            style={{ left: `${metrics.comercialPct}%` }}
                        >
                            <div className="w-3.5 h-3.5 bg-blue-600 rounded-full border-2 border-white shadow cursor-pointer transform -translate-x-1/2 hover:scale-125 transition-transform" />
                            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                                Comercial: {formatDate(metrics.comercialDate)}
                            </div>
                        </div>
                    )}

                    {/* Milestone Pin: PCP Date */}
                    {showPcpDate && metrics.pcpPct !== null && (
                        <div 
                            className="absolute top-1/2 -translate-y-1/2 group"
                            style={{ left: `${metrics.pcpPct}%` }}
                        >
                            <div className="w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-white shadow cursor-pointer transform -translate-x-1/2 hover:scale-125 transition-transform" />
                            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                                PCP: {formatDate(metrics.pcpDate)}
                            </div>
                        </div>
                    )}

                    {/* Milestone Pin: Previsão de Faturamento */}
                    {showBillingDate && metrics.billingPct !== null && (
                        <div 
                            className="absolute top-1/2 -translate-y-1/2 group"
                            style={{ left: `${metrics.billingPct}%` }}
                        >
                            <div className="w-3.5 h-3.5 bg-indigo-600 rounded-full border-2 border-white shadow cursor-pointer transform -translate-x-1/2 hover:scale-125 transition-transform" />
                            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                                Fat. Previsto: {formatDate(metrics.billingDate)}
                            </div>
                        </div>
                    )}
                </div>

                {/* Subtext info */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500 mt-1">
                    {showComercialDate && metrics.comercialDate && (
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600" /> Entrega Comercial: {formatDate(metrics.comercialDate)}</span>
                    )}
                    {showPcpDate && metrics.pcpDate && (
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Dt. PCP: {formatDate(metrics.pcpDate)}</span>
                    )}
                    {showBillingDate && metrics.billingDate && (
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-600" /> Previsão Faturamento: {formatDate(metrics.billingDate)}</span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col flex-1 h-full bg-gray-50/30 overflow-hidden">
            
            {/* Header Control Panel */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-gray-200 bg-white">
                <div className="flex items-center gap-3">
                    <div className="flex border border-gray-300 rounded shadow-sm bg-gray-50 p-0.5">
                        <button
                            onClick={() => setViewMode('client')}
                            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition-colors ${viewMode === 'client' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <User className="w-3.5 h-3.5" />
                            Por Cliente
                        </button>
                        <button
                            onClick={() => setViewMode('order')}
                            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition-colors ${viewMode === 'order' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Folder className="w-3.5 h-3.5" />
                            Por Pedido
                        </button>
                    </div>

                    <div className="flex items-center gap-2 border-l pl-3 border-gray-200">
                        <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Calcular Progresso por:</label>
                        <select
                            value={progressSource}
                            onChange={(e) => setProgressSource(e.target.value)}
                            className="text-xs border border-gray-300 rounded p-1 shadow-sm focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="granular">Apontamentos Granular (Operações)</option>
                            <option value="agregado">Apontamentos Agregado (OP)</option>
                            <option value="faturamento">Faturamento (Faturado vs Vendido)</option>
                        </select>
                    </div>
                </div>

                {/* Milestones toggles */}
                <div className="flex items-center gap-4 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-xs">
                    <span className="font-semibold text-gray-500">Exibir Marcos:</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={showComercialDate} 
                            onChange={() => setShowComercialDate(!showComercialDate)}
                            className="rounded text-blue-600 focus:ring-0 w-3.5 h-3.5"
                        />
                        <span className="text-blue-700 font-medium">Comercial</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={showPcpDate} 
                            onChange={() => setShowPcpDate(!showPcpDate)}
                            className="rounded text-amber-600 focus:ring-0 w-3.5 h-3.5"
                        />
                        <span className="text-amber-700 font-medium">PCP</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={showBillingDate} 
                            onChange={() => setShowBillingDate(!showBillingDate)}
                            className="rounded text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                        />
                        <span className="text-indigo-700 font-medium">Faturamento</span>
                    </label>
                </div>

                <div className="flex items-center gap-2">
                    {/* Toggle: Todos do banco vs filtro atual */}
                    <button
                        onClick={() => setLoadAll(v => !v)}
                        title={loadAll ? 'Clique para usar somente os filtros atuais' : 'Clique para carregar TODOS os pedidos ativos do banco, ignorando filtros'}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-semibold active:scale-[0.98] transition-all shadow-sm ${
                            loadAll
                                ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700'
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        {loadAll ? <Database className="w-3.5 h-3.5" /> : <Filter className="w-3.5 h-3.5" />}
                        {loadAll ? 'Todos do Banco' : 'Filtro Atual'}
                    </button>

                    <button
                        onClick={() => {
                            if (data.length === 0) {
                                toast.warning('Nenhum dado para exportar.');
                                return;
                            }
                            const docResult = generateTimelinePDF({ type: 'all' });
                            const link = document.createElement('a');
                            link.href = URL.createObjectURL(docResult.blob);
                            link.download = docResult.fileName;
                            link.click();
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 active:scale-[0.98] rounded shadow-sm transition-all"
                        title="Baixar Cronograma Geral em PDF"
                    >
                        <Download className="w-3.5 h-3.5" />
                        PDF Geral
                    </button>

                    <button
                        onClick={() => {
                            if (data.length === 0) {
                                toast.warning('Nenhum dado para exportar.');
                                return;
                            }
                            exportNodeToExcel(null, 'all');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-white border border-emerald-300 hover:bg-emerald-50 active:scale-[0.98] rounded shadow-sm transition-all"
                        title="Exportar Cronograma Geral para Excel"
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Excel Geral
                    </button>
                </div>
            </div>

            {/* Content Table / Tree */}
            <div className="flex-1 overflow-auto p-4 min-h-0">

                {/* Banner de aviso quando modo "todos do banco" está ativo */}
                {loadAll && !loading && (
                    <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-800 font-medium">
                        <Database className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span>
                            Modo <strong>Todos do Banco</strong> ativo — exibindo todos os pedidos ativos ({data.length} pedidos). Os filtros da barra superior estão sendo ignorados.
                        </span>
                        <button onClick={() => setLoadAll(false)} className="ml-auto text-indigo-600 hover:text-indigo-900 underline whitespace-nowrap">
                            Voltar aos filtros
                        </button>
                    </div>
                )}

                {loading && (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        <span>Carregando dados do cronograma...</span>
                    </div>
                )}

                {error && (
                    <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {!loading && !error && groupedData.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500 bg-white border rounded-xl shadow-sm">
                        <Calendar className="w-12 h-12 text-gray-300 mb-2" />
                        <span className="font-medium">Nenhum pedido correspondente encontrado.</span>
                        <span className="text-xs text-gray-400 mt-1">Ajuste os filtros de pesquisa acima para expandir os resultados.</span>
                    </div>
                )}

                {!loading && !error && groupedData.length > 0 && (
                    <div className="flex flex-col gap-3">
                        {groupedData.map((node, index) => {
                            const nodeId = viewMode === 'client' ? node.name : node.pedido;
                            const isExpanded = !!expandedNodes[nodeId];
                            const aggProgress = progressSource === 'granular' ? node.progresso_granular : progressSource === 'agregado' ? node.progresso_agregado : node.progresso_faturamento;

                            return (
                                <div key={nodeId} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                                    {/* Parent Node Header */}
                                    <div className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100/70 transition-colors cursor-pointer" onClick={() => toggleNode(nodeId)}>
                                        <div className="flex items-center gap-3">
                                            {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-800">
                                                    {viewMode === 'client' ? node.name : `Pedido: ${node.pedido}`}
                                                </span>
                                                <span className="text-xs text-gray-500 flex items-center gap-2">
                                                    {viewMode === 'client' ? (
                                                        <>
                                                            <span>{node.total_pedidos} Pedido(s)</span> • 
                                                            <span>{node.total_itens} Itens</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span>Cliente: {node.cliente}</span> • 
                                                            <span>{node.total_itens} Itens</span>
                                                        </>
                                                    )}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6" onClick={e => e.stopPropagation()}>
                                            {/* Progress info */}
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-xs font-semibold text-gray-500">Progresso Geral</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${aggProgress}%` }} />
                                                    </div>
                                                    <span className="text-xs font-bold text-gray-800">{aggProgress}%</span>
                                                </div>
                                            </div>

                                            {/* Action buttons */}
                                            <div className="flex items-center gap-2 border-l pl-4 border-gray-200">
                                                <button
                                                    onClick={() => handleOpenEmailModal(node, viewMode)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 hover:text-blue-800 rounded shadow-sm transition-colors"
                                                    title="Enviar Cronograma para o Cliente"
                                                >
                                                    <Mail className="w-3.5 h-3.5" />
                                                    Enviar
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const docResult = generateTimelinePDF({
                                                            type: viewMode,
                                                            name: viewMode === 'client' ? node.name : null,
                                                            pedido: viewMode === 'order' ? node.pedido : null,
                                                            cliente: viewMode === 'order' ? node.cliente : null,
                                                            pedidos: viewMode === 'client' ? node.pedidos : null,
                                                            itens: viewMode === 'order' ? node.itens : null,
                                                        });
                                                        const link = document.createElement('a');
                                                        link.href = URL.createObjectURL(docResult.blob);
                                                        link.download = docResult.fileName;
                                                        link.click();
                                                    }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded shadow-sm transition-colors"
                                                    title="Baixar Cronograma em PDF"
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                    PDF
                                                </button>
                                                <button
                                                    onClick={() => exportNodeToExcel(node, viewMode)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded shadow-sm transition-colors"
                                                    title="Exportar para Excel"
                                                >
                                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                                    Excel
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Node Details */}
                                    {isExpanded && (
                                        <div className="border-t border-gray-100 divide-y divide-gray-100 bg-white">
                                            {viewMode === 'client' ? (
                                                node.pedidos.map(p => (
                                                    <div key={p.pedido} className="p-4">
                                                        <h4 className="text-xs font-bold text-gray-600 mb-3 flex items-center gap-1">
                                                            <Folder className="w-3.5 h-3.5" /> Pedido: {p.pedido}
                                                        </h4>
                                                        <div className="pl-4 flex flex-col gap-4">
                                                            {p.itens.map(item => (
                                                                <div key={item.item} className="grid grid-cols-1 md:grid-cols-12 items-center gap-4 border-b border-gray-50 pb-3 last:border-b-0 last:pb-0">
                                                                    <div className="md:col-span-4 flex flex-col gap-0.5">
                                                                        <span className="text-xs font-bold text-gray-800">{item.produto}</span>
                                                                        <span className="text-xs text-gray-500 truncate max-w-sm" title={item.descricao}>{item.descricao}</span>
                                                                        <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1">
                                                                            <span>Qtd. Vendida: {item.qtd_vendida}</span> •
                                                                            <span>Já Faturada: {item.qtd_faturada}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="md:col-span-8">
                                                                        {renderTimelineBar(item, p.data_emissao)}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                node.itens.map(item => (
                                                    <div key={item.item} className="grid grid-cols-1 md:grid-cols-12 items-center gap-4 p-4 hover:bg-gray-50/50 transition-colors">
                                                        <div className="md:col-span-4 flex flex-col gap-0.5">
                                                            <span className="text-xs font-bold text-gray-800">{item.produto}</span>
                                                            <span className="text-xs text-gray-500 truncate max-w-sm" title={item.descricao}>{item.descricao}</span>
                                                            <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1">
                                                                <span>Qtd. Vendida: {item.qtd_vendida}</span> •
                                                                <span>Já Faturada: {item.qtd_faturada}</span>
                                                            </div>
                                                        </div>
                                                        <div className="md:col-span-8">
                                                            {renderTimelineBar(item, node.data_emissao)}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Email Dispatch Confirmation Modal */}
            {emailModalOpen && selectedEmailTarget && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl border border-gray-100 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 bg-gray-900 text-white">
                            <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-2">
                                <Mail className="w-4 h-4 text-emerald-400" />
                                Enviar Cronograma por E-mail
                            </h3>
                            <button onClick={() => setEmailModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Destinatário</label>
                                <span className="text-[11px] text-gray-400 block mb-2">Preencha um ou mais e-mails. Pressione o botão para adicionar outros.</span>
                                
                                <div className="flex flex-col gap-2">
                                    {emailTo.map((email, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setEmailTo(prev => prev.map((item, i) => i === idx ? val : item));
                                                }}
                                                placeholder="exemplo@cliente.com.br"
                                                className="flex-1 text-xs border border-gray-300 rounded px-3 py-2 shadow-sm focus:ring-1 focus:ring-blue-500"
                                            />
                                            {emailTo.length > 1 && (
                                                <button 
                                                    onClick={() => setEmailTo(prev => prev.filter((_, i) => i !== idx))}
                                                    className="p-2 text-red-500 hover:bg-red-50 border border-red-200 rounded transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => setEmailTo(prev => [...prev, ''])}
                                        className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 mt-1 self-start"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Adicionar e-mail
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Assunto do E-mail</label>
                                <input
                                    type="text"
                                    value={emailSubject}
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                    className="w-full text-xs border border-gray-300 rounded px-3 py-2 shadow-sm focus:ring-1 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mensagem Customizada</label>
                                <textarea
                                    value={emailMessage}
                                    onChange={(e) => setEmailMessage(e.target.value)}
                                    rows={4}
                                    className="w-full text-xs border border-gray-300 rounded px-3 py-2 shadow-sm focus:ring-1 focus:ring-blue-500"
                                />
                            </div>

                            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>O cronograma formatado em PDF será anexado automaticamente a esta mensagem.</span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
                            <button
                                onClick={() => setEmailModalOpen(false)}
                                className="px-4 py-2 text-xs font-semibold border rounded hover:bg-gray-100 transition-colors"
                                disabled={sendingEmail}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSendEmail}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 rounded shadow transition-colors"
                                disabled={sendingEmail}
                            >
                                {sendingEmail ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-3.5 h-3.5" />
                                        Disparar E-mail
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
