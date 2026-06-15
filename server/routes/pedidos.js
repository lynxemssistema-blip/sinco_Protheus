const express = require('express');
const router = express.Router();
const db = require('../db');
const mysqlPool = require('../services/mysqlService');
const XLSX = require('xlsx');
const { validate, rules } = require('../middlewares/validate');
const archiver = require('archiver');
const fs = require('fs');
const nodePath = require('path');
const ExcelJS = require('exceljs');
const { getInactiveOrdersFilter } = require('../util/pedidoFilterHelper');
const { getVisaoGerencial } = require('../util/visaoGerencialHelper');

// ── Forecast cache (módulo) — TTL 60s, evita fetch MySQL por requisição ────
let _fcCache = { map: new Map(), expiresAt: 0 };
async function getForecastMapCached() {
    if (Date.now() < _fcCache.expiresAt) return _fcCache.map;
    const map = new Map();
    try {
        const [rows] = await mysqlPool.query(`
            SELECT TRIM(pedido) as pedido, TRIM(item) as item,
                   MAX(data_entrega_pcp) as data_entrega_pcp,
                   MAX(data_prevista_faturamento) as data_prevista_faturamento
            FROM app_pcp_delivery_forecasts
            WHERE pedido IS NOT NULL AND item IS NOT NULL
            GROUP BY TRIM(pedido), TRIM(item)
        `);
        for (const row of rows) {
            map.set(`${row.pedido}|${row.item}`, {
                data_entrega_pcp: row.data_entrega_pcp || null,
                data_prevista_faturamento: row.data_prevista_faturamento || null
            });
        }
    } catch (err) {
        console.error('getForecastMapCached error:', err.message);
    }
    _fcCache = { map, expiresAt: Date.now() + 60_000 };
    return map;
}

