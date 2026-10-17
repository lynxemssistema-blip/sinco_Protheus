import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import autoTable from 'jspdf-autotable';
import { PDFDocument } from 'pdf-lib';
import { logoBase64 } from './metalfisaLogoBase64';
import api, { getProductDocs } from './api';
import { getCompanyShortName } from './companyBranding';
import { downloadBlob } from '../utils/downloadHelper';

const BLUE = [30, 58, 95];
const ML = 10;
const MR = 10;
const HEADER_H = 28;

const STATUS_LABEL = {
    waiting: 'Aguardando',
    in_progress: 'Em Andamento',
    done: 'Concluído'
};

/**
 * Cabeçalho Padrão Lynx
 */
const drawHeader = (doc, pageWidth, meta) => {
    const hY = 6;
    const usableW = pageWidth - ML - MR;
    const hH = 22;

    const col1 = ML + 44;   // Logo | Empresa
    const col2 = pageWidth - MR - 50;  // Título central | Data/Hora/Usuário

    // Borda externa
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(0.4);
    doc.rect(ML, hY, usableW, hH);

    // Divisórias verticais
    doc.setLineWidth(0.2);
    doc.line(col1, hY, col1, hY + hH);
    doc.line(col2, hY, col2, hY + hH);

    // Logo
    try {
        if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', ML + 2, hY + 2, 40, 18);
        } else {
            throw new Error('no logo');
        }
    } catch {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...BLUE);
        doc.text(getCompanyShortName(), ML + 4, hY + 13);
    }

    // Título central
    const centerTitleX = (col1 + col2) / 2;
    doc.setTextColor(...BLUE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('RELATÓRIO DE PENDÊNCIAS DE APONTAMENTO', centerTitleX, hY + 8, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(70, 70, 70);
    const subInfo = [
        `OP: ${meta.opNum || '—'}${meta.itemPv ? ` (Item ${meta.itemPv})` : ''}`,
        meta.pedido ? `Pedido: ${meta.pedido}` : null,
        meta.produtoPai ? `Produto: ${meta.produtoPai}` : null
    ].filter(Boolean).join('  |  ');
    doc.text(subInfo, centerTitleX, hY + 14, { align: 'center' });

    if (meta.snapshotInfo) {
        doc.setFontSize(7.5);
        doc.setTextColor(110, 110, 110);
        doc.text(`Snapshot: ${meta.snapshotInfo}`, centerTitleX, hY + 19, { align: 'center' });
    }

    // Info direita
    const now = new Date();
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(`Emissão: ${now.toLocaleDateString('pt-BR')}`, col2 + 3, hY + 6.5);
    doc.text(`Hora: ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, col2 + 3, hY + 11.5);
    doc.text(`Usuário: ${meta.user?.nome || meta.user?.login || 'Sistema'}`, col2 + 3, hY + 16.5);

    return hY + hH + 4;
};

/**
 * Rodapé Padrão Lynx
 */
const drawFooters = (doc, pageWidth) => {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(140, 140, 140);
        doc.text('Lynx System — Gestão Integrada de Produção & PCP', ML, pageH - 4.5);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - MR, pageH - 4.5, { align: 'right' });
    }
};

/**
 * Função principal para gerar o relatório PDF com anexo do desenho do produto pai
 */
export const generatePendenciasReportPdf = async ({
    opNum,
    itemPv,
    pedido,
    produtoPai,
    itens = [],
    user = null,
    snapshotInfo = null,
    onProgress = null
}) => {
    if (!itens || itens.length === 0) {
        throw new Error('Nenhuma pendência informada para geração do relatório.');
    }

    if (onProgress) onProgress('Gerando relatório de pendências...');

    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    const determinedProdutoPai = produtoPai || itens[0]?.produto || '';

    const meta = {
        opNum,
        itemPv,
        pedido,
        produtoPai: determinedProdutoPai,
        user,
        snapshotInfo
    };

    const startY = drawHeader(doc, pageWidth, meta);

    // Formatação das linhas da tabela
    const head = [[
        'Pedido/Item',
        'Cliente',
        'PC Cliente',
        'Ref. Cliente',
        'OP Completa',
        'Produto / Descrição',
        'Operação',
        'Recurso',
        'Qtd Plan/Prod',
        'Status'
    ]];

    const uniqueItens = [];
    const seenItemKeys = new Set();
    (itens || []).forEach(it => {
        const opComp = it.op_completa || `${it.op || ''}${it.item_op || ''}${it.sequen || ''}`;
        const key = `${opComp}_${it.produto || ''}_${it.operac || ''}_${it.recurso || ''}`;
        if (!seenItemKeys.has(key)) {
            seenItemKeys.add(key);
            uniqueItens.push(it);
        }
    });

    const body = uniqueItens.map(it => {
        const pedItem = `${it.pedido || '-'}\nItem ${it.item_pv || it.item_op || '-'}`;
        const prodDesc = `${it.produto || '-'}\n${it.desc_produto || '-'}`;
        const recDesc = `${it.recurso || '-'}\n${it.desc_recurso || '-'}`;
        const opComp = it.op_completa || `${it.op || ''}${it.item_op || ''}${it.sequen || ''}`;
        const qtdText = `${it.qtde_produzida || 0} / ${it.qtde_planejada || 0} ${it.um || 'UN'}`;
        const stText = STATUS_LABEL[it.status] || it.status || 'Aguardando';

        return [
            pedItem,
            it.cliente || '-',
            it.ped_cliente || '-',
            it.ref_cliente || '-',
            opComp,
            prodDesc,
            it.operac || '-',
            recDesc,
            qtdText,
            stText
        ];
    });

    autoTable(doc, {
        startY: startY,
        head: head,
        body: body,
        styles: {
            fontSize: 7.5,
            cellPadding: 2,
            valign: 'middle',
            overflow: 'linebreak'
        },
        headStyles: {
            fillColor: BLUE,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center'
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        columnStyles: {
            0: { cellWidth: 22, halign: 'center' },
            1: { cellWidth: 38 },
            2: { cellWidth: 20, font: 'courier' },
            3: { cellWidth: 22, font: 'courier' },
            4: { cellWidth: 26, font: 'courier', fontStyle: 'bold', halign: 'center', textColor: [13, 110, 253] },
            5: { cellWidth: 50 },
            6: { cellWidth: 16, halign: 'center', font: 'courier' },
            7: { cellWidth: 32 },
            8: { cellWidth: 24, halign: 'center' },
            9: { cellWidth: 27, halign: 'center', fontStyle: 'bold' }
        },
        margin: { top: HEADER_H, left: ML, right: MR, bottom: 12 },
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 9) {
                const val = String(data.cell.raw || '');
                if (val === 'Em Andamento') {
                    data.cell.styles.textColor = [180, 83, 9]; // Amber
                    data.cell.styles.fillColor = [254, 243, 199];
                } else if (val === 'Aguardando') {
                    data.cell.styles.textColor = [71, 85, 105]; // Slate
                    data.cell.styles.fillColor = [241, 245, 249];
                } else if (val === 'Concluído') {
                    data.cell.styles.textColor = [22, 101, 52]; // Green
                    data.cell.styles.fillColor = [220, 252, 231];
                }
            }
        },
        didDrawPage: (data) => {
            if (data.pageNumber > 1) {
                drawHeader(doc, pageWidth, meta);
            }
        }
    });

    drawFooters(doc, pageWidth);

    const relatorioPdfBytes = doc.output('arraybuffer');
    let finalPdfBytes = relatorioPdfBytes;

    // ── ANEXO DO DESENHO DO PRODUTO PAI ──
    if (determinedProdutoPai) {
        try {
            if (onProgress) onProgress(`Buscando desenho técnico do produto ${determinedProdutoPai}...`);
            const docs = await getProductDocs(determinedProdutoPai);
            
            if (docs && docs.length > 0) {
                const drawing = docs.find(d =>
                    (d.tipo === 'Desenho' || d.titulo?.toLowerCase().includes('desenho')) &&
                    d.url_arquivo?.toLowerCase().endsWith('.pdf')
                ) || docs.find(d => d.url_arquivo?.toLowerCase().endsWith('.pdf'));

                if (drawing && drawing.url_arquivo) {
                    if (onProgress) onProgress(`Mesclando desenho de ${determinedProdutoPai}...`);
                    const resDrawing = await api.get('/docs/view', {
                        params: { path: drawing.url_arquivo },
                        responseType: 'arraybuffer'
                    });

                    if (resDrawing?.data) {
                        const mergedDoc = await PDFDocument.create();

                        // 1. Relatório de Pendências Lynx
                        const relDoc = await PDFDocument.load(relatorioPdfBytes);
                        const relPages = await mergedDoc.copyPages(relDoc, relDoc.getPageIndices());
                        relPages.forEach(p => mergedDoc.addPage(p));

                        // 2. Desenho do Produto Pai
                        const drawDoc = await PDFDocument.load(resDrawing.data);
                        const drawPages = await mergedDoc.copyPages(drawDoc, drawDoc.getPageIndices());
                        drawPages.forEach(p => mergedDoc.addPage(p));

                        finalPdfBytes = await mergedDoc.save();
                    }
                }
            }
        } catch (drawingErr) {
            console.warn('⚠️ Não foi possível anexar o desenho do produto pai:', drawingErr.message);
        }
    }

    // Disparar abertura/download do PDF final
    const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
    const fileName = `Pendencias_OP_${opNum || 'Geral'}${itemPv ? `_Item_${itemPv}` : ''}_${new Date().toISOString().split('T')[0]}.pdf`;
    downloadBlob(blob, fileName, 'application/pdf');
};

export default generatePendenciasReportPdf;
