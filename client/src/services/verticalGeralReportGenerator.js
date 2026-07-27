/**
 * verticalGeralReportGenerator.js
 * Relatório Geral — Fila de Produção por Setor (Vertical)
 * PDF A4 Landscape — padrão MetalFisa + Excel
 */
import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { logoBase64 } from './metalfisaLogoBase64';

const ML = 8;
const MR = 8;
const HDR_H = 20;

const formatDate = (dStr) => {
    if (!dStr) return '-';
    try {
        const s = typeof dStr === 'string' ? dStr.substring(0, 10) : dStr;
        return s.split('-').reverse().join('/');
    } catch {
        return '-';
    }
};

const pct = (apontada, planejada) => {
    const q = parseFloat(planejada || 0);
    if (q <= 0) return 0;
    return Math.min(100, Math.round((parseFloat(apontada || 0) / q) * 100));
};

const statusOp = (s) => {
    if (s === 'CONCLUIDO') return 'CONCLUIDO';
    if (s === 'PARCIAL') return 'PARCIAL';
    return 'PENDENTE';
};

const opAnteriorStr = (row) => {
    if (!row.op_anterior) return '-';
    const op = row.op_anterior;
    return `${op.recurso_codigo || op.operacao_codigo || '-'} (${statusOp(op.status)})`;
};

const opProximaStr = (row) => {
    if (!row.op_proxima) return '-';
    const op = row.op_proxima;
    return `${op.recurso_codigo || op.operacao_codigo || '-'} (${statusOp(op.status)})`;
};

const tempoUnitStr = (row) => {
    if (!row.tempad || row.tempad <= 0) return '-';
    return `${Number(row.tempad).toFixed(3).replace('.', ',')} min`;
};

const tempoTotalStr = (row) => {
    if (!row.tempad || row.tempad <= 0) return '-';
    const cappedAp = Math.min(parseFloat(row.qtd_apontada || 0), parseFloat(row.qtd_op || 0));
    const saldo = Math.max(0, parseFloat(row.qtd_op || 0) - cappedAp);
    const setup = cappedAp === 0 ? (parseFloat(row.setup || 0)) : 0;
    return `${(row.tempad * saldo + setup).toFixed(2).replace('.', ',')} min`;
};

const drawHeader = (doc, pageWidth, recurso, filtrosText, emissao) => {
    const y0 = 5;
    const usableW = pageWidth - ML - MR;
    const BRAND_W = 40;

    doc.setFillColor(30, 58, 95);
    doc.rect(ML, y0, BRAND_W, HDR_H, 'F');
    try {
        if (logoBase64) doc.addImage(logoBase64, 'PNG', ML + 1, y0 + 1, 36, 14);
    } catch (_) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text('METALFISA', ML + 4, y0 + 10);
    }

    doc.setFillColor(245, 247, 250);
    doc.rect(ML + BRAND_W, y0, usableW - BRAND_W, HDR_H, 'F');

    const blockX = ML + BRAND_W + (usableW - BRAND_W) / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 95);
    doc.text('RELATORIO GERAL - FILA DE PRODUCAO POR SETOR', blockX, y0 + 7, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    const sub = recurso ? `Recurso: ${recurso}${filtrosText ? '  |  ' + filtrosText : ''}` : (filtrosText || '');
    doc.text(sub, blockX, y0 + 13, { align: 'center' });

    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`Emissao: ${emissao}`, pageWidth - MR, y0 + 4, { align: 'right' });

    doc.setDrawColor(200, 210, 220);
    doc.setLineWidth(0.25);
    doc.rect(ML, y0, usableW, HDR_H);

    return y0 + HDR_H + 3;
};