// GET /api/pedidos
router.get('/', async (req, res) => {
    try {
        const { cliente, pedido, produto, pedcli, dataInicial, dataFinal, dateType = 'pedido', page = 1, limit = 50, only_active = 'false', op_status = '', sortBy = 'emissao', sortOrder = 'DESC' } = req.query;

        // Paginação
        const limitParsed = parseInt(limit, 10) || 50;
        const pageParsed = parseInt(page, 10) || 1;
        const offset = (pageParsed - 1) * limitParsed;

        // Fetch forecasts from MySQL first
        let valuesList = "(CAST('DUMMY' AS varchar), CAST('DUMMY' AS varchar), CAST(NULL AS varchar), CAST(NULL AS varchar))";
        try {
            const [forecastRows] = await mysqlPool.query(`
                SELECT TRIM(pedido) as pedido, TRIM(item) as item, data_entrega_pcp, data_prevista_faturamento 
                FROM app_pcp_delivery_forecasts
                WHERE pedido IS NOT NULL AND item IS NOT NULL
            `);
            if (forecastRows.length > 0) {
                valuesList = forecastRows.map(row => {
                    const entregaPcpStr = row.data_entrega_pcp ? `'${row.data_entrega_pcp}'` : 'NULL';
                    const prevFatStr = row.data_prevista_faturamento ? `'${row.data_prevista_faturamento}'` : 'NULL';
                    return `(CAST('${row.pedido}' AS varchar), CAST('${row.item}' AS varchar), CAST(${entregaPcpStr} AS varchar), CAST(${prevFatStr} AS varchar))`;
                }).join(', ');
            }
        } catch (err) {
            console.error('Error fetching forecasts for virtual join:', err);
        }

        // Parâmetros para query
        const params = [];
        let paramCount = 1;

        // Construção dinâmica de filtros
        const getInactiveFilter = await getInactiveOrdersFilter();
        let whereClause = "WHERE COALESCE(c5.d_e_l_e_t_, '') = '' AND c5.c5_tipo <> 'B'" + getInactiveFilter('c5.c5_num');

        // Filtra fora os "Vermelhos" (Faturados) - Optional now for Performance
        if (only_active === 'true') {
            whereClause += ` AND (
                COALESCE(c5.c5_nota, '') = '' 
                OR EXISTS (
                    SELECT 1 FROM public.sc6010 c6 
                    WHERE c6.c6_num = c5.c5_num 
                    AND c6.c6_filial = c5.c5_filial 
                    AND COALESCE(c6.d_e_l_e_t_, '') = ''
                    AND ((c6.c6_qtdven - c6.c6_qtdent) > 0 OR c6.c6_qtdlib > 0)
                )
            )`;
        }

        if (cliente) {
            const pgClient = await db.connect();
            let clienteMatches = [];
            try {
                const resTemp = await pgClient.query(
                    `SELECT a1_cod, a1_loja FROM public.sa1010 WHERE COALESCE(d_e_l_e_t_, '') = '' AND a1_nome ILIKE $1 LIMIT 5000`, 
                    [`%${cliente}%`]
                );
                clienteMatches = resTemp.rows;
            } finally {
                pgClient.release();
            }

            if (clienteMatches.length === 0) {
                return res.json({ data: [], meta: { hasNextPage: false, total: 0 } });
            }

            const inValues = clienteMatches.map(m => `('${m.a1_cod}', '${m.a1_loja}')`).join(', ');
            whereClause += ` AND (c5.c5_cliente, c5.c5_lojacli) IN (${inValues})`;
        }

        if (pedido) {
            const pedidoList = String(pedido).split(',')
                .map(p => p.trim())
                .filter(p => p.length > 0)
                .map(p => p.padStart(6, '0'));

            if (pedidoList.length === 1) {
                whereClause += ` AND TRIM(c5.c5_num) = $${paramCount}`;
                params.push(pedidoList[0]);
                paramCount++;
            } else if (pedidoList.length > 1) {
                const placeholders = pedidoList.map((_, i) => `$${paramCount + i}`).join(', ');
                whereClause += ` AND TRIM(c5.c5_num) IN (${placeholders})`;
                params.push(...pedidoList);
                paramCount += pedidoList.length;
            }
        }

        if (produto) {
            whereClause += ` AND EXISTS (
                SELECT 1 FROM public.sc6010 c6_filter 
                WHERE c6_filter.c6_num = c5.c5_num 
                AND c6_filter.c6_filial = c5.c5_filial 
                AND c6_filter.c6_produto ILIKE '%' || $${paramCount} || '%'
                AND COALESCE(c6_filter.d_e_l_e_t_, '') = ''
            )`;
            params.push(produto);
            paramCount++;
        }

        if (pedcli) {
            whereClause += ` AND EXISTS (
                SELECT 1 FROM public.sc6010 c6_filter 
                WHERE c6_filter.c6_num = c5.c5_num 
                AND c6_filter.c6_filial = c5.c5_filial 
                AND c6_filter.c6_pedcli ILIKE '%' || $${paramCount} || '%'
                AND COALESCE(c6_filter.d_e_l_e_t_, '') = ''
            )`;
            params.push(pedcli);
            paramCount++;
        }

        if (op_status === 'com_op') {
            whereClause += ` AND EXISTS (
                SELECT 1 FROM public.sc6010 c6_op_filter
                WHERE c6_op_filter.c6_num = c5.c5_num
                AND c6_op_filter.c6_filial = c5.c5_filial
                AND COALESCE(c6_op_filter.d_e_l_e_t_, '') = ''
                AND EXISTS (
                     SELECT 1 FROM public.sc2010 c2_op
                     WHERE (c2_op.c2_pedido = c6_op_filter.c6_num)
                     AND c2_op.c2_itempv = c6_op_filter.c6_item
                     AND COALESCE(c2_op.d_e_l_e_t_, '') = ''
                )
            )`;
        } else if (op_status === 'sem_op') {
            whereClause += ` AND EXISTS (
                SELECT 1 FROM public.sc6010 c6_sem_op_filter
                WHERE c6_sem_op_filter.c6_num = c5.c5_num
                AND c6_sem_op_filter.c6_filial = c5.c5_filial
                AND COALESCE(c6_sem_op_filter.d_e_l_e_t_, '') = ''
                AND NOT EXISTS (
                     SELECT 1 FROM public.sc2010 c2_op
                     WHERE (c2_op.c2_pedido = c5.c5_num)
                     AND c2_op.c2_itempv = c6_sem_op_filter.c6_item
                     AND COALESCE(c2_op.d_e_l_e_t_, '') = ''
                )
            )`;
        }

        // Filtro por data
        if (dataInicial || dataFinal) {
            if (dateType === 'nf') {
                let nfFilter = `EXISTS (
                    SELECT 1 FROM public.sd2010 d2_ex
                    JOIN public.sf2010 f2_ex 
                        ON f2_ex.f2_doc = d2_ex.d2_doc 
                        AND f2_ex.f2_serie = d2_ex.d2_serie 
                        AND COALESCE(f2_ex.d_e_l_e_t_, '') = ''
                    WHERE d2_ex.d2_pedido = c5.c5_num 
                      AND COALESCE(d2_ex.d_e_l_e_t_, '') = ''
                `;
                if (dataInicial) {
                    nfFilter += ` AND f2_ex.f2_emissao >= $${paramCount}`;
                    params.push(dataInicial.replace(/-/g, ''));
                    paramCount++;
                }
                if (dataFinal) {
                    nfFilter += ` AND f2_ex.f2_emissao <= $${paramCount}`;
                    params.push(dataFinal.replace(/-/g, ''));
                    paramCount++;
                }
                nfFilter += `)`;
                whereClause += ` AND ${nfFilter}`;
            } else if (dateType === 'entrega') {
                let entregaFilter = `EXISTS (
                    SELECT 1 FROM public.sc6010 c6_ent 
                    WHERE c6_ent.c6_num = c5.c5_num 
                    AND c6_ent.c6_filial = c5.c5_filial 
                    AND COALESCE(c6_ent.d_e_l_e_t_, '') = ''
                `;
                if (dataInicial) {
                    entregaFilter += ` AND c6_ent.c6_entreg >= $${paramCount}`;
                    params.push(dataInicial.replace(/-/g, ''));
                    paramCount++;
                }
                if (dataFinal) {
                    entregaFilter += ` AND c6_ent.c6_entreg <= $${paramCount}`;
                    params.push(dataFinal.replace(/-/g, ''));
                    paramCount++;
                }
                entregaFilter += `)`;
                whereClause += ` AND ${entregaFilter}`;
            } else {
                if (dataInicial) {
                    whereClause += ` AND c5.c5_emissao >= $${paramCount}`;
                    params.push(dataInicial.replace(/-/g, ''));
                    paramCount++;
                }
                if (dataFinal) {
                    whereClause += ` AND c5.c5_emissao <= $${paramCount}`;
                    params.push(dataFinal.replace(/-/g, ''));
                    paramCount++;
                }
            }
        }

        const query = `
      SELECT
        c5.c5_num AS pedido,
        sa1.a1_nome AS nome_cliente,
        NULLIF(TRIM(COALESCE(c5.c5_mennota, '') || ' ' || COALESCE(c5.c5_zobs, '') || ' ' || COALESCE(c5.c5_zobsorc, '')), '') AS observacoes_gerais,
        TRIM(c5.c5_emissao) AS emissao_raw,
        COALESCE(c6_agg.itens_count, 0)     AS itens_count,
        COALESCE(c6_op_agg.itens_com_op, 0) AS itens_com_op,
        c6_agg.entrega_raw,
        CASE
            WHEN COALESCE(c6_agg.itens_count, 0) = 0
                THEN 'red'
            WHEN c6_agg.itens_distintos > COALESCE(c2_agg.op_count, 0)
                 AND COALESCE(c2_agg.op_count, 0) > 0
                THEN 'orange'
            WHEN COALESCE(c2_agg.op_count, 0) = 0
                THEN 'red'
            WHEN c5.c5_liberok = '' AND COALESCE(c5.c5_nota, '') = ''
                THEN 'green'
            WHEN c5.c5_liberok = 'S'
                THEN 'yellow'
            ELSE 'default'
        END AS status_cor
      FROM public.sc5010 c5
      LEFT JOIN public.sa1010 sa1
        ON sa1.a1_cod = c5.c5_cliente
        AND COALESCE(sa1.d_e_l_e_t_, '') = ''
      LEFT JOIN (
          SELECT c6.c6_num, c6.c6_filial,
              MIN(fc.data_entrega_pcp) AS min_entrega_pcp,
              MAX(fc.data_prevista_faturamento) AS max_prev_fat
          FROM public.sc6010 c6
          LEFT JOIN (
              VALUES ${valuesList}
          ) AS fc(pedido, item, data_entrega_pcp, data_prevista_faturamento)
              ON fc.pedido = TRIM(c6.c6_num) AND fc.item = TRIM(c6.c6_item)
          WHERE COALESCE(c6.d_e_l_e_t_, '') = ''
          GROUP BY c6.c6_num, c6.c6_filial
      ) fc_agg ON fc_agg.c6_num = c5.c5_num AND fc_agg.c6_filial = c5.c5_filial
      LEFT JOIN (
          SELECT c6_num, c6_filial,
              COUNT(*)                AS itens_count,
              COUNT(DISTINCT c6_item) AS itens_distintos,
              TRIM(MAX(c6_entreg))    AS entrega_raw
          FROM public.sc6010
          WHERE COALESCE(d_e_l_e_t_, '') = ''
          GROUP BY c6_num, c6_filial
      ) c6_agg ON c6_agg.c6_num = c5.c5_num AND c6_agg.c6_filial = c5.c5_filial
      LEFT JOIN (
          SELECT c6_x.c6_num, c6_x.c6_filial,
              COUNT(DISTINCT c6_x.c6_item) AS itens_com_op
          FROM public.sc6010 c6_x
          WHERE COALESCE(c6_x.d_e_l_e_t_, '') = ''
          AND EXISTS (
              SELECT 1 FROM public.sc2010 c2_x
              WHERE c2_x.c2_pedido = c6_x.c6_num
                AND c2_x.c2_itempv = c6_x.c6_item
                AND COALESCE(c2_x.d_e_l_e_t_, '') = ''
          )
          GROUP BY c6_x.c6_num, c6_x.c6_filial
      ) c6_op_agg ON c6_op_agg.c6_num = c5.c5_num AND c6_op_agg.c6_filial = c5.c5_filial
      LEFT JOIN (
          SELECT c2_pedido,
              COUNT(DISTINCT c2_itempv) AS op_count
          FROM public.sc2010
          WHERE COALESCE(d_e_l_e_t_, '') = ''
          GROUP BY c2_pedido
      ) c2_agg ON c2_agg.c2_pedido = c5.c5_num
      ${whereClause}
      ${sortBy === 'entrega' 
          ? `ORDER BY NULLIF(TRIM(c6_agg.entrega_raw), '') ${sortOrder === 'ASC' ? 'ASC' : 'DESC'} NULLS LAST, c5.c5_num DESC` 
          : sortBy === 'emissao'
          ? `ORDER BY c5.c5_emissao ${sortOrder === 'ASC' ? 'ASC' : 'DESC'}, c5.c5_num DESC`
          : sortBy === 'entrega_pcp'
          ? `ORDER BY CASE WHEN fc_agg.min_entrega_pcp IS NULL THEN 1 ELSE 0 END ASC, fc_agg.min_entrega_pcp ${sortOrder === 'ASC' ? 'ASC' : 'DESC'}, c5.c5_num DESC`
          : sortBy === 'prev_fat'
          ? `ORDER BY CASE WHEN fc_agg.max_prev_fat IS NULL THEN 1 ELSE 0 END ASC, fc_agg.max_prev_fat ${sortOrder === 'ASC' ? 'ASC' : 'DESC'}, c5.c5_num DESC`
          : sortBy === 'pedido'
          ? `ORDER BY c5.c5_num ${sortOrder === 'ASC' ? 'ASC' : 'DESC'}`
          : `ORDER BY c5.c5_num DESC`}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

        params.push(limitParsed, offset);
        const paramsCount = params.slice(0, paramCount - 1);

        const countQuery = `
        SELECT count(*) as total
        FROM public.sc5010 c5
        LEFT JOIN public.sa1010 sa1
        ON sa1.a1_cod = c5.c5_cliente
        AND COALESCE(sa1.d_e_l_e_t_, '') = ''
        ${whereClause}
    `;

        const result = await db.query(query, params);
        // countResult not needed anymore due to COUNT(*) OVER()

        const data = result.rows.map(row => {
            const parseDateStr = (dStr) => {
                if (!dStr || dStr.trim() === '' || dStr.length < 8) return '';
                return `${dStr.substring(6, 8)}/${dStr.substring(4, 6)}/${dStr.substring(2, 4)}`;
            };
            return {
                ...row,
                emissao: parseDateStr(row.emissao_raw),
                entrega: parseDateStr(row.entrega_raw)
            };
        });

        res.json({
            data: data,
            meta: {
                total: result.rows.length > 0 ? parseInt(result.rows[0].full_count, 10) : 0,
                page: parseInt(page),
                limit: limitParsed
            }
        });

    } catch (err) {
        console.error('Erro detalhado consulta pedidos:', err);
        res.status(500).json({ error: 'Erro interno ao processar consulta.', details: err.message });
    }
});

// GET /api/pedidos/flat - Listagem Plana (Item a Item)
router.get('/flat', async (req, res) => {
    console.log(`📡 [DEBUG] /api/pedidos/flat chamado (Versão: 27/02/2026 09:45)`);
    let query = '';
    let countQuery = '';
    let params = [];
    let paramsCount = [];
    let errorStep = '';
    try {
        const { cliente, pedido, produto, pedcli, dataInicial, dataFinal, dateType = 'pedido', page = 1, limit = 50, only_active = 'false', tipo_item = '', pcpDataInicial = '', pcpDataFinal = '', pcpDateFilter = 'false', op_status = '', sortBy = 'emissao', sortOrder = 'DESC' } = req.query;
        const limitParsed = parseInt(limit, 10) || 50;
        const pageParsed = parseInt(page, 10) || 1;
        const offset = (pageParsed - 1) * limitParsed;

        params = [];
        let paramCount = 1;
        let countParams = [];
        let countParamCount = 1;

        // Parallelize 3 MySQL round-trips that were previously serial:
        //  1. forecast map (can be large table)
        //  2+3. getInactiveOrdersFilter (2 queries internally)
        const _tMysqlStart = Date.now();
        const [forecastMap, getInactiveFilter] = await Promise.all([
            getForecastMapCached(),
            getInactiveOrdersFilter()
        ]);
        console.log(`⏱ /flat MySQL pre-fetch took ${Date.now() - _tMysqlStart}ms (forecastMap=${forecastMap.size} entries)`);
        const inactiveFilterSql = getInactiveFilter('c5.c5_num');
        let whereClause = "WHERE COALESCE(c5.d_e_l_e_t_, '') = '' AND c5.c5_tipo <> 'B' AND COALESCE(c6.d_e_l_e_t_, '') = ''" + inactiveFilterSql;
        let countWhereClause = "WHERE COALESCE(c5.d_e_l_e_t_, '') = '' AND c5.c5_tipo <> 'B' AND COALESCE(c6.d_e_l_e_t_, '') = ''" + inactiveFilterSql;

        if (only_active === 'true') {
            // Keep only the direct item-level saldo filter — fast index scan on c6 columns.
            // The old order-level EXISTS subquery was redundant and caused full table scans.
            const activeItemFilter = ` AND ((c6.c6_qtdven - c6.c6_qtdent) > 0 OR c6.c6_qtdlib > 0)`;
            whereClause += activeItemFilter;
            countWhereClause += activeItemFilter;
        }

        if (cliente) {
            const pgClient = await db.connect();
            let clienteMatches = [];
            try {
                const resTemp = await pgClient.query(
                    `SELECT a1_cod, a1_loja FROM public.sa1010 WHERE COALESCE(d_e_l_e_t_, '') = '' AND a1_nome ILIKE $1 LIMIT 5000`, 
                    [`%${cliente}%`]
                );
                clienteMatches = resTemp.rows;
            } finally {
                pgClient.release();
            }

            if (clienteMatches.length === 0) {
                return res.json({ data: [], meta: { hasNextPage: false, total: 0 } });
            }

            const inValues = clienteMatches.map(m => `('${m.a1_cod}', '${m.a1_loja}')`).join(', ');
            whereClause += ` AND (c5.c5_cliente, c5.c5_lojacli) IN (${inValues})`;
            countWhereClause += ` AND (c5.c5_cliente, c5.c5_lojacli) IN (${inValues})`;
        }

        if (pedido) {
            // Support multiple comma-separated order numbers: "4002,4618,5000"
            const pedidoList = String(pedido).split(',')
                .map(p => p.trim())
                .filter(p => p.length > 0)
                .map(p => p.padStart(6, '0'));

            if (pedidoList.length === 1) {
                whereClause += ` AND TRIM(c5.c5_num) = $${paramCount}`;
                params.push(pedidoList[0]);
                paramCount++;
                countWhereClause += ` AND TRIM(c5.c5_num) = $${countParamCount}`;
                countParams.push(pedidoList[0]);
                countParamCount++;
            } else {
                const placeholders = pedidoList.map((_, i) => `$${paramCount + i}`).join(', ');
                whereClause += ` AND TRIM(c5.c5_num) IN (${placeholders})`;
                params.push(...pedidoList);
                paramCount += pedidoList.length;

                const countPlaceholders = pedidoList.map((_, i) => `$${countParamCount + i}`).join(', ');
                countWhereClause += ` AND TRIM(c5.c5_num) IN (${countPlaceholders})`;
                countParams.push(...pedidoList);
                countParamCount += pedidoList.length;
            }
        }

        if (produto) {
            whereClause += ` AND c6.c6_produto ILIKE '%' || $${paramCount} || '%'`;
            params.push(produto);
            paramCount++;
            countWhereClause += ` AND c6.c6_produto ILIKE '%' || $${countParamCount} || '%'`;
            countParams.push(produto);
            countParamCount++;
        }

        if (pedcli) {
            whereClause += ` AND c6.c6_pedcli ILIKE '%' || $${paramCount} || '%'`;
            params.push(pedcli);
            paramCount++;
            countWhereClause += ` AND c6.c6_pedcli ILIKE '%' || $${countParamCount} || '%'`;
            countParams.push(pedcli);
            countParamCount++;
        }

        // --- Novo Filtro de Tipo de Item (Múltipla Seleção) ---
        if (tipo_item) {
            const tipos = tipo_item.split(',').filter(Boolean);
            if (tipos.length > 0) {
                const tipoConditions = [];
                
                if (tipos.includes('Restrição')) {
                    tipoConditions.push(`(
                        EXISTS (
                            SELECT 1 FROM public.sb1010 filter_sb
                            WHERE TRIM(filter_sb.b1_cod) = TRIM(c6.c6_produto)
                            AND COALESCE(filter_sb.d_e_l_e_t_, '') <> '*'
                            AND filter_sb.b1_msblql IN ('1','S','T','Y')
                        ) OR EXISTS (
                            SELECT 1 FROM public.sz0010 filter_sz
                            WHERE TRIM(filter_sz.z0_produto) = TRIM(c6.c6_produto)
                            AND COALESCE(filter_sz.d_e_l_e_t_, '') <> '*'
                            AND filter_sz.z0_status = 'P'
                        )
                    )`);
                }
                if (tipos.includes('Revisão')) {
                    tipoConditions.push(`(COALESCE(c6.c6_xrevm, '') <> COALESCE(c6.c6_xrevc, ''))`);
                }
                if (tipos.includes('Novo')) {
                    tipoConditions.push(`(NOT EXISTS (
                        SELECT 1 FROM public.sg1010 sg1
                        WHERE TRIM(sg1.g1_cod) = TRIM(c6.c6_produto)
                        AND COALESCE(sg1.d_e_l_e_t_, '') <> '*'
                    ) AND NOT EXISTS (
                        SELECT 1 FROM public.sg2010 sg2
                        WHERE TRIM(sg2.g2_produto) = TRIM(c6.c6_produto)
                        AND COALESCE(sg2.d_e_l_e_t_, '') <> '*'
                    ))`);
                }
                if (tipos.includes('PCP')) {
                    tipoConditions.push(`(NOT (
                        EXISTS (
                            SELECT 1 FROM public.sb1010 filter_sb
                            WHERE TRIM(filter_sb.b1_cod) = TRIM(c6.c6_produto)
                            AND COALESCE(filter_sb.d_e_l_e_t_, '') <> '*'
                            AND filter_sb.b1_msblql IN ('1','S','T','Y')
                        ) OR EXISTS (
                            SELECT 1 FROM public.sz0010 filter_sz
                            WHERE TRIM(filter_sz.z0_produto) = TRIM(c6.c6_produto)
                            AND COALESCE(filter_sz.d_e_l_e_t_, '') <> '*'
                            AND filter_sz.z0_status = 'P'
                        )
                    ) AND COALESCE(c6.c6_xrevm, '') = COALESCE(c6.c6_xrevc, '') 
                      AND (
                        EXISTS (
                            SELECT 1 FROM public.sg1010 sg1
                            WHERE TRIM(sg1.g1_cod) = TRIM(c6.c6_produto)
                            AND COALESCE(sg1.d_e_l_e_t_, '') <> '*'
                        ) OR EXISTS (
                            SELECT 1 FROM public.sg2010 sg2
                            WHERE TRIM(sg2.g2_produto) = TRIM(c6.c6_produto)
                            AND COALESCE(sg2.d_e_l_e_t_, '') <> '*'
                        )
                    ))`);
                }
                
                if (tipoConditions.length > 0) {
                    const tipoFilter = ` AND (${tipoConditions.join(' OR ')})`;
                    whereClause += tipoFilter;
                    countWhereClause += tipoFilter;
                }
            }
        }

        // --- Filtro de Status da OP ---
        if (op_status === 'com_op') {
            const opFilter = ` AND EXISTS (SELECT 1 FROM public.sc2010 c2_status WHERE (c2_status.c2_pedido = c5.c5_num) AND c2_status.c2_itempv = c6.c6_item AND COALESCE(c2_status.d_e_l_e_t_, '') = '')`;
            whereClause += opFilter;
            countWhereClause += opFilter;
        } else if (op_status === 'sem_op') {
            const opFilter = ` AND NOT EXISTS (SELECT 1 FROM public.sc2010 c2_status WHERE (c2_status.c2_pedido = c5.c5_num) AND c2_status.c2_itempv = c6.c6_item AND COALESCE(c2_status.d_e_l_e_t_, '') = '')`;
            whereClause += opFilter;
            countWhereClause += opFilter;
        }

        if (dataInicial || dataFinal) {
            if (dateType === 'nf') {
                const nfBase = `EXISTS (
                    SELECT 1 FROM public.sd2010 d2_ex
                    JOIN public.sf2010 f2_ex
                        ON f2_ex.f2_doc = d2_ex.d2_doc
                        AND f2_ex.f2_serie = d2_ex.d2_serie
                        AND COALESCE(f2_ex.d_e_l_e_t_, '') = ''
                    WHERE d2_ex.d2_pedido = c5.c5_num
                      AND d2_ex.d2_itempv = c6.c6_item
                      AND COALESCE(d2_ex.d_e_l_e_t_, '') = ''
                `;
                let nfFilter = nfBase;
                let countNfFilter = nfBase;

                if (dataInicial) {
                    const val = dataInicial.replace(/-/g, '');
                    nfFilter += ` AND f2_ex.f2_emissao >= $${paramCount}`;
                    params.push(val);
                    paramCount++;
                    countNfFilter += ` AND f2_ex.f2_emissao >= $${countParamCount}`;
                    countParams.push(val);
                    countParamCount++;
                }
                if (dataFinal) {
                    const val = dataFinal.replace(/-/g, '');
                    nfFilter += ` AND f2_ex.f2_emissao <= $${paramCount}`;
                    params.push(val);
                    paramCount++;
                    countNfFilter += ` AND f2_ex.f2_emissao <= $${countParamCount}`;
                    countParams.push(val);
                    countParamCount++;
                }

                nfFilter += `)`;
                countNfFilter += `)`;
                whereClause += ` AND ${nfFilter}`;
                countWhereClause += ` AND ${countNfFilter}`;

            } else if (dateType === 'entrega') {
                if (dataInicial) {
                    const val = dataInicial.replace(/-/g, '');
                    whereClause += ` AND c6.c6_entreg >= $${paramCount}`;
                    params.push(val);
                    paramCount++;
                    countWhereClause += ` AND c6.c6_entreg >= $${countParamCount}`;
                    countParams.push(val);
                    countParamCount++;
                }
                if (dataFinal) {
                    const val = dataFinal.replace(/-/g, '');
                    whereClause += ` AND c6.c6_entreg <= $${paramCount}`;
                    params.push(val);
                    paramCount++;
                    countWhereClause += ` AND c6.c6_entreg <= $${countParamCount}`;
                    countParams.push(val);
                    countParamCount++;
                }
            } else if (dateType === 'entrega_pcp') {
                // entrega_pcp date filter uses the fc CTE — handled in the fc setup block below
            } else {
                // Default: filter by emissao (dateType=pedido or unrecognized)
                if (dataInicial) {
                    const val = dataInicial.replace(/-/g, '');
                    whereClause += ` AND c5.c5_emissao >= $${paramCount}`;
                    params.push(val);
                    paramCount++;
                    countWhereClause += ` AND c5.c5_emissao >= $${countParamCount}`;
                    countParams.push(val);
                    countParamCount++;
                }
                if (dataFinal) {
                    const val = dataFinal.replace(/-/g, '');
                    whereClause += ` AND c5.c5_emissao <= $${paramCount}`;
                    params.push(val);
                    paramCount++;
                    countWhereClause += ` AND c5.c5_emissao <= $${countParamCount}`;
                    countParams.push(val);
                    countParamCount++;
                }
            }
        }

        // ── FC JOIN SETUP (forecast data injected via unnest arrays) ────────────
        // Qualquer sort/filtro que dependa de datas PCP usa o fc CTE para que o
        // PostgreSQL faça TODA a ordenação, filtro e paginação sem JS intermediário.
        const needsFcJoin = (sortBy === 'entrega_pcp' || sortBy === 'prev_fat') ||
                            (dateType === 'entrega_pcp' && (dataInicial || dataFinal)) ||
                            !!pcpDataInicial || !!pcpDataFinal;

        let fcJoin = '';
        let countFcJoin = '';
        let fcSelect = 'NULL::timestamp AS data_entrega_pcp, NULL::timestamp AS data_prevista_faturamento';

        if (needsFcJoin && forecastMap.size > 0) {
            const fcPedidos = [], fcItems = [], fcDatas = [], fcPrevFats = [];
            for (const [key, val] of forecastMap) {
                const [p, i] = key.split('|');
                fcPedidos.push(p);
                fcItems.push(i);
                fcDatas.push(val.data_entrega_pcp ? new Date(val.data_entrega_pcp) : null);
                fcPrevFats.push(val.data_prevista_faturamento ? new Date(val.data_prevista_faturamento) : null);
            }
            // paramCount == countParamCount aqui (sempre incrementados juntos)
            const fcBase = paramCount;
            params.push(fcPedidos, fcItems, fcDatas, fcPrevFats);
            countParams.push(fcPedidos, fcItems, fcDatas, fcPrevFats);
            paramCount += 4;
            countParamCount += 4;

            const fcJoinSql = `
                LEFT JOIN (
                    SELECT * FROM unnest(
                        $${fcBase}::text[], $${fcBase+1}::text[],
                        $${fcBase+2}::timestamp[], $${fcBase+3}::timestamp[]
                    ) AS t(fc_pedido, fc_item, data_entrega_pcp, data_prevista_faturamento)
                ) fc ON fc.fc_pedido = TRIM(c6.c6_num) AND fc.fc_item = TRIM(c6.c6_item)
            `;
            fcJoin = fcJoinSql;
            countFcJoin = fcJoinSql;
            fcSelect = 'fc.data_entrega_pcp, fc.data_prevista_faturamento';

            // Filtro entrega_pcp por data (empurrado ao DB)
            if (dateType === 'entrega_pcp' && (dataInicial || dataFinal)) {
                if (dataInicial) {
                    whereClause += ` AND fc.data_entrega_pcp >= $${paramCount}::timestamp`;
                    countWhereClause += ` AND fc.data_entrega_pcp >= $${countParamCount}::timestamp`;
                    const v = new Date(dataInicial);
                    params.push(v); countParams.push(v); paramCount++; countParamCount++;
                }
                if (dataFinal) {
                    whereClause += ` AND fc.data_entrega_pcp <= $${paramCount}::timestamp`;
                    countWhereClause += ` AND fc.data_entrega_pcp <= $${countParamCount}::timestamp`;
                    const v = new Date(dataFinal + 'T23:59:59');
                    params.push(v); countParams.push(v); paramCount++; countParamCount++;
                }
            }

            // Filtro pcpDataInicial / pcpDataFinal (empurrado ao DB)
            if (pcpDataInicial) {
                whereClause += ` AND fc.data_entrega_pcp >= $${paramCount}::timestamp`;
                countWhereClause += ` AND fc.data_entrega_pcp >= $${countParamCount}::timestamp`;
                const v = new Date(pcpDataInicial);
                params.push(v); countParams.push(v); paramCount++; countParamCount++;
            }
            if (pcpDataFinal) {
                whereClause += ` AND fc.data_entrega_pcp <= $${paramCount}::timestamp`;
                countWhereClause += ` AND fc.data_entrega_pcp <= $${countParamCount}::timestamp`;
                const v = new Date(pcpDataFinal + 'T23:59:59');
                params.push(v); countParams.push(v); paramCount++; countParamCount++;
            }

        } else if (needsFcJoin) {
            // forecastMap vazio mas filtro/sort depende dele → retorna 0 resultados
            if ((dateType === 'entrega_pcp' && (dataInicial || dataFinal)) || pcpDataInicial || pcpDataFinal) {
                whereClause += ' AND FALSE';
                countWhereClause += ' AND FALSE';
            }
        }

        // ── ORDER BY ──────────────────────────────────────────────────────────
        const sortDir = sortOrder === 'ASC' ? 'ASC' : 'DESC';
        let orderClauseInner = '';
        if (sortBy === 'entrega') {
            orderClauseInner = `ORDER BY NULLIF(TRIM(COALESCE(c6.c6_entreg, '')), '') ${sortDir} NULLS LAST, c5.c5_num DESC, c6.c6_item ASC`;
        } else if (sortBy === 'emissao') {
            orderClauseInner = `ORDER BY c5.c5_emissao ${sortDir}, c5.c5_num DESC, c6.c6_item ASC`;
        } else if (sortBy === 'entrega_pcp') {
            orderClauseInner = fcJoin
                ? `ORDER BY CASE WHEN fc.data_entrega_pcp IS NULL THEN 1 ELSE 0 END ASC, fc.data_entrega_pcp ${sortDir} NULLS LAST, c5.c5_num DESC, c6.c6_item ASC`
                : `ORDER BY c5.c5_num DESC, c6.c6_item ASC`;
        } else if (sortBy === 'prev_fat') {
            orderClauseInner = fcJoin
                ? `ORDER BY CASE WHEN fc.data_prevista_faturamento IS NULL THEN 1 ELSE 0 END ASC, fc.data_prevista_faturamento ${sortDir} NULLS LAST, c5.c5_num DESC, c6.c6_item ASC`
                : `ORDER BY c5.c5_num DESC, c6.c6_item ASC`;
        } else if (sortBy === 'pedido') {
            orderClauseInner = `ORDER BY c5.c5_num ${sortDir}, c6.c6_item ASC`;
        } else {
            orderClauseInner = `ORDER BY c5.c5_num DESC, c6.c6_item ASC`;
        }

        let orderClauseOuter = '';
        if (sortBy === 'entrega') {
            orderClauseOuter = `ORDER BY NULLIF(TRIM(pi.entrega), '') ${sortDir} NULLS LAST, pi.pedido DESC, pi.item ASC, c2.c2_sequen ASC, c2.c2_num ASC`;
        } else if (sortBy === 'emissao') {
            orderClauseOuter = `ORDER BY pi.emissao ${sortDir}, pi.pedido DESC, pi.item ASC, c2.c2_sequen ASC, c2.c2_num ASC`;
        } else if (sortBy === 'entrega_pcp') {
            orderClauseOuter = `ORDER BY CASE WHEN pi.data_entrega_pcp IS NULL THEN 1 ELSE 0 END ASC, pi.data_entrega_pcp ${sortDir} NULLS LAST, pi.pedido DESC, pi.item ASC, c2.c2_sequen ASC, c2.c2_num ASC`;
        } else if (sortBy === 'prev_fat') {
            orderClauseOuter = `ORDER BY CASE WHEN pi.data_prevista_faturamento IS NULL THEN 1 ELSE 0 END ASC, pi.data_prevista_faturamento ${sortDir} NULLS LAST, pi.pedido DESC, pi.item ASC, c2.c2_sequen ASC, c2.c2_num ASC`;
        } else if (sortBy === 'pedido') {
            orderClauseOuter = `ORDER BY pi.pedido ${sortDir}, pi.item ASC, c2.c2_sequen ASC, c2.c2_num ASC`;
        } else {
            orderClauseOuter = `ORDER BY pi.pedido DESC, pi.item ASC, c2.c2_sequen ASC, c2.c2_num ASC`;
        }

        query = `
            WITH paged_base AS (
                SELECT
                    c5.c5_num,
                    c5.c5_cliente,
                    c5.c5_lojacli,
                    c5.c5_mennota,
                    c5.c5_zobs,
                    c5.c5_zobsorc,
                    c5.c5_emissao,
                    c5.c5_orcres,
                    c5.c5_liberok,
                    c6.c6_item,
                    c6.c6_produto,
                    c6.c6_xrevm,
                    c6.c6_xrevc,
                    c6.c6_um,
                    c6.c6_qtdven,
                    c6.c6_qtdent,
                    c6.c6_prcven,
                    c6.c6_valor,
                    c6.c6_entreg,
                    c6.c6_pedcli,
                    ${fcJoin ? 'fc.data_entrega_pcp, fc.data_prevista_faturamento' : 'NULL::varchar as data_entrega_pcp, NULL::varchar as data_prevista_faturamento'}
                FROM public.sc5010 c5
                JOIN public.sc6010 c6
                    ON COALESCE(c6.d_e_l_e_t_, '') = ''
                    AND c6.c6_filial = c5.c5_filial
                    AND c6.c6_num = c5.c5_num
                ${fcJoin}
                ${whereClause}
                ${orderClauseInner}
                -- Fetch one extra row to detect hasNextPage without COUNT(*)
                LIMIT $${paramCount} OFFSET $${paramCount + 1}
            ),
            paged_items AS (
                SELECT
                    TRIM(pb.c5_num) as pedido,
                    TRIM(pb.c5_cliente) as cod_cliente,
                    TRIM(pb.c5_lojacli) as loja_cliente,
                    NULLIF(TRIM(COALESCE(pb.c5_mennota, '') || ' ' || COALESCE(pb.c5_zobs, '') || ' ' || COALESCE(pb.c5_zobsorc, '')), '') AS observacoes_gerais,
                    sa1.a1_nome as nome_cliente,
                    pb.c5_emissao as emissao,
                    pb.c5_orcres as orcamento,
                    TRIM(pb.c6_item) as item,
                    pb.c6_item as item_raw,
                    TRIM(pb.c6_produto) as codigo,
                    pb.c6_produto as codigo_raw,
                    TRIM(pb.c6_xrevm) as rev_codigo,
                    TRIM(pb.c6_xrevc) as c6_rev_cliente,
                    sb1.b1_desc as descricao,
                    TRIM(sb1.b1_msblql) as b1_msblql,
                    pb.c6_um as unidade,
                    COALESCE(pb.c6_qtdven, 0)::numeric(18,6) as quantidade,
                    COALESCE(pb.c6_qtdent, 0)::numeric(18,6) as qtd_entreg,
                    (COALESCE(pb.c6_qtdven, 0) - COALESCE(pb.c6_qtdent, 0))::numeric(18,6) as qtd_faturar,
                    pb.c6_prcven::numeric(18,2) as valor_unitario,
                    pb.c6_valor::numeric(18,2) as valor_total,
                    COALESCE(sb1.b1_prv1, 0)::numeric(18,2) as preco_cadastro,
                    TRIM(COALESCE(pb.c6_entreg, '')) as entrega,
                    pb.c6_pedcli as ped_cliente,
                    pb.c5_liberok as status_cor,
                    pb.data_entrega_pcp,
                    pb.data_prevista_faturamento
                FROM paged_base pb
                LEFT JOIN public.sa1010 sa1
                    ON sa1.a1_cod = pb.c5_cliente
                    AND sa1.a1_loja = pb.c5_lojacli
                    AND COALESCE(sa1.d_e_l_e_t_, '') = ''
                LEFT JOIN public.sb1010 sb1
                    ON sb1.b1_cod = pb.c6_produto
                    AND COALESCE(sb1.d_e_l_e_t_, '') = ''
            )
            SELECT
                pi.*,
                -- status_tipo_item computed in JS enrichment after batch lookup
                NULL::varchar AS status_tipo_item,
                NULL::varchar AS status_tipo_detalhe,
                TRIM(c2.c2_num) AS op_num,
                TRIM(c2.c2_num) || TRIM(c2.c2_item) || TRIM(c2.c2_sequen) AS op_num_completa,
                TRIM(c2.c2_tpop) AS op_tipo,
                c2.c2_quant::numeric(18,6) AS op_qtd
            FROM paged_items pi
            LEFT JOIN public.sc2010 c2
                ON TRIM(c2.c2_pedido) = pi.pedido
                AND TRIM(c2.c2_itempv) = pi.item
                AND c2.c2_sequen = '001'
                AND COALESCE(c2.d_e_l_e_t_, '') = ''
            ${orderClauseOuter}
        `;

        params.push(limitParsed + 1, offset); // +1 for hasNextPage detection

        countQuery = `
            SELECT COUNT(*) as total
            FROM public.sc5010 c5
            JOIN public.sc6010 c6
                ON COALESCE(c6.d_e_l_e_t_, '') = ''
                AND c6.c6_filial = c5.c5_filial
                AND c6.c6_num = c5.c5_num
            LEFT JOIN public.sa1010 sa1
                ON sa1.a1_cod = c5.c5_cliente
                AND sa1.a1_loja = c5.c5_lojacli
                AND COALESCE(sa1.d_e_l_e_t_, '') = ''
            ${countFcJoin}
            ${countWhereClause}
        `;

        errorStep = 'pg_main_query';
        // Single dedicated client — no more COUNT(*) query
        const pgClient = await db.connect();
        let result;
        const _tQueryStart = Date.now();
        try {
            await pgClient.query("SET statement_timeout = '120000'; SET work_mem = '64MB';");
            // Fetch limit+1 to detect hasNextPage without COUNT(*)
            result = await pgClient.query(query, params);
        } finally {
            pgClient?.release();
        }
        console.log(`✅ /flat PG query took ${Date.now() - _tQueryStart}ms (rows=${result.rows.length})`);

        if (req.query.minimal === 'true') {
            const hasNextPage = result.rows.length > limitParsed;
            const pageData = result.rows.slice(0, limitParsed);
            return res.json({
                data: pageData,
                meta: {
                    hasNextPage,
                    page: pageParsed,
                    limit: limitParsed
                }
            });
        }

        errorStep = 'enrichment';

        // Quando fcJoin não está ativo, data_entrega_pcp e data_prevista_faturamento
        // vêm como NULL do DB — preenche do cache em memória (exibição, não sort/filter).
        if (!fcJoin) {
            for (const row of result.rows) {
                const fc = forecastMap.get(`${String(row.pedido).trim()}|${String(row.item).trim()}`);
                if (fc) {
                    row.data_entrega_pcp = fc.data_entrega_pcp;
                    row.data_prevista_faturamento = fc.data_prevista_faturamento;
                }
            }
        }

        // ── ENRICHMENT em paralelo ─────────────────────────────────────────────
        if (result.rows.length > 0) {
            const pairs = result.rows.map(r => [String(r.pedido).trim(), String(r.item).trim()]);
            const productCodes = [...new Set(result.rows.map(i => i.codigo).filter(c => c))];
            const uniquePedidos = [...new Set(pairs.map(p => p[0]))];
            const pedidoPlaceholders = uniquePedidos.map(() => '?').join(',');
            const uniquePedidosArr = result.rows.map(r => String(r.pedido).trim());
            const uniqueItems = result.rows.map(r => String(r.item).trim());

            // Batch docs: chunks em paralelo
            const docsEnrichment = (async () => {
                if (productCodes.length === 0) return {};
                const CHUNK = 150;
                const chunks = [];
                for (let i = 0; i < productCodes.length; i += CHUNK) chunks.push(productCodes.slice(i, i + CHUNK));
                const allRows = (await Promise.all(chunks.map(chunk => {
                    const ph = chunk.map(() => '?').join(',');
                    return mysqlPool.execute(`SELECT DISTINCT TRIM(produto_codigo) as produto_codigo, url_arquivo, tipo FROM produtos_docs WHERE produto_codigo IN (${ph})`, chunk).then(([r]) => r);
                }))).flat();
                const docsMap = {};
                allRows.forEach(row => {
                    if (!docsMap[row.produto_codigo]) docsMap[row.produto_codigo] = [];
                    docsMap[row.produto_codigo].push(row);
                });
                return docsMap;
            })();

            // Batch notas fiscais (PG — única query para todos os pedidos da página)
            const notasFiscaisEnrichment = db.query(`
                SELECT
                    d2.d2_pedido as pedido,
                    d2.d2_itempv as item,
                    TRIM(d2.d2_doc) as nota,
                    TRIM(d2.d2_serie) as serie,
                    TO_CHAR(TO_DATE(NULLIF(TRIM(f2.f2_emissao), ''), 'YYYYMMDD'), 'DD/MM/YY') as emissao,
                    '' as natureza,
                    TRIM(d2.d2_cf) as cfop,
                    d2.d2_quant::numeric(18,2) as qtd,
                    d2.d2_prunit::numeric(18,2) as valor_unit,
                    d2.d2_total::numeric(18,2) as valor_total,
                    d2.d2_valicm::numeric(18,2) as valor_icms,
                    d2.d2_valipi::numeric(18,2) as valor_ipi,
                    d2.d2_valfre::numeric(18,2) as valor_frete,
                    f2.f2_pbruto::numeric(18,2) as peso_bruto,
                    f2.f2_pliqui::numeric(18,2) as peso_liquido,
                    TRIM(f2.f2_transp) as transporte
                FROM public.sd2010 d2
                JOIN public.sf2010 f2
                    ON f2.f2_doc = d2.d2_doc AND f2.f2_serie = d2.d2_serie
                    AND COALESCE(f2.d_e_l_e_t_, '') = ''
                WHERE d2.d2_pedido = ANY($1::varchar[]) AND COALESCE(d2.d_e_l_e_t_, '') = ''
            `, [uniquePedidos]);

            // Batch ref_cliente / rev_cliente (PG — única query)
            const sz1Enrichment = db.query(`
                SELECT
                    z1.z1_cliente,
                    z1.z1_loja,
                    TRIM(z1.z1_produto) as produto,
                    STRING_AGG(DISTINCT TRIM(z1.z1_codcli), ' / ') as ref_cliente,
                    STRING_AGG(DISTINCT TRIM(z1.z1_revisao), ' / ') as rev_cliente
                FROM public.sz1010 z1
                WHERE z1.z1_cliente = ANY($1::varchar[])
                AND TRIM(z1.z1_produto) = ANY($2::varchar[])
                AND COALESCE(z1.d_e_l_e_t_, '') = ''
                GROUP BY z1.z1_cliente, z1.z1_loja, TRIM(z1.z1_produto)
            `, [
                [...new Set(result.rows.map(r => r.cod_cliente).filter(Boolean))],
                productCodes
            ]);

            // Last Operation Enrichment (Protheus sg2010)
            let lastOpEnrichment = null;
            if (productCodes.length > 0) {
                lastOpEnrichment = db.query(`
                    SELECT
                        TRIM(g2.g2_produto) as produto,
                        TRIM(g2.g2_recurso) as operacao_final
                    FROM public.sg2010 g2
                    WHERE TRIM(g2.g2_produto) = ANY($1::varchar[])
                    AND COALESCE(g2.d_e_l_e_t_, '') = ''
                    AND TRIM(g2.g2_codigo) = (
                        SELECT MAX(TRIM(g2_sub.g2_codigo))
                        FROM public.sg2010 g2_sub
                        WHERE TRIM(g2_sub.g2_produto) = TRIM(g2.g2_produto)
                        AND COALESCE(g2_sub.d_e_l_e_t_, '') = ''
                    )
                `, [productCodes]);
            }

            // Saldo Produzido Enrichment (MySQL app_production_appointments)
            const uniqueOpsArr = [...new Set(result.rows.map(r => String(r.op_num || '').trim()).filter(Boolean))];
            let saldoProduzidoEnrichment = null;
            if (uniqueOpsArr.length > 0) {
                const opPlaceholders = uniqueOpsArr.map(() => '?').join(',');
                saldoProduzidoEnrichment = mysqlPool.query(`
                    SELECT op_numero, operacao_codigo, SUM(quantidade) as produzido
                    FROM app_production_appointments
                    WHERE op_numero IN (${opPlaceholders})
                    AND conferencia_status != 'CANCELADO'
                    GROUP BY op_numero, operacao_codigo
                `, uniqueOpsArr);
            }

            const [forecastResult, notesResult, docsResult, faturasResult, notasResult, sz1Result, lastOpResult, saldoProdResult] = await Promise.allSettled([
                // 1. PCP Forecasts
                mysqlPool.query(`
                    SELECT *, TRIM(pedido) as p_trim, TRIM(item) as i_trim
                    FROM app_pcp_delivery_forecasts
                    WHERE TRIM(pedido) IN (${pedidoPlaceholders})
                    ORDER BY id ASC
                `, uniquePedidos),
                // 2. Notes
                mysqlPool.query(`
                    SELECT TRIM(pedido) as pedido, TRIM(item) as item,
                           pcp_planned_eng_date, pcp_planned_eng_obs,
                           designer_production_release_date, engineering_start_date, lpf_codigo,
                           project_type,
                           bom_prepared_by, bom_prepared_at, bom_released_at, bom_notes,
                           designer_name, designer_start_forecast, designer_end_forecast,
                           designer_start_real, designer_end_real, designer_notes,
                           pcp_mat_req_date, pcp_mat_req_user,
                           pcp_mech_start_date, pcp_mech_start_user,
                           pcp_cut_rel_date, pcp_cut_rel_user, pcp_notes
                    FROM app_sales_order_item_notes
                    WHERE TRIM(pedido) IN (${pedidoPlaceholders})
                `, uniquePedidos),
                // 3. Docs (chunks paralelos)
                docsEnrichment,
                // 4. Faturamentos
                mysqlPool.query(`
                    SELECT TRIM(i.pedido) as pedido, TRIM(i.item) as item,
                           s.numero_solicitacao, i.quantidade_solicitada, s.created_at, i.pcp_forecast_id
                    FROM app_faturamento_solicitacao_itens i
                    JOIN app_faturamento_solicitacoes s ON i.solicitacao_id = s.id
                    WHERE TRIM(i.pedido) IN (${pedidoPlaceholders})
                    ORDER BY s.created_at DESC
                `, uniquePedidos),
                // 5. Notas Fiscais (batch PG)
                notasFiscaisEnrichment,
                // 6. Ref/Rev cliente (batch PG)
                sz1Enrichment,
                // 7. Last Operation Code (Protheus)
                lastOpEnrichment,
                // 8. Saldo Produzido (MySQL)
                saldoProduzidoEnrichment
            ]);

            // ── Batch status lookup (sg1/sg2/sz0) — replaces per-row LATERAL JOINs ──
            const statusEnrichment = productCodes.length > 0 ? db.query(`
                SELECT 'sg1' as src, TRIM(g1_cod) as cod FROM public.sg1010
                    WHERE g1_cod = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') <> '*'
                UNION ALL
                SELECT 'sg2' as src, TRIM(g2_produto) as cod FROM public.sg2010
                    WHERE g2_produto = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') <> '*'
                UNION ALL
                SELECT 'sz0' as src, TRIM(z0_produto) as cod FROM public.sz0010
                    WHERE z0_produto = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') <> '*' AND z0_status = 'P'
            `, [productCodes]) : Promise.resolve({ rows: [] });

            // Map Last Ops
            const lastOpMap = {};
            if (lastOpResult && lastOpResult.status === 'fulfilled' && lastOpResult.value) {
                lastOpResult.value.rows.forEach(r => {
                    lastOpMap[r.produto] = r.operacao_final;
                });
            }

            // Map Saldo Produzido
            const saldoProdMap = {}; // { '005959-MO0013': 10 }
            if (saldoProdResult && saldoProdResult.status === 'fulfilled' && saldoProdResult.value) {
                saldoProdResult.value[0].forEach(r => {
                    saldoProdMap[`${r.op_numero}-${r.operacao_codigo}`] = parseFloat(r.produzido) || 0;
                });
            }

            // Merge Forecasts
            if (forecastResult.status === 'fulfilled') {
                const forecastMap = {};
                forecastResult.value[0].forEach(f => {
                    const key = `${f.p_trim}-${f.i_trim}`;
                    if (!forecastMap[key]) forecastMap[key] = [];
                    forecastMap[key].push(f);
                });
                result.rows.forEach(row => {
                    const forecasts = forecastMap[`${String(row.pedido).trim()}-${String(row.item).trim()}`] || [];
                    if (forecasts.length > 0) {
                        let matchedForecast = forecasts[forecasts.length - 1]; // fallback to last

                        if (row.op_num) {
                            const cleanOpNum = String(row.op_num).replace(/\s+/g, '');
                            const exactMatch = forecasts.find(f => f.op_protheus && cleanOpNum.startsWith(String(f.op_protheus).replace(/\s+/g, '')));
                            if (exactMatch) {
                                matchedForecast = exactMatch;
                            } else {
                                const seqStr = cleanOpNum.slice(-3);
                                const seqInt = parseInt(seqStr, 10);
                                if (!isNaN(seqInt) && seqInt > 0 && seqInt <= forecasts.length) {
                                    matchedForecast = forecasts[seqInt - 1];
                                }
                            }
                        }

                        row.pcp_delivery_forecast_id = matchedForecast.id;
                        row.data_prevista_faturamento = matchedForecast.data_prevista_faturamento;
                        row.pcp_delivery_forecast_date = matchedForecast.data_entrega_pcp;
                        row.pcp_delivery_forecast_qtd = matchedForecast.quantidade_pcp;
                        row.pcp_delivery_forecast_user = matchedForecast.usuario;
                        row.pcp_delivery_forecast_at = matchedForecast.created_at;
                        row.pcp_programacoes = [matchedForecast];
                    } else {
                        row.pcp_delivery_forecast_id = null;
                        row.data_prevista_faturamento = null;
                        row.pcp_programacoes = [];
                    }
                    
                    // Saldo Produzido injection
                    row.saldo_produzido = 0;
                    const finalOp = lastOpMap[String(row.codigo).trim()];
                    if (row.op_num && finalOp) {
                        const sKey = `${String(row.op_num).trim()}-${finalOp}`;
                        if (saldoProdMap[sKey] !== undefined) {
                            row.saldo_produzido = saldoProdMap[sKey];
                        }
                    }

                });
            } else { console.error('Error forecasts:', forecastResult.reason?.message); }

            if (notesResult.status === 'fulfilled') {
                const notesMap = {};
                notesResult.value[0].forEach(n => { notesMap[`${n.pedido}-${n.item}`] = n; });
                result.rows.forEach(row => {
                    const note = notesMap[`${String(row.pedido).trim()}-${String(row.item).trim()}`];
                    if (note) {
                        row.pcp_planned_eng_date = note.pcp_planned_eng_date;
                        row.pcp_planned_eng_obs = note.pcp_planned_eng_obs;
                        row.designer_production_release_date = note.designer_production_release_date;
                        row.engineering_start_date = note.engineering_start_date;
                        row.lpf_codigo_base = note.lpf_codigo;
                        // Engineering general + BOM
                        row.project_type = note.project_type;
                        row.bom_prepared_by = note.bom_prepared_by;
                        row.bom_prepared_at = note.bom_prepared_at;
                        row.bom_released_at = note.bom_released_at;
                        row.bom_notes = note.bom_notes;
                        // Designer
                        row.designer_name = note.designer_name;
                        row.designer_start_forecast = note.designer_start_forecast;
                        row.designer_end_forecast = note.designer_end_forecast;
                        row.designer_start_real = note.designer_start_real;
                        row.designer_end_real = note.designer_end_real;
                        row.designer_notes = note.designer_notes;
                        // PCP (Corte)
                        row.pcp_mat_req_date = note.pcp_mat_req_date;
                        row.pcp_mat_req_user = note.pcp_mat_req_user;
                        row.pcp_mech_start_date = note.pcp_mech_start_date;
                        row.pcp_mech_start_user = note.pcp_mech_start_user;
                        row.pcp_cut_rel_date = note.pcp_cut_rel_date;
                        row.pcp_cut_rel_user = note.pcp_cut_rel_user;
                        row.pcp_notes = note.pcp_notes;
                    }
                });
            } else { console.error('Error notes:', notesResult.reason?.message); }

            // Merge Docs
            if (docsResult.status === 'fulfilled') {
                const docsMap = docsResult.value;
                result.rows.forEach(item => {
                    const docs = docsMap[item.codigo] || [];
                    item.has_docs = docs.length > 0;
                    item.docs_count = docs.length;
                    const drawing = docs.find(d => String(d.tipo).toLowerCase().includes('desenho'));
                    item.has_drawing = !!drawing;
                    item.drawing_url = drawing ? drawing.url_arquivo : null;
                    item.first_doc = docs.length > 0 ? docs[0].url_arquivo : null;
                });
            } else { console.error('Error docs:', docsResult.reason?.message); }

            // Merge Faturamentos
            if (faturasResult.status === 'fulfilled') {
                const faturasMap = {};
                faturasResult.value[0].forEach(f => {
                    const key = `${String(f.pedido).trim()}-${String(f.item).trim()}`;
                    if (!faturasMap[key]) faturasMap[key] = [];
                    faturasMap[key].push(f);
                });
                result.rows.forEach(item => {
                    item.faturamentos_solicitados = faturasMap[`${String(item.pedido).trim()}-${String(item.item).trim()}`] || [];
                });
            } else { console.error('Error faturas:', faturasResult.reason?.message); }

            // Merge Notas Fiscais (batch)
            if (notasResult.status === 'fulfilled') {
                const nfMap = {};
                notasResult.value.rows.forEach(nf => {
                    const key = `${String(nf.pedido).trim()}-${String(nf.item).trim()}`;
                    if (!nfMap[key]) nfMap[key] = [];
                    nfMap[key].push({ nota: nf.nota, serie: nf.serie, emissao: nf.emissao, natureza: nf.natureza, cfop: nf.cfop, qtd: nf.qtd, valor_unit: nf.valor_unit, valor_total: nf.valor_total, valor_icms: nf.valor_icms, valor_ipi: nf.valor_ipi, valor_frete: nf.valor_frete, peso_bruto: nf.peso_bruto, peso_liquido: nf.peso_liquido, transporte: nf.transporte });
                });
                result.rows.forEach(row => {
                    row.notas_fiscais = nfMap[`${String(row.pedido).trim()}-${String(row.item).trim()}`] || null;
                });
            } else { console.error('Error notas_fiscais batch:', notasResult.reason?.message); }

            // Merge Ref/Rev Cliente (batch)
            if (sz1Result.status === 'fulfilled') {
                const sz1Map = {};
                sz1Result.value.rows.forEach(r => {
                    sz1Map[`${r.z1_cliente}-${r.z1_loja}-${r.produto}`] = r;
                });
                result.rows.forEach(row => {
                    const entry = sz1Map[`${row.cod_cliente}-${row.loja_cliente}-${row.codigo}`];
                    row.ref_cliente = entry ? entry.ref_cliente : null;
                    row.rev_cliente = entry ? entry.rev_cliente : null;
                });
            } else { console.error('Error sz1 batch:', sz1Result.reason?.message); }

            // ── Compute status_tipo_item from batch lookup (replaces SQL LATERAL JOINs) ──
            try {
                const statusRows = await statusEnrichment;
                const sg1Set = new Set(), sg2Set = new Set(), sz0Set = new Set();
                statusRows.rows.forEach(r => {
                    if (r.src === 'sg1') sg1Set.add(r.cod.trim());
                    if (r.src === 'sg2') sg2Set.add(r.cod.trim());
                    if (r.src === 'sz0') sz0Set.add(r.cod.trim());
                });
                result.rows.forEach(row => {
                    const cod = String(row.codigo || '').trim();
                    const isBlocked = ['1','S','T','Y'].includes(row.b1_msblql);
                    const hasRestriction = sz0Set.has(cod);
                    const revDiff = (row.rev_codigo || '').trim() !== (row.c6_rev_cliente || '').trim();
                    const isNew = !sg1Set.has(cod) && !sg2Set.has(cod);
                    if (isBlocked || hasRestriction) {
                        row.status_tipo_item = 'Restrição';
                        row.status_tipo_detalhe = `${isBlocked ? 'Produto bloqueado (SB1).' : 'Restrição SZ0.'} Rev. MF: ${row.rev_codigo || '-'} / Rev. Cli: ${row.c6_rev_cliente || '-'}`;
                    } else if (revDiff) {
                        row.status_tipo_item = 'Revisão';
                        row.status_tipo_detalhe = `Diferença de revisão. Rev. MF: ${row.rev_codigo || '-'} / Rev. Cli: ${row.c6_rev_cliente || '-'}`;
                    } else if (isNew) {
                        row.status_tipo_item = 'Novo';
                        row.status_tipo_detalhe = 'Produto novo — sem estrutura (BOM) cadastrada no Protheus.';
                    } else {
                        row.status_tipo_item = 'PCP';
                        row.status_tipo_detalhe = 'Item com estrutura existente, liberado para PCP.';
                    }
                });
            } catch (e) {
                console.error('Erro batch status lookup:', e.message);
            }

        }

        if (pedido && String(pedido).trim() === '004002') {
            console.log('FLAT VIEW RETURNING:', result.rows.length, 'rows for 004002');
            console.log('Item 01 count:', result.rows.filter(r => r.item === '01').length);
        }

        // Slice to limitParsed — the extra row was only fetched to detect next page
        const hasNextPage = result.rows.length > limitParsed;
        const pageData = result.rows.slice(0, limitParsed);

        res.json({
            data: pageData,
            meta: {
                hasNextPage,
                page: parseInt(page),
                limit: limitParsed
            }
        });

    } catch (err) {
        const errLog = [
            `step=${errorStep}`,
            `code=${err.code || 'n/a'}`,
            `msg=${err.message}`,
            err.stack,
            `--- query ---`,
            query,
            `--- params ---`,
            JSON.stringify(params)
        ].join('\n');
        require('fs').writeFileSync('error_log.txt', errLog);
        console.error(`❌ Erro fatal na rota /pedidos/flat [step=${errorStep}]:`, err.message);
        console.error(`   PG code: ${err.code || 'n/a'} | position: ${err.position || 'n/a'}`);
        if (err.code === '57014') console.error('   ⚠️ Query cancelada por statement_timeout — verifique índices ou aumente o timeout.');
        
        if (err.code === '53300' || err.code === '53100') {
            return res.status(503).json({
                error: 'Banco de dados temporariamente indisponível (muitas conexões ativas). Aguarde alguns segundos e tente novamente.',
                code: err.code
            });
        }

        const debugEnabled = String(req.query?.debug || '').toLowerCase() === 'true';
        res.status(500).json({
            error: 'Erro ao buscar lista plana.',
            details: err.message,
            step: errorStep || null,
            ...(debugEnabled ? {
                stack: err.stack,
                pg: {
                    code: err.code || null,
                    position: err.position || null
                },
                debug: {
                    query,
                    params,
                    countQuery,
                    paramsCount
                }
            } : {})
        });
    }
});

// GET /api/pedidos/kpi-faturar - Indicadores de Itens a Faturar
router.get('/kpi-faturar', async (req, res) => {
    try {
        const getInactiveFilter = await getInactiveOrdersFilter();
        const inactiveFilterSql = getInactiveFilter('c5.c5_num');

        // 1. Busca os itens ativos primeiro
        const queryActive = `
            SELECT
                TRIM(c5.c5_num) as pedido,
                TRIM(c6.c6_item) as item,
                TRIM(c6.c6_produto) as codigo,
                TRIM(c6.c6_xrevm) as revm,
                TRIM(c6.c6_xrevc) as revc
            FROM public.sc5010 c5
            JOIN public.sc6010 c6
                ON c6.c6_filial = c5.c5_filial
                AND c6.c6_num   = c5.c5_num
                AND COALESCE(c6.d_e_l_e_t_, '') = ''
            WHERE COALESCE(c5.d_e_l_e_t_, '') = ''
              AND c5.c5_tipo <> 'B'
              AND ((c6.c6_qtdven - c6.c6_qtdent) > 0 OR c6.c6_qtdlib > 0)
              ${inactiveFilterSql}
        `;
        const activeRes = await db.query(queryActive);
        
        if (activeRes.rows.length === 0) {
            return res.json({ data: [] });
        }

        const productCodes = [...new Set(activeRes.rows.map(r => r.codigo).filter(Boolean))];
        const pedidosList = [...new Set(activeRes.rows.map(r => r.pedido).filter(Boolean))];

        // 2. Busca flags de restrição e PCP em batch
        const [sb1Res, sz0Res, sg1Res, sg2Res, sc2Res] = await Promise.all([
            db.query(`SELECT TRIM(b1_cod) as cod, TRIM(b1_msblql) as msblql FROM public.sb1010 WHERE b1_cod = ANY($1) AND COALESCE(d_e_l_e_t_, '') = ''`, [productCodes]),
            db.query(`SELECT DISTINCT TRIM(z0_produto) as cod FROM public.sz0010 WHERE TRIM(z0_produto) = ANY($1) AND COALESCE(d_e_l_e_t_, '') <> '*' AND z0_status = 'P'`, [productCodes]),
            db.query(`SELECT DISTINCT TRIM(g1_cod) as cod FROM public.sg1010 WHERE TRIM(g1_cod) = ANY($1) AND COALESCE(d_e_l_e_t_, '') <> '*'`, [productCodes]),
            db.query(`SELECT DISTINCT TRIM(g2_produto) as cod FROM public.sg2010 WHERE TRIM(g2_produto) = ANY($1) AND COALESCE(d_e_l_e_t_, '') <> '*'`, [productCodes]),
            db.query(`SELECT DISTINCT TRIM(c2_pedido) as pedido, TRIM(c2_itempv) as item FROM public.sc2010 WHERE TRIM(c2_pedido) = ANY($1) AND COALESCE(d_e_l_e_t_, '') = ''`, [pedidosList])
        ]);

        const sb1Map = {}; sb1Res.rows.forEach(r => sb1Map[r.cod] = r.msblql);
        const sz0Set = new Set(sz0Res.rows.map(r => r.cod));
        const sg1Set = new Set(sg1Res.rows.map(r => r.cod));
        const sg2Set = new Set(sg2Res.rows.map(r => r.cod));
        const sc2Set = new Set(sc2Res.rows.map(r => `${r.pedido}-${r.item}`));

        const counts = {
            'Restrição': 0,
            'Revisão': 0,
            'Novo': 0,
            'PCP (Com OP)': 0,
            'PCP (Sem OP) - Urgente Liberação': 0
        };

        // 3. Processamento em memória
        for (const row of activeRes.rows) {
            const b1 = sb1Map[row.codigo] || '';
            const inSz0 = sz0Set.has(row.codigo);
            const inSg1 = sg1Set.has(row.codigo);
            const inSg2 = sg2Set.has(row.codigo);
            const inSc2 = sc2Set.has(`${row.pedido}-${row.item}`);
            const revm = row.revm || '';
            const revc = row.revc || '';

            if (['1', 'S', 'T', 'Y'].includes(b1) || inSz0) {
                counts['Restrição']++;
            } else if (revm !== revc) {
                counts['Revisão']++;
            } else if (!inSg1 && !inSg2) {
                counts['Novo']++;
            } else if (inSc2) {
                counts['PCP (Com OP)']++;
            } else {
                counts['PCP (Sem OP) - Urgente Liberação']++;
            }
        }

        const dataOut = Object.keys(counts).map(key => ({
            status_tipo_item: key,
            total: counts[key]
        }));

        res.json({ data: dataOut });
    } catch (err) {
        console.error('Erro na rota kpi-faturar:', err);
        res.status(500).json({ error: 'Erro interno.', details: err.message });
    }
});

// GET /api/pedidos/visao-gerencial-atrasos - Dashboard Diretor (Só Atrasados)
router.get('/visao-gerencial-atrasos', async (req, res) => {
    return getVisaoGerencial(req, res, true);
});

// GET /api/pedidos/visao-gerencial-fabrica - Dashboard Diretor (Toda a Fábrica - Atrasados + Futuros)
router.get('/visao-gerencial-fabrica', async (req, res) => {
    return getVisaoGerencial(req, res, false);
});

// POST /api/pedidos/snapshot-fabrica - Salvar snapshot diário
router.post('/snapshot-fabrica', async (req, res) => {
    try {
        const { snapshot_date, total_pedidos, total_produtos, total_atraso_qtd, total_futuro_qtd, total_atraso_brl, total_futuro_brl } = req.body;
        
        // Criar a tabela se não existir
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_pcp_snapshots (
                id INT AUTO_INCREMENT PRIMARY KEY,
                snapshot_date DATE NOT NULL,
                total_pedidos INT DEFAULT 0,
                total_produtos INT DEFAULT 0,
                total_atraso_qtd DECIMAL(15,2) DEFAULT 0,
                total_futuro_qtd DECIMAL(15,2) DEFAULT 0,
                total_atraso_brl DECIMAL(15,2) DEFAULT 0,
                total_futuro_brl DECIMAL(15,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uk_snap_date (snapshot_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Insert or Update the snapshot for today
        const query = `
            INSERT INTO app_pcp_snapshots (
                snapshot_date, total_pedidos, total_produtos, 
                total_atraso_qtd, total_futuro_qtd, 
                total_atraso_brl, total_futuro_brl
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                total_pedidos = VALUES(total_pedidos),
                total_produtos = VALUES(total_produtos),
                total_atraso_qtd = VALUES(total_atraso_qtd),
                total_futuro_qtd = VALUES(total_futuro_qtd),
                total_atraso_brl = VALUES(total_atraso_brl),
                total_futuro_brl = VALUES(total_futuro_brl)
        `;
        
        await mysqlPool.query(query, [
            snapshot_date, total_pedidos, total_produtos, 
            total_atraso_qtd, total_futuro_qtd, 
            total_atraso_brl, total_futuro_brl
        ]);

        res.json({ message: 'Snapshot salvo com sucesso!' });
    } catch (err) {
        console.error('Erro ao salvar snapshot da fábrica:', err);
        res.status(500).json({ error: 'Erro interno ao salvar snapshot.', details: err.message });
    }
});

// GET /api/pedidos/:id/item-status
// Returns lightweight status classification (Restrição/Revisão/Novo/PCP) per item.
// Used by the Visão Geral tree-mode expand to show the correct status badge.
router.get('/:id/item-status', async (req, res) => {
    try {
        const pedido = String(req.params.id || '').trim();
        if (!pedido) {
            return res.status(400).json({ error: 'Parâmetro pedido inválido ou ausente.' });
        }

        // Fetch all items for this order with only the fields needed for status classification
        const itemsResult = await db.query(`
            SELECT
                TRIM(c6.c6_item)    AS item,
                TRIM(c6.c6_produto) AS codigo,
                TRIM(c6.c6_xrevm)   AS rev_codigo,
                TRIM(c6.c6_xrevc)   AS c6_rev_cliente,
                COALESCE(sb1.b1_msblql, '') AS b1_msblql
            FROM public.sc5010 c5
            JOIN public.sc6010 c6
                ON COALESCE(c6.d_e_l_e_t_, '') = ''
                AND c6.c6_filial = c5.c5_filial
                AND c6.c6_num = c5.c5_num
            LEFT JOIN public.sb1010 sb1
                ON COALESCE(sb1.d_e_l_e_t_, '') = ''
                AND TRIM(sb1.b1_cod) = TRIM(c6.c6_produto)
            WHERE c5.c5_num = $1
              AND COALESCE(c5.d_e_l_e_t_, '') = ''
              AND c5.c5_tipo <> 'B'
            ORDER BY c6.c6_item ASC
        `, [pedido]);

        const items = itemsResult.rows;
        if (items.length === 0) {
            return res.json({ pedido, items: [] });
        }

        // Deduplicate product codes and fetch SG1, SG2, SZ0 in one batch query
        const productCodes = [...new Set(items.map(i => i.codigo).filter(Boolean))];

        const pgStatusResult = await db.query(`
            SELECT 'sg1' AS type, TRIM(g1_cod) AS cod
              FROM public.sg1010
             WHERE TRIM(g1_cod) = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') <> '*'
            UNION ALL
            SELECT 'sg2' AS type, TRIM(g2_produto) AS cod
              FROM public.sg2010
             WHERE TRIM(g2_produto) = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') <> '*'
            UNION ALL
            SELECT 'sz0' AS type, TRIM(z0_produto) AS cod
              FROM public.sz0010
             WHERE TRIM(z0_produto) = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') <> '*' AND z0_status = 'P'
        `, [productCodes]);

        const sg1Set = new Set();
        const sg2Set = new Set();
        const sz0Set = new Set();
        pgStatusResult.rows.forEach(r => {
            if (r.type === 'sg1') sg1Set.add(r.cod);
            if (r.type === 'sg2') sg2Set.add(r.cod);
            if (r.type === 'sz0') sz0Set.add(r.cod);
        });

        // Classify each item using the same hierarchy as /flat and /:id/itens
        const classified = items.map(item => {
            const isBlocked     = ['1', 'S', 'T', 'Y'].includes(item.b1_msblql);
            const hasRestriction = sz0Set.has(item.codigo);
            const revDiff       = (item.rev_codigo || '') !== (item.c6_rev_cliente || '');
            const isNew         = !sg1Set.has(item.codigo) && !sg2Set.has(item.codigo);

            let status_tipo_item, status_tipo_detalhe;

            if (isBlocked || hasRestriction) {
                status_tipo_item   = 'Restrição';
                const reason = isBlocked
                    ? 'Produto bloqueado no cadastro SB1 (b1_msblql).'
                    : 'Restrição pendente no cadastro SZ0 (status=P).';
                status_tipo_detalhe = `${reason} Rev. MF: ${item.rev_codigo || '-'} / Rev. Cli: ${item.c6_rev_cliente || '-'}`;
            } else if (revDiff) {
                status_tipo_item   = 'Revisão';
                status_tipo_detalhe = `Diferença de revisão. Rev. MF: ${item.rev_codigo || '-'} / Rev. Cli: ${item.c6_rev_cliente || '-'}`;
            } else if (isNew) {
                status_tipo_item   = 'Novo';
                status_tipo_detalhe = 'Produto novo — sem estrutura (BOM) cadastrada no Protheus.';
            } else {
                status_tipo_item   = 'PCP';
                status_tipo_detalhe = 'Item com estrutura existente, liberado para PCP.';
            }

            // Return diagnostic payload
            return {
                item: item.item,
                codigo: item.codigo,
                rev_codigo: item.rev_codigo,
                c6_rev_cliente: item.c6_rev_cliente,
                b1_msblql: item.b1_msblql,
                has_sg1: sg1Set.has(item.codigo),
                has_sg2: sg2Set.has(item.codigo),
                has_sz0: sz0Set.has(item.codigo),
                status_tipo_item,
                status_tipo_detalhe,
            };
        });

        console.log(`[item-status/${pedido}] ✅ ${classified.length} itens classificados.`);
        return res.json({ pedido, items: classified });
    } catch (err) {
        console.error(`[item-status] ❌ Erro:`, err.message);
        return res.status(500).json({ error: 'Erro ao calcular status dos itens.', details: err.message });
    }
});

// GET /api/pedidos/:id/pdf-data  ── Lean endpoint for PDF generation only
// Returns only what orderPdfGenerator.js needs: PG core fields + MySQL notes
// Avoids the 8 enrichment queries of /:id/itens, preventing MySQL connection exhaustion
router.get('/:id/pdf-data', async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        if (!id) return res.status(400).json({ error: 'Parâmetro pedido inválido.' });

        // ── Query 1: Core PG data (only fields used by PDF) ──
        const pgResult = await db.query(`
            SELECT
                TRIM(c5.c5_num)                                         AS pedido,
                TRIM(c5.c5_cliente)                                      AS cod_cliente,
                TRIM(sa1.a1_nome)                                        AS nome_cliente,
                c5.c5_emissao                                            AS emissao,
                TRIM(c6.c6_item)                                         AS item,
                TRIM(c6.c6_produto)                                      AS codigo,
                TRIM(c6.c6_xrevm)                                        AS rev_codigo,
                TRIM(c6.c6_xrevc)                                        AS c6_rev_cliente,
                sb1.b1_desc                                              AS descricao,
                c6.c6_um                                                 AS unidade,
                COALESCE(c6.c6_qtdven, 0)::numeric(18,2)                AS qtd,
                COALESCE(c6.c6_qtdent, 0)::numeric(18,2)                AS qtd_entreg,
                (COALESCE(c6.c6_qtdven,0) - COALESCE(c6.c6_qtdent,0))::numeric(18,2) AS qtd_faturar,
                TRIM(COALESCE(c6.c6_entreg, ''))                        AS entrega,
                TRIM(COALESCE(c6.c6_entreg, ''))                        AS c6_entreg,
                TRIM(c6.c6_pedcli)                                       AS ped_cliente,
                TRIM(c2.c2_num)                                          AS op_num,
                TRIM(c2.c2_tpop)                                         AS op_tipo,
                c2.c2_quant::numeric(18,2)                               AS op_qtd,
                NULLIF(TRIM(COALESCE(c5.c5_mennota,'') || ' ' || COALESCE(c5.c5_zobs,'')), '') AS observacoes_gerais
            FROM public.sc5010 c5
            JOIN public.sc6010 c6
                ON COALESCE(c6.d_e_l_e_t_, '') = ''
                AND c6.c6_filial = c5.c5_filial
                AND c6.c6_num = c5.c5_num
            LEFT JOIN public.sa1010 sa1
                ON sa1.a1_cod = c5.c5_cliente
                AND sa1.a1_loja = c5.c5_lojacli
                AND COALESCE(sa1.d_e_l_e_t_, '') = ''
            LEFT JOIN public.sb1010 sb1
                ON TRIM(sb1.b1_cod) = TRIM(c6.c6_produto)
                AND COALESCE(sb1.d_e_l_e_t_, '') = ''
            LEFT JOIN public.sc2010 c2
                ON TRIM(c2.c2_pedido) = TRIM(c5.c5_num)
                AND c2.c2_itempv = c6.c6_item
                AND c2.c2_sequen = '001'
                AND COALESCE(c2.d_e_l_e_t_, '') = ''
            WHERE c5.c5_num = $1
              AND COALESCE(c5.d_e_l_e_t_, '') = ''
              AND c5.c5_tipo <> 'B'
            ORDER BY c6.c6_item ASC
        `, [id]);

        if (pgResult.rows.length === 0) {
            return res.status(404).json({ error: 'Pedido não encontrado.' });
        }

        // ── Query 2: Notes/Ata from MySQL (only pcp_notes for footer obs) ──
        let notes = [];
        try {
            const [noteRows] = await mysqlPool.execute(
                `SELECT TRIM(pedido) AS pedido, TRIM(item) AS item_number,
                        pcp_notes, designer_notes
                 FROM app_sales_order_item_notes
                 WHERE TRIM(pedido) = ?`,
                [id.replace(/^0+/, '')]
            );
            notes = noteRows || [];
        } catch (mysqlErr) {
            console.warn(`[pdf-data/${id}] MySQL notes unavailable:`, mysqlErr.message);
            // Non-fatal: PDF still generates without notes
        }

        // Attach pcp_notes to items
        const notesMap = {};
        notes.forEach(n => { notesMap[n.item_number] = n; });
        const itens = pgResult.rows.map(row => ({
            ...row,
            pcp_notes: notesMap[String(Number(row.item) || row.item)]?.pcp_notes || '',
            status_tipo_item: 'PCP', // simplified for PDF display
        }));

        // Build capa from first row
        const first = pgResult.rows[0];
        const capa = {
            pedido:           first.pedido,
            cod_cliente:      first.cod_cliente,
            nome_cliente:     first.nome_cliente || '',
            emissao:          first.emissao || '',
            pedido_cliente:   first.ped_cliente || '',
            entrega:          first.entrega || '',
            observacoes_gerais: first.observacoes_gerais || '',
        };

        return res.json({ capa, itens });

    } catch (err) {
        console.error(`[pdf-data] ❌`, err.message);
        return res.status(500).json({ error: 'Erro ao gerar dados do PDF.', details: err.message });
    }
});

// GET /api/pedidos/:id/itens
router.get('/:id/itens', async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();

        // Guard: reject empty or obviously invalid IDs before touching the DB
        if (!id) {
            return res.status(400).json({ error: 'Parâmetro pedido inválido ou ausente.' });
        }

        const query = `
            SELECT
                TRIM(c5.c5_num)     AS pedido,
                TRIM(c5.c5_cliente) AS cod_cliente,
                TRIM(c5.c5_lojacli) AS loja_cliente,
                TRIM(c6.c6_item)    AS item,
                TRIM(c6.c6_produto) AS codigo,
                TRIM(c6.c6_xrevm) AS rev_codigo,
                TRIM(c6.c6_xrevc) AS c6_rev_cliente,
                sb1.b1_desc   AS descricao,
                c6.c6_um      AS unidade,
                COALESCE(c6.c6_qtdven, 0)::numeric(18,6)  AS quantidade,
                TRIM(c6.c6_entreg) AS entrega_raw,
                TRIM(c6.c6_pedcli) AS ped_cliente,
                TRIM(c2.c2_num) AS op_num,
                TRIM(c2.c2_num) || TRIM(c2.c2_item) || TRIM(c2.c2_sequen) AS op_num_completa,
                TRIM(c2.c2_tpop) AS op_tipo,
                c2.c2_quant   AS op_qtd,
                COALESCE(c6.c6_qtdent, 0)::numeric(18,6) AS qtd_entreg,
                (COALESCE(c6.c6_qtdven, 0) - COALESCE(c6.c6_qtdent, 0))::numeric(18,6) AS qtd_faturar,
                sb1.b1_msblql
            FROM public.sc5010 c5
            JOIN public.sc6010 c6
                ON COALESCE(c6.d_e_l_e_t_, '') = ''
                AND c6.c6_filial = c5.c5_filial
                AND c6.c6_num = c5.c5_num
            LEFT JOIN public.sb1010 sb1
                ON COALESCE(sb1.d_e_l_e_t_, '') = ''
                AND TRIM(sb1.b1_cod) = TRIM(c6.c6_produto)
            LEFT JOIN public.sc2010 c2
                ON (c2.c2_pedido = c5.c5_num )
                AND c2.c2_itempv = c6.c6_item
                AND COALESCE(c2.d_e_l_e_t_, '') = ''

            WHERE c5.c5_num = $1
            AND COALESCE(c5.d_e_l_e_t_, '') = ''
            AND c5.c5_tipo <> 'B'
            ORDER BY c6.c6_item ASC
        `;

        let result;
        try {
            result = await db.query(query, [id]);
        } catch (pgErr) {
            console.error(`[itens/${id}] ❌ FASE 1 - Query principal PostgreSQL falhou:`, pgErr.message);
            return res.status(500).json({ error: 'Erro na query principal de itens.', details: pgErr.message });
        }

        // Parallel Enrichment: Notes + Docs + NFs + Ref/Rev cliente + PG Status Checks
        const items = result.rows;
        if (items.length > 0) {
            console.log(`[itens/${id}] ✅ ${items.length} itens encontrados. Iniciando enriquecimento...`);
            const productCodes = [...new Set(items.map(i => i.codigo).filter(c => c))];
            const paddedCodes = productCodes.map(c => c.padEnd(15, ' '));

            const codCliente = items[0]?.cod_cliente;
            const lojaCliente = items[0]?.loja_cliente;

            const [notesResult, docsResult, nfResult, sz1Result, pgStatusResult] = await Promise.allSettled([
                // 1. Notes
                mysqlPool.query('SELECT * FROM app_sales_order_item_notes WHERE pedido = ?', [id]),
                // 2. Docs
                (async () => {
                    if (productCodes.length === 0) return {};
                    const placeholders = productCodes.map(() => '?').join(',');
                    const [docsRows] = await mysqlPool.execute(
                        `SELECT TRIM(produto_codigo) as produto_codigo, url_arquivo, tipo FROM produtos_docs WHERE produto_codigo IN (${placeholders})`,
                        productCodes
                    );
                    const docsMap = {};
                    docsRows.forEach(row => {
                        if (!docsMap[row.produto_codigo]) docsMap[row.produto_codigo] = [];
                        docsMap[row.produto_codigo].push(row);
                    });
                    return docsMap;
                })(),
                // 3. Notas Fiscais (batch)
                db.query(`
                    SELECT d2.d2_itempv as item,
                        TRIM(d2.d2_doc) as nota, TRIM(d2.d2_serie) as serie,
                        TRIM(f2.f2_emissao) as emissao_raw,
                        '' as natureza, TRIM(d2.d2_cf) as cfop,
                        d2.d2_quant::numeric(18,2) as qtd, d2.d2_prunit::numeric(18,2) as valor_unit,
                        d2.d2_total::numeric(18,2) as valor_total, d2.d2_valicm::numeric(18,2) as valor_icms,
                        d2.d2_valipi::numeric(18,2) as valor_ipi, d2.d2_valfre::numeric(18,2) as valor_frete,
                        f2.f2_pbruto::numeric(18,2) as peso_bruto, f2.f2_pliqui::numeric(18,2) as peso_liquido,
                        TRIM(f2.f2_transp) as transporte
                    FROM public.sd2010 d2
                    JOIN public.sf2010 f2 ON f2.f2_doc = d2.d2_doc AND f2.f2_serie = d2.d2_serie AND COALESCE(f2.d_e_l_e_t_, '') = ''
                    WHERE d2.d2_pedido = $1 AND COALESCE(d2.d_e_l_e_t_, '') = ''
                `, [id]),
                // 4. Ref/Rev cliente (batch)
                codCliente ? db.query(`
                    SELECT TRIM(z1.z1_produto) as produto,
                        STRING_AGG(DISTINCT TRIM(z1.z1_codcli), ' / ') as ref_cliente,
                        STRING_AGG(DISTINCT TRIM(z1.z1_revisao), ' / ') as rev_cliente
                    FROM public.sz1010 z1
                    WHERE z1.z1_cliente = $1 AND z1.z1_loja = $2
                    AND TRIM(z1.z1_produto) = ANY($3::varchar[])
                    AND COALESCE(z1.d_e_l_e_t_, '') = ''
                    GROUP BY TRIM(z1.z1_produto)
                `, [codCliente, lojaCliente, productCodes]) : Promise.resolve({ rows: [] }),
                // 5. PG Status (SG1, SG2, SZ0) via batch with indexes
                productCodes.length > 0 ? db.query(`
                    SELECT 'sg1' as type, TRIM(g1_cod) as cod FROM public.sg1010 WHERE g1_cod = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') <> '*'
                    UNION ALL
                    SELECT 'sg2' as type, TRIM(g2_produto) as cod FROM public.sg2010 WHERE g2_produto = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') <> '*'
                    UNION ALL
                    SELECT 'sz0' as type, TRIM(z0_produto) as cod FROM public.sz0010 WHERE z0_produto = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') <> '*' AND z0_status = 'P'
                `, [paddedCodes]) : Promise.resolve({ rows: [] })
            ]);

            // Merge Notes
            if (notesResult.status === 'fulfilled') {
                const notesMap = {};
                notesResult.value[0].forEach(n => notesMap[n.item] = n);
                items.forEach(item => {
                    const note = notesMap[item.item];
                    if (note) {
                        item.project_type = note.project_type;
                        item.engineering_start_date = note.engineering_start_date;
                        item.bom_prepared_by = note.bom_prepared_by;
                        item.bom_prepared_at = note.bom_prepared_at;
                        item.bom_released_at = note.bom_released_at;
                        item.bom_notes = note.bom_notes;
                        item.designer_name = note.designer_name;
                        item.designer_start_forecast = note.designer_start_forecast;
                        item.designer_end_forecast = note.designer_end_forecast;
                        item.designer_start_real = note.designer_start_real;
                        item.designer_end_real = note.designer_end_real;
                        item.designer_production_release_date = note.designer_production_release_date;
                        item.designer_notes = note.designer_notes;
                        item.pcp_mat_req_date = note.pcp_mat_req_date;
                        item.pcp_mat_req_user = note.pcp_mat_req_user;
                        item.pcp_mech_start_date = note.pcp_mech_start_date;
                        item.pcp_mech_start_user = note.pcp_mech_start_user;
                        item.pcp_cut_rel_date = note.pcp_cut_rel_date;
                        item.pcp_cut_rel_user = note.pcp_cut_rel_user;
                        item.pcp_notes = note.pcp_notes;
                        item.pcp_planned_eng_date = note.pcp_planned_eng_date;
                        item.pcp_planned_eng_obs = note.pcp_planned_eng_obs;
                    } else {
                        item.project_type = null;
                        item.engineering_start_date = null;
                        item.designer_production_release_date = null;
                    }
                });
            } else {
                console.error('Error merging notes (items):', notesResult.reason?.message);
            }

            // Merge Docs
            if (docsResult.status === 'fulfilled') {
                const docsMap = docsResult.value;
                items.forEach(item => {
                    const docs = docsMap[item.codigo] || [];
                    item.has_docs = docs.length > 0;
                    item.docs_count = docs.length;
                    const drawing = docs.find(d => String(d.tipo).toLowerCase().includes('desenho'));
                    item.has_drawing = !!drawing;
                    item.drawing_url = drawing ? drawing.url_arquivo : null;
                    item.first_doc = docs.length > 0 ? docs[0].url_arquivo : null;
                });
            } else {
                console.error('Error merging docs (items):', docsResult.reason?.message);
            }

            // Merge Notas Fiscais (batch)
            if (nfResult.status === 'fulfilled') {
                const nfMap = {};
                nfResult.value.rows.forEach(nf => {
                    const key = String(nf.item).trim();
                    if (!nfMap[key]) nfMap[key] = [];
                    nfMap[key].push({ nota: nf.nota, serie: nf.serie, emissao_raw: nf.emissao_raw, natureza: nf.natureza, cfop: nf.cfop, qtd: nf.qtd, valor_unit: nf.valor_unit, valor_total: nf.valor_total, valor_icms: nf.valor_icms, valor_ipi: nf.valor_ipi, valor_frete: nf.valor_frete, peso_bruto: nf.peso_bruto, peso_liquido: nf.peso_liquido, transporte: nf.transporte });
                });
                items.forEach(item => {
                    item.notas_fiscais = nfMap[String(item.item).trim()] || null;
                });
            } else {
                console.error('Error merging NFs (items):', nfResult.reason?.message);
            }

            // Merge Ref/Rev Cliente (batch SZ1)
            if (sz1Result.status === 'fulfilled') {
                const sz1Map = {};
                sz1Result.value.rows.forEach(r => {
                    sz1Map[r.produto] = r;
                });
                items.forEach(item => {
                    const entry = sz1Map[item.codigo];
                    item.ref_cliente = entry ? entry.ref_cliente : null;
                    item.rev_cliente = entry ? entry.rev_cliente : null;
                });
            } else {
                console.error('Error merging SZ1 (items):', sz1Result.reason?.message);
            }

            // Process Status Item (Calculated in JS instead of lateral joins)
            let sg1Set = new Set(), sg2Set = new Set(), sz0Set = new Set();
            if (pgStatusResult.status === 'fulfilled') {
                pgStatusResult.value.rows.forEach(r => {
                    if (r.type === 'sg1') sg1Set.add(r.cod);
                    if (r.type === 'sg2') sg2Set.add(r.cod);
                    if (r.type === 'sz0') sz0Set.add(r.cod);
                });
            } else {
                console.error('Error fetching PG Status (items):', pgStatusResult.reason?.message);
            }

            items.forEach(item => {
                const isBlocked = ['1','S','T','Y'].includes(item.b1_msblql);
                const hasRestriction = sz0Set.has(item.codigo);
                const revDiff = (item.rev_codigo || '') !== (item.c6_rev_cliente || '');
                const isNew = !sg1Set.has(item.codigo) && !sg2Set.has(item.codigo);

                if (isBlocked || hasRestriction) {
                    item.status_tipo_item = 'Restrição';
                    let detail = isBlocked ? `Produto bloqueado no cadastro (SB1 b1_msblql).` : `Restrição pendente no cadastro (SZ0 status=P).`;
                    item.status_tipo_detalhe = `${detail} Rev. MF: ${item.rev_codigo || '-'} / Rev. Cli: ${item.c6_rev_cliente || '-'}`;
                } else if (revDiff) {
                    item.status_tipo_item = 'Revisão';
                    item.status_tipo_detalhe = `Diferença de revisão detectada. Rev. MF: ${item.rev_codigo || '-'} / Rev. Cli: ${item.c6_rev_cliente || '-'}`;
                } else if (isNew) {
                    item.status_tipo_item = 'Novo';
                    item.status_tipo_detalhe = 'Produto novo — sem estrutura (BOM) cadastrada no Protheus.';
                } else {
                    item.status_tipo_item = 'PCP';
                    item.status_tipo_detalhe = 'Item com estrutura existente, liberado para PCP.';
                }
            });

            // Fetch All PCP Forecasts for this pedido
            try {
                const [forecasts] = await mysqlPool.query(`
                        SELECT *, TRIM(pedido) as p_trim, TRIM(item) as item_trim
                        FROM app_pcp_delivery_forecasts
                        WHERE TRIM(pedido) = ?
                        ORDER BY id ASC
                    `, [id]);

                const forecastMap = {};
                forecasts.forEach(f => {
                    const key = f.item_trim;
                    if (!forecastMap[key]) forecastMap[key] = [];
                    forecastMap[key].push(f);
                });

                items.forEach(item => {
                    const itemForecasts = forecastMap[item.item] || [];
                    if (itemForecasts.length > 0) {
                        let matchedForecast = itemForecasts[itemForecasts.length - 1]; // fallback to last

                        if (item.op_num) {
                            const cleanOpNum = String(item.op_num).replace(/\s+/g, '');
                            const exactMatch = itemForecasts.find(f => f.op_protheus && cleanOpNum.startsWith(String(f.op_protheus).replace(/\s+/g, '')));
                            if (exactMatch) {
                                matchedForecast = exactMatch;
                            } else {
                                const seqStr = cleanOpNum.slice(-3);
                                const seqInt = parseInt(seqStr, 10);
                                if (!isNaN(seqInt) && seqInt > 0 && seqInt <= itemForecasts.length) {
                                    matchedForecast = itemForecasts[seqInt - 1];
                                }
                            }
                        }

                        item.pcp_delivery_forecast_id = matchedForecast.id;
                        item.data_prevista_faturamento = matchedForecast.data_prevista_faturamento;
                        item.pcp_delivery_forecast_date = matchedForecast.data_entrega_pcp;
                        item.pcp_delivery_forecast_qtd = matchedForecast.quantidade_pcp;
                        item.pcp_delivery_forecast_user = matchedForecast.usuario;
                        item.pcp_delivery_forecast_at = matchedForecast.created_at;
                        item.pcp_programacoes = [matchedForecast];
                    } else {
                        item.pcp_delivery_forecast_id = null;
                        item.data_prevista_faturamento = null;
                        item.pcp_delivery_forecast_date = null;
                        item.pcp_delivery_forecast_qtd = null;
                        item.pcp_delivery_forecast_user = null;
                        item.pcp_delivery_forecast_at = null;
                        item.pcp_programacoes = [];
                    }
                });
            } catch (err) {
                console.error('Error merging PCP forecasts:', err);
            }

            // Converter datas de Protheus string (YYYYMMDD) para formato legível (DD/MM/YY) p/ Frontend
            const parseDateStr = (dStr) => {
                if (!dStr || dStr.trim() === '' || dStr.length < 8) return null;
                return `${dStr.substring(6, 8)}/${dStr.substring(4, 6)}/${dStr.substring(2, 4)}`;
            };

            items.forEach(item => {
                item.entrega = parseDateStr(item.entrega_raw);
                if (item.notas_fiscais) {
                    item.notas_fiscais.forEach(nf => {
                        nf.emissao = parseDateStr(nf.emissao_raw);
                    });
                }
            });
        }

        res.json(items);

    } catch (err) {
        require('fs').writeFileSync('error_itens_log.txt', `[${new Date().toISOString()}] pedido=${req.params.id}\n${err.stack}`);
        console.error(`Erro SQL ao buscar itens pedido ${req.params.id}: `, err.message);
        res.status(500).json({ error: 'Erro ao buscar itens do pedido.', details: err.message });
    }
});

// Sales Order Item Notes Routes
// Ensure tables exist
(async () => {
    try {
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_sales_order_item_notes(
            id INT AUTO_INCREMENT PRIMARY KEY,
            pedido VARCHAR(20) NOT NULL,
            item VARCHAR(10) NOT NULL,
            nota TEXT,
            status ENUM('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO') DEFAULT 'PENDENTE',
            created_by VARCHAR(100),
            updated_by VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_pedido_item(pedido, item),
            INDEX idx_pedido(pedido)
        ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4
            `);

        // Check/Add project_type
        try {
            await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN project_type VARCHAR(50) DEFAULT NULL`);
        } catch (e) { /* ignore if exists */ }

        // Check/Add engineering_start_date
        try {
            await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN engineering_start_date DATE DEFAULT NULL`);
        } catch (e) { /* ignore */ }

        // BOM Fields
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN bom_prepared_by VARCHAR(100) DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN bom_prepared_at DATE DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN bom_released_at DATE DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN bom_notes TEXT DEFAULT NULL`); } catch (e) { }

        // Designer Fields
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN designer_name VARCHAR(100) DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN designer_start_forecast DATE DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN designer_end_forecast DATE DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN designer_start_real DATE DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN designer_end_real DATE DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN designer_production_release_date DATE DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN designer_notes TEXT DEFAULT NULL`); } catch (e) { }

        // PCP Fields
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN pcp_mat_req_date DATE DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN pcp_mat_req_user VARCHAR(100) DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN pcp_mech_start_date DATE DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN pcp_mech_start_user VARCHAR(100) DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN pcp_cut_rel_date DATE DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN pcp_cut_rel_user VARCHAR(100) DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN pcp_notes TEXT DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN pcp_planned_eng_date DATE DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN pcp_planned_eng_obs TEXT DEFAULT NULL`); } catch (e) { }

        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_sales_order_item_notes_history(
                id INT AUTO_INCREMENT PRIMARY KEY,
                pedido VARCHAR(20) NOT NULL,
                item VARCHAR(10) NOT NULL,
                action_type ENUM('CREATED', 'UPDATED', 'STATUS_CHANGED', 'DELETED') NOT NULL,
                field_changed VARCHAR(50),
                old_value TEXT,
                new_value TEXT,
                user_name VARCHAR(100) NOT NULL,
                user_email VARCHAR(100),
                action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_pedido_item(pedido, item),
                INDEX idx_timestamp(action_timestamp DESC)
            ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4
        `);

        // PCP Forecasts Table
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_pcp_delivery_forecasts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                pedido VARCHAR(20) NOT NULL,
                item VARCHAR(10) NOT NULL,
                data_entrega_pcp DATE NOT NULL,
                quantidade_pcp DECIMAL(18,6) NOT NULL,
                usuario VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_pedido_item (pedido, item)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
    } catch (err) {
        console.error('Error notes tables:', err.message);
    }
})();

