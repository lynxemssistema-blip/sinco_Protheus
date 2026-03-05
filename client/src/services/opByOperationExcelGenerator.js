import * as XLSX from 'xlsx';

/**
 * Generates an Excel spreadsheet for the Ordem de Produção grouped by Operation Code (Recurso).
 * Includes two tabs:
 * 1. Rastreabilidade OPs (Detailed list of components per operation)
 * 2. Resumo Geral de Materiais (Aggregated quantities per component code)
 * 
 * @param {Object} mirrorData - Data returned by /api/pedidos/op-mirror/:id
 */
export const opByOperationExcelGenerator = (mirrorData) => {
    try {
        if (!mirrorData || !mirrorData.pedido) {
            console.error("Invalid data provided to Excel generator");
            alert("Dados inválidos para exportação para Excel.");
            return;
        }

        const wb = XLSX.utils.book_new();

        // --- ABA 1: RASTREABILIDADE OPs ---
        // Flatten and Group by Operation Code (Recurso)
        const detailedRows = [];

        // Track the operations
        mirrorData.itens.forEach(itemGroup => {
            const processComponentForDetailed = (component, parentCode = 'PRODUTO FINAL') => {
                if (component.operacoes && Array.isArray(component.operacoes) && component.operacoes.length > 0) {
                    component.operacoes.forEach(op => {
                        const recurso = op.recurso ? op.recurso.trim().toUpperCase() : 'INDEFINIDO';

                        const isLevel0 = component.nivel === 0 || component.nivel === undefined;
                        const rawQtd = isLevel0
                            ? parseFloat(component.quantidade_venda || component.quantidade_calculada || component.qtd_total || 0)
                            : parseFloat(component.quantidade_calculada || component.qtd_total || 0);

                        detailedRows.push({
                            "Operação (Recurso)": `${recurso} - ${op.desc_operacao || ''}`,
                            "Pedido (PV)": mirrorData.pedido.pedido,
                            "Produto Pai (BOM)": parentCode,
                            "Nível": isLevel0 ? 'PAI' : component.nivel !== undefined ? component.nivel : '-',
                            "OP Associada": component.op_num || itemGroup.produto_principal?.op_num || '-',
                            "Cód Componente": component.codigo,
                            "Descrição do Componente": component.descricao,
                            "Qtde Requerida": rawQtd,
                            "UM": component.unidade || component.um || 'UN'
                        });
                    });
                }
            };

            if (itemGroup.produto_principal) {
                processComponentForDetailed(itemGroup.produto_principal, itemGroup.produto_principal.codigo);
            }

            if (itemGroup.estrutura_linear && Array.isArray(itemGroup.estrutura_linear)) {
                itemGroup.estrutura_linear.forEach(child => {
                    const parentForChild = child.pai || itemGroup.produto_principal?.codigo || child.codigo;
                    processComponentForDetailed(child, parentForChild);
                });
            }
        });

        // Sort detailed rows by Operation name
        detailedRows.sort((a, b) => a["Operação (Recurso)"].localeCompare(b["Operação (Recurso)"]));

        // --- ABA 2: RESUMO GERAL DE PEÇAS AGLUTINADAS ---
        const partsSummaryMap = new Map();

        mirrorData.itens.forEach(itemGroup => {
            const processPart = (component) => {
                const code = component.codigo || 'S/COD';

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

            if (itemGroup.produto_principal) {
                processPart(itemGroup.produto_principal);
            }

            if (itemGroup.estrutura_linear && Array.isArray(itemGroup.estrutura_linear)) {
                itemGroup.estrutura_linear.forEach(child => {
                    processPart(child);
                });
            }
        });

        const summaryRows = Array.from(partsSummaryMap.values())
            .filter(part => part.qtdTotal > 0)
            .sort((a, b) => a.descricao.localeCompare(b.descricao))
            .map(p => ({
                "Cód Componente": p.codigo,
                "Descrição do Componente / Material": p.descricao,
                "UM": p.um,
                "Qtde Total Necessária": parseFloat(Number(p.qtdTotal).toFixed(4))
            }));

        // --- BUILD WORKBOOK ---

        let hasData = false;

        // Add Detailed Worksheet
        if (detailedRows.length > 0) {
            const wsDetailed = XLSX.utils.json_to_sheet(detailedRows);
            XLSX.utils.book_append_sheet(wb, wsDetailed, "Rastreabilidade OPs");

            // Adjust column widths
            const wsDetailsCols = [
                { wch: 30 }, // Operação
                { wch: 15 }, // Pedido
                { wch: 25 }, // Produto Pai
                { wch: 10 }, // Nível
                { wch: 15 }, // OP
                { wch: 25 }, // Cód Componente
                { wch: 50 }, // Descrição
                { wch: 15 }, // Qtde
                { wch: 8 }   // UM
            ];
            wsDetailed['!cols'] = wsDetailsCols;
            hasData = true;
        }

        // Add Summary Worksheet
        if (summaryRows.length > 0) {
            const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
            XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo de Materiais");

            // Adjust column widths
            const wsSummaryCols = [
                { wch: 25 }, // Código
                { wch: 60 }, // Descrição
                { wch: 10 }, // UM
                { wch: 20 }  // Qtde
            ];
            wsSummary['!cols'] = wsSummaryCols;
            hasData = true;
        }

        if (!hasData) {
            alert("Nenhum dado produtivo encontrado para exportar.");
            return;
        }

        // Get safe filename
        const safePedido = mirrorData.pedido.pedido ? String(mirrorData.pedido.pedido).replace(/[^a-zA-Z0-9]/g, '') : 'Desconhecido';
        const fileName = `Rastreabilidade_OPs_PV_${safePedido}.xlsx`;

        // Export file
        XLSX.writeFile(wb, fileName);

    } catch (error) {
        console.error("Error generating Excel:", error);
        alert("Erro ao exportar detalhamento para o Excel. Verifique o console.");
    }
};
