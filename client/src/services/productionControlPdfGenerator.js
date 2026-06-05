import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { logoBase64 } from './metalfisaLogoBase64';

// ─── Constantes de layout ────────────────────────────────────────────────────
const ML = 10;
const MR = 10;
const HDR_H = 28;      // altura do bloco de cabeçalho
const BRAND_W = 42;    // largura do bloco azul (logo + nome)
const LOGO_W  = 14;
const LOGO_H  = 14;

// ─── Cabeçalho padrão MetalFisa ──────────────────────────────────────────────
const drawMetalfisaHeader = (doc, pageWidth, title, subtitle = '') => {
    const y0 = 6;

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

    // Separador cinza claro
    doc.setFillColor(245, 247, 250);
    doc.rect(ML + BRAND_W, y0, pageWidth - ML - MR - BRAND_W, HDR_H, 'F');

    // Título e subtítulo centralizados no bloco cinza
    const blockCenter = ML + BRAND_W + (pageWidth - ML - MR - BRAND_W) / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 58, 95);
    doc.text(title, blockCenter, y0 + 10, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(subtitle || 'PCP — Planejamento e Controle de Produção', blockCenter, y0 + 16, { align: 'center' });

    // Data de emissão no canto direito
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    const emissao = new Date().toLocaleString('pt-BR');
    doc.text(`Emissão: ${emissao}`, pageWidth - MR, y0 + 7, { align: 'right' });

    // Borda geral do header
    doc.setDrawColor(200, 210, 220);
    doc.setLineWidth(0.3);
    doc.rect(ML, y0, pageWidth - ML - MR, HDR_H);

    return y0 + HDR_H + 3; // retorna próximo Y disponível
};

// ─── Formatação de data ───────────────────────────────────────────────────────
const formatDate = (dStr) => {
    if (!dStr) return '-';
    try {
        if (typeof dStr === 'string' && dStr.includes('T')) return new Date(dStr).toLocaleDateString('pt-BR');
        if (typeof dStr === 'string' && dStr.includes('-')) return dStr.substring(0, 10).split('-').reverse().join('/');
        return new Date(dStr).toLocaleDateString('pt-BR');
    } catch {
        return '-';
    }
};

// ─── Mapeamento de linha da tabela ────────────────────────────────────────────
const mapRow = (row) => {
    const planInicioStr = row.data_planejada_inicio ? formatDate(row.data_planejada_inicio) : '-';
    const planFimStr    = row.data_planejada_fim    ? formatDate(row.data_planejada_fim)    : '-';

    const qPlan  = parseFloat(row.qtd_planejada_op  || 0);
    const qApont = parseFloat(row.qtd_produzida_real || 0);
    const pct    = qPlan > 0 ? Math.min(100, Math.round((qApont / qPlan) * 100)) : 0;

    return [
        `${row.op || '-'}-${row.item_op || ''} / Seq ${row.sequen || ''}`,
        row.pedido_venda || '-',
        row.nome_fantasia || row.nome_cliente || '-',
        `${row.cod_produto_op || ''}\n${row.desc_produto || ''}`,
        `I: ${planInicioStr}\nF: ${planFimStr}`,
        `${qApont.toFixed(2)} / ${qPlan.toFixed(2)}\n(${pct}%)`,
    ];
};