// Helper function to log history
async function logHistory(pedido, item, actionType, fieldChanged, oldValue, newValue, userName, userEmail) {
    try {
        await mysqlPool.query(
            `INSERT INTO app_sales_order_item_notes_history
            (pedido, item, action_type, field_changed, old_value, new_value, user_name, user_email)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
            [pedido, item, actionType, fieldChanged, oldValue, newValue, userName, userEmail]
        );
    } catch (err) {
        console.error('Error logging history:', err);
    }
}

// ─── Batch Engineering Control Save ──────────────────────────────────────────
// POST /api/pedidos/batch/items/notes
// Aplica os mesmos campos de controle em múltiplos itens de uma vez.
router.post('/batch/items/notes', async (req, res) => {
    const { items, formData } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Lista de itens é obrigatória.' });
    }
    if (!formData || Object.keys(formData).length === 0) {
        return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
    }

    const userName = req.user?.name || req.user?.username || 'Sistema';
    const userEmail = req.user?.email || '';

    const trackedFields = [
        'project_type', 'engineering_start_date',
        'bom_prepared_by', 'bom_prepared_at', 'bom_released_at', 'bom_notes',
        'designer_name', 'designer_start_forecast', 'designer_end_forecast',
        'designer_start_real', 'designer_end_real', 'designer_production_release_date', 'designer_notes',
        'pcp_mat_req_date', 'pcp_mat_req_user', 'pcp_mech_start_date', 'pcp_mech_start_user',
        'pcp_cut_rel_date', 'pcp_cut_rel_user', 'pcp_notes',
        'pcp_planned_eng_date', 'pcp_planned_eng_obs'
    ];

    const dateFields = new Set([
        'engineering_start_date', 'bom_prepared_at', 'bom_released_at',
        'designer_start_forecast', 'designer_end_forecast',
        'designer_start_real', 'designer_end_real', 'designer_production_release_date',
        'pcp_mat_req_date', 'pcp_mech_start_date', 'pcp_cut_rel_date', 'pcp_planned_eng_date'
    ]);

    const isValidDate = (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v);
    const sanitize = (field, val) => {
        if (val === '' || val === undefined || val === null) return null;
        if (dateFields.has(field) && !isValidDate(val)) return null;
        return val;
    };

    const results = [];
    const errors = [];

    const conn = await mysqlPool.getConnection();
    try {
        await conn.beginTransaction();

        for (const { pedido, item } of items) {
            try {
                const [existing] = await conn.query(
                    'SELECT * FROM app_sales_order_item_notes WHERE pedido = ? AND item = ?',
                    [pedido, item]
                );

                if (existing.length > 0) {
                    const oldNote = existing[0];
                    const updates = [];
                    const values = [];

                    for (const field of trackedFields) {
                        if (formData[field] === undefined) continue;
                        const newVal = sanitize(field, formData[field]);
                        const oldVal = oldNote[field] ?? null;
                        const normOld = oldVal instanceof Date ? oldVal.toISOString().split('T')[0] : (oldVal === '' ? null : oldVal);
                        const normNew = newVal === '' ? null : newVal;
                        if (normNew !== normOld) {
                            updates.push(`${field} = ?`);
                            values.push(newVal);
                            await logHistory(pedido, item, 'UPDATED', field, normOld, normNew, `${userName} [lote]`, userEmail);
                        }
                    }

                    if (updates.length > 0) {
                        updates.push('updated_by = ?');
                        values.push(userName);
                        await conn.query(
                            `UPDATE app_sales_order_item_notes SET ${updates.join(', ')} WHERE pedido = ? AND item = ?`,
                            [...values, pedido, item]
                        );
                    }
                    results.push({ pedido, item, action: 'updated' });
                } else {
                    const fields = ['pedido', 'item', 'nota', 'status', 'created_by', 'updated_by', ...trackedFields];
                    const placeholders = fields.map(() => '?').join(', ');
                    const values = [
                        pedido, item, '', 'PENDENTE', userName, userName,
                        ...trackedFields.map(f => sanitize(f, formData[f] ?? null))
                    ];
                    await conn.query(
                        `INSERT INTO app_sales_order_item_notes(${fields.join(', ')}) VALUES(${placeholders})`,
                        values
                    );
                    await logHistory(pedido, item, 'CREATED', null, null, 'Lançamento em lote', `${userName} [lote]`, userEmail);
                    results.push({ pedido, item, action: 'created' });
                }
            } catch (itemErr) {
                errors.push({ pedido, item, error: itemErr.message });
            }
        }

        await conn.commit();
        res.json({ success: true, results, errors });
    } catch (err) {
        await conn.rollback();
        console.error('❌ [BATCH NOTES]', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

router.get('/:pedido/items/notes', async (req, res) => {
    try {
        const { pedido } = req.params;
        const [rows] = await mysqlPool.query(
            'SELECT * FROM app_sales_order_item_notes WHERE pedido = ? ORDER BY item',
            [pedido]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/:pedido/items/:item/notes', async (req, res) => {
    try {
        const { pedido, item } = req.params;
        const body = req.body;
        const { nota, status } = body;
        const userName = req.user?.name || req.user?.username || 'Sistema';
        const userEmail = req.user?.email || '';

        // Fields to track
        const trackedFields = [
            'project_type', 'engineering_start_date',
            'bom_prepared_by', 'bom_prepared_at', 'bom_released_at', 'bom_notes',
            'designer_name', 'designer_start_forecast', 'designer_end_forecast',
            'designer_start_real', 'designer_end_real', 'designer_production_release_date', 'designer_notes',
            'pcp_mat_req_date', 'pcp_mat_req_user',
            'pcp_mech_start_date', 'pcp_mech_start_user',
            'pcp_cut_rel_date', 'pcp_cut_rel_user',
            'pcp_notes',
            'pcp_planned_eng_date', 'pcp_planned_eng_obs'
        ];

        // DATE columns — empty strings must become null for MySQL
        const dateFields = new Set([
            'engineering_start_date', 'bom_prepared_at', 'bom_released_at',
            'designer_start_forecast', 'designer_end_forecast',
            'designer_start_real', 'designer_end_real', 'designer_production_release_date',
            'pcp_mat_req_date', 'pcp_mech_start_date', 'pcp_cut_rel_date',
            'pcp_planned_eng_date'
        ]);

        // Sanitize: convert empty strings to null for DATE fields
        const sanitize = (field, val) => {
            if (val === '' || val === undefined) return null;
            return val;
        };

        const [existing] = await mysqlPool.query(
            'SELECT * FROM app_sales_order_item_notes WHERE pedido = ? AND item = ?',
            [pedido, item]
        );

        if (existing.length > 0) {
            const oldNote = existing[0];
            const updates = [];
            const values = [];

            if (nota !== undefined && nota !== oldNote.nota) {
                updates.push('nota = ?');
                values.push(nota);
                await logHistory(pedido, item, 'UPDATED', 'nota', oldNote.nota, nota, userName, userEmail);
            }

            if (status && status !== oldNote.status) {
                updates.push('status = ?');
                values.push(status);
                await logHistory(pedido, item, 'STATUS_CHANGED', 'status', oldNote.status, status, userName, userEmail);
            }

            // Generic update for tracked fields
            for (const field of trackedFields) {
                const newVal = dateFields.has(field) ? sanitize(field, body[field]) : body[field];
                const oldVal = oldNote[field] || null;
                // Normalize: treat null/undefined/''/null-date as equivalent
                const normalizedOld = (oldVal === '' || oldVal === undefined) ? null : (oldVal instanceof Date ? oldVal.toISOString().split('T')[0] : oldVal);
                const normalizedNew = (newVal === '' || newVal === undefined) ? null : newVal;

                if (body[field] !== undefined && normalizedNew !== normalizedOld) {
                    updates.push(`${field} = ?`);
                    values.push(newVal);
                    await logHistory(pedido, item, 'UPDATED', field, normalizedOld, normalizedNew, userName, userEmail);
                }
            }

            if (updates.length > 0) {
                updates.push('updated_by = ?');
                values.push(userName);
                await mysqlPool.query(
                    `UPDATE app_sales_order_item_notes SET ${updates.join(', ')} WHERE pedido = ? AND item = ? `,
                    [...values, pedido, item]
                );
            }
            res.json({ success: true, action: 'updated' });
        } else {
            // INSERT
            const fields = ['pedido', 'item', 'nota', 'status', 'created_by', 'updated_by', ...trackedFields];
            const placeholders = fields.map(() => '?').join(', ');

            const values = [
                pedido, item, nota || '', status || 'PENDENTE', userName, userName,
                ...trackedFields.map(f => body[f] || null)
            ];

            await mysqlPool.query(
                `INSERT INTO app_sales_order_item_notes(${fields.join(', ')}) VALUES(${placeholders})`,
                values
            );
            await logHistory(pedido, item, 'CREATED', null, null, nota, userName, userEmail);
            res.json({ success: true, action: 'created' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:pedido/items/:item/notes', async (req, res) => {
    try {
        const { pedido, item } = req.params;
        const userName = req.user?.name || req.user?.username || 'Sistema';
        const userEmail = req.user?.email || '';

        const [existing] = await mysqlPool.query(
            'SELECT nota FROM app_sales_order_item_notes WHERE pedido = ? AND item = ?',
            [pedido, item]
        );

        if (existing.length > 0) {
            await mysqlPool.query(
                'DELETE FROM app_sales_order_item_notes WHERE pedido = ? AND item = ?',
                [pedido, item]
            );
            await logHistory(pedido, item, 'DELETED', null, existing[0].nota, null, userName, userEmail);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Note not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:pedido/items/:item/notes/history', async (req, res) => {
    try {
        const { pedido, item } = req.params;
        const [rows] = await mysqlPool.query(
            `SELECT * FROM app_sales_order_item_notes_history 
            WHERE pedido = ? AND item = ?
            ORDER BY action_timestamp DESC`,
            [pedido, item]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:pedido/checklist-print', async (req, res) => {
    try {
        const { pedido } = req.params;

        const orderResult = await db.query(
            `SELECT c5.c5_num as pedido, sa1.a1_nome as cliente, c5.c5_emissao as emissao
            FROM sc5010 c5
            LEFT JOIN sa1010 sa1 ON sa1.a1_cod = c5.c5_cliente AND COALESCE(sa1.d_e_l_e_t_, '') = ''
            WHERE c5.c5_num = $1 AND COALESCE(c5.d_e_l_e_t_, '') = ''`,
            [pedido]
        );

        const itemsResult = await db.query(
            `SELECT c6.c6_item as item, c6.c6_produto as codigo, sb1.b1_desc as descricao
            FROM sc6010 c6
            LEFT JOIN sb1010 sb1 ON sb1.b1_cod = c6.c6_produto AND COALESCE(sb1.d_e_l_e_t_, '') = ''
            WHERE c6.c6_num = $1 AND COALESCE(c6.d_e_l_e_t_, '') = ''
            ORDER BY c6.c6_item`,
            [pedido]
        );

        const [notes] = await mysqlPool.query(
            'SELECT * FROM app_sales_order_item_notes WHERE pedido = ?',
            [pedido]
        );

        const notesMap = {};
        notes.forEach(n => notesMap[n.item] = n);

        const items = itemsResult.rows.map(item => ({
            ...item,
            nota: notesMap[item.item]?.nota || '',
            status: notesMap[item.item]?.status || 'PENDENTE',
            project_type: notesMap[item.item]?.project_type || null,
            engineering_start_date: notesMap[item.item]?.engineering_start_date || null
        }));

        res.json({
            order: orderResult.rows[0],
            items
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:pedido/items/:item/history', async (req, res) => {
    try {
        const { pedido, item } = req.params;
        const [rows] = await mysqlPool.query(
            `SELECT field_changed, user_name, action_timestamp 
             FROM app_sales_order_item_notes_history 
             WHERE pedido = ? AND item = ?
            ORDER BY action_timestamp DESC`,
            [pedido, item]
        );

        // Group by field to get latest
        const history = {};
        rows.forEach(row => {
            if (row.field_changed && !history[row.field_changed]) {
                history[row.field_changed] = {
                    user: row.user_name,
                    date: row.action_timestamp
                };
            }
        });

        res.json(history);
    } catch (err) {
        console.error('Error fetching history:', err);
        res.status(500).json({ error: 'Error fetching history' });
    }
});

// PCP Delivery Forecast Endpoints
router.post('/pcp-forecasts/batch', validate(rules.pcpForecastBatch), async (req, res) => {
    try {
        const { items, data_entrega_pcp, usuario, observacao, numero_serie, serie_cliente, serie_metalfisa, lote, numero_lote } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0 || !data_entrega_pcp || !usuario) {
            return res.status(400).json({ error: 'Dados incompletos para o planejamento Lote PCP.' });
        }

        const connection = await mysqlPool.getConnection();
        await connection.beginTransaction();

        try {
            const savedItems = []; // itens efetivamente salvos com quantidade real

            for (const it of items) {
                let { pedido, item, quantidade_pcp, qtd_total_item } = it;

                if (!pedido || !item || quantidade_pcp === undefined) continue;

                if (qtd_total_item !== undefined) {
                    const [existing] = await connection.query(
                        'SELECT COALESCE(SUM(quantidade_pcp), 0) as total FROM app_pcp_delivery_forecasts WHERE TRIM(pedido) = ? AND TRIM(item) = ?',
                        [String(pedido).trim(), String(item).trim()]
                    );
                    const totalAtual = parseFloat(existing[0].total) || 0;
                    const novaQtd = parseFloat(quantidade_pcp);
                    const limite = parseFloat(qtd_total_item);

                    if (totalAtual + novaQtd > limite + 0.01) {
                        const restante = Math.max(0, limite - totalAtual);
                        if (restante <= 0.01) continue; // já 100% programado, pula
                        quantidade_pcp = parseFloat(restante.toFixed(2)); // quantidade parcial real
                    }
                }

                const [result] = await connection.query(
                    'INSERT INTO app_pcp_delivery_forecasts (pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao, numero_serie, serie_cliente, serie_metalfisa, lote, numero_lote, op_protheus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao || null, numero_serie || null, serie_cliente || null, serie_metalfisa || null, lote || null, numero_lote || null, it.op_protheus || null]
                );

                savedItems.push({ id: result.insertId, pedido: String(pedido).trim(), item: String(item).trim(), quantidade_pcp });
            }
            await connection.commit();
            res.json({ success: true, message: 'Lote programado com sucesso', savedItems });
        } catch (txnErr) {
            await connection.rollback();
            throw txnErr;
        } finally {
            connection.release();
        }

    } catch (err) {
        console.error('Error saving PCP forecast batch:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/pcp-forecasts', validate(rules.pcpForecast), async (req, res) => {
    try {
        const { pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao, numero_serie, serie_cliente, serie_metalfisa, lote, numero_lote, qtd_total_item, data_prevista_faturamento } = req.body;

        if (!pedido || !item || !data_entrega_pcp || quantidade_pcp === undefined || !usuario) {
            return res.status(400).json({ error: 'Dados incompletos para o planejamento PCP.' });
        }

        // Validação: soma das programações não pode ultrapassar qtd_total_item
        if (qtd_total_item !== undefined) {
            const [existing] = await mysqlPool.query(
                'SELECT COALESCE(SUM(quantidade_pcp), 0) as total FROM app_pcp_delivery_forecasts WHERE TRIM(pedido) = ? AND TRIM(item) = ?',
                [String(pedido).trim(), String(item).trim()]
            );
            const totalAtual = parseFloat(existing[0].total) || 0;
            const novaQtd = parseFloat(quantidade_pcp);
            const limite = parseFloat(qtd_total_item);
            if (totalAtual + novaQtd > limite + 0.01) {
                return res.status(400).json({
                    error: `Quantidade excede o total do item. Já programado: ${totalAtual}, disponível: ${Math.max(0, limite - totalAtual).toFixed(2)}.`
                });
            }
        }

        const [result] = await mysqlPool.query(
            'INSERT INTO app_pcp_delivery_forecasts (pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao, numero_serie, serie_cliente, serie_metalfisa, lote, numero_lote, op_protheus, data_prevista_faturamento) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao || null, numero_serie || null, serie_cliente || null, serie_metalfisa || null, lote || null, numero_lote || null, req.body.op_protheus || null, data_prevista_faturamento || null]
        );

        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error('Error saving PCP forecast:', err);
        res.status(500).json({ error: err.message });
    }
});

router.put('/pcp-forecasts/:id', validate(rules.pcpForecastUpdate), async (req, res) => {
    try {
        const { id } = req.params;
        const { data_entrega_pcp, quantidade_pcp, observacao, numero_serie, serie_cliente, serie_metalfisa, lote, numero_lote, usuario, qtd_total_item, data_prevista_faturamento } = req.body;

        if (!data_entrega_pcp || quantidade_pcp === undefined) {
            return res.status(400).json({ error: 'Data e quantidade são obrigatórios.' });
        }

        // Validação: soma das outras programações + nova qtd não pode ultrapassar total
        if (qtd_total_item !== undefined) {
            const [existing] = await mysqlPool.query(
                'SELECT COALESCE(SUM(quantidade_pcp), 0) as total FROM app_pcp_delivery_forecasts WHERE id != ? AND TRIM(pedido) = (SELECT TRIM(pedido) FROM app_pcp_delivery_forecasts WHERE id = ?) AND TRIM(item) = (SELECT TRIM(item) FROM app_pcp_delivery_forecasts WHERE id = ?)',
                [id, id, id]
            );
            const totalOutros = parseFloat(existing[0].total) || 0;
            const novaQtd = parseFloat(quantidade_pcp);
            const limite = parseFloat(qtd_total_item);
            if (totalOutros + novaQtd > limite) {
                return res.status(400).json({
                    error: `Quantidade excede o total do item. Já programado (outros): ${totalOutros}, disponível: ${(limite - totalOutros).toFixed(2)}.`
                });
            }
        }

        await mysqlPool.query(
            'UPDATE app_pcp_delivery_forecasts SET data_entrega_pcp = ?, quantidade_pcp = ?, observacao = ?, numero_serie = ?, serie_cliente = ?, serie_metalfisa = ?, lote = ?, numero_lote = ?, data_prevista_faturamento = ? WHERE id = ?',
            [data_entrega_pcp, parseFloat(quantidade_pcp), observacao || null, numero_serie || null, serie_cliente || null, serie_metalfisa || null, lote || null, numero_lote || null, data_prevista_faturamento || null, id]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Error updating PCP forecast:', err);
        res.status(500).json({ error: err.message });
    }
});

router.patch('/pcp-forecasts/faturamento', async (req, res) => {
    try {
        const { id, pedido, item, data_prevista_faturamento, data_entrega_pcp, quantidade_pcp, usuario } = req.body;

        if (id) {
            await mysqlPool.query(
                'UPDATE app_pcp_delivery_forecasts SET data_prevista_faturamento = ? WHERE id = ?',
                [data_prevista_faturamento || null, id]
            );
            return res.json({ success: true, id });
        } else {
            if (!pedido || !item || !usuario) {
                return res.status(400).json({ error: 'Pedido, item e usuário são obrigatórios para inicializar a previsão de faturamento.' });
            }
            if (!data_entrega_pcp || quantidade_pcp === undefined) {
                return res.status(400).json({ error: 'Data de entrega e quantidade do item são necessárias para inicializar a previsão de faturamento.' });
            }

            const [result] = await mysqlPool.query(
                'INSERT INTO app_pcp_delivery_forecasts (pedido, item, data_entrega_pcp, quantidade_pcp, usuario, data_prevista_faturamento) VALUES (?, ?, ?, ?, ?, ?)',
                [pedido, item, data_entrega_pcp, parseFloat(quantidade_pcp), usuario, data_prevista_faturamento || null]
            );
            return res.json({ success: true, id: result.insertId });
        }
    } catch (err) {
        console.error('Error patching billing forecast:', err);
        res.status(500).json({ error: err.message });
    }
});

router.patch('/pcp-forecasts/:id/op', async (req, res) => {
    try {
        const { id } = req.params;
        const { op_protheus } = req.body;
        
        await mysqlPool.query(
            'UPDATE app_pcp_delivery_forecasts SET op_protheus = ? WHERE id = ?',
            [op_protheus, id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating PCP forecast OP:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/pcp-forecasts/:id', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query('SELECT op_protheus FROM app_pcp_delivery_forecasts WHERE id = ?', [req.params.id]);

        await mysqlPool.query('DELETE FROM app_pcp_delivery_forecasts WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting PCP forecast:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/items/:pedido/:item/pcp-forecasts/history', async (req, res) => {
    try {
        const { pedido, item } = req.params;
        const [rows] = await mysqlPool.query(
            'SELECT * FROM app_pcp_delivery_forecasts WHERE TRIM(pedido) = ? AND TRIM(item) = ? ORDER BY id ASC',
            [String(pedido).trim(), String(item).trim()]
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching PCP history:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/pedidos/op-mirror/:id
// Gera os dados para o Espelho da Ordem de Produção (OP Mirror)
// O sistema explode toda a estrutura (SG1) e puxa o roteiro (SG2), mapeando 
// as quantidades com base na quantidade vendida do pedido de venda (SC6).
// ─────────────────────────────────────────────────────────────────────────────
router.get('/op-mirror/:id', async (req, res) => {
    let client;
    try {
        client = await db.connect();
        const { id } = req.params;
        const { item: queryItem, pendingOnly } = req.query;

        // Guard: reject empty pedido
        if (!id || String(id).trim() === '') {
            return res.status(400).json({ error: 'Parâmetro pedido (id) é obrigatório.' });
        }

        // Guard: reject empty item when explicitly provided
        if (queryItem !== undefined && String(queryItem).trim() === '') {
            return res.status(400).json({ error: 'Parâmetro item não pode ser vazio.' });
        }

        // Strict boolean coercion for pendingOnly — never treat arbitrary string as truthy
        const isPendingOnly = pendingOnly === 'true' || pendingOnly === '1';

        // Timeout: 5 minutos para pedidos complexos (004554 tem BOM profundo)
        await client.query("SET LOCAL statement_timeout = '300000'");

        // Step 1: Fetch Capa do Pedido e Cliente
        const orderQuery = `
            SELECT
                TRIM(c5.c5_num) AS pedido,
                TO_CHAR(TO_DATE(NULLIF(TRIM(c5.c5_emissao), ''), 'YYYYMMDD'), 'DD/MM/YY') AS emissao,
                TRIM(sa1.a1_nome) AS nome_cliente,
                TRIM(sa1.a1_cgc) AS cgc_cliente,
                TRIM(sa1.a1_mun) AS municipio,
                TRIM(sa1.a1_est) AS estado
            FROM sc5010 c5
            LEFT JOIN sa1010 sa1
                ON sa1.a1_cod = c5.c5_cliente
                AND COALESCE(sa1.d_e_l_e_t_, '') IN ('', ' ')
            WHERE TRIM(c5.c5_num) = $1
              AND COALESCE(c5.d_e_l_e_t_, '') IN ('', ' ')
        `;

        const orderResult = await client.query(orderQuery, [id]);
        const orderData = orderResult.rows.length > 0 ? orderResult.rows[0] : null;

        // Build parameterized item filter (prevents SQL injection — never interpolate queryParams)
        const explosionParams = [id];
        let itemCondition = '';
        if (queryItem) {
            explosionParams.push(String(queryItem).trim());
            itemCondition = `AND TRIM(c6.c6_item) = $${explosionParams.length}`;
        }

        // Pending-only: strict boolean
        let pendingCondition = '';
        let qtdVendaExpression = `COALESCE(NULLIF(c6.c6_qtdven::numeric, 0), c2.c2_quant::numeric, 0)`;

        if (isPendingOnly) {
            pendingCondition = `AND (COALESCE(c6.c6_qtdven::numeric, 0) - COALESCE(c6.c6_qtdent::numeric, 0)) > 0`;
            qtdVendaExpression = `GREATEST(COALESCE(c6.c6_qtdven::numeric, 0) - COALESCE(c6.c6_qtdent::numeric, 0), 0)`;
        }

        const explosionQuery = `
            WITH RECURSIVE
            -- Pre-fetch SC2 para o pedido inteiro (1 scan em vez de N correlated subqueries)
            sc2_lookup AS (
                SELECT
                    c2.c2_itempv,
                    TRIM(c2.c2_produto) AS produto,
                    TRIM(c2.c2_num)     AS op_num,
                    TRIM(c2.c2_tpop)   AS op_tipo,
                    ROW_NUMBER() OVER (
                        PARTITION BY c2.c2_itempv, TRIM(c2.c2_produto)
                        ORDER BY c2.c2_num
                    ) AS rn
                FROM sc2010 c2
                WHERE TRIM(c2.c2_pedido) = $1
                  AND COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
            ),
            sc2_first AS (
                SELECT c2_itempv, produto, op_num, op_tipo FROM sc2_lookup WHERE rn = 1
            ),
            -- 1. Capa de Itens do PV
            pv_itens AS (
                SELECT
                    TRIM(c6.c6_item) AS item_pedido,
                    TRIM(c6.c6_produto) AS produto_venda,
                    TRIM(sb1.b1_desc) AS desc_venda,
                    TRIM(sb1.b1_tipo) AS tipo_venda,
                    ${qtdVendaExpression} AS qtd_venda,
                    TRIM(c6.c6_um) AS unid_venda,
                    TRIM(c6.c6_xrevm) AS rev_metalfisa,
                    COALESCE(TRIM(c2.c2_num), SUBSTRING(TRIM(c6.c6_numop), 1, 6)) AS op_num,
                    TRIM(c2.c2_tpop) AS op_tipo
                FROM sc6010 c6
                LEFT JOIN sc2010 c2
                    ON c2.c2_filial = c6.c6_filial
                    AND TRIM(c2.c2_pedido) = TRIM(c6.c6_num)
                    AND c2.c2_itempv = c6.c6_item
                    AND c2.c2_sequen = '001'
                    AND COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
                LEFT JOIN sb1010 sb1
                    ON TRIM(sb1.b1_cod) = TRIM(c6.c6_produto)
                    AND COALESCE(sb1.d_e_l_e_t_, '') IN ('', ' ')
                WHERE TRIM(c6.c6_num) = $1
                  AND COALESCE(c6.d_e_l_e_t_, '') IN ('', ' ')
                  AND COALESCE(TRIM(c6.c6_numop), '') != ''
                  ${itemCondition}
                  ${pendingCondition}
            ),
            -- 2. Explosão Recursiva de BOM
            estrutura AS (
                -- Nível 0: produtos vendidos
                SELECT
                    pv.item_pedido,
                    0 AS nivel,
                    pv.produto_venda AS produto_pai,
                    pv.produto_venda AS componente,
                    pv.desc_venda AS descricao,
                    pv.tipo_venda AS tipo,
                    pv.unid_venda AS unidade,
                    pv.rev_metalfisa AS revisao,
                    1::numeric AS qtd_base,
                    pv.qtd_venda AS qtd_necessaria,
                    pv.op_num AS op_relacionada,
                    pv.op_tipo AS op_tipo_relacionada
                FROM pv_itens pv

                UNION ALL

                -- Filhos: JOIN com sc2_first em vez de subqueries correlacionadas
                SELECT
                    e.item_pedido,
                    e.nivel + 1,
                    CAST(TRIM(e.componente) AS VARCHAR(30)) AS produto_pai,
                    CAST(TRIM(g1.g1_comp)  AS VARCHAR(30)) AS componente,
                    CAST(TRIM(sb1.b1_desc) AS VARCHAR(100)) AS descricao,
                    CAST(TRIM(sb1.b1_tipo) AS VARCHAR(2))  AS tipo,
                    CAST(TRIM(sb1.b1_um)   AS VARCHAR(10)) AS unidade,
                    CAST(TRIM(sb1.b1_urev) AS VARCHAR(10)) AS revisao,
                    g1.g1_quant::numeric AS qtd_base,
                    (e.qtd_necessaria * g1.g1_quant::numeric)::numeric AS qtd_necessaria,
                    COALESCE(sc2.op_num,  e.op_relacionada)      AS op_relacionada,
                    COALESCE(sc2.op_tipo, e.op_tipo_relacionada) AS op_tipo_relacionada
                FROM estrutura e
                JOIN sg1010 g1
                    ON TRIM(g1.g1_cod) = TRIM(e.componente)
                    AND COALESCE(g1.d_e_l_e_t_, '') IN ('', ' ')
                LEFT JOIN sb1010 sb1
                    ON TRIM(sb1.b1_cod) = TRIM(g1.g1_comp)
                    AND COALESCE(sb1.d_e_l_e_t_, '') IN ('', ' ')
                LEFT JOIN sc2_first sc2
                    ON sc2.c2_itempv = e.item_pedido
                    AND sc2.produto  = TRIM(g1.g1_comp)
                WHERE e.nivel < 15
            ),
            pecas_distintas AS (
                SELECT DISTINCT componente FROM estrutura
            ),
            -- 3. Roteiro SG2: pré-materializa a revisão máxima por produto (O(N))
            --    Substitui o correlated subquery MAX() que era O(N²) e causava timeout
            max_rev_por_produto AS (
                SELECT TRIM(g2_produto) AS produto, MAX(TRIM(g2_codigo)) AS max_codigo
                FROM sg2010
                WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')
                  AND TRIM(g2_produto) IN (SELECT componente FROM pecas_distintas)
                GROUP BY TRIM(g2_produto)
            ),
            roteiro_agregado AS (
                SELECT
                    TRIM(g2.g2_produto) AS g2_produto_limpo,
                    json_agg(
                        json_build_object(
                            'seq',           TRIM(g2.g2_operac),
                            'recurso',       TRIM(g2.g2_recurso),
                            'desc_operacao', TRIM(h1.h1_descri),
                            'setup',         g2.g2_setup,
                            'tempo_padrao',  ROUND(g2.g2_tempad::numeric, 3),
                            'ferramenta',    TRIM(g2.g2_ferram)
                        ) ORDER BY TRIM(g2.g2_operac)
                    ) AS operacoes
                FROM sg2010 g2
                JOIN max_rev_por_produto mr
                    ON TRIM(g2.g2_produto) = mr.produto
                    AND TRIM(g2.g2_codigo) = mr.max_codigo
                LEFT JOIN sh1010 h1
                    ON TRIM(h1.h1_codigo) = TRIM(g2.g2_recurso)
                    AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
                WHERE COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
                GROUP BY TRIM(g2.g2_produto)
            )
            -- RESULTADO + ROTEIRO (SG2) OTIMIZADO
            SELECT
                e.item_pedido,
                e.nivel,
                e.produto_pai,
                e.componente,
                e.descricao,
                e.tipo,
                e.unidade,
                e.revisao,
                e.qtd_necessaria,
                e.op_relacionada,
                e.op_tipo_relacionada,
                COALESCE(ra.operacoes, '[]'::json) AS operacoes
            FROM estrutura e
            LEFT JOIN roteiro_agregado ra ON ra.g2_produto_limpo = e.componente
            ORDER BY e.item_pedido ASC, e.nivel ASC, e.produto_pai ASC, e.componente ASC;
        `;

        const explosionResult = await client.query(explosionQuery, explosionParams);

        // Step 3: Parse and Structure the flat SQL results into a Nested Hierarchy 
        // PV Item -> Final Product -> Tree of Components

        // This is a helper Map to build trees per item_pedido
        const itemsMap = new Map();

        explosionResult.rows.forEach(row => {
            if (!itemsMap.has(row.item_pedido)) {
                itemsMap.set(row.item_pedido, {
                    item_pedido: row.item_pedido,
                    produto_principal: null,
                    // Flat list of the BOM elements, will be rendered iteratively in PDF like Protheus
                    estrutura_linear: [],
                });
            }

            const itemGroup = itemsMap.get(row.item_pedido);

            // Se for nível 0, marcamos os dados de capa do item:
            if (row.nivel === 0) {
                itemGroup.produto_principal = {
                    codigo: row.componente,
                    descricao: row.descricao,
                    tipo: row.tipo,
                    revisao: row.revisao,
                    unidade: row.unidade,
                    quantidade_venda: parseFloat(row.qtd_necessaria),
                    op_num: row.op_relacionada,
                    op_tipo: row.op_tipo_relacionada,
                    operacoes: row.operacoes
                };
            } else {
                // If it's a child element (Nivel > 0), store it in order
                itemGroup.estrutura_linear.push({
                    nivel: parseInt(row.nivel),
                    pai: row.produto_pai,
                    codigo: row.componente,
                    descricao: row.descricao,
                    tipo: row.tipo,
                    unidade: row.unidade,
                    quantidade_calculada: parseFloat(row.qtd_necessaria),
                    op_num: row.op_relacionada,
                    op_tipo: row.op_tipo_relacionada,
                    operacoes: row.operacoes
                });
            }
        });

        const returnedItems = Array.from(itemsMap.values());

        res.json({
            pedido: orderData,
            itens: returnedItems
        });

    } catch (err) {
        console.error('[OP Mirror Error]', err);
        res.status(500).json({ error: 'Erro interno ao gerar espelho de OP', details: err.message });
    } finally {
        if (client) client.release();
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/pedidos/op-mirror/:id/export-laser
// Exporta componentes com operação MO0013 para o template Espelho OS-Corte.xls
// Retorna um ZIP contendo: template preenchido + Excel de resumo
// ─────────────────────────────────────────────────────────────────────────────
router.get('/op-mirror/:id/export-laser', async (req, res) => {
    try {
        const { id } = req.params;

        // Step 1: Verifica existência do pedido
        const orderResult = await db.query(
            `SELECT TRIM(c5.c5_num) AS pedido, TRIM(sa1.a1_nome) AS nome_cliente
             FROM sc5010 c5
             LEFT JOIN sa1010 sa1
               ON sa1.a1_cod = c5.c5_cliente AND sa1.a1_loja = c5.c5_lojacli
               AND COALESCE(sa1.d_e_l_e_t_, '') = ''
             WHERE TRIM(c5.c5_num) = $1 AND COALESCE(c5.d_e_l_e_t_, '') = ''`,
            [id]
        );
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Pedido não encontrado.' });
        }

        // Step 2: Explode BOM e filtra apenas componentes com operação MO0013
        const laserQuery = `
            WITH RECURSIVE
            pv_itens AS (
                SELECT
                    TRIM(c6.c6_item) AS item_pedido,
                    TRIM(c6.c6_produto) AS produto_venda,
                    COALESCE(NULLIF(c6.c6_qtdven::numeric, 0), c2.c2_quant::numeric, 0) AS qtd_venda
                FROM sc6010 c6
                LEFT JOIN sc2010 c2
                    ON c2.c2_filial = c6.c6_filial
                    AND TRIM(c2.c2_pedido) = TRIM(c6.c6_num)
                    AND c2.c2_itempv = c6.c6_item
                    AND c2.c2_sequen = '001'
                    AND COALESCE(c2.d_e_l_e_t_, '') = ''
                WHERE TRIM(c6.c6_num) = $1
                  AND COALESCE(c6.d_e_l_e_t_, '') = ''
                  AND COALESCE(TRIM(c6.c6_numop), '') != ''
            ),
            estrutura AS (
                SELECT
                    pv.item_pedido,
                    0 AS nivel,
                    pv.produto_venda AS componente,
                    pv.qtd_venda AS qtd_necessaria
                FROM pv_itens pv

                UNION ALL

                SELECT
                    e.item_pedido,
                    e.nivel + 1,
                    CAST(TRIM(g1.g1_comp) AS VARCHAR(30)) AS componente,
                    (e.qtd_necessaria * g1.g1_quant::numeric)::numeric AS qtd_necessaria
                FROM estrutura e
                JOIN sg1010 g1
                    ON TRIM(g1.g1_cod) = TRIM(e.componente)
                    AND COALESCE(g1.d_e_l_e_t_, '') = ''
                WHERE e.nivel < 15
            ),
            laser_agg AS (
                SELECT
                    TRIM(e.componente) AS cod_componente,
                    MIN(TRIM(sb1.b1_desc)) AS descricao,
                    SUM(e.qtd_necessaria)::numeric AS qtd_requerida
                FROM estrutura e
                LEFT JOIN sb1010 sb1
                    ON TRIM(sb1.b1_cod) = TRIM(e.componente)
                    AND COALESCE(sb1.d_e_l_e_t_, '') = ''
                WHERE e.nivel > 0
                  AND EXISTS (
                      SELECT 1 FROM sg2010 g2
                      WHERE TRIM(g2.g2_produto) = TRIM(e.componente)
                        AND TRIM(g2.g2_recurso) = 'MO0013'
                        AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
                        AND TRIM(g2.g2_codigo) = (
                            SELECT MAX(TRIM(g2_sub.g2_codigo))
                            FROM sg2010 g2_sub
                            WHERE TRIM(g2_sub.g2_produto) = TRIM(e.componente)
                              AND COALESCE(g2_sub.d_e_l_e_t_, '') IN ('', ' ')
                        )
                  )
                GROUP BY TRIM(e.componente)
            )
            SELECT
                lc.cod_componente,
                lc.descricao,
                lc.qtd_requerida,
                (
                    SELECT TRIM(g1_mtc.g1_comp)
                    FROM sg1010 g1_mtc
                    WHERE TRIM(g1_mtc.g1_cod) = lc.cod_componente
                      AND TRIM(g1_mtc.g1_comp) LIKE 'MTC%'
                      AND COALESCE(g1_mtc.d_e_l_e_t_, '') = ''
                    LIMIT 1
                ) AS material_chapa
            FROM laser_agg lc
            ORDER BY lc.cod_componente;
        `;

        const laserResult = await db.query(laserQuery, [id]);
        const components = laserResult.rows;

        if (components.length === 0) {
            return res.status(404).json({ error: 'Nenhum componente com operação MO0013 encontrado para este pedido.' });
        }

        // Step 3: Busca caminhos de PDF no MySQL (tipo "desenho" tem prioridade)
        const componentCodes = components.map(c => c.cod_componente);
        const placeholders = componentCodes.map(() => '?').join(',');
        const [docsRows] = await mysqlPool.execute(
            `SELECT TRIM(produto_codigo) AS produto_codigo, url_arquivo, tipo
             FROM produtos_docs WHERE produto_codigo IN (${placeholders})`,
            componentCodes
        );
        const docsMap = {};
        docsRows.forEach(row => {
            if (!docsMap[row.produto_codigo]) docsMap[row.produto_codigo] = [];
            docsMap[row.produto_codigo].push(row);
        });
        components.forEach(comp => {
            const docs = docsMap[comp.cod_componente] || [];
            const drawing = docs.find(d => String(d.tipo || '').toLowerCase().includes('desenho'));
            comp.pdf_path = drawing ? drawing.url_arquivo : (docs.length > 0 ? docs[0].url_arquivo : '');
        });

        // Step 4: Lê o template .xls da rede
        const templatePath = process.env.LASER_TEMPLATE_PATH ||
            '\\\\192.168.1.253\\Estrutura Lynx\\023-SGQ\\023-001-FORMULARIOS\\Espelho OS-Corte.xls';

        let templateBuffer;
        try {
            templateBuffer = fs.readFileSync(templatePath);
        } catch (err) {
            return res.status(500).json({
                error: `Não foi possível ler o template em: ${templatePath}`,
                details: err.message
            });
        }

        // Step 5: Preenche a aba "Import XLS" a partir da linha 7
        const workbook = XLSX.read(templateBuffer, { type: 'buffer' });
        const sheetName = 'Import XLS';
        if (!workbook.SheetNames.includes(sheetName)) {
            return res.status(500).json({ error: `Aba "${sheetName}" não encontrada no template.` });
        }

        const sheet = workbook.Sheets[sheetName];

        components.forEach((comp, idx) => {
            const row = 7 + idx;
            sheet[`A${row}`] = { v: comp.cod_componente, t: 's' };
            sheet[`B${row}`] = { v: parseFloat(comp.qtd_requerida), t: 'n' };
            sheet[`H${row}`] = { v: comp.material_chapa || '', t: 's' };
            sheet[`K${row}`] = { v: comp.pdf_path || '', t: 's' };
        });

        // Atualiza o range da aba para incluir todas as novas linhas
        const lastRow = 6 + components.length; // 0-indexed last row
        const currentRange = XLSX.utils.decode_range(sheet['!ref'] || 'A1:K6');
        currentRange.e.r = Math.max(currentRange.e.r, lastRow);
        currentRange.e.c = Math.max(currentRange.e.c, 10); // coluna K = índice 10
        sheet['!ref'] = XLSX.utils.encode_range(currentRange);

        const templateFilled = XLSX.write(workbook, { type: 'buffer', bookType: 'xls' });

        // Step 6: Cria Excel de resumo (ExcelJS)
        const summaryWb = new ExcelJS.Workbook();
        const ws = summaryWb.addWorksheet('Componentes MO0013');
        ws.columns = [
            { header: 'Cód Componente',     key: 'cod',   width: 20 },
            { header: 'Descrição',          key: 'desc',  width: 40 },
            { header: 'Qtde Requerida',     key: 'qtd',   width: 15 },
            { header: 'Material Chapa MTC', key: 'chapa', width: 22 },
            { header: 'Endereço PDF',       key: 'pdf',   width: 55 },
        ];
        ws.getRow(1).eachCell(cell => {
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
        });
        components.forEach(comp => {
            ws.addRow({
                cod:   comp.cod_componente,
                desc:  comp.descricao || '',
                qtd:   parseFloat(comp.qtd_requerida),
                chapa: comp.material_chapa || '',
                pdf:   comp.pdf_path || '',
            });
        });
        const summaryBuffer = await summaryWb.xlsx.writeBuffer();

        // Step 7: Monta o ZIP e envia
        const dateStr = new Date().toISOString().slice(0, 10);
        const pedidoRef = id.trim();
        const zipName      = `Corte-Laser_${pedidoRef}_${dateStr}.zip`;
        const templateName = `Espelho-OS-Corte_${pedidoRef}_${dateStr}.xls`;
        const summaryName  = `Componentes-MO0013_${pedidoRef}_${dateStr}.xlsx`;

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

        const archive = archiver('zip', { zlib: { level: 6 } });
        archive.on('error', err => { throw err; });
        archive.pipe(res);
        archive.append(Buffer.from(templateFilled), { name: templateName });
        archive.append(Buffer.from(summaryBuffer),  { name: summaryName });
        await archive.finalize();

    } catch (err) {
        console.error('[Export Laser Error]', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Erro ao gerar exportação laser', details: err.message });
        }
    }
});

// ─── PCP LOTES (LIBERAÇÃO PARA PRODUÇÃO) ──────────────────────────────────

// POST /api/pedidos/pcp-lotes
// Cria um novo lote de produção com os itens selecionados
router.post('/pcp-lotes', async (req, res) => {
    try {
        const { itens, observacao, criador } = req.body;
        if (!itens || itens.length === 0) {
            return res.status(400).json({ error: 'Nenhum item selecionado para o lote.' });
        }

        // Generate Lote Ref (e.g. LOTE-YYYYMMDD-HHMMSS)
        const dateStr = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
        const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        const loteRef = `LOTE-${dateStr}-${randomStr}`;

        // Iniciar transação no MySQL
        const connection = await mysqlPool.getConnection();
        try {
            await connection.beginTransaction();

            // Inserir a capa do Lote
            const [loteResult] = await connection.query(
                `INSERT INTO app_pcp_lotes (lote_ref, created_by, observacao, status) VALUES (?, ?, ?, 'ABERTO')`,
                [loteRef, criador || 'PCP', observacao || '']
            );
            const loteId = loteResult.insertId;

            // Inserir os itens do Lote
            for (const item of itens) {
                await connection.query(
                    `INSERT INTO app_pcp_lote_itens (lote_id, pedido, item, codigo, qtd_liberada) VALUES (?, ?, ?, ?, ?)`,
                    [loteId, item.pedido, item.item, item.codigo, item.quantidade || 0]
                );
            }

            await connection.commit();
            res.json({ success: true, lote_id: loteId, lote_ref: loteRef });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('[PCP Lotes Error]', error);
        res.status(500).json({ error: 'Erro ao criar lote de produção', details: error.message });
    }
});

// GET /api/pedidos/pcp-lotes
// Lista os lotes criados
router.get('/pcp-lotes', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(`
            SELECT l.*, COUNT(i.id) as total_itens 
            FROM app_pcp_lotes l
            LEFT JOIN app_pcp_lote_itens i ON i.lote_id = l.id
            GROUP BY l.id
            ORDER BY l.created_at DESC
            LIMIT 50
        `);
        res.json(rows);
    } catch (error) {
        console.error('[PCP Lotes List Error]', error);
        res.status(500).json({ error: 'Erro ao buscar lotes', details: error.message });
    }
});

// PUT /api/pedidos/import-pcp-date
// Atualiza a data_entrega_pcp vindo da planilha Excel
router.put('/import-pcp-date', async (req, res) => {
    try {
        const { pedido, item, produto, dataPcp } = req.body;
        if (!pedido) {
            return res.status(400).json({ error: 'Pedido é obrigatório.' });
        }

        const formattedPedido = String(pedido).trim().padStart(6, '0');
        const formattedItem = item ? String(item).trim().padStart(2, '0') : null;
        const formattedDate = dataPcp ? String(dataPcp).trim() : null;

        if (!formattedDate) {
             return res.json({ success: true, message: 'Sem data para atualizar' });
        }

        let resolvedItem = formattedItem;
        let saldo_fat = 0;

        // Buscar no PostgreSQL o item (se faltar) e o saldo_fat (quantidade)
        const pgClient = await db.connect();
        try {
            let sql = `SELECT TRIM(c6_item) as item, (COALESCE(c6_qtdven::numeric, 0) - COALESCE(c6_qtdent::numeric, 0)) as saldo_fat FROM sc6010 WHERE c6_num = $1 AND COALESCE(d_e_l_e_t_, '') = ''`;
            let params = [formattedPedido];
            
            if (formattedItem) {
                sql += ` AND c6_item = $2`;
                params.push(formattedItem);
            } else if (produto) {
                sql += ` AND c6_produto = $2`;
                params.push(produto);
            }
            
            sql += ` LIMIT 1`;
            
            const result = await pgClient.query(sql, params);
            if (result.rows.length > 0) {
                resolvedItem = result.rows[0].item;
                saldo_fat = Math.max(0, result.rows[0].saldo_fat || 0);
            }
        } finally {
            pgClient.release();
        }

        const finalItem = resolvedItem || '01';

        // Verifica se já existe
        const [existing] = await mysqlPool.query('SELECT id FROM app_pcp_delivery_forecasts WHERE pedido = ? AND item = ? ORDER BY id DESC LIMIT 1', [formattedPedido, finalItem]);

        if (existing.length > 0) {
            await mysqlPool.query(
                'UPDATE app_pcp_delivery_forecasts SET data_entrega_pcp = ?, quantidade_pcp = ? WHERE id = ?',
                [formattedDate, saldo_fat, existing[0].id]
            );
        } else {
            await mysqlPool.query(
                'INSERT INTO app_pcp_delivery_forecasts (pedido, item, data_entrega_pcp, quantidade_pcp, usuario) VALUES (?, ?, ?, ?, ?)',
                [formattedPedido, finalItem, formattedDate, saldo_fat, 'SISTEMA_PLANILHA']
            );
        }

        res.json({ success: true, item: finalItem, quantidade_pcp: saldo_fat });
    } catch (error) {
        console.error('[Import PCP Date Error]', error);
        res.status(500).json({ error: 'Erro ao atualizar data', details: error.message });
    }
});

module.exports = router;
