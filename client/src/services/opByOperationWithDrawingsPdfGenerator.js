import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import autoTable from 'jspdf-autotable';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import api from './api';

/**
 * Generates an "Espelho da Ordem de Produção" grouped strictly by Operation Code (Recurso).
 * Prioritizes traceability including PV, Item, and Parent Product for every line.
 * @param {Object} mirrorData - Data returned by /api/pedidos/op-mirror/:id
 */
export const generateOPByOperationWithDrawingsPdf = async (mirrorData, userName = 'Usuário') => {
    try {
        if (!mirrorData || !mirrorData.pedido) {
            console.error("Invalid data provided to PDF generator");
            alert("Dados inválidos para geração do PDF.");
            return;
        }

        // Use landscape to accommodate many columns (traceability)
        const doc = new jsPDF('landscape', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // 1. Flatten and Group by Operation Code (Recurso)
        // Key: Recurso, Value: { recurso, desc_operacao, components: [] }
        const operationsMap = new Map();

        mirrorData.itens.forEach(itemGroup => {
            const processComponent = (component, parentCode = 'PRODUTO FINAL') => {
                if (component.operacoes && Array.isArray(component.operacoes) && component.operacoes.length > 0) {
                    component.operacoes.forEach(op => {
                        const recurso = op.recurso ? op.recurso.trim().toUpperCase() : 'INDEFINIDO';

                        if (!operationsMap.has(recurso)) {
                            operationsMap.set(recurso, {
                                recurso: recurso,
                                desc_operacao: op.desc_operacao || '',
                                components: []
                            });
                        }

                        // User request: No consolidation, keep full traceability.
                        // Calculate total quantity: (Quantity of this component in BOM) * (Sales Order quantity)
                        // Note: Backend might already provide rawQtd as quantidade_calculada.
                        const isLevel0 = component.nivel === 0 || component.nivel === undefined;
                        const rawQtd = isLevel0
                            ? (component.quantidade_venda || component.quantidade_calculada || component.qtd_total || 0)
                            : (component.quantidade_calculada || component.qtd_total || 0);

                        operationsMap.get(recurso).components.push({
                            pedido: mirrorData.pedido.pedido,
                            itemPedido: itemGroup.item_pedido,
                            produtoPai: parentCode,
                            codigo: component.codigo,
                            descricao: component.descricao,
                            qtdTotal: rawQtd,
                            um: component.unidade || component.um || 'UN',
                            nivel: isLevel0 ? 'PAI' : component.nivel,
                            op_num: component.op_num || itemGroup.produto_principal?.op_num || '-'
                        });
                    });
                }

                // Recursively process children if they exist in a linear structure context
                // In our current CTE structure, components usually come in a 'estrutura_linear' array.
            };

            // Process main product
            if (itemGroup.produto_principal) {
                // For level 0, the parent is the component itself
                processComponent(itemGroup.produto_principal, itemGroup.produto_principal.codigo);
            }

            // Process children
            if (itemGroup.estrutura_linear && Array.isArray(itemGroup.estrutura_linear)) {
                // To track immediate parent in a flat structure (itemGroup.estrutura_linear),
                // we'd ideally need 'pai_codigo' in the data. Assuming components are ordered
                // such that we can infer or they have a 'pai' reference.
                // For now, mirroring correctly from itemGroup context.
                itemGroup.estrutura_linear.forEach(child => {
                    // In a flat list, we use the parent code provided by the child data
                    const parentForChild = child.pai || itemGroup.produto_principal?.codigo || child.codigo;
                    processComponent(child, parentForChild);
                });
            }
        });

        if (operationsMap.size === 0) {
            alert("Nenhuma operação de manufatura encontrada.");
            return;
        }

        // Sort operation codes
        const sortedRecursos = Array.from(operationsMap.keys()).sort();

        // Track page ranges per operation for sub-pagination
        const opPageInfo = [];

        sortedRecursos.forEach((recurso, index) => {
            const groupData = operationsMap.get(recurso);

            if (index > 0) {
                doc.addPage();
            }

            const startPage = doc.internal.getNumberOfPages();

            // Define the header drawing function for didDrawPage
            const drawPageHeader = (data) => {
                // Base Header
                doc.setFillColor(30, 58, 95);
                doc.rect(10, 5, 40, 15, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(12);
                doc.text("METALFISA", 30, 14, { align: 'center' });
                doc.setTextColor(0, 0, 0);

                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text("ESPELHO OP - POR OPERAÇÃO (RASTREABILIDADE)", pageWidth / 2, 12, { align: 'center' });

                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.text(`EMISSÃO: ${mirrorData.pedido?.emissao || ''}`, pageWidth - 45, 10);
                doc.setFont('helvetica', 'bold');
                doc.text(`PEDIDO PV: ${mirrorData.pedido?.pedido || ''}`, pageWidth - 45, 15);

                const yOffset = 25;

                // Traceability context block (Order/Client) - Persistent on every page
                // Removed "Ped. Cliente" as requested since it varies per line
                doc.setFillColor(245, 245, 245);
                doc.setDrawColor(200, 200, 200);
                doc.rect(10, yOffset, pageWidth - 20, 10, 'FD');

                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(`Cliente:`, 12, yOffset + 6.5);
                doc.setFont('helvetica', 'normal');
                doc.text(`${mirrorData.pedido?.nome_cliente || ''}`, 28, yOffset + 6.5);

                // Operation Title Bar
                doc.setFillColor(60, 141, 188);
                doc.rect(10, yOffset + 14, pageWidth - 20, 10, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text(`OPERAÇÃO: ${groupData.recurso} - ${groupData.desc_operacao}`, 12, yOffset + 21);
                doc.setTextColor(0, 0, 0);
            };

            const tableColumns = [
                "PV",
                "Item",
                "Nível",
                "Prod. Pai (BOM)",
                "OP",
                "Componente",
                "Descrição",
                "Qtd. Req.",
                "UM"
            ];

            const tableRows = groupData.components.map(c => [
                c.pedido,
                c.itemPedido,
                c.nivel !== undefined ? c.nivel : '-',
                c.produtoPai,
                c.op_num,
                c.codigo,
                c.descricao,
                Number(c.qtdTotal).toFixed(2),
                c.um
            ]);

            autoTable(doc, {
                startY: 53,
                head: [tableColumns],
                body: tableRows,
                theme: 'grid',
                headStyles: {
                    fillColor: [240, 240, 240],
                    textColor: [50, 50, 50],
                    fontStyle: 'bold',
                    fontSize: 8,
                    halign: 'center'
                },
                bodyStyles: {
                    fontSize: 8,
                    cellPadding: 2
                },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 15 }, // PV
                    1: { halign: 'center', cellWidth: 12 }, // Item
                    2: { halign: 'center', cellWidth: 10 }, // Nível
                    3: { cellWidth: 35 }, // Prod Pai
                    4: { halign: 'center', cellWidth: 25 }, // OP
                    5: { cellWidth: 40 }, // Componente
                    6: { cellWidth: 'auto' }, // Descricao
                    7: { halign: 'right', cellWidth: 20 }, // Qtd
                    8: { halign: 'center', cellWidth: 10 }  // UM
                },
                margin: { top: 53, bottom: 20 },
                didDrawPage: drawPageHeader
            });

            const endPage = doc.internal.getNumberOfPages();
            opPageInfo.push({
                recurso: groupData.recurso,
                start: startPage,
                end: endPage,
                total: (endPage - startPage) + 1
            });
        });

        // Add page numbers and SUB-PAGINATION
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);

            // Global paging
            doc.text(`Página Global: ${i} de ${pageCount}`, pageWidth - 40, pageHeight - 10);

            // Sub-paging logic
            const currentOpInfo = opPageInfo.find(op => i >= op.start && i <= op.end);
            if (currentOpInfo) {
                const subPage = (i - currentOpInfo.start) + 1;
                doc.setFont('helvetica', 'bold');
                doc.text(`Operação ${currentOpInfo.recurso}: Folha ${subPage} de ${currentOpInfo.total}`, pageWidth - 100, pageHeight - 10);
                doc.setFont('helvetica', 'normal');
            }

            const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            doc.text(`MetalFisa - Rastreabilidade de Operações - Gerado em: ${dataGeracao} por ${userName}`, 10, pageHeight - 10);
        }

        // --- NOVO RECURSO: RESUMO GERAL DE PEÇAS AGLUTINADAS ---

        // 1. Coletar todas as peças exclusivas e somar quantidades
        const partsSummaryMap = new Map();

        mirrorData.itens.forEach(itemGroup => {
            const processPart = (component) => {
                const code = component.codigo || 'S/COD';

                // Pega a quantidade bruta/total do componente
                const isLevel0 = component.nivel === 0 || component.nivel === undefined;
                const rawQtd = isLevel0
                    ? parseFloat(component.quantidade_venda || component.quantidade_calculada || component.qtd_total || 0)
                    : parseFloat(component.quantidade_calculada || component.qtd_total || 0);

                if (partsSummaryMap.has(code)) {
                    partsSummaryMap.get(code).qtdTotal += rawQtd;
                } else {
                    partsSummaryMap.set(code, {
                        codigo: code,
                        descricao: component.descricao || '',
                        um: component.unidade || component.um || 'UN',
                        tipo: component.tipoProduto || component.tipo_produto || component.tipo || '',
                        qtdTotal: rawQtd
                    });
                }
            };

            // Main product
            if (itemGroup.produto_principal) {
                processPart(itemGroup.produto_principal);
            }

            // Children flat structure
            if (itemGroup.estrutura_linear && Array.isArray(itemGroup.estrutura_linear)) {
                itemGroup.estrutura_linear.forEach(child => {
                    processPart(child);
                });
            }
        });

        // 2. Extrair mapa para array, remover 0s e ordenar por descrição
        const partsSummaryArray = Array.from(partsSummaryMap.values())
            .filter(part => part.qtdTotal > 0)
            .sort((a, b) => a.descricao.localeCompare(b.descricao));

        // 2.1 Mapear disponibilidade de Desenhos (PDF) antes de gerar o buffer do jsPDF
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
                const docsObj = docsResult.data;
                const drawing = docsObj.find(d => (d.tipo === 'Desenho' || (d.titulo && d.titulo.toLowerCase().includes('desenho'))) && d.url_arquivo.toLowerCase().endsWith('.pdf'));
                
                if (drawing) {
                    part.hasPdf = true;
                    part.pdfUrl = drawing.url_arquivo;
                } else {
                    part.hasPdf = false;
                }
            } catch (err) {
                console.warn(`Erro verificando PDF de ${part.codigo}`, err);
                part.hasPdf = false;
            }
        }));

        if (partsSummaryArray.length > 0) {
            // Nova Página para o Resumo
            doc.addPage();
            let sumPageCount = doc.internal.getNumberOfPages();

            // Header do Resumo
            doc.setFillColor(40, 167, 69); // Verde para diferenciar
            doc.rect(10, 5, pageWidth - 20, 15, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text("RESUMO GERAL DE PEÇAS E MATERIAIS (AGLUTINADO)", pageWidth / 2, 12, { align: 'center' });

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(`PEDIDO PV: ${mirrorData.pedido?.pedido || ''}`, 15, 12);
            doc.text(`ITENS EXCLUSIVOS: ${partsSummaryArray.length}`, pageWidth - 45, 12);
            doc.setTextColor(0, 0, 0);

            const summaryColumns = ["Código", "Descrição do Material / Peça", "Status PDF", "UM", "Qtde Total Necessária"];
            const summaryRows = partsSummaryArray.map(p => [
                p.codigo,
                p.descricao,
                p.isMaterial ? "NA (Não aplicado)" : (p.hasPdf ? "SIM (Em anexo)" : "NÃO (Faltante)"),
                p.um,
                Number(p.qtdTotal).toFixed(4).replace(/\.?0+$/, '')
            ]);

            autoTable(doc, {
                startY: 25,
                head: [summaryColumns],
                body: summaryRows,
                theme: 'grid',
                headStyles: {
                    fillColor: [240, 240, 240],
                    textColor: [50, 50, 50],
                    fontStyle: 'bold',
                    fontSize: 9,
                    halign: 'left'
                },
                bodyStyles: {
                    fontSize: 8,
                    cellPadding: 3
                },
                columnStyles: {
                    0: { cellWidth: 35, fontStyle: 'bold' },
                    1: { cellWidth: 'auto' },
                    2: { halign: 'center', cellWidth: 35 },
                    3: { halign: 'center', cellWidth: 15 },
                    4: { halign: 'right', cellWidth: 35, fontStyle: 'bold', textColor: [0, 100, 0] }
                },
                didParseCell: function(data) {
                    if (data.section === 'body' && data.column.index === 2) {
                        if (data.cell.raw === "SIM (Em anexo)") {
                            data.cell.styles.textColor = [0, 128, 0];
                            data.cell.styles.fontStyle = 'bold';
                        } else if (data.cell.raw === "NA (Não aplicado)") {
                            data.cell.styles.textColor = [120, 120, 120];
                            data.cell.styles.fontStyle = 'italic';
                        } else {
                            data.cell.styles.textColor = [200, 0, 0];
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                },
                didDrawPage: (data) => {
                    const curr = doc.internal.getNumberOfPages();
                    if (curr > sumPageCount) {
                        sumPageCount = curr;
                        doc.setFontSize(8);
                        doc.text(`Página Anexo: ${curr} de ${sumPageCount}`, pageWidth - 40, pageHeight - 10);
                        const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                        doc.text(`MetalFisa - Rastreabilidade de Operações - Gerado em: ${dataGeracao} por ${userName}`, 10, pageHeight - 10);
                    }
                }
            });
        }

        // --- Início: Anexar Desenhos ---
        // Usamos um PDFDocument novo e limpo como destino final para evitar
        // referências cruzadas inválidas entre documentos distintos (causa do Adobe Error 18).
        let finalPdf;
        try {
            const espelhoBuffer = doc.output('arraybuffer');

            // Documento destino limpo — sem herdar xref do jsPDF
            finalPdf = await PDFDocument.create();

            // Copiar todas as páginas do relatório jsPDF para o doc limpo
            const jspdfDoc = await PDFDocument.load(espelhoBuffer, { ignoreEncryption: true });
            const jspdfCopied = await finalPdf.copyPages(jspdfDoc, jspdfDoc.getPageIndices());
            jspdfCopied.forEach(p => finalPdf.addPage(p));

            // Fonte embutida no doc destino — todas as páginas de desenho viverão aqui
            const helveticaFont = await finalPdf.embedFont(StandardFonts.HelveticaBold);
            const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

            for (const part of partsSummaryArray) {
                if (!part.hasPdf || !part.pdfUrl) continue;
                try {
                    const fileUrl = `/docs/view?path=${encodeURIComponent(part.pdfUrl)}`;
                    const response = await api.get(fileUrl, { responseType: 'arraybuffer' });
                    const drawingBuffer = response.data;

                    const drawingDoc = await PDFDocument.load(drawingBuffer, { ignoreEncryption: true });

                    // Copiar páginas para finalPdf e só então desenhar o watermark
                    // (fonte e páginas no mesmo contexto = referências válidas)
                    const copiedPages = await finalPdf.copyPages(drawingDoc, drawingDoc.getPageIndices());

                    const qtyText = Number(part.qtdTotal).toFixed(4).replace(/\.?0+$/, '');
                    const textData = `CÓPIA CONTROLADA | DATA: ${dataGeracao} | USUÁRIO: ${userName} | QTD NECESSÁRIA: ${qtyText} ${part.um}`;

                    for (const page of copiedPages) {
                        finalPdf.addPage(page);

                        const { width, height } = page.getSize();
                        const minSide = Math.min(width, height);
                        const scale = Math.max(1, minSide / 595);
                        const rectWidth = 450 * scale;
                        const rectHeight = 20 * scale;
                        const fontSize = 6 * scale;
                        const offsetY = 30 * scale;

                        page.drawRectangle({
                            x: 10 * scale,
                            y: height - offsetY,
                            width: rectWidth,
                            height: rectHeight,
                            color: rgb(1, 1, 1),
                            borderColor: rgb(0.8, 0.1, 0.1),
                            borderWidth: 1 * scale,
                        });

                        page.drawText(textData, {
                            x: 15 * scale,
                            y: height - offsetY + (5 * scale),
                            size: fontSize,
                            font: helveticaFont,
                            color: rgb(0.8, 0.1, 0.1),
                        });
                    }
                } catch (err) {
                    console.warn(`Não foi possível carregar ou carimbar o desenho para ${part.codigo}`, err);
                }
            }
        } catch (err) {
            console.error("Erro manipulando pdf-lib:", err);
            throw err;
        }

        const mergedPdfBytes = await finalPdf.save({ useObjectStreams: false });
        const safePedido = mirrorData.pedido.pedido ? String(mirrorData.pedido.pedido).replace(/[^a-zA-Z0-9]/g, '') : 'Desconhecido';
        
        // Disparar download
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Espelho_OP_com_Desenhos_${safePedido}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error("Error generating OP Operation Refresh PDF with drawings:", error);
        alert("Erro ao gerar PDF de rastreabilidade com desenhos. Verifique o console.");
    }
};
