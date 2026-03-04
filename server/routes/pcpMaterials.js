const express = require('express');
const router = express.Router();
const db = require('../db');
const ExcelJS = require('exceljs');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/pcp/orders
// Lista itens de pedidos de venda em aberto com flag tem_estrutura
// Query params: dataInicio, dataFim, cliente, pedido, estrutura (com|sem)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/orders', async (req, res) => {
    try {
        const { cliente, pedido, produto, dataInicial, dataFinal, dateType = 'pedido', only_active = 'true', estrutura } = req.query;
        const params = [];
        let paramCount = 1;

        let whereExtra = "WHERE COALESCE(c5.d_e_l_e_t_, '') = '' AND c5.c5_tipo <> 'B' AND COALESCE(c6.d_e_l_e_t_, '') = ''";

        if (only_active === 'true') {
            whereExtra += ` AND (
                COALESCE(c5.c5_nota, '') = '' 
                OR EXISTS (
                    SELECT 1 FROM sc6010 c6_ex 
                    WHERE c6_ex.c6_num = c5.c5_num 
                    AND c6_ex.c6_filial = c5.c5_filial 
                    AND COALESCE(c6_ex.d_e_l_e_t_, '') = ''
                    AND ((c6_ex.c6_qtdven - c6_ex.c6_qtdent) > 0 OR c6_ex.c6_qtdlib > 0)
                )
            )`;
            whereExtra += ` AND ((c6.c6_qtdven - c6.c6_qtdent) > 0 OR c6.c6_qtdlib > 0)`;
        }

        if (cliente) {
            whereExtra += ` AND sa1.a1_nome ILIKE '%' || $${paramCount} || '%'`;
            params.push(cliente);
            paramCount++;
        }

        if (pedido) {
            whereExtra += ` AND c5.c5_num LIKE '%' || $${paramCount} || '%'`;
            params.push(pedido);
            paramCount++;
        }

        if (produto) {
            whereExtra += ` AND c6.c6_produto ILIKE '%' || $${paramCount} || '%'`;
            params.push(produto);
            paramCount++;
        }

        if (dataInicial || dataFinal) {
            let dateField = 'c5.c5_emissao';
            if (dateType === 'entrega') dateField = 'c6.c6_entreg';
            else if (dateType === 'nf') {
                // Simplified NF filter for PCP tab (just checking SD2)
                whereExtra += ` AND EXISTS (
                    SELECT 1 FROM sd2010 d2_ex
                    JOIN sf2010 f2_ex ON f2_ex.f2_doc = d2_ex.d2_doc AND f2_ex.f2_serie = d2_ex.d2_serie AND COALESCE(f2_ex.d_e_l_e_t_, '') = ''
                    WHERE d2_ex.d2_pedido = c5.c5_num AND d2_ex.d2_itempv = c6.c6_item AND COALESCE(d2_ex.d_e_l_e_t_, '') = ''
                `;
                if (dataInicial) {
                    whereExtra += ` AND f2_ex.f2_emissao >= $${paramCount}`;
                    params.push(dataInicial.replace(/-/g, ''));
                    paramCount++;
                }
                if (dataFinal) {
                    whereExtra += ` AND f2_ex.f2_emissao <= $${paramCount}`;
                    params.push(dataFinal.replace(/-/g, ''));
                    paramCount++;
                }
                whereExtra += `)`;
            }

            if (dateType !== 'nf') {
                if (dataInicial) {
                    whereExtra += ` AND ${dateField} >= $${paramCount}`;
                    params.push(dataInicial.replace(/-/g, ''));
                    paramCount++;
                }
                if (dataFinal) {
                    whereExtra += ` AND ${dateField} <= $${paramCount}`;
                    params.push(dataFinal.replace(/-/g, ''));
                    paramCount++;
                }
            }
        }

        if (estrutura === 'com') {
            whereExtra += ` AND EXISTS (
                SELECT 1 FROM sg1010 sg1x
                WHERE TRIM(sg1x.g1_cod) = TRIM(c6.c6_produto)
                  AND COALESCE(sg1x.d_e_l_e_t_, '') = ''
            )`;
        } else if (estrutura === 'sem') {
            whereExtra += ` AND NOT EXISTS (
                SELECT 1 FROM sg1010 sg1x
                WHERE TRIM(sg1x.g1_cod) = TRIM(c6.c6_produto)
                  AND COALESCE(sg1x.d_e_l_e_t_, '') = ''
            )`;
        }

        const query = `
            SELECT
                TRIM(c5.c5_num)                                                        AS pedido,
                TRIM(c6.c6_item)                                                       AS item,
                TRIM(c6.c6_produto)                                                    AS produto,
                TRIM(sb1.b1_desc)                                                      AS descricao,
                COALESCE(c6.c6_qtdven, 0)::numeric(18,6)                               AS quantidade,
                COALESCE(c6.c6_qtdent, 0)::numeric(18,6)                               AS qtd_entreg,
                (COALESCE(c6.c6_qtdven, 0) - COALESCE(c6.c6_qtdent, 0))::numeric(18,6) AS qtd_faturar,
                CASE 
                    WHEN (COALESCE(c6.c6_qtdven, 0) - COALESCE(c6.c6_qtdent, 0)) <= 0 THEN 'ENTREGUE'
                    ELSE 'PENDENTE'
                END                                                                    AS status,
                TRIM(c6.c6_um)                                                         AS unidade,
                TO_CHAR(
                    TO_DATE(NULLIF(TRIM(c6.c6_entreg), ''), 'YYYYMMDD'),
                    'DD/MM/YYYY'
                )                                                                       AS data_entrega,
                TRIM(c6.c6_entreg)                                                     AS data_entrega_raw,
                TRIM(sa1.a1_nome)                                                      AS cliente,
                EXISTS (
                    SELECT 1 FROM sg1010 sg1
                    WHERE TRIM(sg1.g1_cod) = TRIM(c6.c6_produto)
                      AND COALESCE(sg1.d_e_l_e_t_, '') = ''
                )                                                                       AS tem_estrutura
            FROM sc6010 c6
            JOIN sc5010 c5
                ON  c5.c5_num    = c6.c6_num
                AND c5.c5_filial = c6.c6_filial
                AND COALESCE(c5.d_e_l_e_t_, '') = ''
                AND c5.c5_tipo  <> 'B'
            LEFT JOIN sa1010 sa1
                ON  TRIM(sa1.a1_cod)  = TRIM(c5.c5_cliente)
                AND TRIM(sa1.a1_loja) = TRIM(c5.c5_lojacli)
                AND COALESCE(sa1.d_e_l_e_t_, '') = ''
            LEFT JOIN sb1010 sb1
                ON  TRIM(sb1.b1_cod) = TRIM(c6.c6_produto)
                AND COALESCE(sb1.d_e_l_e_t_, '') = ''
            ${whereExtra}
            ORDER BY c5.c5_num DESC, c6.c6_item ASC
        `;

        const result = await db.query(query, params);
        res.json({ data: result.rows });
    } catch (err) {
        console.error('[PCP] Erro em GET /orders:', err);
        res.status(500).json({ error: 'Erro ao buscar pedidos', detail: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/pcp/export
// Recebe lista de { produto, quantidade } e devolve .xlsx com BOM explodida
// ─────────────────────────────────────────────────────────────────────────────
router.post('/export', async (req, res) => {
    try {
        const items = req.body; // [{ produto, quantidade, descricao_pai }]

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Lista de itens vazia ou inválida' });
        }

        // Acumula matérias-primas: { componente -> { descricao, unidade, quantidade } }
        const consolidado = new Map();

        for (const item of items) {
            const { produto, quantidade } = item;
            const qty = parseFloat(quantidade) || 1;

            const bomQuery = `
                WITH RECURSIVE estrutura AS (
                    -- Começamos com o próprio produto (nível 0)
                    SELECT
                        0                         AS nivel,
                        CAST($1 AS VARCHAR(30))   AS produto_pai,
                        CAST($1 AS VARCHAR(30))   AS componente,
                        1::numeric                AS qtd_unitaria,
                        $2::numeric               AS qtd_total

                    UNION ALL

                    -- Explodimos os filhos se existirem
                    SELECT
                        e.nivel + 1,
                        CAST(TRIM(e.componente) AS VARCHAR(30)) AS produto_pai,
                        CAST(TRIM(g1.g1_comp)   AS VARCHAR(30)) AS componente,
                        g1.g1_quant::numeric                    AS qtd_unitaria,
                        e.qtd_total * g1.g1_quant::numeric      AS qtd_total
                    FROM estrutura e
                    JOIN sg1010 g1
                        ON  TRIM(g1.g1_cod) = TRIM(e.componente)
                        AND COALESCE(g1.d_e_l_e_t_, '') = ''
                    WHERE e.nivel < 10
                )
                SELECT
                    e.componente,
                    TRIM(sb1.b1_desc) AS descricao,
                    TRIM(sb1.b1_um)   AS unidade,
                    SUM(e.qtd_total)  AS qtd_total
                FROM estrutura e
                LEFT JOIN sb1010 sb1
                    ON  TRIM(sb1.b1_cod) = TRIM(e.componente)
                    AND COALESCE(sb1.d_e_l_e_t_, '') = ''
                -- Filtramos apenas as folhas (materiais que não têm mais estrutura abaixo deles)
                WHERE NOT EXISTS (
                    SELECT 1 FROM sg1010 sg1leaf
                    WHERE TRIM(sg1leaf.g1_cod) = TRIM(e.componente)
                      AND COALESCE(sg1leaf.d_e_l_e_t_, '') = ''
                )
                  -- Se o produto raiz $1 não tiver estrutura, a query acima trará ele mesmo como folha
                  -- Isso é o comportamento desejado.
                GROUP BY e.componente, sb1.b1_desc, sb1.b1_um
                ORDER BY e.componente
            `;

            const result = await db.query(bomQuery, [produto.trim(), qty]);

            for (const row of result.rows) {
                const key = row.componente;
                const qtdTotal = parseFloat(row.qtd_total) || 0;

                if (consolidado.has(key)) {
                    consolidado.get(key).quantidade += qtdTotal;
                } else {
                    consolidado.set(key, {
                        codigo: row.componente,
                        descricao: row.descricao || '',
                        unidade: row.unidade || 'UN',
                        quantidade: qtdTotal,
                    });
                }
            }
        }

        // ── Gerar Excel ──────────────────────────────────────────────────────
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'MetalFisa PCP';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Lista de Materiais', {
            views: [{ state: 'frozen', ySplit: 3 }],
        });

        const dataGeracao = new Date().toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });

        // Linha 1 — título
        sheet.mergeCells('A1:E1');
        const titleCell = sheet.getCell('A1');
        titleCell.value = `Lista de Materiais — Gerada em ${dataGeracao}`;
        titleCell.font = { bold: true, size: 13, color: { argb: 'FF1E3A5F' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } };
        sheet.getRow(1).height = 28;

        // Linha 2 — resumo de seleção
        sheet.mergeCells('A2:E2');
        const summaryCell = sheet.getCell('A2');
        summaryCell.value = `${items.length} produto(s) selecionado(s) | ${consolidado.size} matéria(s)-prima(s) identificada(s)`;
        summaryCell.font = { italic: true, size: 10, color: { argb: 'FF555555' } };
        summaryCell.alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getRow(2).height = 18;

        // Linha 3 — cabeçalho
        const headerRow = sheet.getRow(3);
        const headers = [
            { header: 'Código', key: 'codigo', width: 18 },
            { header: 'Descrição', key: 'descricao', width: 48 },
            { header: 'Unidade', key: 'unidade', width: 12 },
            { header: 'Qtde Total', key: 'qtd', width: 16 },
        ];

        sheet.columns = [
            { key: 'codigo', width: 18 },
            { key: 'descricao', width: 48 },
            { key: 'unidade', width: 12 },
            { key: 'qtd', width: 16 },
            { key: '_empty', width: 6 },
        ];

        headers.forEach((h, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = h.header;
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                bottom: { style: 'medium', color: { argb: 'FF2E5B8A' } },
            };
        });
        headerRow.height = 24;

        // Linhas de dados
        const sortedRows = Array.from(consolidado.values()).sort((a, b) =>
            a.codigo.localeCompare(b.codigo)
        );

        sortedRows.forEach((mat, idx) => {
            const row = sheet.addRow([mat.codigo, mat.descricao, mat.unidade, mat.quantidade]);
            row.height = 18;

            // Zebragem leve
            if (idx % 2 === 1) {
                row.eachCell({ includeEmpty: false }, (cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8FC' } };
                });
            }

            // Formatação da coluna de quantidade
            row.getCell(4).numFmt = '#,##0.000';
            row.getCell(4).alignment = { horizontal: 'right' };
            row.getCell(3).alignment = { horizontal: 'center' };
        });

        // Linha de total
        if (sortedRows.length > 0) {
            const totalRow = sheet.addRow(['', 'TOTAL DE ITENS:', '', sortedRows.length]);
            totalRow.getCell(2).font = { bold: true };
            totalRow.getCell(4).font = { bold: true };
            totalRow.getCell(4).alignment = { horizontal: 'right' };
            totalRow.height = 20;
        }

        // Bordas externas na tabela de dados
        const dataStartRow = 3;
        const dataEndRow = sheet.rowCount;
        for (let r = dataStartRow; r <= dataEndRow; r++) {
            const row = sheet.getRow(r);
            [1, 2, 3, 4].forEach(colIdx => {
                const cell = row.getCell(colIdx);
                cell.border = {
                    ...cell.border,
                    left: colIdx === 1 ? { style: 'thin' } : undefined,
                    right: colIdx === 4 ? { style: 'thin' } : undefined,
                    top: r === dataStartRow ? { style: 'thin' } : undefined,
                    bottom: r === dataEndRow ? { style: 'thin' } : undefined,
                };
            });
        }

        // Enviar resposta
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="lista_materiais_${Date.now()}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('[PCP] Erro em POST /export:', err);
        res.status(500).json({ error: 'Erro ao gerar exportação', detail: err.message });
    }
});

module.exports = router;
