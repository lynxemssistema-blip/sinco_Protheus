import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import api from './api';
import { generateOPByOperationPdf } from './opByOperationPdfGenerator';

/**
 * Option B: Generates the "Capa OP", then adds one copy of each component's drawing.
 * Scans component.operacoes to build a full routing sequence (e.g., MO0013 -> MO0014)
 * and injects this sequence into the PDF stamp to save paper but maintain full traceability.
 */
export const generateOPDrawingsWithOpsStampPdf = async (mirrorData, userName = 'Usuário', batchContext = null, returnBuffer = false, includeDescription = false) => {
    try {
        if (!mirrorData || !mirrorData.pedido) {
            console.error('[opDrawingsWithOpsStampGenerator] Dados inválidos:', mirrorData);
            alert('Dados inválidos para geração do PDF.');
            return;
        }

        if (!mirrorData.itens || !Array.isArray(mirrorData.itens) || mirrorData.itens.length === 0) {
            console.warn('[opDrawingsWithOpsStampGenerator] mirrorData.itens está vazio ou ausente:', mirrorData);
            alert('O espelho desta OP não possui itens. Verifique o roteiro no Protheus.');
            return;
        }

        console.log('[opDrawingsWithOpsStampGenerator] Gerando PDF para pedido:', mirrorData.pedido?.pedido, '| Itens:', mirrorData.itens?.length);

        const espelhoBuffer = generateOPByOperationPdf(mirrorData, true, batchContext);
        if (!espelhoBuffer) {
            throw new Error('Falha ao gerar capa de Rastreabilidade.');
        }

        const partsSummaryMap = new Map();

        mirrorData.itens.forEach(itemGroup => {
            const processPart = (component) => {
                const code = component.codigo || 'S/COD';

                const isLevel0 = component.nivel === 0 || component.nivel === undefined;
                let rawQtd = isLevel0
                    ? parseFloat(component.quantidade_venda || component.quantidade_calculada || component.qtd_total || 0)
                    : parseFloat(component.quantidade_calculada || component.qtd_total || 0);

                if (batchContext && batchContext.is_fraction && batchContext.visual_qtd) {
                    const orderQtyOriginal = mirrorData.pedido.quantidade || 1;
                    const fractionQty = parseFloat(batchContext.visual_qtd);
                    rawQtd = isLevel0 ? fractionQty : (rawQtd / orderQtyOriginal) * fractionQty;
                }

                const op_num = component.op_num || itemGroup.produto_principal?.op_num || '-';
                
                const recursosArr = [];
                if (component.operacoes && Array.isArray(component.operacoes)) {
                    component.operacoes.forEach(op => {
                         if (op.recurso) {
                             const recCode = op.recurso.trim().toUpperCase();
                             const desc = (op.desc_operacao || op.descricao || op.desc || op.operacao_cod || '').trim().toUpperCase();
                             if (includeDescription && desc) {
                                 recursosArr.push(`${recCode}-${desc}`);
                             } else {
                                 recursosArr.push(recCode);
                             }
                         }
                    });
                }
                const roteiroStr = recursosArr.length > 0 ? recursosArr.join(' -> ') : 'S/ROTEIRO';

                if (partsSummaryMap.has(code)) {
                    const existingPart = partsSummaryMap.get(code);
                    existingPart.qtdTotal += rawQtd;
                    existingPart.sources.push(op_num);
                    if (existingPart.roteiro === 'S/ROTEIRO' && roteiroStr !== 'S/ROTEIRO') {
                        existingPart.roteiro = roteiroStr;
                    }
                } else {
                    partsSummaryMap.set(code, {
                        codigo: code,
                        descricao: component.descricao || '',
                        um: component.unidade || component.um || 'UN',
                        tipo: component.tipoProduto || component.tipo_produto || component.tipo || '',
                        qtdTotal: rawQtd,
                        sources: [op_num],
                        roteiro: roteiroStr
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

        let finalPdf = await PDFDocument.create();

        const jspdfDoc = await PDFDocument.load(espelhoBuffer, { ignoreEncryption: true });
        const jspdfCopied = await finalPdf.copyPages(jspdfDoc, jspdfDoc.getPageIndices());
        jspdfCopied.forEach(p => finalPdf.addPage(p));

        const helveticaFont = await finalPdf.embedFont(StandardFonts.HelveticaBold);
        const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

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

        for (const part of partsSummaryArray) {
            if (!part.hasPdf || !part.pdfUrl) continue;
            try {
                const fileUrl = `/docs/view?path=${encodeURIComponent(part.pdfUrl)}`;
                const response = await api.get(fileUrl, { responseType: 'arraybuffer' });
                const drawingDoc = await PDFDocument.load(response.data, { ignoreEncryption: true });
                const copiedPages = await finalPdf.copyPages(drawingDoc, drawingDoc.getPageIndices());

                const uniqueOps = [...new Set(part.sources)].join(', ');
                const finalQtdStr = Number(part.qtdTotal).toFixed(4).replace(/\.?0+$/, '');
                const loteNome = batchContext && batchContext.visual_op ? batchContext.visual_op : '';
                
                const visualOpStr = loteNome && loteNome !== uniqueOps ? `${loteNome} (OPs: ${uniqueOps})` : uniqueOps;
                
                const safePedidoNum = mirrorData?.pedido?.pedido || '-';
                const textLine1 = `CÓPIA CONTROLADA | DATA: ${dataGeracao} | USUÁRIO: ${userName} | PEDIDO: ${safePedidoNum}`;
                const baseInfo = `ROTEIRO: ${part.roteiro} | CÓD: ${part.codigo} | ENT. LOTE: ${batchContext && batchContext.data_pcp ? batchContext.data_pcp : '-'} | QTD: ${finalQtdStr} ${part.um} | LOTE/OP: ${visualOpStr}`;
                
                const chunkedInfo = chunkText(baseInfo, 105);
                const allLines = [textLine1, ...chunkedInfo];

                for (const page of copiedPages) {
                    finalPdf.addPage(page);
                    const { width, height } = page.getSize();
                    const minSide = Math.min(width, height);
                    const scale = Math.max(1, minSide / 595);

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
                        color: rgb(0.9, 0.9, 0.9),
                        opacity: 0.12,
                        rotate: degrees(30)
                    });

                    const fontSize = 8 * scale;
                    const lineHeight = 13 * scale;
                    const padding = 5 * scale;
                    
                    const rectWidth = 470 * scale; 
                    const rectHeight = (allLines.length * lineHeight) + padding;
                    
                    const offsetY = 10 * scale + rectHeight; 

                    page.drawRectangle({
                        x: 10 * scale,
                        y: height - offsetY,
                        width: rectWidth,
                        height: rectHeight,
                        borderColor: rgb(0.8, 0.1, 0.1),
                        borderWidth: 1 * scale,
                    });
                    
                    let currY = height - offsetY + rectHeight - padding - fontSize + (2 * scale);
                    for (const textLine of allLines) {
                        page.drawText(textLine, {
                            x: 15 * scale,
                            y: currY,
                            size: fontSize,
                            font: helveticaFont,
                            color: rgb(0.8, 0.1, 0.1),
                        });
                        currY -= lineHeight;
                    }
                }
            } catch (err) {
                console.warn(`Não foi possível carregar ou carimbar o desenho para ${part.codigo}`, err);
            }
        }

        const mergedPdfBytes = await finalPdf.save({ useObjectStreams: false });
        if (returnBuffer) {
            return mergedPdfBytes;
        }

        const batchOpSafe = batchContext && batchContext.visual_op ? batchContext.visual_op : mirrorData.pedido.pedido;
        const safePedido = String(batchOpSafe).replace(/[^a-zA-Z0-9-]/g, '');
        
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const filenameSuffix = includeDescription ? '_Roteiro_Descricao_Carimbo.pdf' : '_Roteiro_Carimbo.pdf';
        link.download = `Pacote_OP_${safePedido}${filenameSuffix}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error("Error generating OP Operation Refresh PDF with ops stamp:", error);
        alert("Erro ao gerar PDF com roteiro no carimbo. Verifique o console.");
    }
};
