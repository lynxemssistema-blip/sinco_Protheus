import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import api from './api';
import { generateOPByOperationPdf } from './opByOperationPdfGenerator';

/**
 * Option A: Generates the "Capa OP" and then groups all PDF drawings by "Recurso".
 * Adds a divider page for each Resource.
 * Prints multiple copies of the same part drawing if it passes through multiple resources.
 */
export const generateOPDrawingsByResourcePdf = async (mirrorData, userName = 'Usuário', batchContext = null, returnBuffer = false) => {
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

        console.log('[opDrawingsByResourceGenerator] Gerando PDF para pedido:', mirrorData.pedido?.pedido, '| Itens:', mirrorData.itens?.length);

        const espelhoBuffer = generateOPByOperationPdf(mirrorData, true, batchContext);
        if (!espelhoBuffer) {
            throw new Error('Falha ao gerar capa de Rastreabilidade.');
        }

        // 1. Mapear Peças e seus Recursos
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
                
                const recursosComponente = [];
                if (component.operacoes && Array.isArray(component.operacoes)) {
                    component.operacoes.forEach(op => {
                         if (op.recurso) {
                             recursosComponente.push({
                                 recurso: op.recurso.trim().toUpperCase(),
                                 descricao: op.desc_operacao ? op.desc_operacao.trim().toUpperCase() : ''
                             });
                         }
                    });
                }

                if (partsSummaryMap.has(code)) {
                    const existingPart = partsSummaryMap.get(code);
                    existingPart.qtdTotal += rawQtd;
                    existingPart.sources.push(op_num);
                    recursosComponente.forEach(rc => {
                        if (!existingPart.recursos.find(r => r.recurso === rc.recurso)) {
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
                        recursos: recursosComponente
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
                    const baseInfo = `RECURSO: ${recursoCode} | CÓD: ${part.codigo} | ENT. LOTE: ${batchContext && batchContext.data_pcp ? batchContext.data_pcp : '-'} | QTD: ${finalQtdStr} ${part.um} | LOTE/OP: ${visualOpStr}`;
                    
                    const chunkedInfo = chunkText(baseInfo, 105);
                    const allLines = [textLine1, ...chunkedInfo];

                    for (const page of copiedPages) {
                        finalPdf.addPage(page);
                        const { width, height } = page.getSize();
                        const minSide = Math.min(width, height);
                        const scale = Math.max(1, minSide / 595);
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

        const batchOpSafe = batchContext && batchContext.visual_op ? batchContext.visual_op : mirrorData.pedido.pedido;
        const safePedido = String(batchOpSafe).replace(/[^a-zA-Z0-9-]/g, '');
        
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Pacote_OP_${safePedido}_Por_Recursos.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error("Error generating OP Drawings by Resource:", error);
        alert("Erro ao gerar PDF agrupado por recurso. Verifique o console.");
    }
};
