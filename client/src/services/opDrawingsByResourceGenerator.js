import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import api from './api';
import { generateOPByOperationPdf } from './opByOperationPdfGenerator';
import { downloadBlob } from '../utils/downloadHelper';

/**
 * Option A: Generates the "Capa OP" and then groups all PDF drawings by "Recurso".
 * Adds a divider page for each Resource.
 * Prints multiple copies of the same part drawing if it passes through multiple resources.
 */
export const generateOPDrawingsByResourcePdf = async (mirrorData, userName = 'Usuário', batchContext = null, returnBuffer = false, includeRoteiroStamp = false, includeDesc = false, includeStockStudy = false) => {
    try {
        if (!mirrorData || !mirrorData.pedido) {
            console.error('[opDrawingsByResourceGenerator] Dados inválidos:', mirrorData);
            alert('Dados inválidos para geração do PDF.');
            return;
        }

        if (!mirrorData.itens || !Array.isArray(mirrorData.itens) || mirrorData.itens.length === 0) {
            console.warn('[opDrawingsByResourceGenerator] mirrorData.itens está vazio ou ausente:', mirrorData);
            alert('O espelho desta OP não possui itens ou operações. Verifique se o pedido possui roteiro no Protheus.');
            return;
        }

        console.log('[opDrawingsByResourceGenerator] Gerando PDF para pedido:', mirrorData.pedido?.pedido, '| Itens:', mirrorData.itens?.length, '| includeStockStudy:', includeStockStudy);

        const espelhoBuffer = generateOPByOperationPdf(mirrorData, true, batchContext);
        if (!espelhoBuffer) {
            throw new Error('Falha ao gerar capa de Rastreabilidade.');
        }

        // 1. Extrair peças com operações
        const partsSummaryMap = new Map();

        mirrorData.itens.forEach(itemGroup => {
            const processPart = (component) => {
                const code = component.codigo || 'S/COD';
                const isLevel0 = component.nivel === 0 || component.nivel === undefined;
                let rawQtd = isLevel0
                    ? parseFloat(component.quantidade_venda || component.quantidade_calculada || component.qtd_total || 0)
                    : parseFloat(component.quantidade_calculada || component.qtd_total || 0);

                if (batchContext && (batchContext.is_fraction || batchContext.visual_qtd || batchContext.qtd)) {
                    const orderQtyOriginal = parseFloat(itemGroup?.produto_principal?.quantidade_venda || itemGroup?.quantidade_venda || mirrorData.pedido?.quantidade || 1);
                    const fractionQty = parseFloat(batchContext.visual_qtd || batchContext.qtd || orderQtyOriginal);
                    rawQtd = isLevel0 ? fractionQty : (orderQtyOriginal > 0 ? (rawQtd / orderQtyOriginal) * fractionQty : rawQtd);
                }

                const op_num = component.op_num || itemGroup.produto_principal?.op_num || '-';
                
                const recursos = [];
                if (component.operacoes && Array.isArray(component.operacoes)) {
                    component.operacoes.forEach(op => {
                        if (op.recurso) {
                            recursos.push({
                                recurso: op.recurso.trim().toUpperCase(),
                                operacao: op.operacao_cod || '',
                                descricao: op.desc_operacao || op.descricao || ''
                            });
                        }
                    });
                }

                const roteiroArray = [];
                if (component.operacoes && Array.isArray(component.operacoes)) {
                    component.operacoes.forEach(op => {
                        if (op.recurso) {
                            const recCode = op.recurso.trim().toUpperCase();
                            const desc = (op.desc_operacao || op.descricao || op.desc || op.operacao_cod || '').trim().toUpperCase();
                            if (includeDesc && desc) {
                                roteiroArray.push(`${recCode}-${desc}`);
                            } else {
                                roteiroArray.push(recCode);
                            }
                        }
                    });
                }
                const roteiroStr = roteiroArray.length > 0 ? roteiroArray.join(' -> ') : 'S/ROTEIRO';

                if (partsSummaryMap.has(code)) {
                    const existingPart = partsSummaryMap.get(code);
                    existingPart.qtdTotal += rawQtd;
                    existingPart.sources.push(op_num);
                    if (existingPart.roteiro === 'S/ROTEIRO' && roteiroStr !== 'S/ROTEIRO') {
                        existingPart.roteiro = roteiroStr;
                    }
                    recursos.forEach(rc => {
                        if (!existingPart.recursos.some(r => r.recurso === rc.recurso && r.operacao === rc.operacao)) {
                            existingPart.recursos.push(rc);
                        }
                    });
                } else {
                    partsSummaryMap.set(code, {
                        codigo: code,
                        descricao: component.descricao || '',
                        um: component.unidade || component.um || 'UN',
                        tipo: component.tipoProduto || component.tipo_produto || component.tipo || '',
                        qtdTotal: rawQtd,
                        sources: [op_num],
                        roteiro: roteiroStr,
                        recursos: recursos
                    });
                }
            };

            if (itemGroup.produto_principal) processPart(itemGroup.produto_principal);
            if (itemGroup.estrutura_linear && Array.isArray(itemGroup.estrutura_linear)) {
                itemGroup.estrutura_linear.forEach(child => processPart(child));
            }
        });

        const partsSummaryArray = Array.from(partsSummaryMap.values())
            .filter(part => part.qtdTotal > 0 && part.recursos.length > 0)
            .sort((a, b) => a.descricao.localeCompare(b.descricao));

        // 2. Mapear disponibilidade de Desenhos (PDF)
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

        // 3. Construir um Map de Recurso -> Peças
        const resourcesMap = new Map();
        partsSummaryArray.forEach(part => {
            if (!part.hasPdf) return;
            part.recursos.forEach(rc => {
                if (!resourcesMap.has(rc.recurso)) {
                    resourcesMap.set(rc.recurso, { descricao: rc.descricao, parts: [] });
                }
                resourcesMap.get(rc.recurso).parts.push(part);
            });
        });

        const sortedResources = Array.from(resourcesMap.keys()).sort();

        // 4. Iniciar Merge do PDF
        let finalPdf = await PDFDocument.create();

        const jspdfDoc = await PDFDocument.load(espelhoBuffer, { ignoreEncryption: true });
        const jspdfCopied = await finalPdf.copyPages(jspdfDoc, jspdfDoc.getPageIndices());
        jspdfCopied.forEach(p => finalPdf.addPage(p));

        // 4.1. Anexar Estudo de Estoque da Estrutura (BOM) se solicitado
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

        const pdfCache = new Map();

        // 5. Adicionar página divisória e PDFs para cada Recurso
        for (const recursoCode of sortedResources) {
            const rcData = resourcesMap.get(recursoCode);
            
            const dividerDoc = new jsPDF('landscape', 'mm', 'a4');
            const pw = dividerDoc.internal.pageSize.getWidth();
            const ph = dividerDoc.internal.pageSize.getHeight();
            
            dividerDoc.setFillColor(255, 255, 255);
            dividerDoc.rect(0, 0, pw, ph, 'F');
            
            dividerDoc.setFillColor(60, 141, 188);
            dividerDoc.rect(0, 0, pw, 30, 'F');
            
            dividerDoc.setTextColor(255, 255, 255);
            dividerDoc.setFontSize(24);
            dividerDoc.setFont('helvetica', 'bold');
            dividerDoc.text(`RECURSO: ${recursoCode}`, pw / 2, 20, { align: 'center' });
            
            dividerDoc.setTextColor(0, 0, 0);
            dividerDoc.setFontSize(36);
            if (rcData.descricao) {
                dividerDoc.text(rcData.descricao, pw / 2, ph / 2, { align: 'center' });
            } else {
                dividerDoc.text("PEÇAS PARA ESTE RECURSO", pw / 2, ph / 2, { align: 'center' });
            }
            
            dividerDoc.setFontSize(14);
            dividerDoc.setFont('helvetica', 'normal');
            dividerDoc.text(`Quantidade de Peças Diferentes: ${rcData.parts.length}`, pw / 2, (ph / 2) + 20, { align: 'center' });
            
            const dividerArrayBuffer = dividerDoc.output('arraybuffer');
            const dividerPdfDoc = await PDFDocument.load(dividerArrayBuffer);
            const copiedDivider = await finalPdf.copyPages(dividerPdfDoc, [0]);
            finalPdf.addPage(copiedDivider[0]);

            for (const part of rcData.parts) {
                try {
                    let responseData;
                    if (pdfCache.has(part.codigo)) {
                        responseData = pdfCache.get(part.codigo);
                    } else {
                        const fileUrl = `/docs/view?path=${encodeURIComponent(part.pdfUrl)}`;
                        const response = await api.get(fileUrl, { responseType: 'arraybuffer' });
                        responseData = response.data;
                        pdfCache.set(part.codigo, responseData);
                    }

                    const drawingDoc = await PDFDocument.load(responseData, { ignoreEncryption: true });
                    const copiedPages = await finalPdf.copyPages(drawingDoc, drawingDoc.getPageIndices());

                    const uniqueOps = [...new Set(part.sources)].join(', ');
                    const finalQtdStr = Number(part.qtdTotal).toFixed(4).replace(/\.?0+$/, '');
                    const loteNome = batchContext && batchContext.visual_op ? batchContext.visual_op : '';
                    const visualOpStr = loteNome && loteNome !== uniqueOps ? `${loteNome} (OPs: ${uniqueOps})` : uniqueOps;
                    
                    const safePedidoNum = mirrorData?.pedido?.pedido || '-';
                    const textLine1 = `CÓPIA CONTROLADA | DATA: ${dataGeracao} | USUÁRIO: ${userName} | PEDIDO: ${safePedidoNum}`;
                    let baseInfo = `RECURSO: ${recursoCode} | CÓD: ${part.codigo} | ENT. LOTE: ${batchContext && batchContext.data_pcp ? batchContext.data_pcp : '-'} | QTD: ${finalQtdStr} ${part.um} | LOTE/OP: ${visualOpStr}`;
                    
                    if (includeRoteiroStamp && part.roteiro) {
                        baseInfo = `ROTEIRO: ${part.roteiro} | ` + baseInfo;
                    }
                    
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
                    console.warn(`Não foi possível carregar ou carimbar o desenho para ${part.codigo} no recurso ${recursoCode}`, err);
                }
            }
        }

        const mergedPdfBytes = await finalPdf.save({ useObjectStreams: false });
        if (returnBuffer) {
            return mergedPdfBytes;
        }

        const opNumRaw = mirrorData.opNumFromTable || ((mirrorData.items && mirrorData.items.length > 0) ? (mirrorData.items[0].op_num_completa || mirrorData.items[0].op_num || '') : '');
        const opPrefix = batchContext && batchContext.visual_op ? `OP_${String(batchContext.visual_op).replace(/[^a-zA-Z0-9-]/g, '')}` : (opNumRaw ? `OP_${opNumRaw.replace(/[^a-zA-Z0-9]/g, '')}` : `Pedido_${String(mirrorData.pedido?.pedido || '').replace(/[^a-zA-Z0-9-]/g, '')}`);
        
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        let filenameSuffix = '_Por_Recursos.pdf';
        if (includeRoteiroStamp) {
            filenameSuffix = includeDesc ? '_Por_Recursos_Roteiro_Descricao.pdf' : '_Por_Recursos_Roteiro.pdf';
        }
        const fileName = `Pacote_${opPrefix}${filenameSuffix}`;
        downloadBlob(blob, fileName, 'application/pdf');

    } catch (error) {
        console.error("Error generating OP Drawings by Resource:", error);
        alert("Erro ao gerar PDF agrupado por recurso. Verifique o console.");
    }
};
