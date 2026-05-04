import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import api from './api';
import { generateOPByOperationPdf } from './opByOperationPdfGenerator';

/**
 * Generates the "Capa OP" using the normal Pedido de Venda format,
 * then merges all required engineering drawings at the end with dynamic watermarks.
 * @param {Object} mirrorData - Data returned by /api/pedidos/op-mirror/:id
 */
export const generateOPByOperationWithDrawingsPdf = async (mirrorData, userName = 'Usuário', batchContext = null, returnBuffer = false) => {
    try {
        if (!mirrorData || !mirrorData.pedido) {
            console.error("Invalid data provided to PDF generator");
            alert("Dados inválidos para geração do PDF.");
            return;
        }

        // Generate the ArrayBuffer of the front cover (Rastreabilidade Operações Mode)
        const espelhoBuffer = generateOPByOperationPdf(mirrorData, true, batchContext);
        if (!espelhoBuffer) {
            throw new Error('Falha ao gerar capa de Rastreabilidade.');
        }

        // 3. Extract parts summary to fetch drawings
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

        // 4. Copiar Capa
        const jspdfDoc = await PDFDocument.load(espelhoBuffer, { ignoreEncryption: true });
        const jspdfCopied = await finalPdf.copyPages(jspdfDoc, jspdfDoc.getPageIndices());
        jspdfCopied.forEach(p => finalPdf.addPage(p));

        const helveticaFont = await finalPdf.embedFont(StandardFonts.HelveticaBold);
        const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        // 5. Copiar Desenhos e Carimbar
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
                    const scale = Math.max(1, minSide / 595);
                    const fontSize = 8 * scale;
                    const lineHeight = 13 * scale;
                    const padding = 5 * scale;
                    
                    const rectWidth = 470 * scale; // Mesma largura
                    const rectHeight = (allLines.length * lineHeight) + padding;
                    
                    // offsetY mantém a caixa na mesma altitudade proporcional
                    const offsetY = 10 * scale + rectHeight; 

                    page.drawRectangle({
                        x: 10 * scale,
                        y: height - offsetY,
                        width: rectWidth,
                        height: rectHeight,
                        // Sem cor de fundo = Transparente
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
        link.download = `Pacote_OP_${safePedido}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error("Error generating OP Operation Refresh PDF with drawings:", error);
        alert("Erro ao gerar PDF de rastreabilidade com desenhos. Verifique o console.");
    }
};