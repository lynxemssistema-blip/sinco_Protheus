import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { logoBase64 } from './metalfisaLogoBase64';

// Layout Constants
const ML = 8;
const MR = 8;
const HDR_H = 22;
const BRAND_W = 44;
const LOGO_W = 12;
const LOGO_H = 12;

// Draw standard MetalFisa Header for PDF
const drawHeader = (doc, pageWidth, title, subtitle = '') => {
    const y0 = 5;

    // Dark Navy Blue Brand Block ([30, 58, 95] - #1E3A5F)
    doc.setFillColor(30, 58, 95);
    doc.rect(ML, y0, BRAND_W, HDR_H, 'F');
    if (logoBase64) {
        try {
            doc.addImage(logoBase64, 'PNG', ML + 2, y0 + 2, LOGO_W, LOGO_H);
        } catch (e) {}
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('METALFISA', ML + 16, y0 + 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('Metalúrgica Ltda', ML + 16, y0 + 13.5);

    // Light Gray Title Block (#F5F7FA)
    doc.setFillColor(245, 247, 250);
    doc.rect(ML + BRAND_W, y0, pageWidth - ML - MR - BRAND_W, HDR_H, 'F');

    const blockCenter = ML + BRAND_W + (pageWidth - ML - MR - BRAND_W) / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(30, 58, 95);
    doc.text(title, blockCenter, y0 + 8.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.text(subtitle, blockCenter, y0 + 15.5, { align: 'center' });

    // Date (right corner)
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`Emissão: ${new Date().toLocaleString('pt-BR')}`, pageWidth - MR - 2, y0 + 5.5, { align: 'right' });

    // Border
    doc.setDrawColor(200, 210, 220);
    doc.setLineWidth(0.3);
    doc.rect(ML, y0, pageWidth - ML - MR, HDR_H);

    return y0 + HDR_H + 4;
};

// Formatter helpers
const formatNum = (val) => {
    if (val == null || val === '' || isNaN(val)) return '-';
    return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const formatDate = (val) => {
    if (!val) return '-';
    const str = String(val).trim();
    if (str.length === 8 && !str.includes('-')) {
        return `${str.substring(6, 8)}/${str.substring(4, 6)}/${str.substring(0, 4)}`;
    }
    if (str.includes('-')) {
        const parts = str.split('T')[0].split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return str;
};

const buildFilterLabel = (filterParams = {}) => {
    const parts = [];
    if (filterParams.cliente) parts.push(`Cliente: ${filterParams.cliente}`);
    if (filterParams.pedido) parts.push(`Pedido: ${filterParams.pedido}`);
    if (filterParams.produto) parts.push(`Produto: ${filterParams.produto}`);
    const prio = filterParams.prioridade || filterParams.somente_prioridades;
    if (prio && prio !== 'false') parts.push(`Prioridade: Grupo ${prio}`);
    if (filterParams.only_active === 'true') parts.push(`Apenas Ativos`);
    return parts.length > 0 ? parts.join(' | ') : 'Todos os Registros';
};

/**
 * EXPORT TO EXCEL (.XLSX) — ESTILO METALFISA
 * Exports multi-sheet Excel file with official headers and formatting
 */
export const exportMasterSheetExcel = (data, filterParams = {}) => {
    if (!data) throw new Error('Nenhum dado disponível para exportar.');

    const wb = XLSX.utils.book_new();
    const filterLabel = buildFilterLabel(filterParams);
    const dateStr = new Date().toLocaleString('pt-BR');

    const createMetalFisaSheet = (title, headerRow, dataRows) => {
        const metaHeader = [
            ['METALFISA METALÚRGICA LTDA — SISTEMA DE GESTÃO INTEGRADO'],
            [`RELATÓRIO: ${title.toUpperCase()}`],
            [`Data de Emissão: ${dateStr}  |  Filtros Aplicados: ${filterLabel}`],
            [], // linha em branco
            headerRow,
            ...dataRows
        ];

        const ws = XLSX.utils.aoa_to_sheet(metaHeader);

        // Auto-fit column widths
        const colWidths = headerRow.map((h, colIdx) => {
            let maxLen = String(h).length;
            dataRows.forEach(row => {
                const cellVal = row[colIdx] != null ? String(row[colIdx]) : '';
                if (cellVal.length > maxLen) maxLen = cellVal.length;
            });
            return { wch: Math.min(Math.max(maxLen + 3, 10), 50) };
        });
        ws['!cols'] = colWidths;

        return ws;
    };

    // 1. Aba: Resumo
    if (data.resumo && data.resumo.length > 0) {
        const resumoHeader = ['Produto', 'Descrição', 'UM', 'Qtd Total a Produzir'];
        const resumoRows = data.resumo.map(r => [
            r.produto,
            r.descricao || '-',
            r.um || '-',
            Number(r.qtd_total || 0)
        ]);
        const wsResumo = createMetalFisaSheet('Resumo de Produtos', resumoHeader, resumoRows);
        XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');
    }

    // 2. Aba: Pedidos
    if (data.pedidos && data.pedidos.length > 0) {
        const pedHeader = ['Pedido', 'Emissão', 'Cliente', 'Qtde Itens', 'Qtd Total Pedido', 'Início PCP', 'Fim PCP'];
        const pedRows = data.pedidos.map(p => [
            p.pedido,
            formatDate(p.emissao),
            p.cliente,
            Number(p.item_count || 0),
            Number(p.soma_qtd || 0),
            formatDate(p.pcp_inicio),
            formatDate(p.pcp_fim)
        ]);
        const wsPedidos = createMetalFisaSheet('Lista de Pedidos', pedHeader, pedRows);
        XLSX.utils.book_append_sheet(wb, wsPedidos, 'Pedidos');
    }

    // 3. Aba: Itens Detalhados (com Grupo de Prioridade!)
    if (data.itens && data.itens.length > 0) {
        const itensHeader = [
            'Pedido', 'Cliente', 'Item', 'Produto', 'Descrição', 'UM',
            'Grupo Prioridade', 'Qtd Pedido', 'Qtd Faturada', 'Qtd Faturar',
            'Entrega', 'Data PCP', 'Nova Data PCP', 'OP', 'Ped. Cliente'
        ];
        const itensRows = data.itens.map(i => [
            i.pedido,
            i.cliente,
            i.item,
            i.produto,
            i.descricao || '-',
            i.um || '-',
            i.op_prioridade ? `Grupo ${i.op_prioridade}` : '-',
            Number(i.qtd || 0),
            Number(i.qtd_entreg || 0),
            Number(i.qtd_faturar || 0),
            formatDate(i.entrega),
            formatDate(i.data_pcp),
            formatDate(i.nova_data_pcp),
            i.op || '-',
            i.ped_cli || '-'
        ]);
        const wsItens = createMetalFisaSheet('Itens Detalhados com Prioridade', itensHeader, itensRows);
        XLSX.utils.book_append_sheet(wb, wsItens, 'Itens Detalhados');
    }

    // 4. Aba: Estrutura BOM
    if (data.estruturas && data.estruturas.length > 0) {
        const bomHeader = ['Produto Pai (Raiz)', 'Componente', 'Descrição Componente', 'UM', 'Tipo', 'Qtd Unitária'];
        const bomRows = data.estruturas.map(b => [
            b.raiz,
            b.comp,
            b.desc || '-',
            b.um || '-',
            b.tipo || '-',
            Number(b.quant || 0)
        ]);
        const wsBom = createMetalFisaSheet('Estrutura de Produtos (BOM)', bomHeader, bomRows);
        XLSX.utils.book_append_sheet(wb, wsBom, 'Estrutura BOM');
    }

    // 5. Aba: Carga por Recurso
    if (data.carga && data.carga.length > 0 && data.recursos) {
        const cargaHeader = ['Pedido', 'Cliente', 'Item', 'Produto', 'Qtd Faturar', ...data.recursos.map(r => `Rec ${r} (min)`)];
        const cargaRows = data.carga.map(c => [
            c.pedido,
            c.cliente,
            c.item,
            c.produto,
            Number(c.qtd_faturar || 0),
            ...data.recursos.map(r => Number(c['rec_' + r] || 0))
        ]);
        const wsCarga = createMetalFisaSheet('Carga por Recurso de Máquina', cargaHeader, cargaRows);
        XLSX.utils.book_append_sheet(wb, wsCarga, 'Carga por Recurso');
    }

    const fileName = `Planilha_Mestra_MetalFisa_${getTodayDateStr()}.xlsx`;
    XLSX.writeFile(wb, fileName);
};

/**
 * EXPORT TO PDF (.PDF) — ESTILO METALFISA
 * Exports Planilha Mestra data into formatted PDF report
 */
export const exportMasterSheetPdf = (data, activeTab = 'itens', filterParams = {}) => {
    if (!data) throw new Error('Nenhum dado disponível para exportar.');

    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const filterLabel = buildFilterLabel(filterParams);

    let tabLabel = 'Relatório Geral';
    let headers = [];
    let rows = [];

    if (activeTab === 'resumo' && data.resumo) {
        tabLabel = 'Resumo de Produtos a Produzir';
        headers = [['Produto', 'Descrição', 'UM', 'Qtd Total a Produzir']];
        rows = data.resumo.map(r => [r.produto, r.descricao || '-', r.um || '-', formatNum(r.qtd_total)]);
    } else if (activeTab === 'pedidos' && data.pedidos) {
        tabLabel = 'Lista de Pedidos de Venda';
        headers = [['Pedido', 'Emissão', 'Cliente', 'Qtde Itens', 'Qtd Total Pedido', 'Início PCP', 'Fim PCP']];
        rows = data.pedidos.map(p => [p.pedido, formatDate(p.emissao), p.cliente, p.item_count, formatNum(p.soma_qtd), formatDate(p.pcp_inicio), formatDate(p.pcp_fim)]);
    } else if (activeTab === 'estruturas' && data.estruturas) {
        tabLabel = 'Estrutura dos Produtos (Engenharia BOM)';
        headers = [['Produto Pai (Raiz)', 'Componente', 'Descrição Componente', 'UM', 'Tipo', 'Qtd Unitária']];
        rows = data.estruturas.map(b => [b.raiz, b.comp, b.desc || '-', b.um || '-', b.tipo || '-', formatNum(b.quant)]);
    } else {
        // Default: Itens Detalhados com Prioridades
        tabLabel = 'Itens Detalhados com Grupos de Prioridades';
        headers = [['Pedido', 'Cliente', 'Item', 'Produto', 'Descrição', 'UM', 'Prioridade', 'Qtd Pedido', 'Qtd Faturar', 'Entrega', 'Nova Data PCP']];
        rows = (data.itens || []).map(i => [
            i.pedido,
            i.cliente,
            i.item,
            i.produto,
            i.descricao || '-',
            i.um || '-',
            i.op_prioridade ? `Grupo ${i.op_prioridade}` : '-',
            formatNum(i.qtd),
            formatNum(i.qtd_faturar),
            formatDate(i.entrega),
            formatDate(i.nova_data_pcp) || '-'
        ]);
    }

    const startY = drawHeader(doc, pageWidth, 'Planilha Mestra - Planejamento S&OP', `Visualização: ${tabLabel}  |  ${filterLabel}`);

    autoTable(doc, {
        startY: startY,
        head: headers,
        body: rows,
        styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [30, 58, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: ML, right: MR },
        didParseCell: (cellData) => {
            // Apply priority badge colors in PDF column 'Prioridade'
            if (cellData.section === 'body' && cellData.column.index === 6 && activeTab === 'itens') {
                const val = String(cellData.cell.raw || '');
                if (val.includes('Grupo 1')) {
                    cellData.cell.styles.fillColor = [254, 226, 226]; // Soft red
                    cellData.cell.styles.textColor = [185, 28, 28]; // Red bold
                    cellData.cell.styles.fontStyle = 'bold';
                } else if (val.includes('Grupo 2')) {
                    cellData.cell.styles.fillColor = [255, 237, 213]; // Soft orange
                    cellData.cell.styles.textColor = [194, 65, 12]; // Orange bold
                    cellData.cell.styles.fontStyle = 'bold';
                } else if (val.includes('Grupo 3')) {
                    cellData.cell.styles.fillColor = [254, 249, 195]; // Soft yellow
                    cellData.cell.styles.textColor = [161, 98, 7]; // Yellow bold
                    cellData.cell.styles.fontStyle = 'bold';
                } else if (val.includes('Grupo')) {
                    cellData.cell.styles.fillColor = [219, 234, 254]; // Soft blue
                    cellData.cell.styles.textColor = [29, 78, 216]; // Blue bold
                    cellData.cell.styles.fontStyle = 'bold';
                }
            }
        },
        didDrawPage: (d) => {
            // Footer
            doc.setFontSize(7);
            doc.setTextColor(140, 140, 140);
            doc.text(`Página ${d.pageNumber}`, pageWidth - MR, pageHeight - 4.5, { align: 'right' });
            doc.text('MetalFisa System — Sistema Integrado de Gestão & Planejamento S&OP', ML, pageHeight - 4.5);
        }
    });

    const fileName = `Planilha_Mestra_MetalFisa_${activeTab}_${getTodayDateStr()}.pdf`;
    doc.save(fileName);
};

const getTodayDateStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