// ─── Gerador principal ────────────────────────────────────────────────────────
export const generateProductionControlPdf = async (ops, filterText = []) => {
    try {
        const doc = new jsPDF('landscape', 'mm', 'a4');
        const pageWidth  = doc.internal.pageSize.getWidth();  // 297
        const pageHeight = doc.internal.pageSize.getHeight(); // 210

        const tableHead = [['OP / Item / Seq', 'Pedido', 'Cliente', 'Produto / Descrição', 'Planejamento', 'Progresso']];
        const colStyles = {
            0: { cellWidth: 30 },
            1: { cellWidth: 22 },
            2: { cellWidth: 48 },
            3: { cellWidth: 'auto' },
            4: { cellWidth: 32, halign: 'center' },
            5: { cellWidth: 32, halign: 'center' },
        };

        // Agrupar por recurso
        const groups = {};
        ops.forEach(p => {
            const key = `${p.recurso || 'SEM RECURSO'} - ${p.desc_recurso || 'SEM DESCRIÇÃO'}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        });
        const resources = Object.keys(groups).sort();

        // Totalizadores
        let sumTotalPlan  = 0;
        let sumTotalApont = 0;

        // Rastreio de páginas por recurso (sub-paginação)
        const opPageInfo = [];

        resources.forEach((rec, idx) => {
            // Nova página a partir do segundo recurso
            if (idx > 0) doc.addPage();

            const startPage = doc.internal.getNumberOfPages();

            // Cabeçalho da página
            let startY = drawMetalfisaHeader(doc, pageWidth, 'CONTROLE DE PRODUÇÃO', 'Relatório por Recurso');

            // Filtros ativos (só na primeira página)
            if (idx === 0 && filterText.length > 0) {
                doc.setFontSize(7.5);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(100, 100, 100);
                doc.text(`Filtros: ${filterText.join(' | ')}`, ML, startY);
                startY += 5;
            }

            // Band colorida com nome do recurso
            doc.setFillColor(30, 58, 95);
            doc.rect(ML, startY, pageWidth - ML - MR, 8, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(255, 255, 255);
            doc.text(`Recurso: ${rec}`, ML + 3, startY + 5.5);

            // Totalizador do grupo
            const groupPlan  = groups[rec].reduce((s, it) => s + parseFloat(it.qtd_planejada_op   || 0), 0);
            const groupApont = groups[rec].reduce((s, it) => s + parseFloat(it.qtd_produzida_real || 0), 0);
            sumTotalPlan  += groupPlan;
            sumTotalApont += groupApont;

            const pctGroup = groupPlan > 0 ? Math.min(100, Math.round((groupApont / groupPlan) * 100)) : 0;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.text(`Total: ${groupApont.toFixed(2)} / ${groupPlan.toFixed(2)} (${pctGroup}%)`, pageWidth - MR - 2, startY + 5.5, { align: 'right' });

            startY += 9;

            const tableBody = groups[rec].map(mapRow);
            // Linha de sub-total do recurso
            tableBody.push([
                {
                    content: `TOTAL DO RECURSO: ${groupApont.toFixed(2)} / ${groupPlan.toFixed(2)} (${pctGroup}%)`,
                    colSpan: 6,
                    styles: { halign: 'right', fontStyle: 'bold', fillColor: [220, 230, 245], textColor: [30, 58, 95] },
                },
            ]);

            autoTable(doc, {
                startY,
                head: tableHead,
                body: tableBody,
                theme: 'grid',
                styles: { fontSize: 7.5, cellPadding: 2, valign: 'middle', lineColor: [210, 215, 220] },
                headStyles: { fillColor: [60, 100, 160], textColor: 255, fontStyle: 'bold', fontSize: 8 },
                columnStyles: colStyles,
                alternateRowStyles: { fillColor: [248, 250, 253] },
                margin: { left: ML, right: MR, top: HDR_H + 10, bottom: 15 },
                didDrawPage: (data) => {
                    // Re-desenha cabeçalho em quebras de página automáticas
                    if (data.pageNumber > 1 || idx > 0) {
                        drawMetalfisaHeader(doc, pageWidth, 'CONTROLE DE PRODUÇÃO', `Recurso: ${rec}`);
                    }
                },
            });

            const endPage = doc.internal.getNumberOfPages();
            opPageInfo.push({ recurso: rec, start: startPage, end: endPage, total: (endPage - startPage) + 1 });
        });

        // ── Total Geral (se mais de um recurso) ─────────────────────────────
        if (resources.length > 1) {
            const lastY = doc.lastAutoTable.finalY + 5;
            const remaining = pageHeight - lastY - 15;
            if (remaining < 12) {
                doc.addPage();
                drawMetalfisaHeader(doc, pageWidth, 'CONTROLE DE PRODUÇÃO', 'Resumo Geral');
            }
            const pctGeral = sumTotalPlan > 0 ? Math.min(100, Math.round((sumTotalApont / sumTotalPlan) * 100)) : 0;
            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 6,
                body: [[{
                    content: `TOTAL GERAL (TODOS OS RECURSOS): ${sumTotalApont.toFixed(2)} / ${sumTotalPlan.toFixed(2)} (${pctGeral}%)`,
                    colSpan: 6,
                    styles: { halign: 'right', fontStyle: 'bold', fillColor: [30, 58, 95], textColor: [255, 255, 255], fontSize: 9 },
                }]],
                theme: 'grid',
                columnStyles: colStyles,
                margin: { left: ML, right: MR },
            });
        }

        // ── Rodapé em todas as páginas (sub-paginação por recurso) ───────────
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(150, 150, 150);

            // Número global
            doc.text(`Página ${i} de ${pageCount}`, pageWidth - MR, pageHeight - 5, { align: 'right' });

            // Sub-paginação por recurso
            const opInfo = opPageInfo.find(o => i >= o.start && i <= o.end);
            if (opInfo && opInfo.total > 1) {
                const subPage = (i - opInfo.start) + 1;
                doc.text(`${opInfo.recurso}: Folha ${subPage} de ${opInfo.total}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
            }

            doc.text('MetalFisa — Controle de Produção', ML, pageHeight - 5);
        }

        doc.save(`controle_producao_${new Date().getTime()}.pdf`);
    } catch (err) {
        console.error('Erro ao gerar relatório', err);
        throw err;
    }
};
