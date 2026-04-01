import jsPDFLib from 'jspdf';
const jsPDF = jsPDFLib.jsPDF || jsPDFLib;
import autoTable from 'jspdf-autotable';

/**
 * Generates an "Espelho da Ordem de Produção" grouped strictly by Operation Code (Recurso).
 * Prioritizes traceability including PV, Item, and Parent Product for every line.
 * @param {Object} mirrorData - Data returned by /api/pedidos/op-mirror/:id
 */
export const generateOPByOperationPdf = (mirrorData) => {
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
                            proxOp: proxOp,
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
                "Próx. Operação",
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
                c.proxOp,
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
                    0: { halign: 'center', cellWidth: 13 }, // PV
                    1: { halign: 'center', cellWidth: 8 }, // Item
                    2: { halign: 'center', cellWidth: 8 }, // Nível
                    3: { cellWidth: 28 }, // Prod Pai
                    4: { halign: 'center', cellWidth: 20 }, // OP
                    5: { cellWidth: 30 }, // Componente
                    6: { cellWidth: 'auto' }, // Descricao
                    7: { halign: 'center', cellWidth: 45, fontStyle: 'bold', textColor: [50, 50, 200] }, // Prox Op
                    8: { halign: 'right', cellWidth: 14 }, // Qtd
                    9: { halign: 'center', cellWidth: 8 }  // UM
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
            doc.text(`MetalFisa - Rastreabilidade de Operações - Gerado em: ${dataGeracao}`, 10, pageHeight - 10);
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

            const summaryColumns = ["Código", "Descrição do Material / Peça", "UM", "Qtde Total Necessária"];
            const summaryRows = partsSummaryArray.map(p => [
                p.codigo,
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
                    0: { cellWidth: 40, fontStyle: 'bold' }, // Código
                    1: { cellWidth: 'auto' }, // Descricao
                    2: { halign: 'center', cellWidth: 20 }, // UM
                    3: { halign: 'right', cellWidth: 40, fontStyle: 'bold', textColor: [0, 100, 0] } // Qtde
                },
                didDrawPage: (data) => {
                    doc.setFontSize(8);
                    const curr = doc.internal.getNumberOfPages();
                    doc.text(`Página Anexo: ${curr} de ${sumPageCount}`, pageWidth - 40, pageHeight - 10);
                }
            });
        }

        const safePedido = mirrorData.pedido.pedido ? String(mirrorData.pedido.pedido).replace(/[^a-zA-Z0-9]/g, '') : 'Desconhecido';
        doc.save(`Rastreabilidade_Operacoes_PV_${safePedido}.pdf`);

    } catch (error) {
        console.error("Error generating OP Operation Refresh PDF:", error);
        alert("Erro ao gerar PDF de rastreabilidade. Verifique o console.");
    }
};
