import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import api from './api';
import { generateOPByOperationPdf } from './opByOperationPdfGenerator';
import { downloadBlob } from '../utils/downloadHelper';

/**
 * Generates the "Capa OP" using the normal Pedido de Venda format,
 * then merges all required engineering drawings at the end with dynamic watermarks.
 * @param {Object} mirrorData - Data returned by /api/pedidos/op-mirror/:id
 */
export const generateOPByOperationWithDrawingsPdf = async (mirrorData, userName = 'Usuário', batchContext = null, returnBuffer = false, includeStockStudy = false) => {
    try {
        if (!mirrorData || !mirrorData.pedido) {
            console.error('[opByOperationWithDrawingsPdfGenerator] Dados inválidos:', mirrorData);
            alert('Dados inválidos para geração do PDF.');
            return;
        }

        if (!mirrorData.itens || !Array.isArray(mirrorData.itens) || mirrorData.itens.length === 0) {
            console.warn('[opByOperationWithDrawingsPdfGenerator] mirrorData.itens está vazio ou ausente:', mirrorData);
            alert('O espelho desta OP não possui itens. Verifique o roteiro no Protheus.');
            return;
        }

        console.log('[opByOperationWithDrawingsPdfGenerator] Gerando PDF para pedido:', mirrorData.pedido?.pedido, '| Itens:', mirrorData.itens?.length, '| includeStockStudy:', includeStockStudy);

        // 1. Generate the ArrayBuffer of the front cover (Rastreabilidade Operações Mode)
        const espelhoBuffer = generateOPByOperationPdf(mirrorData, true, batchContext);
        if (!espelhoBuffer) {
            throw new Error('Falha ao gerar capa de Rastreabilidade.');
        }

        // 2. Extract parts summary to fetch drawings
        const partsSummaryMap = new Map();
        mirrorData.itens.forEach(itemGroup => {
            const processPart = (component) => {
                const code = component.codigo || 'S/COD';

                // Raw qty of component
                const isLevel0 = component.nivel === 0 || component.nivel === undefined;
                let rawQtd = isLevel0
                    ? parseFloat(component.quantidade_venda || component.quantidade_calculada || component.qtd_total || 0)
                    : parseFloat(component.quantidade_calculada || component.qtd_total || 0);

                if (batchContext && batchContext.is_fraction && batchContext.visual_qtd) {
                    const orderQtyOriginal = mirrorData.pedido.quantidade || 1;
                    const fractionQty = parseFloat(batchContext.visual_qtd);
                    rawQtd = isLevel0 ? fractionQty : (rawQtd / orderQtyOriginal) * fractionQty;
                }

                const sourceData = {
                    pedido: mirrorData.pedido.pedido,
                    itemPedido: itemGroup.item_pedido,
                    op_num: component.op_num || itemGroup.produto_principal?.op_num || '-'
                };

                if (partsSummaryMap.has(code)) {
                    partsSummaryMap.get(code).qtdTotal += rawQtd;
                    partsSummaryMap.get(code).sources.push(sourceData);
                } else {
                    partsSummaryMap.set(code, {
                        codigo: code,
                        descricao: component.descricao || '',
                        um: component.unidade || component.um || 'UN',
                        tipo: component.tipoProduto || component.tipo_produto || component.tipo || '',
                        qtdTotal: rawQtd,
                        sources: [sourceData]
                    });
                }
            };

            if (itemGroup.produto_principal) processPart(itemGroup.produto_principal);
            if (itemGroup.estrutura_linear && Array.isArray(itemGroup.estrutura_linear)) {
                itemGroup.estrutura_linear.forEach(child => processPart(child));
            }
        });

        const partsSummaryArray = Array.from(partsSummaryMap.values())
            .filter(part => part.qtdTotal > 0)
            .sort((a, b) => a.descricao.localeCompare(b.descricao));

        // Mapear disponibilidade de Desenhos (PDF)
        await Promise.all(partsSummaryArray.map(async (part) => {
            const codPrefix = part.codigo.substring(0, 4).toUpperCase();
            const isMaterialFallback = ['MTC-', 'MTA-', 'MTT-', 'MTD-', 'MTU-', 'MTE-'].includes(codPrefix);
            if (part.codigo === 'S/COD' || isMaterialFallback || part.tipo === 'MP' || part.tipo === 'MC') {
                part.hasPdf = false;
                part.isMaterial = true;
                return;
            }
            try {
                const docsResult = await api.get(`/docs/${encodeURIComponent(part.codigo)}`);
                const drawing = docsResult.data.find(d => (d.tipo === 'Desenho' || (d.titulo && d.titulo.toLowerCase().includes('desenho'))) && d.url_arquivo.toLowerCase().endsWith('.pdf'));
                if (drawing) {
                    part.hasPdf = true;
                    part.pdfUrl = drawing.url_arquivo;
                } else {
                    part.hasPdf = false;
                }
            } catch (err) {
                part.hasPdf = false;
            }
        }));

        // --- Iniciar Merge do PDF ---
        let finalPdf = await PDFDocument.create();

        // 3. Copiar Capa
        const jspdfDoc = await PDFDocument.load(espelhoBuffer, { ignoreEncryption: true });
        const jspdfCopied = await finalPdf.copyPages(jspdfDoc, jspdfDoc.getPageIndices());
        jspdfCopied.forEach(p => finalPdf.addPage(p));

        // 3.1. Anexar Estudo de Estoque da Estrutura (BOM) se solicitado
        if (includeStockStudy) {
            try {
                const rootCode = mirrorData.itens?.[0]?.produto_principal?.codigo || mirrorData.pedido?.codigo || mirrorData.itens?.[0]?.codigo;
                if (rootCode) {
                    const { getProductStructureStock } = await import('./api');
                    const { exportProductStructureStockPDF } = await import('./productStructureStockReportGenerator');
                    
                    const stockData = await getProductStructureStock(rootCode);
                    if (stockData && stockData.estrutura && stockData.estrutura.length > 0) {
                        const stockMeta = {
                            productCode: rootCode,
                            productDesc: stockData.descricao_pai || mirrorData.itens?.[0]?.produto_principal?.descricao,
                            orderNum: mirrorData.pedido?.pedido,
                            orderItem: mirrorData.pedido?.item,
                            orderQty: mirrorData.pedido?.quantidade || mirrorData.itens?.[0]?.produto_principal?.quantidade,
                            clientName: mirrorData.pedido?.nome_cliente
                        };
                        
                        const stockPdfBytes = exportProductStructureStockPDF(stockData.estrutura, stockMeta, { nome: userName }, true);
                        if (stockPdfBytes) {
                            const stockPdfDoc = await PDFDocument.load(stockPdfBytes, { ignoreEncryption: true });
                            const stockCopiedPages = await finalPdf.copyPages(stockPdfDoc, stockPdfDoc.getPageIndices());
                            stockCopiedPages.forEach(p => finalPdf.addPage(p));
                        }
                    }
                }
            } catch (stockErr) {
                console.warn('Erro ao anexar estudo de estoque da estrutura no PDF:', stockErr);
            }
        }

        const helveticaFont = await finalPdf.embedFont(StandardFonts.HelveticaBold);
        const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        // 4. Copiar Desenhos e Carimbar
        for (const part of partsSummaryArray) {
            if (!part.hasPdf || !part.pdfUrl) continue;
            try {
                const fileUrl = `/docs/view?path=${encodeURIComponent(part.pdfUrl)}`;
                const response = await api.get(fileUrl, { responseType: 'arraybuffer' });
                const drawingDoc = await PDFDocument.load(response.data, { ignoreEncryption: true });
                const copiedPages = await finalPdf.copyPages(drawingDoc, drawingDoc.getPageIndices());

                const chunkText = (str, length) => {
                    const chunks = [];
                    let currentChunk = '';
                    str.split(' ').forEach(word => {
                        if ((currentChunk + word).length > length) {
                            if (currentChunk) chunks.push(currentChunk.trim());
                            currentChunk = word + ' ';
                        } else {
                            currentChunk += word + ' ';
                        }
                    });
                    if (currentChunk) chunks.push(currentChunk.trim());
                    return chunks;
                };

                const uniqueOps = [...new Set(part.sources.map(s => s.op_num))].join(', ');
                const finalQtdStr = Number(part.qtdTotal).toFixed(4).replace(/\.?0+$/, '');
                const loteNome = batchContext && batchContext.visual_op ? batchContext.visual_op : '';
                
                // Exibe nome do lote e TODAS as OPs para não omitir
                const visualOpStr = loteNome && loteNome !== uniqueOps ? `${loteNome} (OPs: ${uniqueOps})` : uniqueOps;
                
                const safePedidoNum = mirrorData?.pedido?.pedido || '-';
                const textLine1 = `CÓPIA CONTROLADA | DATA: ${dataGeracao} | USUÁRIO: ${userName} | PEDIDO: ${safePedidoNum}`;
                
                // Junta todas as informações para serem quebradas dinamicamente
                const baseInfo = `CÓD: ${part.codigo} | ENTREGA LOTE: ${batchContext && batchContext.data_pcp ? batchContext.data_pcp : '-'} | QTD: ${finalQtdStr} ${part.um} | LOTE/OP: ${visualOpStr}`;
                
                const chunkedInfo = chunkText(baseInfo, 105); // limite de quebra (~105 caracteres)
                const allLines = [textLine1, ...chunkedInfo];

                for (const page of copiedPages) {
                    finalPdf.addPage(page);
                    const { width, height } = page.getSize();
                    const minSide = Math.min(width, height);
                    const scale = Math.max(1, minSide / 595); // 595 is A4 width in pt

                    // Draw Watermark in the middle
                    const clientFirstName = String(mirrorData.pedido?.nome_cliente || '').trim().split(' ')[0].toUpperCase();
                    const watermarkText = `PEDIDO: ${mirrorData.pedido?.pedido || ''} - ${clientFirstName}`;
                    const watermarkFontSize = 26 * scale;
                    const textWidth = helveticaFont.widthOfTextAtSize(watermarkText, watermarkFontSize);
                    const textHeight = helveticaFont.heightAtSize(watermarkFontSize);
                    page.drawText(watermarkText, {
                        x: (width - textWidth) / 2,
                        y: (height - textHeight) / 2,
                        size: watermarkFontSize,
                        font: helveticaFont,
                        color: rgb(0.85, 0.85, 0.85),
                        opacity: 0.35,
                        rotate: degrees(45)
                    });

                    // Draw Stamp Background at bottom right
                    const stampFontSize = Math.max(7, 8.5 * scale);
                    const lineHeight = stampFontSize + (3 * scale);
                    const stampWidth = Math.max(340, 360 * scale);
                    const stampHeight = (allLines.length * lineHeight) + (10 * scale);
                    const margin = 10 * scale;
                    const stampX = width - stampWidth - margin;
                    const stampY = margin;

                    page.drawRectangle({
                        x: stampX,
                        y: stampY,
                        width: stampWidth,
                        height: stampHeight,
                        color: rgb(1, 1, 1),
                        opacity: 0.92,
                        borderColor: rgb(0.2, 0.2, 0.2),
                        borderWidth: 1.2 * scale,
                    });

                    allLines.forEach((line, index) => {
                        page.drawText(line, {
                            x: stampX + (8 * scale),
                            y: stampY + stampHeight - ((index + 1) * lineHeight),
                            size: stampFontSize,
                            font: helveticaFont,
                            color: rgb(0.1, 0.1, 0.1),
                        });
                    });
                }
            } catch (err) {
                console.error(`Erro ao processar desenho do item ${part.codigo}:`, err);
            }
        }

        // 5. Finalizar e salvar PDF
        const finalPdfBytes = await finalPdf.save();
        if (returnBuffer) {
            return finalPdfBytes;
        }

        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const opSuffix = includeStockStudy ? '_Estoque_Desenhos.pdf' : '_Desenhos.pdf';
        const fileName = `OP_${mirrorData.pedido?.pedido || 'OP'}${opSuffix}`;
        downloadBlob(blob, fileName, 'application/pdf');

    } catch (error) {
        console.error('[opByOperationWithDrawingsPdfGenerator] Erro fatal na geração do PDF com desenhos:', error);
        alert(`Erro ao gerar PDF de Desenhos: ${error.message}`);
    }
};