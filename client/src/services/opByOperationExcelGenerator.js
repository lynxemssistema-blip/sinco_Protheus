import * as XLSX from 'xlsx';

/**
 * Generates an Excel spreadsheet for the Ordem de Produção grouped by Operation Code (Recurso).
 * Includes three tabs:
 * 1. Rastreabilidade OPs       — each component listed under its own operation codes
 * 2. Resumo de Materiais       — aggregated quantities per component code
 * 3. Materiais por Operação    — NEW: for each recurso/operation, lists ALL materials that pass
 *    through it — the component itself AND every BOM child across ALL levels (BFS traversal)
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

        // ── HELPER: BFS — retorna todos os descendentes de um código na BOM plana ──
        // Percorre o campo `pai` da estrutura_linear para encontrar filhos a qualquer nível.
        const getAllDescendants = (rootCode, estruturaLinear) => {
            // Constrói índice pai → [filhos] para percurso O(N) em vez de O(N²)
            const childrenOf = new Map();
            (estruturaLinear || []).forEach(row => {
                const pai = (row.pai || '').trim().toUpperCase();
                if (!childrenOf.has(pai)) childrenOf.set(pai, []);
                childrenOf.get(pai).push(row);
            });

            const visited = new Set();
            const queue   = [rootCode.trim().toUpperCase()];
            const result  = [];

            while (queue.length > 0) {
                const current = queue.shift();
                if (visited.has(current)) continue;
                visited.add(current);

                (childrenOf.get(current) || []).forEach(child => {
                    result.push(child);
                    const childCode = (child.codigo || '').trim().toUpperCase();
                    if (!visited.has(childCode)) queue.push(childCode);
                });
            }
            return result;
        };

        // ─────────────────────────────────────────────────────────────────────────
        // ABA 1: RASTREABILIDADE OPs
        // Cada componente é listado sob SUAS PRÓPRIAS operações do roteiro (SG2).
        // ─────────────────────────────────────────────────────────────────────────
        const detailedRows = [];

        mirrorData.itens.forEach(itemGroup => {
            const processComponentForDetailed = (component, parentCode = 'PRODUTO FINAL') => {
                if (component.operacoes && Array.isArray(component.operacoes) && component.operacoes.length > 0) {
                    component.operacoes.forEach(op => {
                        const recurso = op.recurso ? op.recurso.trim().toUpperCase() : 'INDEFINIDO';
                        const isLevel0 = component.nivel === 0 || component.nivel === undefined;
                        const rawQtd   = isLevel0
                            ? parseFloat(component.quantidade_venda || component.quantidade_calculada || component.qtd_total || 0)
                            : parseFloat(component.quantidade_calculada || component.qtd_total || 0);

                        detailedRows.push({
                            "Operação (Recurso)": `${recurso} - ${op.desc_operacao || ''}`,
                            "Pedido (PV)":        mirrorData.pedido.pedido,
                            "Produto Pai (BOM)":  parentCode,
                            "Nível":              isLevel0 ? 'PAI' : component.nivel !== undefined ? component.nivel : '-',
                            "OP Associada":       component.op_num || itemGroup.produto_principal?.op_num || '-',
                            "Cód Componente":     component.codigo,
                            "Descrição do Componente": component.descricao,
                            "Qtde Requerida":     rawQtd,
                            "UM":                 component.unidade || component.um || 'UN'
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

        detailedRows.sort((a, b) => a["Operação (Recurso)"].localeCompare(b["Operação (Recurso)"]));

        // ─────────────────────────────────────────────────────────────────────────
        // ABA 2: RESUMO GERAL DE PEÇAS AGLUTINADAS
        // ─────────────────────────────────────────────────────────────────────────
        const partsSummaryMap = new Map();

        mirrorData.itens.forEach(itemGroup => {
            const processPart = (component) => {
                const code     = component.codigo || 'S/COD';
                const isLevel0 = component.nivel === 0 || component.nivel === undefined;
                const rawQtd   = isLevel0
                    ? parseFloat(component.quantidade_venda || component.quantidade_calculada || component.qtd_total || 0)
                    : parseFloat(component.quantidade_calculada || component.qtd_total || 0);

                if (partsSummaryMap.has(code)) {
                    partsSummaryMap.get(code).qtdTotal += rawQtd;
                } else {
                    partsSummaryMap.set(code, {
                        codigo:    code,
                        descricao: component.descricao || '',
                        um:        component.unidade || component.um || 'UN',
                        qtdTotal:  rawQtd
                    });
                }
            };

            if (itemGroup.produto_principal) processPart(itemGroup.produto_principal);
            if (itemGroup.estrutura_linear && Array.isArray(itemGroup.estrutura_linear)) {
                itemGroup.estrutura_linear.forEach(child => processPart(child));
            }
        });

        const summaryRows = Array.from(partsSummaryMap.values())
            .filter(part => part.qtdTotal > 0)
            .sort((a, b) => a.descricao.localeCompare(b.descricao))
            .map(p => ({
                "Cód Componente":                     p.codigo,
                "Descrição do Componente / Material": p.descricao,
                "UM":                                 p.um,
                "Qtde Total Necessária":              parseFloat(Number(p.qtdTotal).toFixed(4))
            }));

        // ─────────────────────────────────────────────────────────────────────────
        // ABA 3: MATERIAIS POR OPERAÇÃO  ← NOVA (todos os níveis)
        //
        // Responde: "O que é consumido na operação MO0020 em TODA a estrutura?"
        //
        // Para cada componente em qualquer nível que possua a operação X no roteiro:
        //   → Emite uma linha DIRETO  (o próprio componente)
        //   → Emite linhas  FILHO nv? (cada descendente via BFS no estrutura_linear)
        //
        // Isso garante que MO0020 mostre não só o produto-pai que usa MO0020, mas
        // todos os sub-componentes que entram nessa operação em qualquer nível da BOM.
        // ─────────────────────────────────────────────────────────────────────────
        const matByOpRows = [];

        mirrorData.itens.forEach(itemGroup => {
            const estrutura   = itemGroup.estrutura_linear || [];
            const itemPedido  = itemGroup.item_pedido || '-';

            const processForOp = (component, opPrincipal) => {
                if (!component.operacoes || !Array.isArray(component.operacoes) || component.operacoes.length === 0) return;

                const isLevel0  = component.nivel === 0 || component.nivel === undefined;
                const compCode  = (component.codigo || '').trim();
                const compQtd   = isLevel0
                    ? parseFloat(component.quantidade_venda || component.quantidade_calculada || component.qtd_total || 0)
                    : parseFloat(component.quantidade_calculada || component.qtd_total || 0);

                component.operacoes.forEach(op => {
                    const recurso      = (op.recurso || 'INDEFINIDO').trim().toUpperCase();
                    const recursoLabel = op.desc_operacao ? `${recurso} - ${op.desc_operacao}` : recurso;

                    // ── DIRETO: o componente que tem esta operação ──
                    matByOpRows.push({
                        "Operação (Recurso)":      recursoLabel,
                        "Seq. Operação":           op.seq || '-',
                        "Pedido (PV)":             mirrorData.pedido.pedido,
                        "Item PV":                 itemPedido,
                        "OP":                      opPrincipal || '-',
                        "Relação":                 'DIRETO',
                        "Nível na BOM":            isLevel0 ? 0 : (component.nivel ?? '-'),
                        "Cód Componente/Material": compCode,
                        "Descrição":               component.descricao || '',
                        "Qtde Requerida":          compQtd,
                        "UM":                      component.unidade || component.um || 'UN',
                    });

                    // ── FILHOS: todos os descendentes na BOM (qualquer nível) ──
                    const descendants = getAllDescendants(compCode, estrutura);
                    descendants.forEach(desc => {
                        const descQtd = parseFloat(desc.quantidade_calculada || desc.qtd_total || 0);
                        matByOpRows.push({
                            "Operação (Recurso)":      recursoLabel,
                            "Seq. Operação":           op.seq || '-',
                            "Pedido (PV)":             mirrorData.pedido.pedido,
                            "Item PV":                 itemPedido,
                            "OP":                      opPrincipal || '-',
                            "Relação":                 `FILHO (nv${desc.nivel})`,
                            "Nível na BOM":            desc.nivel ?? '-',
                            "Cód Componente/Material": (desc.codigo || '').trim(),
                            "Descrição":               desc.descricao || '',
                            "Qtde Requerida":          descQtd,
                            "UM":                      desc.unidade || desc.um || 'UN',
                        });
                    });
                });
            };

            // Nível 0 — produto principal
            if (itemGroup.produto_principal) {
                processForOp(itemGroup.produto_principal, itemGroup.produto_principal.op_num);
            }

            // Níveis 1..N — todos os filhos na estrutura_linear
            estrutura.forEach(child => {
                processForOp(child, child.op_num || itemGroup.produto_principal?.op_num);
            });
        });

        // Ordena: por operação → DIRETO antes de FILHO → por código
        matByOpRows.sort((a, b) => {
            const opCmp = a["Operação (Recurso)"].localeCompare(b["Operação (Recurso)"]);
            if (opCmp !== 0) return opCmp;
            const aDireto = a["Relação"] === 'DIRETO';
            const bDireto = b["Relação"] === 'DIRETO';
            if (aDireto && !bDireto) return -1;
            if (!aDireto && bDireto) return  1;
            return a["Cód Componente/Material"].localeCompare(b["Cód Componente/Material"]);
        });

        // ─────────────────────────────────────────────────────────────────────────
        // MONTAR WORKBOOK
        // ─────────────────────────────────────────────────────────────────────────
        let hasData = false;

        if (detailedRows.length > 0) {
            const wsDetailed = XLSX.utils.json_to_sheet(detailedRows);
            XLSX.utils.book_append_sheet(wb, wsDetailed, "Rastreabilidade OPs");
            wsDetailed['!cols'] = [
                { wch: 30 }, { wch: 15 }, { wch: 25 }, { wch: 10 },
                { wch: 15 }, { wch: 25 }, { wch: 50 }, { wch: 15 }, { wch: 8 }
            ];
            hasData = true;
        }

        if (summaryRows.length > 0) {
            const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
            XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo de Materiais");
            wsSummary['!cols'] = [
                { wch: 25 }, { wch: 60 }, { wch: 10 }, { wch: 20 }
            ];
            hasData = true;
        }

        if (matByOpRows.length > 0) {
            const wsMatByOp = XLSX.utils.json_to_sheet(matByOpRows);
            XLSX.utils.book_append_sheet(wb, wsMatByOp, "Materiais por Operação");
            wsMatByOp['!cols'] = [
                { wch: 32 }, // Operação (Recurso)
                { wch: 12 }, // Seq. Operação
                { wch: 14 }, // Pedido
                { wch: 10 }, // Item PV
                { wch: 10 }, // OP
                { wch: 16 }, // Relação (DIRETO / FILHO nv2...)
                { wch: 12 }, // Nível na BOM
                { wch: 28 }, // Cód Componente/Material
                { wch: 55 }, // Descrição
                { wch: 16 }, // Qtde Requerida
                { wch: 8 }   // UM
            ];
            hasData = true;
        }

        if (!hasData) {
            alert("Nenhum dado produtivo encontrado para exportar.");
            return;
        }

        const safePedido = mirrorData.pedido.pedido
            ? String(mirrorData.pedido.pedido).replace(/[^a-zA-Z0-9]/g, '')
            : 'Desconhecido';
        XLSX.writeFile(wb, `Rastreabilidade_OPs_PV_${safePedido}.xlsx`);

    } catch (error) {
        console.error("Error generating Excel:", error);
        alert("Erro ao exportar detalhamento para o Excel. Verifique o console.");
    }
};