export const generateVerticalGeralPdf = (rows, recurso, filters, user) => {
    if (!rows?.length) throw new Error('Nenhum dado para exportar.');

    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const emissao    = new Date().toLocaleString('pt-BR');

    const filterParts = [];
    if (filters?.op) filterParts.push(`OP: ${filters.op}`);
    if (filters?.pedido) filterParts.push(`Pedido: ${filters.pedido}`);
    if (filters?.produto) filterParts.push(`Produto: ${filters.produto}`);
    if (filters?.cliente) filterParts.push(`Cliente: ${filters.cliente}`);
    if (filters?.plan_inicio_ate) filterParts.push(`Planej. ate: ${formatDate(filters.plan_inicio_ate)}`);
    const filtrosText = filterParts.join(' | ');

    let startY = drawHeader(doc, pageWidth, recurso, filtrosText, emissao);

    const totalOps   = rows.length;
    const concluidos = rows.filter(r => r.status === 'CONCLUIDO').length;
    const parciais   = rows.filter(r => r.status === 'PARCIAL').length;
    const pendentes  = rows.filter(r => r.status !== 'CONCLUIDO' && r.status !== 'PARCIAL').length;
    const totalPlan  = rows.reduce((s, r) => s + parseFloat(r.qtd_op || 0), 0);
    const totalApont = rows.reduce((s, r) => s + Math.min(parseFloat(r.qtd_apontada || 0), parseFloat(r.qtd_op || 0)), 0);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const kpi = `Total: ${totalOps} OPs   |   Concluidos: ${concluidos}   |   Parciais: ${parciais}   |   Pendentes: ${pendentes}   |   Qtd Planejada: ${totalPlan.toFixed(2)}   |   Qtd Apontada: ${totalApont.toFixed(2)}   |   Por: ${user?.nome || 'Sistema'}`;
    doc.text(kpi, ML, startY);
    startY += 6;

    const head = [[
        'OP / Item / Seq',
        'Pedido',
        'Cliente',
        'Produto / Descricao',
        'Planejamento',
        'Qtd Plan.',
        'Qtd Apont.',
        '%',
        'T.Unit (min)',
        'T.Total (min)',
        'Op.Ant.',
        'Op.Atual',
        'Op.Prox.',
        'Status',
    ]];

    const body = rows.map(row => {
        const cappedAp = Math.min(parseFloat(row.qtd_apontada || 0), parseFloat(row.qtd_op || 0));
        const p = pct(cappedAp, row.qtd_op);

        return [
            `${row.op}-${row.item_op}\nSeq: ${row.sequen_op}`,
            row.pedido || '-',
            row.nome_cliente || row.cliente || '-',
            `${row.produto || '-'}\n${row.desc_produto || ''}`,
            row.planejamento_inicio ? formatDate(row.planejamento_inicio) : 'Nao plan.',
            parseFloat(row.qtd_op || 0).toFixed(2),
            cappedAp.toFixed(2),
            `${p}%`,
            tempoUnitStr(row),
            tempoTotalStr(row),
            opAnteriorStr(row),
            `${row.recurso_codigo || row.operacao_codigo || '-'}\n${row.operacao_desc || ''}`,
            opProximaStr(row),
            statusOp(row.status),
        ];
    });

    body.push([
        { content: 'TOTAL GERAL', colSpan: 5, styles: { fontStyle: 'bold', halign: 'right', fillColor: [30, 58, 95], textColor: [255, 255, 255] } },
        { content: totalPlan.toFixed(2), styles: { fontStyle: 'bold', halign: 'right', fillColor: [30, 58, 95], textColor: [255, 255, 255] } },
        { content: totalApont.toFixed(2), styles: { fontStyle: 'bold', halign: 'right', fillColor: [30, 58, 95], textColor: [255, 255, 255] } },
        { content: `${totalPlan > 0 ? Math.round((totalApont / totalPlan) * 100) : 0}%`, styles: { fontStyle: 'bold', halign: 'center', fillColor: [30, 58, 95], textColor: [255, 255, 255] } },
        { content: '', colSpan: 6, styles: { fillColor: [30, 58, 95] } },
    ]);

    autoTable(doc, {
        startY,
        head,
        body,
        theme: 'grid',
        styles: {
            fontSize: 6.5,
            cellPadding: 1.8,
            valign: 'middle',
            lineColor: [210, 215, 220],
            overflow: 'linebreak',
        },
        headStyles: {
            fillColor: [30, 58, 95],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 7,
            halign: 'center',
        },
        columnStyles: {
            0:  { cellWidth: 22, fontStyle: 'bold' },
            1:  { cellWidth: 18, halign: 'center' },
            2:  { cellWidth: 30 },
            3:  { cellWidth: 'auto' },
            4:  { cellWidth: 18, halign: 'center' },
            5:  { cellWidth: 16, halign: 'right' },
            6:  { cellWidth: 16, halign: 'right' },
            7:  { cellWidth: 10, halign: 'center' },
            8:  { cellWidth: 16, halign: 'center' },
            9:  { cellWidth: 18, halign: 'center' },
            10: { cellWidth: 20, halign: 'center' },
            11: { cellWidth: 22, halign: 'center' },
            12: { cellWidth: 20, halign: 'center' },
            13: { cellWidth: 18, halign: 'center' },
        },
        alternateRowStyles: { fillColor: [248, 250, 253] },
        willDrawCell: (data) => {
            if (data.section !== 'body') return;
            if (data.column.index === 13) {
                const val = String(data.cell.raw || '');
                if (val === 'CONCLUIDO') {
                    data.cell.styles.textColor = [20, 120, 60];
                    data.cell.styles.fontStyle  = 'bold';
                } else if (val === 'PARCIAL') {
                    data.cell.styles.textColor = [160, 100, 0];
                    data.cell.styles.fontStyle  = 'bold';
                } else if (val === 'PENDENTE') {
                    data.cell.styles.textColor = [180, 30, 30];
                    data.cell.styles.fontStyle  = 'bold';
                }
            }
            if (data.column.index === 7) {
                const n = parseInt(data.cell.raw, 10);
                if (n === 100) data.cell.styles.textColor = [20, 120, 60];
                else if (n > 0) data.cell.styles.textColor = [160, 100, 0];
                else data.cell.styles.textColor = [180, 30, 30];
                data.cell.styles.fontStyle = 'bold';
            }
        },
        margin: { left: ML, right: MR, top: HDR_H + 12, bottom: 14 },
        didDrawPage: (data) => {
            if (data.pageNumber > 1) {
                drawHeader(doc, pageWidth, recurso, filtrosText, emissao);
            }
        },
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        doc.text(`Pagina ${i} de ${pageCount}`, pageWidth - MR, pageHeight - 5, { align: 'right' });
        doc.text('MetalFisa - Relatorio Geral de Apontamento Vertical', ML, pageHeight - 5);
    }

    const ts = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 16);
    doc.save(`relatorio_geral_vertical_${recurso || 'todos'}_${ts}.pdf`);
};

