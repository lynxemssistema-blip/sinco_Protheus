/**
 * mrpReportGenerator.js
 * Gerador de relatórios S&OP MRP — PDF (A4 deitado, padrão Lynx) + Excel
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { logoBase64 } from './metalfisaLogoBase64';
import { getCompanyShortName } from './companyBranding';

// ─── Layout ──────────────────────────────────────────────────────────────────
const ML     = 10;
const MR     = 10;
const HDR_H  = 28;
const BRAND_W = 42;
const LOGO_W  = 14;
const LOGO_H  = 14;

// ─── Cabeçalho padrão Lynx (reutiliza exato padrão do sistema) ───────────
const drawHeader = (doc, pageWidth, title, subtitle = '') => {
    const y0 = 6;

    // Bloco azul escuro com logo
    doc.setFillColor(30, 58, 95);
    doc.rect(ML, y0, BRAND_W, HDR_H, 'F');
    doc.addImage(logoBase64, 'PNG', ML + 2, y0 + 2, LOGO_W, LOGO_H);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(getCompanyShortName(), ML + 18, y0 + 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text('Metalúrgica Ltda', ML + 18, y0 + 15.5);

    // Bloco cinza claro para título
    doc.setFillColor(245, 247, 250);
    doc.rect(ML + BRAND_W, y0, pageWidth - ML - MR - BRAND_W, HDR_H, 'F');

    const blockCenter = ML + BRAND_W + (pageWidth - ML - MR - BRAND_W) / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 58, 95);
    doc.text(title, blockCenter, y0 + 10, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(subtitle, blockCenter, y0 + 17, { align: 'center' });

    // Data de emissão (canto direito)
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(`Emissão: ${new Date().toLocaleString('pt-BR')}`, pageWidth - MR, y0 + 7, { align: 'right' });

    // Borda do header
    doc.setDrawColor(200, 210, 220);
    doc.setLineWidth(0.3);
    doc.rect(ML, y0, pageWidth - ML - MR, HDR_H);

    return y0 + HDR_H + 3;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt2 = (v) => Number(v || 0).toFixed(2);

const statusLabel = (necLiquida) =>
    Number(necLiquida) <= 0 ? 'OK' : `Faltam ${fmt2(necLiquida)}`;

// ─── GERADOR PDF ─────────────────────────────────────────────────────────────
export const generateMrpPdf = (resultados, filtrosLabel = '') => {
    if (!resultados?.materiais?.length) {
        throw new Error('Nenhum dado para exportar.');
    }

    const doc       = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth  = doc.internal.pageSize.getWidth();   // 297
    const pageHeight = doc.internal.pageSize.getHeight();  // 210

    // ── Informações do relatório ────────────────────────────────────────────
    const totalMPs    = resultados.materiais.length;
    const totalFalta  = resultados.materiais.filter(m => Number(m.necessidade_liquida) > 0).length;
    const totalOk     = totalMPs - totalFalta;
    const subtitle    = `S&OP — Necessidades de Material (MRP) | Base: ${resultados.items_base} produtos`;

    let startY = drawHeader(doc, pageWidth, 'PLANEJAMENTO DE MATERIAIS', subtitle);

    // ── KPIs resumo ─────────────────────────────────────────────────────────
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);

    const kpiLine = [
        `Total de MPs: ${totalMPs}`,
        `✅ Cobertos: ${totalOk}`,
        `⚠️  Necessidade em aberto: ${totalFalta}`,
        filtrosLabel ? `Filtros: ${filtrosLabel}` : '',
    ].filter(Boolean).join('   |   ');

    doc.text(kpiLine, ML, startY);
    startY += 6;

    // ── Tabela ───────────────────────────────────────────────────────────────
    const tableHead = [[
        'Código MP',
        'Descrição do Material',
        'Un',
        'Qtd Necessária',
        'Almox 01 ★',
        'Almox 03',
        'Nec. Líquida',
        'Status',
    ]];

    const tableBody = resultados.materiais.map(mat => {
        const necLiq = Number(mat.necessidade_liquida);
        return [
            mat.codigo,
            mat.descricao,
            mat.unidade,
            fmt2(mat.qtd_total_necessaria),
            fmt2(mat.saldo_almox01),
            fmt2(mat.saldo_almox03),
            fmt2(mat.necessidade_liquida),
            statusLabel(necLiq),
        ];
    });

    // Linha de totais
    const sumNecessaria = resultados.materiais.reduce((s, m) => s + Number(m.qtd_total_necessaria), 0);
    const sumAlmox01    = resultados.materiais.reduce((s, m) => s + Number(m.saldo_almox01), 0);
    const sumAlmox03    = resultados.materiais.reduce((s, m) => s + Number(m.saldo_almox03), 0);
    const sumLiquida    = resultados.materiais.reduce((s, m) => s + Number(m.necessidade_liquida), 0);

    tableBody.push([
        { content: 'TOTAL GERAL', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', fillColor: [30, 58, 95], textColor: [255, 255, 255] } },
        { content: fmt2(sumNecessaria), styles: { fontStyle: 'bold', halign: 'right', fillColor: [30, 58, 95], textColor: [255, 255, 255] } },
        { content: fmt2(sumAlmox01),    styles: { fontStyle: 'bold', halign: 'right', fillColor: [30, 58, 95], textColor: [255, 255, 255] } },
        { content: fmt2(sumAlmox03),    styles: { fontStyle: 'bold', halign: 'right', fillColor: [30, 58, 95], textColor: [255, 255, 255] } },
        { content: fmt2(sumLiquida),    styles: { fontStyle: 'bold', halign: 'right', fillColor: [30, 58, 95], textColor: [255, 255, 255] } },
        { content: `${totalFalta} itens em aberto`, styles: { fontStyle: 'bold', halign: 'center', fillColor: [30, 58, 95], textColor: [255, 255, 255] } },
    ]);

    autoTable(doc, {
        startY,
        head: tableHead,
        body: tableBody,
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2.2, valign: 'middle', lineColor: [210, 215, 220] },
        headStyles: { fillColor: [60, 100, 160], textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'center' },
        columnStyles: {
            0: { cellWidth: 28,  fontStyle: 'bold' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 10,  halign: 'center' },
            3: { cellWidth: 28,  halign: 'right' },
            4: { cellWidth: 24,  halign: 'right' },
            5: { cellWidth: 24,  halign: 'right' },
            6: { cellWidth: 24,  halign: 'right' },
            7: { cellWidth: 30,  halign: 'center' },
        },
        alternateRowStyles: { fillColor: [248, 250, 253] },
        // Colorir célula de status: vermelho se falta, verde se OK
        willDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 7) {
                const val = String(data.cell.raw || '');
                if (val.startsWith('Faltam')) {
                    data.cell.styles.textColor = [180, 30, 30];
                    data.cell.styles.fontStyle = 'bold';
                } else if (val === 'OK') {
                    data.cell.styles.textColor = [20, 120, 60];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        },
        margin: { left: ML, right: MR, top: HDR_H + 10, bottom: 15 },
        didDrawPage: (data) => {
            if (data.pageNumber > 1) {
                drawHeader(doc, pageWidth, 'PLANEJAMENTO DE MATERIAIS', subtitle);
            }
        },
    });

    // ── Rodapé em todas as páginas ───────────────────────────────────────────
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - MR, pageHeight - 5, { align: 'right' });
        doc.text('Lynx — S&OP / Planejamento de Materiais', ML, pageHeight - 5);
    }

    const ts = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 16);
    doc.save(`mrp_necessidades_${ts}.pdf`);
};

// ─── GERADOR EXCEL ────────────────────────────────────────────────────────────
export const generateMrpExcel = (resultados, filtrosLabel = '') => {
    if (!resultados?.materiais?.length) {
        throw new Error('Nenhum dado para exportar.');
    }

    const wb = XLSX.utils.book_new();

    // ── Aba principal: dados detalhados ──────────────────────────────────────
    const headerRow = [
        'Código MP',
        'Descrição',
        'Tipo',
        'Un',
        'Qtd Necessária',
        'Saldo Almox 01 ★',
        'Saldo Almox 03',
        'Necessidade Líquida',
        'Status',
    ];

    const dataRows = resultados.materiais.map(mat => [
        mat.codigo,
        mat.descricao,
        mat.tipo,
        mat.unidade,
        Number(mat.qtd_total_necessaria),
        Number(mat.saldo_almox01),
        Number(mat.saldo_almox03),
        Number(mat.necessidade_liquida),
        Number(mat.necessidade_liquida) <= 0 ? 'OK' : 'NECESSIDADE EM ABERTO',
    ]);

    // Linhas de meta-informação no topo
    const metaRows = [
        ['Lynx — S&OP / Planejamento de Necessidades de Material (MRP)'],
        [`Emissão: ${new Date().toLocaleString('pt-BR')}`],
        [`Base de cálculo: ${resultados.items_base} produtos a fabricar`],
        filtrosLabel ? [`Filtros aplicados: ${filtrosLabel}`] : [],
        [],  // linha em branco
        headerRow,
        ...dataRows,
        [],  // separador
        [
            'TOTAL GERAL', '', '', '',
            resultados.materiais.reduce((s, m) => s + Number(m.qtd_total_necessaria), 0),
            resultados.materiais.reduce((s, m) => s + Number(m.saldo_almox01), 0),
            resultados.materiais.reduce((s, m) => s + Number(m.saldo_almox03), 0),
            resultados.materiais.reduce((s, m) => s + Number(m.necessidade_liquida), 0),
            `${resultados.materiais.filter(m => Number(m.necessidade_liquida) > 0).length} itens em aberto`,
        ],
    ].filter(r => r.length > 0 || r === []);

    const ws = XLSX.utils.aoa_to_sheet(metaRows);

    // Largura das colunas
    ws['!cols'] = [
        { wch: 18 },  // Código
        { wch: 45 },  // Descrição
        { wch: 8  },  // Tipo
        { wch: 6  },  // Un
        { wch: 18 },  // Qtd Necessária
        { wch: 18 },  // Almox 01
        { wch: 18 },  // Almox 03
        { wch: 20 },  // Nec. Líquida
        { wch: 25 },  // Status
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'MRP - Necessidades');

    // ── Aba resumo: apenas itens em aberto ───────────────────────────────────
    const emAberto = resultados.materiais.filter(m => Number(m.necessidade_liquida) > 0);
    if (emAberto.length > 0) {
        const wsAberto = XLSX.utils.aoa_to_sheet([
            ['Lynx — Itens com Necessidade em Aberto'],
            [`Emissão: ${new Date().toLocaleString('pt-BR')}`],
            [],
            ['Código MP', 'Descrição', 'Un', 'Qtd Necessária', 'Almox 01', 'Nec. Líquida'],
            ...emAberto.map(m => [
                m.codigo,
                m.descricao,
                m.unidade,
                Number(m.qtd_total_necessaria),
                Number(m.saldo_almox01),
                Number(m.necessidade_liquida),
            ]),
        ]);
        wsAberto['!cols'] = [
            { wch: 18 }, { wch: 45 }, { wch: 6 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
        ];
        XLSX.utils.book_append_sheet(wb, wsAberto, 'Em Aberto');
    }

    // ── Aba SOLDA: materiais de produtos que passam pelo recurso MO0020 ───────
    // O backend retorna tem_solda=true para MPs consumidas por produtos cujo roteiro
    // inclui o recurso de solda (MO0020 — SOLDA MIG/TIG).
    const materiaisSolda = resultados.materiais.filter(m => m.tem_solda === true);
    if (materiaisSolda.length > 0) {
        const soldaProdutosLabel = Array.isArray(resultados.solda_produtos) && resultados.solda_produtos.length > 0
            ? `Produtos com operação de SOLDA (${resultados.recurso_solda || 'MO0020'}): ${resultados.solda_produtos.join(', ')}`
            : `Recurso de SOLDA: ${resultados.recurso_solda || 'MO0020'}`;

        const wsSolda = XLSX.utils.aoa_to_sheet([
            ['Lynx — Materiais de SOLDA (MIG/TIG)'],
            [`Emissão: ${new Date().toLocaleString('pt-BR')}`],
            [soldaProdutosLabel],
            [],
            ['Código MP', 'Descrição', 'Tipo', 'Un', 'Qtd Necessária', 'Almox 01', 'Almox 03', 'Nec. Líquida', 'Status'],
            ...materiaisSolda.map(m => [
                m.codigo,
                m.descricao,
                m.tipo,
                m.unidade,
                Number(m.qtd_total_necessaria),
                Number(m.saldo_almox01),
                Number(m.saldo_almox03),
                Number(m.necessidade_liquida),
                Number(m.necessidade_liquida) <= 0 ? 'OK' : 'NECESSIDADE EM ABERTO',
            ]),
            [], // separador
            [
                'TOTAL SOLDA', '', '', '',
                materiaisSolda.reduce((s, m) => s + Number(m.qtd_total_necessaria), 0),
                materiaisSolda.reduce((s, m) => s + Number(m.saldo_almox01), 0),
                materiaisSolda.reduce((s, m) => s + Number(m.saldo_almox03), 0),
                materiaisSolda.reduce((s, m) => s + Number(m.necessidade_liquida), 0),
                `${materiaisSolda.filter(m => Number(m.necessidade_liquida) > 0).length} itens em aberto`,
            ],
        ]);
        wsSolda['!cols'] = [
            { wch: 18 }, { wch: 45 }, { wch: 8 }, { wch: 6 },
            { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 25 },
        ];
        XLSX.utils.book_append_sheet(wb, wsSolda, 'Materiais SOLDA');
    }

    const ts = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 16);
    XLSX.writeFile(wb, `mrp_necessidades_${ts}.xlsx`);
};
