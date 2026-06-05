const express = require('express');
const router = express.Router();
const db = require('../db');
const ExcelJS = require('exceljs');
const { getInactiveOrdersFilter } = require('../util/pedidoFilterHelper');

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

        const getInactiveFilter = await getInactiveOrdersFilter();
        let whereExtra = "WHERE COALESCE(c5.d_e_l_e_t_, '') = '' AND c5.c5_tipo <> 'B' AND COALESCE(c6.d_e_l_e_t_, '') = '' " + getInactiveFilter('c5.c5_num');

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

        if (pedido && typeof pedido === 'string') {
            // Normaliza para 6 dígitos com zeros à esquerda (formato Protheus: '004090')
            whereExtra += ` AND TRIM(c5.c5_num) = $${paramCount}`;
            params.push(pedido.trim().padStart(6, '0'));
            paramCount++;
        } else if (Array.isArray(pedido)) {
            whereExtra += ` AND TRIM(c5.c5_num) = $${paramCount}`;
            params.push(pedido[0].trim().padStart(6, '0'));
            paramCount++;
        }

        if (produto && typeof produto === 'string') {
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

        const consolidado = new Map();

        const itemsPayload = items.map(i => ({
            produto: String(i.produto).trim(),
            quantidade: parseFloat(i.quantidade) || 1,
            pedido:    String(i.pedido   || '').trim(),
            cliente:   String(i.cliente  || '').trim(),
            descricao_pai: String(i.descricao_pai || '').trim(),
        }));

        // ── Query 1: BOM consolidada (aglutinada) ─────────────────────────────
        const bomQuery = `
            WITH RECURSIVE estrutura AS (
                SELECT
                    0                                      AS nivel,
                    CAST(p.produto AS VARCHAR(30))         AS produto_raiz,
                    CAST(p.produto AS VARCHAR(30))         AS produto_pai,
                    CAST(p.produto AS VARCHAR(30))         AS componente,
                    1::numeric                             AS qtd_unitaria,
                    p.quantidade::numeric                  AS qtd_total
                FROM json_to_recordset($1::json) AS p(produto text, quantidade numeric, pedido text, cliente text, descricao_pai text)

                UNION ALL

                SELECT
                    e.nivel + 1,
                    CAST(TRIM(e.produto_raiz) AS VARCHAR(30)),
                    CAST(TRIM(e.componente)   AS VARCHAR(30)) AS produto_pai,
                    CAST(TRIM(g1.g1_comp)     AS VARCHAR(30)) AS componente,
                    g1.g1_quant::numeric,
                    e.qtd_total * g1.g1_quant::numeric
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
            WHERE NOT EXISTS (
                SELECT 1 FROM sg1010 sg1leaf
                WHERE TRIM(sg1leaf.g1_cod) = TRIM(e.componente)
                  AND COALESCE(sg1leaf.d_e_l_e_t_, '') = ''
            )
            GROUP BY e.componente, sb1.b1_desc, sb1.b1_um
            ORDER BY e.componente
        `;

        // ── Query 2: BOM detalhada (sem aglutinar — linha por produto pai) ────
        const bomDetalhadaQuery = `
            WITH RECURSIVE estrutura AS (
                SELECT
                    0                                      AS nivel,
                    CAST(p.produto AS VARCHAR(30))         AS produto_raiz,
                    CAST(p.descricao_pai AS VARCHAR(120))  AS descricao_raiz,
                    CAST(p.pedido   AS VARCHAR(20))        AS pedido,
                    CAST(p.cliente  AS VARCHAR(80))        AS cliente,
                    CAST(p.produto AS VARCHAR(30))         AS produto_pai,
                    CAST(p.produto AS VARCHAR(30))         AS componente,
                    1::numeric                             AS qtd_unitaria,
                    p.quantidade::numeric                  AS qtd_total
                FROM json_to_recordset($1::json) AS p(produto text, quantidade numeric, pedido text, cliente text, descricao_pai text)

                UNION ALL

                SELECT
                    e.nivel + 1,
                    CAST(TRIM(e.produto_raiz)   AS VARCHAR(30)),
                    CAST(TRIM(e.descricao_raiz) AS VARCHAR(120)),
                    CAST(TRIM(e.pedido)         AS VARCHAR(20)),
                    CAST(TRIM(e.cliente)        AS VARCHAR(80)),
                    CAST(TRIM(e.componente)     AS VARCHAR(30)) AS produto_pai,
                    CAST(TRIM(g1.g1_comp)       AS VARCHAR(30)) AS componente,
                    g1.g1_quant::numeric,
                    e.qtd_total * g1.g1_quant::numeric
                FROM estrutura e
                JOIN sg1010 g1
                    ON  TRIM(g1.g1_cod) = TRIM(e.componente)
                    AND COALESCE(g1.d_e_l_e_t_, '') = ''
                WHERE e.nivel < 10
            )
            SELECT
                e.produto_raiz,
                e.descricao_raiz,
                e.pedido,
                e.cliente,
                e.componente,
                TRIM(sb1.b1_desc) AS descricao,
                TRIM(sb1.b1_um)   AS unidade,
                e.qtd_total
            FROM estrutura e
            LEFT JOIN sb1010 sb1
                ON  TRIM(sb1.b1_cod) = TRIM(e.componente)
                AND COALESCE(sb1.d_e_l_e_t_, '') = ''
            WHERE NOT EXISTS (
                SELECT 1 FROM sg1010 sg1leaf
                WHERE TRIM(sg1leaf.g1_cod) = TRIM(e.componente)
                  AND COALESCE(sg1leaf.d_e_l_e_t_, '') = ''
            )
            ORDER BY e.produto_raiz, e.componente
        `;

        // ── Executar queries em paralelo ──────────────────────────────────────
        const jsonPayload = JSON.stringify(itemsPayload);
        const [result, detalhadaResult] = await Promise.all([
            db.query(bomQuery,          [jsonPayload]),
            db.query(bomDetalhadaQuery, [jsonPayload]),
        ]);

        // Consolidar aba 1
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

        // Produtos sem estrutura (selecionados que não geraram nenhum material)
        const produtosComMaterial = new Set(detalhadaResult.rows.map(r => r.produto_raiz));
        const semEstrutura = itemsPayload.filter(i => !produtosComMaterial.has(i.produto));

        // ── Helpers para estilo de aba ────────────────────────────────────────
        const dataGeracao = new Date().toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });

        const AZUL_ESCURO = 'FF1E3A5F';
        const AZUL_CLARO  = 'FFD6E4F0';
        const BRANCO      = 'FFFFFFFF';
        const ZEBRA       = 'FFF5F8FC';
        const LARANJA     = 'FFFF6B35';
        const LARANJA_CLR = 'FFFFF0EA';

        const styleHeaderRow = (row, numCols, fillArgb = AZUL_ESCURO) => {
            for (let c = 1; c <= numCols; c++) {
                const cell = row.getCell(c);
                cell.font  = { bold: true, color: { argb: BRANCO }, size: 10 };
                cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillArgb } };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
                cell.border = { bottom: { style: 'medium', color: { argb: 'FF2E5B8A' } } };
            }
            row.height = 22;
        };

        const styleTitleCell = (cell, text, numCols, sheetRef) => {
            cell.value = text;
            cell.font  = { bold: true, size: 12, color: { argb: AZUL_ESCURO } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_CLARO } };
            sheetRef.getRow(sheetRef.rowCount).height = 26;
        };

        // ── Gerar Excel ───────────────────────────────────────────────────────
        const workbook = new ExcelJS.Workbook();
        workbook.creator  = 'MetalFisa PCP';
        workbook.created  = new Date();

        // ════════════════════════════════════════════════════════════════════
        // ABA 1 — Lista de Materiais (Consolidada / Aglutinada)
        // ════════════════════════════════════════════════════════════════════
        const sheet = workbook.addWorksheet('Lista de Materiais', {
            views: [{ state: 'frozen', ySplit: 3 }],
        });

        sheet.columns = [
            { key: 'codigo',   width: 20 },
            { key: 'descricao',width: 50 },
            { key: 'unidade',  width: 12 },
            { key: 'qtd',      width: 18 },
            { key: '_empty',   width: 5  },
        ];

        sheet.mergeCells('A1:D1');
        styleTitleCell(
            sheet.getCell('A1'),
            `Lista de Materiais (Consolidada) — Gerada em ${dataGeracao}`,
            4, sheet
        );

        sheet.mergeCells('A2:D2');
        const sum2 = sheet.getCell('A2');
        sum2.value = `${items.length} produto(s) selecionado(s) | ${consolidado.size} matéria(s)-prima(s)`;
        sum2.font  = { italic: true, size: 9, color: { argb: 'FF555555' } };
        sum2.alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getRow(2).height = 16;

        const hRow1 = sheet.getRow(3);
        ['Código', 'Descrição', 'Unidade', 'Qtde Total'].forEach((h, i) => {
            hRow1.getCell(i + 1).value = h;
        });
        styleHeaderRow(hRow1, 4);

        const sortedRows = Array.from(consolidado.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
        sortedRows.forEach((mat, idx) => {
            const row = sheet.addRow([mat.codigo, mat.descricao, mat.unidade, mat.quantidade]);
            row.height = 17;
            if (idx % 2 === 1) {
                row.eachCell({ includeEmpty: false }, cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
                });
            }
            row.getCell(4).numFmt = '#,##0.000';
            row.getCell(4).alignment = { horizontal: 'right' };
            row.getCell(3).alignment = { horizontal: 'center' };
        });

        if (sortedRows.length > 0) {
            const tr = sheet.addRow(['', 'TOTAL DE ITENS DISTINTOS:', '', sortedRows.length]);
            tr.getCell(2).font = { bold: true };
            tr.getCell(4).font = { bold: true };
            tr.getCell(4).alignment = { horizontal: 'right' };
            tr.height = 20;
        }

        // ════════════════════════════════════════════════════════════════════
        // ABA 2 — Detalhado (sem aglutinar — linha por produto pai)
        // ════════════════════════════════════════════════════════════════════
        const sheetDet = workbook.addWorksheet('Detalhado', {
            views: [{ state: 'frozen', ySplit: 3 }],
        });

        sheetDet.columns = [
            { key: 'pedido',        width: 14 },
            { key: 'cliente',       width: 32 },
            { key: 'produto_raiz',  width: 18 },
            { key: 'desc_raiz',     width: 46 },
            { key: 'componente',    width: 18 },
            { key: 'descricao',     width: 46 },
            { key: 'unidade',       width: 10 },
            { key: 'qtd',           width: 16 },
            { key: '_empty',        width: 4  },
        ];

        sheetDet.mergeCells('A1:H1');
        styleTitleCell(
            sheetDet.getCell('A1'),
            `Detalhado de Materiais (Por Produto Pai) — Gerado em ${dataGeracao}`,
            8, sheetDet
        );

        sheetDet.mergeCells('A2:H2');
        const sd2 = sheetDet.getCell('A2');
        sd2.value = `${detalhadaResult.rows.length} linha(s) | ${items.length} produto(s) selecionado(s)`;
        sd2.font  = { italic: true, size: 9, color: { argb: 'FF555555' } };
        sd2.alignment = { horizontal: 'center', vertical: 'middle' };
        sheetDet.getRow(2).height = 16;

        const hRowDet = sheetDet.getRow(3);
        ['Pedido', 'Cliente', 'Produto Pai', 'Desc. Produto Pai', 'Componente', 'Descrição Componente', 'Un', 'Quantidade'].forEach((h, i) => {
            hRowDet.getCell(i + 1).value = h;
        });
        styleHeaderRow(hRowDet, 8);

        detalhadaResult.rows.forEach((row, idx) => {
            const r = sheetDet.addRow([
                row.pedido         || '',
                row.cliente        || '',
                row.produto_raiz   || '',
                row.descricao_raiz || '',
                row.componente     || '',
                row.descricao      || '',
                row.unidade        || 'UN',
                parseFloat(row.qtd_total) || 0,
            ]);
            r.height = 17;

            if (idx % 2 === 1) {
                r.eachCell({ includeEmpty: false }, cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
                });
            }
            r.getCell(8).numFmt = '#,##0.000';
            r.getCell(8).alignment = { horizontal: 'right' };
            r.getCell(7).alignment = { horizontal: 'center' };
        });

        // ════════════════════════════════════════════════════════════════════
        // ABA 3 — Sem Estrutura (produtos sem BOM)
        // ════════════════════════════════════════════════════════════════════
        const sheetSE = workbook.addWorksheet('Sem Estrutura', {
            views: [{ state: 'frozen', ySplit: 3 }],
        });

        sheetSE.columns = [
            { key: 'pedido',     width: 14 },
            { key: 'cliente',    width: 38 },
            { key: 'produto',    width: 20 },
            { key: 'descricao',  width: 52 },
            { key: 'quantidade', width: 16 },
            { key: '_empty',     width: 4  },
        ];

        sheetSE.mergeCells('A1:E1');
        const titleSE = sheetSE.getCell('A1');
        titleSE.value = `Produtos Sem Estrutura (Sem BOM) — Gerado em ${dataGeracao}`;
        titleSE.font  = { bold: true, size: 12, color: { argb: BRANCO } };
        titleSE.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: LARANJA } };
        titleSE.alignment = { horizontal: 'center', vertical: 'middle' };
        sheetSE.getRow(1).height = 26;

        sheetSE.mergeCells('A2:E2');
        const sd2SE = sheetSE.getCell('A2');
        sd2SE.value = semEstrutura.length > 0
            ? `⚠️ ${semEstrutura.length} produto(s) sem estrutura de materiais cadastrada`
            : '✅ Todos os produtos selecionados possuem estrutura de materiais';
        sd2SE.font  = { italic: true, bold: true, size: 10, color: { argb: semEstrutura.length > 0 ? 'FFC0392B' : 'FF27AE60' } };
        sd2SE.alignment = { horizontal: 'center', vertical: 'middle' };
        sheetSE.getRow(2).height = 18;

        const hRowSE = sheetSE.getRow(3);
        ['Pedido', 'Cliente', 'Produto', 'Descrição', 'Qtd. a Faturar'].forEach((h, i) => {
            hRowSE.getCell(i + 1).value = h;
        });
        styleHeaderRow(hRowSE, 5, LARANJA);

        if (semEstrutura.length === 0) {
            const rSE = sheetSE.addRow(['', '', '', '— Nenhum produto sem estrutura —', '']);
            rSE.getCell(4).font = { italic: true, color: { argb: 'FF888888' } };
            rSE.height = 18;
        } else {
            semEstrutura.forEach((item, idx) => {
                // Buscar descricao_pai e outros dados dos items originais
                const original = items.find(i => String(i.produto).trim() === item.produto);
                const r = sheetSE.addRow([
                    original?.pedido         || '',
                    original?.cliente        || '',
                    item.produto,
                    original?.descricao_pai  || '',
                    item.quantidade,
                ]);
                r.height = 17;
                r.eachCell({ includeEmpty: false }, cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? LARANJA_CLR : BRANCO } };
                });
                r.getCell(5).numFmt = '#,##0.000';
                r.getCell(5).alignment = { horizontal: 'right' };
            });
        }

        // ── Enviar resposta ───────────────────────────────────────────────────
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
