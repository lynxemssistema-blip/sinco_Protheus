import ExcelJS from 'exceljs';
import api from './api';
import { downloadBlob } from '../utils/downloadHelper';

const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('pt-BR');
    } catch {
        return dateStr;
    }
};

/**
 * Generates a complete professional Excel workbook for a PCP liberation lot with ALL levels of BOM
 * and consolidated piece totals scaled precisely by the lot quantities.
 * 
 * Includes:
 * 1. Resumo do Lote (todas as OPs, frações, produtos, quantidades e clientes)
 * 2. Roteiro e Operações Detalhadas (todas as etapas de fabricação de cada peça com tempos reais do lote)
 * 3. Estrutura Multi-Nível por OP (árvore completa de componentes com consumo unitário e total por OP)
 * 4. Consolidação Total de Peças (soma global consolidada de cada peça/componente/MP necessária no lote)
 * 
 * @param {Object} release - The release record from app_pcp_releases
 * @param {Object} user - Current user object
 * @param {Function} onProgress - Optional callback (current, total, status)
 */
export const generateLoteExcel = async (release, user = null, onProgress = null) => {
    try {
        const ops = release.ops || [];
        if (ops.length === 0) {
            throw new Error('Nenhuma OP / peça encontrada neste lote.');
        }

        const lotCode = release.codigo_liberacao || release.codigo_lote || 'LOTE_PCP';
        const totalOps = ops.length;

        // Fetch op-mirror for each OP in the lot
        const opMirrors = [];
        for (let i = 0; i < ops.length; i++) {
            const op = ops[i];
            if (onProgress) {
                onProgress(i + 1, totalOps, `Buscando estrutura completa da OP ${op.visual_op || op.op_num || `Ped. ${op.pedido} Item ${op.item}`}...`);
            }

            try {
                const endpoint = `/pedidos/op-mirror/${op.pedido}?item=${op.item}`;
                const res = await api.get(endpoint);
                opMirrors.push({
                    op,
                    data: res.data
                });
            } catch (err) {
                console.warn(`[LoteExcel] Falha ao buscar espelho da OP ${op.pedido}-${op.item}:`, err.message);
                opMirrors.push({
                    op,
                    data: null
                });
            }
        }

        if (onProgress) {
            onProgress(totalOps, totalOps, 'Calculando consolidação e gerando planilhas...');
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = user?.nome || 'Lynx PCP';
        workbook.created = new Date();

        // ─────────────────────────────────────────────────────────────────────────────
        // ABA 1: ÍNDICE GERAL & RESUMO DO LOTE
        // ─────────────────────────────────────────────────────────────────────────────
        const wsSummary = workbook.addWorksheet('1. Índice & Resumo Lote', {
            views: [{ showGridLines: true }]
        });

        // Header Title
        wsSummary.mergeCells('A1:J1');
        const titleCell = wsSummary.getCell('A1');
        titleCell.value = `LYNX — ÍNDICE GERAL E RESUMO MESTRE / LOTE: ${lotCode}`;
        titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } }; // Dark green
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        wsSummary.getRow(1).height = 30;

        // Metadata box
        const totalPecasLote = ops.reduce((acc, o) => acc + (Number(o.qtd || o.visual_qtd) || 0), 0);
        const uniquePedidosCount = new Set(ops.map(o => String(o.pedido || '').trim()).filter(Boolean)).size;
        const statusStr = release.status === 'LIBERADO' ? 'LIBERADO P/ FABRICAÇÃO' : 'ABERTO / PCP';

        const metaRows = [
            ['Código do Lote:', lotCode, 'Liberado por:', release.usuario || user?.nome || 'PCP', 'Data Liberação:', formatDate(release.data_hora)],
            ['Data Prev. PCP:', release.data_pcp || '—', 'Total de OPs:', `${totalOps} OP(s) (${uniquePedidosCount} Pedidos)`, 'Total de Peças:', `${totalPecasLote} un`],
            ['Status do Lote:', statusStr, 'Tipo de Liberação:', 'LOTE AGLUTINADO PCP', 'Índice de Itens:', `${ops.length} itens cadastrados`]
        ];

        metaRows.forEach((rowVals) => {
            const r = wsSummary.addRow(rowVals);
            r.height = 20;
            [1, 3, 5].forEach(colIdx => {
                const c = r.getCell(colIdx);
                c.font = { bold: true, color: { argb: 'FF334155' } };
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            });
        });

        wsSummary.addRow([]); // Blank line

        // Table Header
        const summaryHeaders = ['# (Índice)', 'Pedido Venda', 'Item Ped.', 'OP / Fração', 'Cód. Produto', 'Descrição do Produto', 'Qtd Lote', 'Cliente', 'Data PCP', 'Status'];
        const headerRow = wsSummary.addRow(summaryHeaders);
        headerRow.height = 24;
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15803D' } }; // Emerald green
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                left: { style: 'thin', color: { argb: 'FF94A3B8' } },
                bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
                right: { style: 'thin', color: { argb: 'FF94A3B8' } }
            };
        });

        // Rows
        ops.forEach((op, idx) => {
            const dataRow = wsSummary.addRow([
                idx + 1,
                op.pedido || '-',
                op.item || '-',
                op.visual_op || op.op_num || '-',
                op.codigo || op.produto || op.cod_produto || '-',
                op.descricao || '-',
                Number(op.qtd || op.visual_qtd) || 0,
                op.nome_cliente || op.cliente || '-',
                op.data_entrega_pcp || op.data_pcp || release.data_pcp || '—',
                'LIBERADO PCP'
            ]);
            dataRow.height = 20;

            const isEven = idx % 2 === 0;
            dataRow.eachCell((cell, colIdx) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
                if (!isEven) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                }
                if (colIdx === 1 || colIdx === 7) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                } else if (colIdx === 4) {
                    cell.font = { bold: true, color: { argb: 'FF047857' } };
                }
            });
        });

        // Auto width for Summary
        wsSummary.columns.forEach((col) => {
            let maxLen = 10;
            col.eachCell({ includeEmpty: false }, cell => {
                const len = cell.value ? String(cell.value).length : 0;
                if (len > maxLen) maxLen = Math.min(len + 3, 50);
            });
            col.width = maxLen;
        });

        // ─────────────────────────────────────────────────────────────────────────────
        // ABA 2: ROTEIROS E OPERAÇÕES
        // ─────────────────────────────────────────────────────────────────────────────
        const wsOps = workbook.addWorksheet('2. Roteiros e Operações', {
            views: [{ showGridLines: true }]
        });

        // Header Title
        wsOps.mergeCells('A1:L1');
        const titleOps = wsOps.getCell('A1');
        titleOps.value = `LYNX — ROTEIROS DE FABRICAÇÃO E OPERAÇÕES / LOTE: ${lotCode}`;
        titleOps.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
        titleOps.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }; // Navy Blue
        titleOps.alignment = { horizontal: 'center', vertical: 'middle' };
        wsOps.getRow(1).height = 26;

        const opsHeaders = [
            'OP / Fração', 'Pedido', 'Item', 'Cód. Produto', 'Descrição da Peça',
            'Qtd OP no Lote', 'Seq', 'Recurso / C.T.', 'Operação', 'Descrição da Operação',
            'Tempo Padrão (h/un)', 'Tempo Total no Lote (h)'
        ];

        const opsHeaderRow = wsOps.addRow(opsHeaders);
        opsHeaderRow.height = 22;
        opsHeaderRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }; // Blue
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                left: { style: 'thin', color: { argb: 'FF94A3B8' } },
                bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
                right: { style: 'thin', color: { argb: 'FF94A3B8' } }
            };
        });

        let opsRowCount = 0;
        opMirrors.forEach(({ op, data }) => {
            const visualOp = op.visual_op || op.op_num || '-';
            const opQty = Number(op.qtd || op.visual_qtd || 1);
            const mainProdCode = op.codigo || op.produto || op.cod_produto || '-';
            const mainProdDesc = op.descricao || '-';

            if (!data || !data.itens || data.itens.length === 0) {
                const fallbackRow = wsOps.addRow([
                    visualOp, op.pedido, op.item, mainProdCode, mainProdDesc,
                    opQty, '01', 'FABRICA', 'GERAL', 'Fabricação / Montagem', 0, 0
                ]);
                fallbackRow.height = 18;
                opsRowCount++;
                return;
            }

            const itemGroup = data.itens.find(i => String(i.item || i.item_pedido).trim() === String(op.item).trim()) || data.itens[0];
            const linearList = itemGroup?.estrutura_linear || [];
            const fullOrderQty = Number(itemGroup?.produto_principal?.quantidade_venda || itemGroup?.quantidade_venda || 1);

            const processedCodes = new Set();
            const componentsWithOps = [];

            if (itemGroup?.produto_principal?.operacoes && itemGroup.produto_principal.operacoes.length > 0) {
                componentsWithOps.push({
                    codigo: itemGroup.produto_principal.codigo || mainProdCode,
                    descricao: itemGroup.produto_principal.descricao || mainProdDesc,
                    operacoes: itemGroup.produto_principal.operacoes,
                    qtd: opQty
                });
                processedCodes.add((itemGroup.produto_principal.codigo || '').trim());
            }

            linearList.forEach(comp => {
                const code = (comp.codigo || '').trim();
                if (code && !processedCodes.has(code) && comp.operacoes && comp.operacoes.length > 0) {
                    const unitMultiplier = comp.qtd_unitaria !== undefined ? Number(comp.qtd_unitaria) : (comp.qtd_base !== undefined ? Number(comp.qtd_base) : (fullOrderQty > 0 ? Number(comp.quantidade_calculada || comp.qtd_total || 0) / fullOrderQty : Number(comp.quantidade_calculada || 0)));
                    const compLotQty = unitMultiplier * opQty;

                    componentsWithOps.push({
                        codigo: code,
                        descricao: comp.descricao || '',
                        operacoes: comp.operacoes,
                        qtd: compLotQty
                    });
                    processedCodes.add(code);
                }
            });

            if (componentsWithOps.length === 0) {
                const row = wsOps.addRow([
                    visualOp, op.pedido, op.item, mainProdCode, mainProdDesc,
                    opQty, '01', 'PADRAO', 'PRODUCAO', 'Processo Padrão', 0, 0
                ]);
                row.height = 18;
                opsRowCount++;
            } else {
                componentsWithOps.forEach(c => {
                    (c.operacoes || []).forEach(opItem => {
                        const seq = opItem.operacao || opItem.g2_operac || opItem.seq || '—';
                        const recurso = opItem.recurso || opItem.g2_recurso || opItem.centro_trabalho || '—';
                        const descOper = opItem.descricao || opItem.g2_descri || opItem.nome_operacao || '—';
                        const tempoPadrao = Number(opItem.tempo_padrao || opItem.g2_tempo || opItem.tempo_setup || 0);
                        const tempoTotal = tempoPadrao * c.qtd;

                        const row = wsOps.addRow([
                            visualOp,
                            op.pedido,
                            op.item,
                            c.codigo,
                            c.descricao,
                            Number(c.qtd.toFixed(4)),
                            seq,
                            recurso,
                            opItem.codigo_operacao || seq,
                            descOper,
                            Number(tempoPadrao.toFixed(4)),
                            Number(tempoTotal.toFixed(4))
                        ]);
                        row.height = 18;

                        const isEven = opsRowCount % 2 === 0;
                        if (!isEven) {
                            row.eachCell(cell => {
                                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                            });
                        }
                        opsRowCount++;
                    });
                });
            }
        });

        // Auto width for Ops
        wsOps.columns.forEach(col => {
            let maxLen = 10;
            col.eachCell({ includeEmpty: false }, cell => {
                const len = cell.value ? String(cell.value).length : 0;
                if (len > maxLen) maxLen = Math.min(len + 3, 50);
            });
            col.width = maxLen;
        });

        // ─────────────────────────────────────────────────────────────────────────────
        // ABA 3: ESTRUTURA COMPLETA MULTI-NÍVEL POR OP
        // ─────────────────────────────────────────────────────────────────────────────
        const wsBom = workbook.addWorksheet('3. Estrutura Multi-Nível (BOM)', {
            views: [{ showGridLines: true }]
        });

        // Header Title
        wsBom.mergeCells('A1:K1');
        const titleBom = wsBom.getCell('A1');
        titleBom.value = `LYNX — ESTRUTURA COMPLETA MULTI-NÍVEL DAS OPS / LOTE: ${lotCode}`;
        titleBom.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
        titleBom.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C2D12' } }; // Brown / Bronze
        titleBom.alignment = { horizontal: 'center', vertical: 'middle' };
        wsBom.getRow(1).height = 26;

        const bomHeaders = [
            'OP / Fração', 'Pedido', 'Item', 'Cód. Pai', 'Nível',
            'Cód. Componente / MP', 'Descrição do Componente', 'Qtd Unitária (p/ 1 un)',
            'Qtd Total no Lote', 'Unidade', 'Armazém'
        ];

        const bomHeaderRow = wsBom.addRow(bomHeaders);
        bomHeaderRow.height = 22;
        bomHeaderRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC2410C' } }; // Orange
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                left: { style: 'thin', color: { argb: 'FF94A3B8' } },
                bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
                right: { style: 'thin', color: { argb: 'FF94A3B8' } }
            };
        });

        // Map for consolidating piece totals in Aba 4
        const consolidatedMap = new Map();

        let bomRowCount = 0;
        opMirrors.forEach(({ op, data }) => {
            const visualOp = op.visual_op || op.op_num || '-';
            const opQty = Number(op.qtd || op.visual_qtd || 1);
            const parentCode = op.codigo || op.produto || op.cod_produto || '-';
            const parentDesc = op.descricao || '-';

            // Also add parent product itself to consolidated map
            if (!consolidatedMap.has(parentCode)) {
                consolidatedMap.set(parentCode, {
                    codigo: parentCode,
                    descricao: parentDesc,
                    tipo: 'PRODUTO FINAL (PAI)',
                    nivelMax: '0 (PAI)',
                    um: 'UN',
                    qtdTotal: 0,
                    ops: new Set()
                });
            }
            const consParent = consolidatedMap.get(parentCode);
            consParent.qtdTotal += opQty;
            consParent.ops.add(visualOp);

            if (data && data.itens && data.itens.length > 0) {
                const itemGroup = data.itens.find(i => String(i.item || i.item_pedido).trim() === String(op.item).trim()) || data.itens[0];
                const linearList = itemGroup?.estrutura_linear || [];
                const fullOrderQty = Number(itemGroup?.produto_principal?.quantidade_venda || itemGroup?.quantidade_venda || 1);

                linearList.forEach(comp => {
                    const code = (comp.codigo || '-').trim();
                    const desc = (comp.descricao || '-').trim();
                    const unitQtd = comp.qtd_unitaria !== undefined ? Number(comp.qtd_unitaria) : (comp.qtd_base !== undefined ? Number(comp.qtd_base) : (fullOrderQty > 0 ? Number(comp.quantidade_calculada || comp.qtd_total || 0) / fullOrderQty : Number(comp.quantidade_calculada || 0)));
                    const totalLotQty = unitQtd * opQty;
                    const um = comp.unidade || comp.um || 'UN';
                    const nivel = comp.nivel || 1;
                    const tipo = comp.tipo || comp.tipo_produto || (code.startsWith('MT') ? 'FABRICADO' : 'MATÉRIA PRIMA');

                    const row = wsBom.addRow([
                        visualOp,
                        op.pedido,
                        op.item,
                        comp.pai || parentCode,
                        nivel,
                        code,
                        desc,
                        Number(unitQtd.toFixed(4)),
                        Number(totalLotQty.toFixed(4)),
                        um,
                        comp.armazem || comp.local || '01'
                    ]);
                    row.height = 18;

                    const isEven = bomRowCount % 2 === 0;
                    if (!isEven) {
                        row.eachCell(cell => {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                        });
                    }
                    bomRowCount++;

                    // Consolidate in Map
                    if (!consolidatedMap.has(code)) {
                        consolidatedMap.set(code, {
                            codigo: code,
                            descricao: desc,
                            tipo: tipo,
                            nivelMax: `Nível ${nivel}`,
                            um: um,
                            qtdTotal: 0,
                            ops: new Set()
                        });
                    }
                    const cons = consolidatedMap.get(code);
                    cons.qtdTotal += totalLotQty;
                    cons.ops.add(visualOp);
                });
            }
        });

        // Auto width for BOM
        wsBom.columns.forEach(col => {
            let maxLen = 10;
            col.eachCell({ includeEmpty: false }, cell => {
                const len = cell.value ? String(cell.value).length : 0;
                if (len > maxLen) maxLen = Math.min(len + 3, 50);
            });
            col.width = maxLen;
        });

        // ─────────────────────────────────────────────────────────────────────────────
        // ABA 4: CONSOLIDAÇÃO TOTAL DE PEÇAS E MATERIAIS (SOMA GERAL DO LOTE)
        // ─────────────────────────────────────────────────────────────────────────────
        const wsConsolidated = workbook.addWorksheet('4. Consolid. Peças Materiais', {
            views: [{ showGridLines: true }]
        });

        // Header Title
        wsConsolidated.mergeCells('A1:H1');
        const titleCons = wsConsolidated.getCell('A1');
        titleCons.value = `LYNX — CONSOLIDAÇÃO TOTAL DE PEÇAS E MATERIAIS SOMADOS / LOTE: ${lotCode}`;
        titleCons.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCons.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } }; // Deep Emerald
        titleCons.alignment = { horizontal: 'center', vertical: 'middle' };
        wsConsolidated.getRow(1).height = 28;

        const consHeaders = [
            '#', 'Código do Produto / Peça', 'Descrição da Peça / Matéria-Prima',
            'Tipo / Classificação', 'Nível na Estrutura', 'QTD TOTAL SOMADA NO LOTE',
            'Unidade', 'Presente nas OPs / Frações'
        ];

        const consHeaderRow = wsConsolidated.addRow(consHeaders);
        consHeaderRow.height = 24;
        consHeaderRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }; // Emerald
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                left: { style: 'thin', color: { argb: 'FF94A3B8' } },
                bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
                right: { style: 'thin', color: { argb: 'FF94A3B8' } }
            };
        });

        const sortedConsolidated = Array.from(consolidatedMap.values()).sort((a, b) => {
            return a.codigo.localeCompare(b.codigo);
        });

        sortedConsolidated.forEach((item, idx) => {
            const dataRow = wsConsolidated.addRow([
                idx + 1,
                item.codigo,
                item.descricao,
                item.tipo,
                item.nivelMax,
                Number(item.qtdTotal.toFixed(4)),
                item.um,
                Array.from(item.ops).join(', ')
            ]);
            dataRow.height = 20;

            const isEven = idx % 2 === 0;
            dataRow.eachCell((cell, colIdx) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
                if (!isEven) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                }
                if (colIdx === 1 || colIdx === 5 || colIdx === 7) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                } else if (colIdx === 6) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    cell.font = { bold: true, color: { argb: 'FF065F46' } };
                } else if (colIdx === 2) {
                    cell.font = { bold: true };
                }
            });
        });

        // Auto width for Consolidated
        wsConsolidated.columns.forEach(col => {
            let maxLen = 10;
            col.eachCell({ includeEmpty: false }, cell => {
                const len = cell.value ? String(cell.value).length : 0;
                if (len > maxLen) maxLen = Math.min(len + 3, 50);
            });
            col.width = maxLen;
        });

        // Export Buffer and Download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const fileName = `${lotCode}_PACOTE_COMPLETO_ESTRUTURAS_E_ROTEIROS.xlsx`;
        downloadBlob(blob, fileName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        return true;
    } catch (err) {
        console.error('❌ [generateLoteExcel ERROR]', err);
        throw err;
    }
};
