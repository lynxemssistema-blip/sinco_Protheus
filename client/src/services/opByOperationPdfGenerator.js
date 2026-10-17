import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import autoTable from 'jspdf-autotable';
import { getCompanyShortName } from './companyBranding';

const formatDatePCP = (dateStr) => {
    if (!dateStr) return '-';
    const str = String(dateStr).trim();
    if (str.includes('/')) return str;
    if (str.includes('-')) {
        const parts = str.split('T')[0].split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    }
    if (str.length === 8 && /^\d+$/.test(str)) {
        return `${str.substring(6, 8)}/${str.substring(4, 6)}/${str.substring(0, 4)}`;
    }
    return str;
};

const drawWatermark = (doc, pedidoNum, clientName) => {
    const clientFirstName = String(clientName || '').trim().split(' ')[0].toUpperCase();
    const watermarkText = `PEDIDO: ${pedidoNum || ''} - ${clientFirstName}`;
    if (typeof doc.saveGraphicsState === 'function') {
        try {
            doc.saveGraphicsState();
            if (typeof doc.GState === 'function') {
                doc.setGState(new doc.GState({ opacity: 0.1 }));
            }
        } catch (e) {}
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(242, 242, 242);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.text(watermarkText, pageWidth / 2, pageHeight / 2, { align: 'center', angle: 30 });
    if (typeof doc.restoreGraphicsState === 'function') {
        try {
            doc.restoreGraphicsState();
        } catch (e) {}
    }
};

/**
 * Generates an "Espelho da Ordem de Produção" grouped strictly by Operation Code (Recurso).
 * Prioritizes traceability including PV, Item, and Parent Product for every line.
 * @param {Object} mirrorData - Data returned by /api/pedidos/op-mirror/:id
 */
export const generateOPByOperationPdf = (mirrorData, returnBuffer = false, batchContext = null) => {
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
                const isLevel0 = component.nivel === 0 || component.nivel === undefined;
                let rawQtd = isLevel0
                    ? parseFloat(component.quantidade_venda || component.quantidade_calculada || component.qtd_total || 0)
                    : parseFloat(component.quantidade_calculada || component.qtd_total || 0);
                
                if (batchContext && batchContext.is_fraction && batchContext.visual_qtd) {
                    const orderQtyOriginal = mirrorData.pedido.quantidade || 1;
                    const fractionQty = parseFloat(batchContext.visual_qtd);
                    rawQtd = isLevel0 ? fractionQty : (rawQtd / orderQtyOriginal) * fractionQty;
                }

                if (component.operacoes && Array.isArray(component.operacoes) && component.operacoes.length > 0) {
                    component.operacoes.forEach((op, index) => {
                        const recurso = op.recurso ? op.recurso.trim().toUpperCase() : 'INDEFINIDO';

                        let proxOp = 'FINALIZADA';
                        if (index + 1 < component.operacoes.length) {
                             const nOp = component.operacoes[index + 1];
                             const rec = nOp.recurso ? nOp.recurso.trim().toUpperCase() : 'INDEFINIDO';
                             const desc = nOp.desc_operacao ? nOp.desc_operacao.trim().toUpperCase() : '';
                             proxOp = desc ? `${rec} - ${desc}` : rec;
                        }

                        if (!operationsMap.has(recurso)) {
                            operationsMap.set(recurso, {
                                recurso: recurso,
                                desc_operacao: op.desc_operacao || '',
                                components: []
                            });
                        }

                        operationsMap.get(recurso).components.push({
                            pedido: mirrorData.pedido.pedido,
                            itemPedido: itemGroup.item_pedido,
                            produtoPai: parentCode,
                            codigo: component.codigo,
                            descricao: component.descricao,
                            tipo: component.tipo,
                            proxOp: proxOp,
                            qtdTotal: rawQtd,
                            um: component.unidade || component.um || 'UN',
                            nivel: isLevel0 ? 'PAI' : component.nivel,
                            op_num: (batchContext && batchContext.visual_op) ? batchContext.visual_op : (component.op_num || itemGroup.produto_principal?.op_num || '-'),
                            data_pcp: itemGroup.data_pcp || null
                        });
                    });
                } else {
                    // Handle items without operations (e.g. raw materials, purchased parts, missing routing)
                    const recurso = 'SEM OPERAÇÃO / ALMOXARIFADO';
                    if (!operationsMap.has(recurso)) {
                        operationsMap.set(recurso, {
                            recurso: recurso,
                            desc_operacao: 'Itens sem roteiro (Separação direta)',
                            components: []
                        });
                    }
                    operationsMap.get(recurso).components.push({
                        pedido: mirrorData.pedido.pedido,
                        itemPedido: itemGroup.item_pedido,
                        produtoPai: parentCode,
                        codigo: component.codigo,
                        descricao: component.descricao,
                        tipo: component.tipo,
                        proxOp: '-',
                        qtdTotal: rawQtd,
                        um: component.unidade || component.um || 'UN',
                        nivel: isLevel0 ? 'PAI' : component.nivel,
                        op_num: (batchContext && batchContext.visual_op) ? batchContext.visual_op : (component.op_num || itemGroup.produto_principal?.op_num || '-'),
                        data_pcp: itemGroup.data_pcp || null
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
            if (returnBuffer) {
                // Generate a fallback page so downstream generators always get a valid buffer
                console.warn('[opByOperationPdfGenerator] Nenhuma operação encontrada — gerando capa de aviso.');
                const fallbackDoc = new jsPDF('landscape', 'mm', 'a4');
                const fw = fallbackDoc.internal.pageSize.getWidth();
                const fh = fallbackDoc.internal.pageSize.getHeight();
                fallbackDoc.setFillColor(30, 58, 95);
                fallbackDoc.rect(10, 5, 40, 15, 'F');
                fallbackDoc.setTextColor(255, 255, 255);
                fallbackDoc.setFontSize(12);
                fallbackDoc.text(getCompanyShortName(), 30, 14, { align: 'center' });
                fallbackDoc.setTextColor(0, 0, 0);
                fallbackDoc.setFontSize(16);
                fallbackDoc.setFont('helvetica', 'bold');
                fallbackDoc.text('ESPELHO OP - SEM OPERAÇÕES ENCONTRADAS', fw / 2, fh / 2 - 10, { align: 'center' });
                fallbackDoc.setFontSize(10);
                fallbackDoc.setFont('helvetica', 'normal');
                fallbackDoc.text(`Pedido: ${mirrorData.pedido?.pedido || '-'} | Cliente: ${mirrorData.pedido?.nome_cliente || '-'}`, fw / 2, fh / 2 + 5, { align: 'center' });
                fallbackDoc.text('Nenhum roteiro de fabricação foi localizado para este pedido.', fw / 2, fh / 2 + 15, { align: 'center' });
                return fallbackDoc.output('arraybuffer');
            }
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
                // Draw watermark first so it sits behind table text
                drawWatermark(doc, mirrorData.pedido?.pedido, mirrorData.pedido?.nome_cliente);

                // Base Header
                doc.setFillColor(30, 58, 95);
                doc.rect(10, 5, 40, 15, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(12);
                doc.text(getCompanyShortName(), 30, 14, { align: 'center' });
                doc.setTextColor(0, 0, 0);

                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text("ESPELHO OP - POR OPERAÇÃO (RASTREABILIDADE)", pageWidth / 2, 12, { align: 'center' });

                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.text(`EMISSÃO: ${mirrorData.pedido?.emissao || ''}`, pageWidth - 10, 8, { align: 'right' });
                doc.setFont('helvetica', 'bold');
                doc.text(`PEDIDO PV: ${mirrorData.pedido?.pedido || ''}`, pageWidth - 10, 13, { align: 'right' });

                const uniqueDates = [...new Set(groupData.components.map(c => c.data_pcp).filter(Boolean))];
                const dataPcpFormatted = uniqueDates.length > 0 
                    ? uniqueDates.map(formatDatePCP).join(', ') 
                    : (mirrorData.pedido?.data_pcp ? formatDatePCP(mirrorData.pedido.data_pcp) : '-');
                doc.setFont('helvetica', 'bold');
                doc.text(`Data de Entrega Prevista: ${dataPcpFormatted}`, pageWidth - 10, 18, { align: 'right' });

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
                "Seq. OP (MP)",
                "Componente",
                "Descrição",
                "Próx. Operação",
                "Qtd. Req.",
                "UM",
                "Qtd. Exec.",
                "Data",
                "Assinatura / Operador"
            ];

            const tableRows = groupData.components.map(c => {
                const isMaterial = c.tipo === 'MP' || c.tipo === 'MC' || ['MTC-', 'MTA-', 'MTT-', 'MTD-', 'MTU-', 'MTE-'].includes((c.codigo || '').substring(0, 4).toUpperCase());
                let seqOpMp = '-';
                if (isMaterial && c.op_num && c.op_num.length > 3) {
                    const sequencial = c.op_num.slice(-3);
                    seqOpMp = `${c.pedido}-${c.itemPedido}-${sequencial}`;
                }

                return [
                    c.pedido,
                    c.itemPedido,
                    c.nivel !== undefined ? c.nivel : '-',
                    c.produtoPai,
                    c.op_num,
                    seqOpMp,
                    c.codigo,
                    c.descricao,
                    c.proxOp,
                    Number(c.qtdTotal).toFixed(2),
                    c.um,
                    "", // Qtd. Exec. (campo em branco para preenchimento a caneta)
                    "", // Data (campo em branco)
                    ""  // Assinatura / Operador (campo em branco)
                ];
            });

            autoTable(doc, {
                startY: 53,
                head: [tableColumns],
                body: tableRows,
                theme: 'grid',
                headStyles: {
                    fillColor: [240, 240, 240],
                    textColor: [50, 50, 50],
                    fontStyle: 'bold',
                    fontSize: 7.5,
                    halign: 'center'
                },
                bodyStyles: {
                    fontSize: 7.5,
                    cellPadding: 2
                },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 11 }, // PV
                    1: { halign: 'center', cellWidth: 7 },  // Item
                    2: { halign: 'center', cellWidth: 7 },  // Nível
                    3: { cellWidth: 22 },                   // Prod Pai
                    4: { halign: 'center', cellWidth: 16 }, // OP
                    5: { halign: 'center', cellWidth: 20, fontStyle: 'bold' }, // Seq. OP (MP)
                    6: { cellWidth: 26 },                   // Componente
                    7: { cellWidth: 'auto' },               // Descrição
                    8: { halign: 'center', cellWidth: 35, fontStyle: 'bold', textColor: [50, 50, 200] }, // Próx. Operação
                    9: { halign: 'right', cellWidth: 12 },   // Qtd. Req.
                    10: { halign: 'center', cellWidth: 7 },  // UM
                    11: { halign: 'center', cellWidth: 16 }, // Qtd. Exec.
                    12: { halign: 'center', cellWidth: 18 }, // Data
                    13: { halign: 'center', cellWidth: 30 }  // Assinatura / Operador
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
            doc.text(`Lynx - Rastreabilidade de Operações - Gerado em: ${dataGeracao}`, 10, pageHeight - 10);
        }

        // --- NOVO RECURSO: RESUMO GERAL DE PEÇAS AGLUTINADAS ---

        // 1. Coletar todas as peças exclusivas e somar quantidades
        const partsSummaryMap = new Map();

        mirrorData.itens.forEach(itemGroup => {
            const processPart = (component) => {
                const code = component.codigo || 'S/COD';

                // Pega a quantidade bruta/total do componente
                const isLevel0 = component.nivel === 0 || component.nivel === undefined;
                let rawQtd = isLevel0
                    ? parseFloat(component.quantidade_venda || component.quantidade_calculada || component.qtd_total || 0)
                    : parseFloat(component.quantidade_calculada || component.qtd_total || 0);
                
                if (batchContext && batchContext.is_fraction && batchContext.visual_qtd) {
                    const orderQtyOriginal = mirrorData.pedido.quantidade || 1;
                    const fractionQty = parseFloat(batchContext.visual_qtd);
                    rawQtd = isLevel0 ? fractionQty : (rawQtd / orderQtyOriginal) * fractionQty;
                }

                const isMaterial = component.tipo === 'MP' || component.tipo === 'MC' || ['MTC-', 'MTA-', 'MTT-', 'MTD-', 'MTU-', 'MTE-'].includes((code || '').substring(0, 4).toUpperCase());
                let seqOpMp = '-';
                if (isMaterial && component.op_num && component.op_num.length > 3) {
                    const sequencial = component.op_num.slice(-3);
                    const itemPedido = itemGroup.item_pedido || '';
                    const pedido = mirrorData.pedido?.pedido || '';
                    seqOpMp = `${pedido}-${itemPedido}-${sequencial}`;
                }

                const mapKey = isMaterial && seqOpMp !== '-' ? `${code}||${seqOpMp}` : code;

                if (partsSummaryMap.has(mapKey)) {
                    partsSummaryMap.get(mapKey).qtdTotal += rawQtd;
                } else {
                    partsSummaryMap.set(mapKey, {
                        codigo: code,
                        seqOpMp: seqOpMp,
                        descricao: component.descricao || '',
                        um: component.unidade || component.um || 'UN',
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

            const summaryColumns = ["Código", "Seq. OP (MP)", "Descrição do Material / Peça", "UM", "Qtde Total Necessária"];
            const summaryRows = partsSummaryArray.map(p => [
                p.codigo,
                p.seqOpMp || '-',
                p.descricao,
                p.um,
                Number(p.qtdTotal).toFixed(4).replace(/\.?0+$/, '') // Formatação enxuta
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
                    0: { cellWidth: 35, fontStyle: 'bold' }, // Código
                    1: { halign: 'center', cellWidth: 22 }, // Seq. OP
                    2: { cellWidth: 'auto' }, // Descricao
                    3: { halign: 'center', cellWidth: 15 }, // UM
                    4: { halign: 'right', cellWidth: 32, fontStyle: 'bold', textColor: [0, 100, 0] } // Qtde
                },
                didDrawPage: (data) => {
                    drawWatermark(doc, mirrorData.pedido?.pedido, mirrorData.pedido?.nome_cliente);
                    doc.setFontSize(8);
                    const curr = doc.internal.getNumberOfPages();
                    doc.text(`Página Anexo: ${curr} de ${sumPageCount}`, pageWidth - 40, pageHeight - 10);
                }
            });
        }
        if (returnBuffer) {
            return doc.output('arraybuffer');
        }

        const safePedido = mirrorData.pedido.pedido ? String(mirrorData.pedido.pedido).replace(/[^a-zA-Z0-9]/g, '') : 'Desconhecido';
        const opNumRaw = mirrorData.opNumFromTable || ((mirrorData.items && mirrorData.items.length > 0) ? (mirrorData.items[0].op_num_completa || mirrorData.items[0].op_num || '') : '');
        const opSuffix = opNumRaw ? `_OP_${opNumRaw.replace(/[^a-zA-Z0-9]/g, '')}` : '';
        doc.save(`Rastreabilidade_Operacoes_PV_${safePedido}${opSuffix}.pdf`);

    } catch (error) {
        console.error("Error generating OP Operation Refresh PDF:", error);
        alert("Erro ao gerar PDF de rastreabilidade. Verifique o console.");
    }
};
