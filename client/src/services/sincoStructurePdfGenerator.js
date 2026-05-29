import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import autoTable from 'jspdf-autotable';
import { PDFDocument } from 'pdf-lib';
import { logoBase64 } from './metalfisaLogoBase64';
import api from './api';

const BLUE = [30, 58, 95];
const ML = 10;
const MR = 10;
const HEADER_H = 30; // altura total do cabeçalho (px) para margem das tabelas

const fmtQtd = (v) =>
    parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });

// ─────────────────────────────────────────────
//  CABEÇALHO PADRÃO METALFISA
// ─────────────────────────────────────────────
const drawHeader = (doc, pageWidth, rootCode, user, reportTitle) => {
    const hY = 5;
    const usableW = pageWidth - ML - MR;
    const hH = 20;

    const col1 = ML + 42;   // logo | empresa
    const col2 = ML + 145;  // título | info

    // Borda externa
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(0.4);
    doc.rect(ML, hY, usableW, hH);

    // Divisórias verticais
    doc.setLineWidth(0.2);
    [col1, col2].forEach(x => doc.line(x, hY, x, hY + hH));

    // ── Logo ──
    try {
        if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', ML + 1, hY + 1.5, 38, 17);
        } else {
            throw new Error('no logo');
        }
    } catch {
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...BLUE);
        doc.text('METALFISA', ML + 3, hY + 12);
    }

    // ── Título central ──
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(reportTitle, (col1 + col2) / 2, hY + 8, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Produto: ${rootCode || '—'}`, (col1 + col2) / 2, hY + 14, { align: 'center' });

    // ── Info direita ──
    const now = new Date();
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Data: ${now.toLocaleDateString('pt-BR')}`, col2 + 3, hY + 7);
    doc.text(`Hora: ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, col2 + 3, hY + 12);
    doc.text(`Usuário: ${user?.nome || user?.login || 'Sistema'}`, col2 + 3, hY + 17);

    return hY + hH + 4; // retorna Y onde o conteúdo deve começar
};

// ─────────────────────────────────────────────
//  FOOTER PADRÃO METALFISA
// ─────────────────────────────────────────────
const drawFooters = (doc, pageWidth) => {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        doc.text(`Gerado via MetalFisa App — SINCO Engenharia`, ML, pageH - 5);
        doc.text(
            `Página ${i} de ${pageCount}`,
            pageWidth - MR,
            pageH - 5,
            { align: 'right' }
        );
    }
};

// ─────────────────────────────────────────────
//  GERADOR PRINCIPAL
// ─────────────────────────────────────────────
const generateSincoStructurePdf = async (structure, user) => {
    if (!structure || !structure.tree) return;

    const doc = new jsPDF('portrait', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const reportTitle = 'Relação de Estrutura do Produto';

    // ── Cabeçalho da primeira página ──
    let startY = drawHeader(doc, pageWidth, structure.rootCode, user, reportTitle);

    // ── Monta dados da tabela ──
    const tableData = [];
    const rootPData = structure.protheusData || {};

    // Linha do produto raiz (Nível 00)
    const rootDesc =
        structure.tree.find(i => i.CodMatFabricante === structure.rootCode)?.DescResumo || '—';
    const rootUnidade =
        structure.tree.find(i => i.CodMatFabricante === structure.rootCode)?.Unidade || 'UN';

    tableData.push([
        '001',
        'PA',
        '00',
        structure.rootCode,
        rootDesc,
        fmtQtd(1),
        rootUnidade,
        rootPData.revisao || '',
        rootPData.desenho_cliente || '',
        rootPData.rev_cliente || '',
    ]);

    let seqItem = 2;

    structure.tree.forEach(item => {
        const nivelNum = parseInt(item.nivel || 0);
        const nivelStr = nivelNum < 10 ? `0${nivelNum}` : `${nivelNum}`;
        const isPI = nivelNum > 0 && item.materiais && item.materiais.length > 0;
        const indent = '  '.repeat(nivelNum);

        tableData.push([
            seqItem.toString().padStart(3, '0'),
            isPI ? 'PI' : 'MP',
            nivelStr,
            indent + item.CodMatFabricante,
            indent + (item.DescResumo || ''),
            item.QtdeTotal ? fmtQtd(item.QtdeTotal) : '0',
            item.Unidade || 'UN',
            '',
            '',
            '',
        ]);
        seqItem++;

        // Processos de fabricação
        (item.processos || []).forEach(proc => {
            tableData.push([
                seqItem.toString().padStart(3, '0'),
                'PR',
                nivelStr + '+',
                '  '.repeat(nivelNum + 1) + (proc.processName || proc.processCode || 'OP'),
                '  '.repeat(nivelNum + 1) + 'PROCESSO DE FABRICAÇÃO',
                proc.timeMin ? `${parseFloat(proc.timeMin)}` : '0',
                'MIN',
                '', '', '',
            ]);
            seqItem++;
        });

        // Materiais
        (item.materiais || []).forEach(mat => {
            const nivelMat = nivelNum + 1;
            tableData.push([
                seqItem.toString().padStart(3, '0'),
                'MP',
                nivelMat < 10 ? `0${nivelMat}` : `${nivelMat}`,
                '  '.repeat(nivelMat) + (mat.materialCode || 'S/COD'),
                '  '.repeat(nivelMat) + (mat.materialDescDetal || mat.materialDesc || '—'),
                fmtQtd(mat.quantity),
                mat.unidade || 'UN',
                '', '', '',
            ]);
            seqItem++;
        });
    });

    // ── Tabela principal ──
    autoTable(doc, {
        startY,
        head: [['ITEM', 'TP', 'NÍV', 'CÓDIGO', 'DESCRIÇÃO', 'QTDE', 'UM', 'Rev MF', 'Cód. Cliente', 'Rev. Cli.']],
        body: tableData,
        theme: 'grid',
        styles: {
            fontSize: 7,
            cellPadding: 1.5,
            font: 'helvetica',
            textColor: [0, 0, 0],
            valign: 'middle',
        },
        headStyles: {
            fillColor: BLUE,
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 7.5,
        },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 8,  halign: 'center' },
            2: { cellWidth: 8,  halign: 'center' },
            3: { cellWidth: 28 },
            4: { cellWidth: 'auto' },
            5: { cellWidth: 16, halign: 'right' },
            6: { cellWidth: 10, halign: 'center' },
            7: { cellWidth: 12, halign: 'center' },
            8: { cellWidth: 22 },
            9: { cellWidth: 12, halign: 'center' },
        },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { top: HEADER_H, left: ML, right: MR, bottom: 15 },
        didDrawPage: (data) => {
            // Redesenha cabeçalho em páginas subsequentes
            if (data.pageNumber > 1) {
                drawHeader(doc, pageWidth, structure.rootCode, user, reportTitle);
            }
        },
    });

    // ── Página de Revisões/Restrições (se houver) ──
    if (structure.revisionsSummary && structure.revisionsSummary.length > 0) {
        doc.addPage();
        const revStartY = drawHeader(doc, pageWidth, structure.rootCode, user, 'Resumo de Revisões e Restrições');

        const revTableData = structure.revisionsSummary.map(r => [
            r.codigo,
            r.descricao,
            r.revisao_mf,
            r.revisao_cli,
            r.desenho_cli,
            r.status,
        ]);

        autoTable(doc, {
            startY: revStartY,
            head: [['Código', 'Descrição', 'Rev MF', 'Rev Cli', 'Des. Cliente', 'Status']],
            body: revTableData,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
            headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold' },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 5 && data.cell.raw !== 'Normal') {
                    data.cell.styles.textColor = [180, 0, 0];
                    data.cell.styles.fontStyle = 'bold';
                }
            },
            alternateRowStyles: { fillColor: [245, 247, 250] },
            margin: { top: HEADER_H, left: ML, right: MR, bottom: 15 },
            didDrawPage: (data) => {
                if (data.pageNumber > 1) {
                    drawHeader(doc, pageWidth, structure.rootCode, user, 'Resumo de Revisões e Restrições');
                }
            },
        });
    }

    // ── Footer em todas as páginas ──
    drawFooters(doc, pageWidth);

    // ── Gera bytes da ficha ──
    const fichaPdfBytes = doc.output('arraybuffer');

    // ── Mescla com o desenho raiz (se houver PDF vinculado) ──
    let finalPdfBytes = fichaPdfBytes;

    const rootItem = structure.tree.find(i => i.CodMatFabricante === structure.rootCode);
    if (rootItem?.hasPdfFile && rootItem?.pdfPath) {
        try {
            const response = await api.get('/sinco/docs/view', {
                params: { path: rootItem.pdfPath },
                responseType: 'arraybuffer',
            });

            const mergedPdf = await PDFDocument.create();

            // Desenho raiz primeiro
            const rootDoc = await PDFDocument.load(response.data);
            const rootPages = await mergedPdf.copyPages(rootDoc, rootDoc.getPageIndices());
            rootPages.forEach(p => mergedPdf.addPage(p));

            // Ficha técnica após
            const fichaDoc = await PDFDocument.load(fichaPdfBytes);
            const fichaPages = await mergedPdf.copyPages(fichaDoc, fichaDoc.getPageIndices());
            fichaPages.forEach(p => mergedPdf.addPage(p));

            finalPdfBytes = await mergedPdf.save();
        } catch (err) {
            console.error('⚠️ Falha ao mesclar desenho com a Ficha Técnica:', err);
        }
    }

    // ── Download ──
    const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `Estrutura_${structure.rootCode}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export { generateSincoStructurePdf };
export default generateSincoStructurePdf;