export const generateVerticalGeralExcel = (rows, recurso, filters, user) => {
    if (!rows?.length) throw new Error('Nenhum dado para exportar.');

    const wb = XLSX.utils.book_new();

    const filterParts = [];
    if (filters?.op) filterParts.push(`OP: ${filters.op}`);
    if (filters?.pedido) filterParts.push(`Pedido: ${filters.pedido}`);
    if (filters?.produto) filterParts.push(`Produto: ${filters.produto}`);
    if (filters?.cliente) filterParts.push(`Cliente: ${filters.cliente}`);
    if (filters?.plan_inicio_ate) filterParts.push(`Planej. ate: ${formatDate(filters.plan_inicio_ate)}`);

    const emissao = new Date().toLocaleString('pt-BR');
    const totalPlan  = rows.reduce((s, r) => s + parseFloat(r.qtd_op || 0), 0);
    const totalApont = rows.reduce((s, r) => s + Math.min(parseFloat(r.qtd_apontada || 0), parseFloat(r.qtd_op || 0)), 0);

    const headerRow = [
        'OP', 'Item OP', 'Sequencia', 'Pedido', 'Item Pedido',
        'Cliente', 'Produto', 'Descricao Produto',
        'Planejamento Inicio', 'Qtd Planejada (OP)',
        'Qtd Apontada', '% Progresso',
        'Tempo Unitario (min)', 'Tempo Total Pend. (min)',
        'Op. Anterior', 'St. Op. Anterior',
        'Recurso / Op. Atual', 'Desc. Op. Atual',
        'Op. Proxima', 'St. Op. Proxima',
        'Status', 'Conf. Pendente', 'Checklist',
        'Dias Espera',
        'Ult. Apontamento', 'Ult. Usuario Apontamento',
    ];

    const dataRows = rows.map(row => {
        const cappedAp = Math.min(parseFloat(row.qtd_apontada || 0), parseFloat(row.qtd_op || 0));
        const saldo    = Math.max(0, parseFloat(row.qtd_op || 0) - cappedAp);
        const setup    = cappedAp === 0 ? parseFloat(row.setup || 0) : 0;
        const tempad   = parseFloat(row.tempad || 0);

        return [
            row.op || '',
            row.item_op || '',
            row.sequen_op || '',
            row.pedido || '',
            row.item_pedido || '',
            row.nome_cliente || row.cliente || '',
            row.produto || '',
            row.desc_produto || '',
            row.planejamento_inicio ? formatDate(row.planejamento_inicio) : '',
            parseFloat(row.qtd_op || 0),
            cappedAp,
            pct(cappedAp, row.qtd_op),
            tempad > 0 ? Number(tempad.toFixed(3)) : '',
            tempad > 0 ? Number((tempad * saldo + setup).toFixed(2)) : '',
            row.op_anterior ? (row.op_anterior.recurso_codigo || row.op_anterior.operacao_codigo || '') : '',
            row.op_anterior ? statusOp(row.op_anterior.status) : '',
            row.recurso_codigo || row.operacao_codigo || '',
            row.operacao_desc || '',
            row.op_proxima ? (row.op_proxima.recurso_codigo || row.op_proxima.operacao_codigo || '') : '',
            row.op_proxima ? statusOp(row.op_proxima.status) : '',
            statusOp(row.status),
            row.tem_pendencia_conferencia ? 'SIM' : 'NAO',
            row.checklist_status || '',
            row.dias_espera || 0,
            row.ultima_data_apontamento ? new Date(row.ultima_data_apontamento).toLocaleString('pt-BR') : '',
            row.usuarios_apontamento || '',
        ];
    });

    const totalRow = [
        'TOTAL GERAL', '', '', '', '', '', '', '',
        '', totalPlan, totalApont,
        totalPlan > 0 ? Math.round((totalApont / totalPlan) * 100) : 0,
        '', '', '', '', '', '', '', '',
        '', '', '', '', '', '',
    ];

    const aoa = [
        [`MetalFisa - Relatorio Geral de Apontamento Vertical - Recurso: ${recurso || 'Todos'}`],
        [`Emissao: ${emissao}   |   Emitido por: ${user?.nome || 'Sistema'}`],
        [`Filtros: ${filterParts.length > 0 ? filterParts.join(' | ') : 'Nenhum'}`],
        [],
        headerRow,
        ...dataRows,
        [],
        totalRow,
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws['!cols'] = [
        { wch: 10 }, { wch: 8  }, { wch: 8  }, { wch: 12 }, { wch: 8  },
        { wch: 35 }, { wch: 16 }, { wch: 40 },
        { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 10 },
        { wch: 16 }, { wch: 18 },
        { wch: 14 }, { wch: 14 },
        { wch: 16 }, { wch: 30 },
        { wch: 14 }, { wch: 14 },
        { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
        { wch: 22 }, { wch: 30 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Fila Vertical');

    const abertos = rows.filter(r => r.status !== 'CONCLUIDO');
    if (abertos.length > 0) {
        const wsAberto = XLSX.utils.aoa_to_sheet([
            [`MetalFisa - OPs Em Aberto - Recurso: ${recurso || 'Todos'}`],
            [`Emissao: ${emissao}`],
            [],
            ['OP', 'Item', 'Seq', 'Pedido', 'Cliente', 'Produto', 'Desc. Produto', 'Planejamento', 'Qtd Plan.', 'Qtd Apont.', '%', 'Status'],
            ...abertos.map(row => {
                const cappedAp = Math.min(parseFloat(row.qtd_apontada || 0), parseFloat(row.qtd_op || 0));
                return [
                    row.op, row.item_op, row.sequen_op, row.pedido || '',
                    row.nome_cliente || row.cliente || '',
                    row.produto, row.desc_produto || '',
                    row.planejamento_inicio ? formatDate(row.planejamento_inicio) : '',
                    parseFloat(row.qtd_op || 0), cappedAp,
                    pct(cappedAp, row.qtd_op), statusOp(row.status),
                ];
            }),
        ]);
        wsAberto['!cols'] = [
            { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 30 },
            { wch: 16 }, { wch: 36 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 12 },
        ];
        XLSX.utils.book_append_sheet(wb, wsAberto, 'Em Aberto');
    }

    const ts = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 16);
    XLSX.writeFile(wb, `relatorio_geral_vertical_${recurso || 'todos'}_${ts}.xlsx`);
};
