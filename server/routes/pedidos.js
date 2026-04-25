const express = require('express');
const router = express.Router();
const db = require('../db');
const mysqlPool = require('../services/mysqlService');
const XLSX = require('xlsx');
const archiver = require('archiver');
const fs = require('fs');
const nodePath = require('path');
const ExcelJS = require('exceljs');
const { getInactiveOrdersFilter } = require('../util/pedidoFilterHelper');
const { getVisaoGerencial } = require('../util/visaoGerencialHelper');
// GET /api/pedidos
router.get('/', async (req, res) => {
    try {
        const { cliente, pedido, produto, dataInicial, dataFinal, page = 1, limit = 50, only_active = 'false', op_status = '' } = req.query;

        // Paginação
        const limitParsed = parseInt(limit, 10) || 50;
        const pageParsed = parseInt(page, 10) || 1;
        const offset = (pageParsed - 1) * limitParsed;

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
            whereClause += ` AND sa1.a1_nome ILIKE '%' || $${paramCount} || '%'`;
            params.push(cliente);
            paramCount++;
        }

        if (pedido) {
            whereClause += ` AND c5.c5_num LIKE '%' || $${paramCount} || '%'`;
            params.push(pedido);
            paramCount++;
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

        // Filtro por data de emissão
        if (dataInicial) {
            const dataInicialProtheus = dataInicial.replace(/-/g, '');
            whereClause += ` AND c5.c5_emissao >= $${paramCount}`;
            params.push(dataInicialProtheus);
            paramCount++;
        }

        if (dataFinal) {
            const dataFinalProtheus = dataFinal.replace(/-/g, '');
            whereClause += ` AND c5.c5_emissao <= $${paramCount}`;
            params.push(dataFinalProtheus);
            paramCount++;
        }

        const query = `
      SELECT
        c5.c5_num AS pedido,
        sa1.a1_nome AS nome_cliente,
        NULLIF(TRIM(COALESCE(c5.c5_mennota, '') || ' ' || COALESCE(c5.c5_zobs, '') || ' ' || COALESCE(c5.c5_zobsorc, '')), '') AS observacoes_gerais,
        TRIM(c5.c5_emissao) AS emissao_raw,
        (
            SELECT COUNT(*) 
            FROM public.sc6010 c6_count
            WHERE c6_count.c6_num = c5.c5_num
            AND c6_count.c6_filial = c5.c5_filial
            AND COALESCE(c6_count.d_e_l_e_t_, '') = ''
        ) AS itens_count,
        (
            SELECT COUNT(*)
            FROM public.sc6010 c6_op
            WHERE c6_op.c6_num = c5.c5_num
            AND c6_op.c6_filial = c5.c5_filial
            AND COALESCE(c6_op.d_e_l_e_t_, '') = ''
            AND EXISTS (
                SELECT 1 FROM public.sc2010 c2
                WHERE (c2.c2_pedido = c6_op.c6_num )
                AND c2.c2_itempv = c6_op.c6_item
                AND COALESCE(c2.d_e_l_e_t_, '') = ''
            )
        ) AS itens_com_op,
        (
            SELECT TRIM(MAX(c6_sub.c6_entreg))
            FROM public.sc6010 c6_sub
            WHERE c6_sub.c6_num = c5.c5_num
            AND c6_sub.c6_filial = c5.c5_filial
            AND COALESCE(c6_sub.d_e_l_e_t_, '') = ''
        ) AS entrega_raw,
        CASE
            -- Sem itens no pedido
            WHEN NOT EXISTS (SELECT 1 FROM public.sc6010 c6_check WHERE c6_check.c6_num = c5.c5_num AND COALESCE(c6_check.d_e_l_e_t_, '') = '') THEN 'red'
            
            -- Itens mistos (com e sem OP)
            WHEN (
                SELECT COUNT(DISTINCT c6_m.c6_item)
                FROM public.sc6010 c6_m
                WHERE c6_m.c6_num = c5.c5_num AND COALESCE(c6_m.d_e_l_e_t_, '') = ''
            ) > (
                SELECT COUNT(DISTINCT c2_m.c2_itempv)
                FROM public.sc2010 c2_m
                WHERE (c2_m.c2_pedido = c5.c5_num)
                AND COALESCE(c2_m.d_e_l_e_t_, '') = ''
            ) AND EXISTS (
                SELECT 1 FROM public.sc2010 c2_e WHERE (c2_e.c2_pedido = c5.c5_num) AND COALESCE(c2_e.d_e_l_e_t_, '') = ''
            ) THEN 'orange'

            -- Todos os itens sem OP
            WHEN NOT EXISTS (SELECT 1 FROM public.sc2010 c2_none WHERE (c2_none.c2_pedido = c5.c5_num) AND COALESCE(c2_none.d_e_l_e_t_, '') = '') THEN 'red'

            -- Padrão Protheus
            WHEN c5.c5_liberok = '' AND COALESCE(c5.c5_nota, '') = '' THEN 'green'
            WHEN c5.c5_liberok = 'S' THEN 'yellow'
            ELSE 'default'
        END AS status_cor
      FROM public.sc5010 c5
      LEFT JOIN public.sa1010 sa1
        ON sa1.a1_cod = c5.c5_cliente
        AND COALESCE(sa1.d_e_l_e_t_, '') = ''
      ${whereClause}
      ORDER BY c5.c5_emissao DESC, c5.c5_num DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

        params.push(limitParsed, offset);

        const result = await db.query(query, params);

        // Contagem total para paginação
        const countQuery = `
        SELECT count(*) as total
        FROM public.sc5010 c5
        LEFT JOIN public.sa1010 sa1
        ON sa1.a1_cod = c5.c5_cliente
        AND COALESCE(sa1.d_e_l_e_t_, '') = ''
        ${whereClause}
    `;
        const paramsCount = params.slice(0, paramCount - 1);
        const countResult = await db.query(countQuery, paramsCount);

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
                total: parseInt(countResult.rows[0].total),
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
        const { cliente, pedido, produto, dataInicial, dataFinal, dateType = 'pedido', page = 1, limit = 50, only_active = 'false', tipo_item = '', pcpDataInicial = '', pcpDataFinal = '', pcpDateFilter = 'false', op_status = '' } = req.query;
        const limitParsed = parseInt(limit, 10) || 50;
        const pageParsed = parseInt(page, 10) || 1;
        const offset = (pageParsed - 1) * limitParsed;

        params = [];
        let paramCount = 1;

        // Base Filter Logic
        const getInactiveFilter = await getInactiveOrdersFilter();
        let whereClause = "WHERE COALESCE(c5.d_e_l_e_t_, '') = '' AND c5.c5_tipo <> 'B' AND COALESCE(c6.d_e_l_e_t_, '') = ''" + getInactiveFilter('c5.c5_num');

        if (only_active === 'true') {
            whereClause += ` AND (
                COALESCE(c5.c5_nota, '') = '' 
                OR EXISTS (
                    SELECT 1 FROM public.sc6010 c6_ex 
                    WHERE c6_ex.c6_num = c5.c5_num 
                    AND c6_ex.c6_filial = c5.c5_filial 
                    AND COALESCE(c6_ex.d_e_l_e_t_, '') = ''
                    AND ((c6_ex.c6_qtdven - c6_ex.c6_qtdent) > 0 OR c6_ex.c6_qtdlib > 0)
                )
            )`;
            // Filtro a nível de item para a lista plana
            whereClause += ` AND ((c6.c6_qtdven - c6.c6_qtdent) > 0 OR c6.c6_qtdlib > 0)`;
        }

        if (cliente) {
            whereClause += ` AND sa1.a1_nome ILIKE '%' || $${paramCount} || '%'`;
            params.push(cliente);
            paramCount++;
        }

        if (pedido) {
            whereClause += ` AND c5.c5_num LIKE '%' || $${paramCount} || '%'`;
            params.push(pedido);
            paramCount++;
        }

        if (produto) {
            whereClause += ` AND c6.c6_produto ILIKE '%' || $${paramCount} || '%'`;
            params.push(produto);
            paramCount++;
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
                    whereClause += ` AND (${tipoConditions.join(' OR ')})`;
                }
            }
        }

        // --- Filtro de Status da OP ---
        if (op_status === 'com_op') {
            whereClause += ` AND EXISTS (SELECT 1 FROM public.sc2010 c2_status WHERE (c2_status.c2_pedido = c5.c5_num) AND c2_status.c2_itempv = c6.c6_item AND COALESCE(c2_status.d_e_l_e_t_, '') = '')`;
        } else if (op_status === 'sem_op') {
            whereClause += ` AND NOT EXISTS (SELECT 1 FROM public.sc2010 c2_status WHERE (c2_status.c2_pedido = c5.c5_num) AND c2_status.c2_itempv = c6.c6_item AND COALESCE(c2_status.d_e_l_e_t_, '') = '')`;
        }

        if (dataInicial || dataFinal) {
            if (dateType === 'nf') {
                let nfFilter = `EXISTS (
                    SELECT 1 FROM public.sd2010 d2_ex
                    JOIN public.sf2010 f2_ex 
                        ON f2_ex.f2_doc = d2_ex.d2_doc 
                        AND f2_ex.f2_serie = d2_ex.d2_serie 
                        AND COALESCE(f2_ex.d_e_l_e_t_, '') = ''
                    WHERE d2_ex.d2_pedido = c5.c5_num 
                      AND d2_ex.d2_itempv = c6.c6_item 
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

        // ── MAIN QUERY ─────────────────────────────────────────────────────────
        // Melhorias de performance:
        // 1. ref_cliente / rev_cliente removidos do SQL (subqueries correlacionadas) → batch PG após
        // 2. notas_fiscais removido do SQL (json_agg corr.) → batch PG após
        // 3. LATERAL JOINs substituem EXISTS duplicados nos dois blocos CASE → avaliados 1x por linha
        query = `
            SELECT
                TRIM(c5.c5_num) as pedido,
                TRIM(c5.c5_cliente) as cod_cliente,
                TRIM(c5.c5_lojacli) as loja_cliente,
                NULLIF(TRIM(COALESCE(c5.c5_mennota, '') || ' ' || COALESCE(c5.c5_zobs, '') || ' ' || COALESCE(c5.c5_zobsorc, '')), '') AS observacoes_gerais,
                sa1.a1_nome as nome_cliente,
                c5.c5_emissao as emissao,
                c5.c5_orcres as orcamento,
                TRIM(c6.c6_item) as item,
                TRIM(c6.c6_produto) as codigo,
                TRIM(c6.c6_xrevm) as rev_codigo,
                TRIM(c6.c6_xrevc) as c6_rev_cliente,
                sb1.b1_desc as descricao,
                c6.c6_um as unidade,
                COALESCE(c6.c6_qtdven, 0)::numeric(18,6) as quantidade,
                COALESCE(c6.c6_qtdent, 0)::numeric(18,6) as qtd_entreg,
                (COALESCE(c6.c6_qtdven, 0) - COALESCE(c6.c6_qtdent, 0))::numeric(18,6) as qtd_faturar,
                c6.c6_prcven::numeric(18,2) as valor_unitario,
                c6.c6_valor::numeric(18,2) as valor_total,
                TRIM(COALESCE(c6.c6_entreg, '')) as entrega,
                c6.c6_pedcli as ped_cliente,
                TRIM(c2.c2_num) || TRIM(c2.c2_item) || TRIM(c2.c2_sequen) AS op_num,
                c2.c2_quant as op_qtd,
                c5.c5_liberok as status_cor,
                -- CASE unificado usando resultados dos LATERAL JOINs (avaliado 1x por linha)
                CASE
                    WHEN sb1.b1_msblql IN ('1','S','T','Y') OR sz0_chk.ok IS NOT NULL THEN 'Restrição'
                    WHEN COALESCE(c6.c6_xrevm, '') <> COALESCE(c6.c6_xrevc, '') THEN 'Revisão'
                    WHEN sg1_chk.ok IS NULL AND sg2_chk.ok IS NULL THEN 'Novo'
                    ELSE 'PCP'
                END AS status_tipo_item,
                CASE
                    WHEN sb1.b1_msblql IN ('1','S','T','Y') THEN 'Produto bloqueado no cadastro (SB1 b1_msblql). Rev. MF: ' || COALESCE(TRIM(c6.c6_xrevm), '-') || ' / Rev. Cli: ' || COALESCE(TRIM(c6.c6_xrevc), '-')
                    WHEN sz0_chk.ok IS NOT NULL THEN 'Restrição pendente no cadastro (SZ0 status=P). Rev. MF: ' || COALESCE(TRIM(c6.c6_xrevm), '-') || ' / Rev. Cli: ' || COALESCE(TRIM(c6.c6_xrevc), '-')
                    WHEN COALESCE(c6.c6_xrevm, '') <> COALESCE(c6.c6_xrevc, '') THEN 'Diferença de revisão detectada. Rev. MF: ' || COALESCE(TRIM(c6.c6_xrevm), '-') || ' / Rev. Cli: ' || COALESCE(TRIM(c6.c6_xrevc), '-')
                    WHEN sg1_chk.ok IS NULL AND sg2_chk.ok IS NULL THEN 'Produto novo — sem estrutura (BOM) cadastrada no Protheus.'
                    ELSE 'Item com estrutura existente, liberado para PCP.'
                END AS status_tipo_detalhe
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
                ON sb1.b1_cod = c6.c6_produto
                AND COALESCE(sb1.d_e_l_e_t_, '') = ''
            LEFT JOIN public.sc2010 c2
                ON (c2.c2_pedido = c5.c5_num )
                AND c2.c2_itempv = c6.c6_item
                AND COALESCE(c2.d_e_l_e_t_, '') = ''
            LEFT JOIN LATERAL (
                SELECT 1 as ok FROM public.sz0010
                WHERE TRIM(z0_produto) = TRIM(c6.c6_produto)
                AND COALESCE(d_e_l_e_t_, '') <> '*' AND z0_status = 'P' LIMIT 1
            ) sz0_chk ON true
            LEFT JOIN LATERAL (
                SELECT 1 as ok FROM public.sg1010
                WHERE TRIM(g1_cod) = TRIM(c6.c6_produto)
                AND COALESCE(d_e_l_e_t_, '') <> '*' LIMIT 1
            ) sg1_chk ON true
            LEFT JOIN LATERAL (
                SELECT 1 as ok FROM public.sg2010
                WHERE TRIM(g2_produto) = TRIM(c6.c6_produto)
                AND COALESCE(d_e_l_e_t_, '') <> '*' LIMIT 1
            ) sg2_chk ON true
            ${whereClause}
            ORDER BY c5.c5_num DESC, c6.c6_item ASC
            LIMIT $${paramCount} OFFSET $${paramCount + 1}
        `;

        params.push(limitParsed, offset);

        // Count query (mesma estrutura, sem LATERAL — não afeta o count)
        countQuery = `
            SELECT count(*) as total
            FROM public.sc5010 c5
            JOIN public.sc6010 c6
                ON COALESCE(c6.d_e_l_e_t_, '') = ''
                AND c6.c6_filial = c5.c5_filial
                AND c6.c6_num = c5.c5_num
            LEFT JOIN public.sa1010 sa1
                ON sa1.a1_cod = c5.c5_cliente
                AND sa1.a1_loja = c5.c5_lojacli
                AND COALESCE(sa1.d_e_l_e_t_, '') = ''
            ${whereClause}
        `;
        paramsCount = params.slice(0, paramCount - 1);

        errorStep = 'pg_main_query';
        // ── MAIN QUERY + COUNT em paralelo ─────────────────────────────────────
        const [result, countResult] = await Promise.all([
            db.query(query, params),
            db.query(countQuery, paramsCount)
        ]);
        errorStep = 'enrichment';

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
                WHERE d2.d2_pedido = ANY($1) AND COALESCE(d2.d_e_l_e_t_, '') = ''
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
                WHERE z1.z1_cliente = ANY($1)
                AND TRIM(z1.z1_produto) = ANY($2)
                AND COALESCE(z1.d_e_l_e_t_, '') = ''
                GROUP BY z1.z1_cliente, z1.z1_loja, TRIM(z1.z1_produto)
            `, [
                [...new Set(result.rows.map(r => r.cod_cliente).filter(Boolean))],
                productCodes
            ]);

            const [forecastResult, notesResult, docsResult, faturasResult, notasResult, sz1Result] = await Promise.allSettled([
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
                           designer_production_release_date, engineering_start_date, lpf_codigo
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
                sz1Enrichment
            ]);

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
                    row.pcp_programacoes = forecasts;
                    if (forecasts.length > 0) {
                        const last = forecasts[forecasts.length - 1];
                        row.pcp_delivery_forecast_date = last.data_entrega_pcp;
                        row.pcp_delivery_forecast_qtd = last.quantidade_pcp;
                        row.pcp_delivery_forecast_user = last.usuario;
                        row.pcp_delivery_forecast_at = last.created_at;
                    }
                });
            } else { console.error('Error forecasts:', forecastResult.reason?.message); }

            // Merge Notes
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

            // Filtro por Data PCP (pós-enriquecimento)
            if (pcpDataInicial || pcpDataFinal) {
                const dInicio = pcpDataInicial ? new Date(pcpDataInicial) : null;
                const dFim = pcpDataFinal ? new Date(pcpDataFinal + 'T23:59:59') : null;
                result.rows = result.rows.filter(row => {
                    const progs = row.pcp_programacoes || [];
                    return progs.some(p => {
                        const d = new Date(p.data_entrega_pcp);
                        if (dInicio && d < dInicio) return false;
                        if (dFim && d > dFim) return false;
                        return true;
                    });
                });
            }
        }

        res.json({
            data: result.rows,
            meta: {
                total: parseInt(countResult.rows[0].total),
                page: parseInt(page),
                limit: limitParsed
            }
        });

    } catch (err) {
        console.error('Erro FLAT VIEW:', err);
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

// GET /api/pedidos/:id/itens
router.get('/:id/itens', async (req, res) => {
    try {
        const { id } = req.params;

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
                TRIM(c2.c2_num) || TRIM(c2.c2_item) || TRIM(c2.c2_sequen) AS op_num,
                c2.c2_quant   AS op_qtd,
                COALESCE(c6.c6_qtdent, 0)::numeric(18,6) AS qtd_entreg,
                (COALESCE(c6.c6_qtdven, 0) - COALESCE(c6.c6_qtdent, 0))::numeric(18,6) AS qtd_faturar,
                CASE
                    WHEN sb1.b1_msblql IN ('1','S','T','Y') OR sz0_chk.ok IS NOT NULL THEN 'Restrição'
                    WHEN COALESCE(c6.c6_xrevm, '') <> COALESCE(c6.c6_xrevc, '') THEN 'Revisão'
                    WHEN sg1_chk.ok IS NULL AND sg2_chk.ok IS NULL THEN 'Novo'
                    ELSE 'PCP'
                END AS status_tipo_item,
                CASE
                    WHEN sb1.b1_msblql IN ('1','S','T','Y') THEN 'Produto bloqueado no cadastro (SB1 b1_msblql). Rev. MF: ' || COALESCE(TRIM(c6.c6_xrevm), '-') || ' / Rev. Cli: ' || COALESCE(TRIM(c6.c6_xrevc), '-')
                    WHEN sz0_chk.ok IS NOT NULL THEN 'Restrição pendente no cadastro (SZ0 status=P). Rev. MF: ' || COALESCE(TRIM(c6.c6_xrevm), '-') || ' / Rev. Cli: ' || COALESCE(TRIM(c6.c6_xrevc), '-')
                    WHEN COALESCE(c6.c6_xrevm, '') <> COALESCE(c6.c6_xrevc, '') THEN 'Diferença de revisão detectada. Rev. MF: ' || COALESCE(TRIM(c6.c6_xrevm), '-') || ' / Rev. Cli: ' || COALESCE(TRIM(c6.c6_xrevc), '-')
                    WHEN sg1_chk.ok IS NULL AND sg2_chk.ok IS NULL THEN 'Produto novo — sem estrutura (BOM) cadastrada no Protheus.'
                    ELSE 'Item com estrutura existente, liberado para PCP.'
                END AS status_tipo_detalhe
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
            LEFT JOIN LATERAL (
                SELECT 1 as ok FROM public.sz0010
                WHERE TRIM(z0_produto) = TRIM(c6.c6_produto)
                AND COALESCE(d_e_l_e_t_, '') <> '*' AND z0_status = 'P' LIMIT 1
            ) sz0_chk ON true
            LEFT JOIN LATERAL (
                SELECT 1 as ok FROM public.sg1010
                WHERE TRIM(g1_cod) = TRIM(c6.c6_produto)
                AND COALESCE(d_e_l_e_t_, '') <> '*' LIMIT 1
            ) sg1_chk ON true
            LEFT JOIN LATERAL (
                SELECT 1 as ok FROM public.sg2010
                WHERE TRIM(g2_produto) = TRIM(c6.c6_produto)
                AND COALESCE(d_e_l_e_t_, '') <> '*' LIMIT 1
            ) sg2_chk ON true
            WHERE c5.c5_num = $1
            AND COALESCE(c5.d_e_l_e_t_, '') = ''
            AND c5.c5_tipo <> 'B'
            ORDER BY c6.c6_item ASC
        `;

        const result = await db.query(query, [id]);

        // Parallel Enrichment: Notes + Docs + NFs + Ref/Rev cliente
        const items = result.rows;
        if (items.length > 0) {
            const productCodes = [...new Set(items.map(i => i.codigo).filter(c => c))];
            const codCliente = items[0]?.cod_cliente;
            const lojaCliente = items[0]?.loja_cliente;

            const [notesResult, docsResult, nfResult, sz1Result] = await Promise.allSettled([
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
                    AND TRIM(z1.z1_produto) = ANY($3)
                    AND COALESCE(z1.d_e_l_e_t_, '') = ''
                    GROUP BY TRIM(z1.z1_produto)
                `, [codCliente, lojaCliente, productCodes]) : Promise.resolve({ rows: [] })
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
            // Fetch Latest PCP Forecasts for this pedido
            try {
                const [forecasts] = await mysqlPool.query(`
                        SELECT f1.*, TRIM(f1.item) as item_trim
                        FROM app_pcp_delivery_forecasts f1
                        INNER JOIN (
                            SELECT pedido, item, MAX(id) as max_id
                            FROM app_pcp_delivery_forecasts
                            WHERE TRIM(pedido) = ?
                            GROUP BY pedido, item
                        ) f2 ON f1.id = f2.max_id
                    `, [id]);

                const forecastMap = {};
                forecasts.forEach(f => forecastMap[f.item_trim] = f);

                items.forEach(item => {
                    const forecast = forecastMap[item.item];
                    if (forecast) {
                        item.pcp_delivery_forecast_date = forecast.data_entrega_pcp;
                        item.pcp_delivery_forecast_qtd = forecast.quantidade_pcp;
                        item.pcp_delivery_forecast_user = forecast.usuario;
                        item.pcp_delivery_forecast_at = forecast.created_at;
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
router.post('/pcp-forecasts/batch', async (req, res) => {
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

                await connection.query(
                    'INSERT INTO app_pcp_delivery_forecasts (pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao, numero_serie, serie_cliente, serie_metalfisa, lote, numero_lote) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao || null, numero_serie || null, serie_cliente || null, serie_metalfisa || null, lote || null, numero_lote || null]
                );

                savedItems.push({ pedido: String(pedido).trim(), item: String(item).trim(), quantidade_pcp });
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

router.post('/pcp-forecasts', async (req, res) => {
    try {
        const { pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao, numero_serie, serie_cliente, serie_metalfisa, lote, numero_lote, qtd_total_item } = req.body;

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
            'INSERT INTO app_pcp_delivery_forecasts (pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao, numero_serie, serie_cliente, serie_metalfisa, lote, numero_lote) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao || null, numero_serie || null, serie_cliente || null, serie_metalfisa || null, lote || null, numero_lote || null]
        );

        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error('Error saving PCP forecast:', err);
        res.status(500).json({ error: err.message });
    }
});

router.put('/pcp-forecasts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data_entrega_pcp, quantidade_pcp, observacao, numero_serie, serie_cliente, serie_metalfisa, lote, numero_lote, usuario, qtd_total_item } = req.body;

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
            'UPDATE app_pcp_delivery_forecasts SET data_entrega_pcp = ?, quantidade_pcp = ?, observacao = ?, numero_serie = ?, serie_cliente = ?, serie_metalfisa = ?, lote = ?, numero_lote = ? WHERE id = ?',
            [data_entrega_pcp, parseFloat(quantidade_pcp), observacao || null, numero_serie || null, serie_cliente || null, serie_metalfisa || null, lote || null, numero_lote || null, id]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Error updating PCP forecast:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/pcp-forecasts/:id', async (req, res) => {
    try {
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
    try {
        const { id } = req.params;
        const { item: queryItem } = req.query; // Optional single-item filter

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
                AND sa1.a1_loja = c5.c5_lojacli 
                AND COALESCE(sa1.d_e_l_e_t_, '') = ''
            WHERE TRIM(c5.c5_num) = $1
              AND COALESCE(c5.d_e_l_e_t_, '') = ''
        `;

        const orderResult = await db.query(orderQuery, [id]);

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Pedido não encontrado no Protheus.' });
        }

        const orderData = orderResult.rows[0];

        // Se passarmos um item específico, adiciona condição na query
        const itemCondition = queryItem ? `AND TRIM(c6.c6_item) = '${queryItem}'` : '';

        // Step 2: Query the Items (SC6) and explode the BOM (SG1) down to the leaves
        // AND aggregate the Operations (SG2) per component.
        const explosionQuery = `
            WITH RECURSIVE
            -- 1. Capa de Itens do PV (Ignora itens sem OP)
            pv_itens AS (
                SELECT 
                    TRIM(c6.c6_item) AS item_pedido,
                    TRIM(c6.c6_produto) AS produto_venda,
                    TRIM(sb1.b1_desc) AS desc_venda,
                    TRIM(sb1.b1_tipo) AS tipo_venda,
                    COALESCE(NULLIF(c6.c6_qtdven::numeric, 0), c2.c2_quant::numeric, 0) AS qtd_venda,
                    TRIM(c6.c6_um) as unid_venda,
                    TRIM(c6.c6_xrevm) as rev_metalfisa,
                    COALESCE(TRIM(c2.c2_num) || TRIM(c2.c2_item) || TRIM(c2.c2_sequen), TRIM(c6.c6_numop)) AS op_num
                FROM sc6010 c6
                LEFT JOIN sc2010 c2 ON c2.c2_filial = c6.c6_filial AND TRIM(c2.c2_pedido) = TRIM(c6.c6_num) AND c2.c2_itempv = c6.c6_item AND c2.c2_sequen = '001' AND COALESCE(c2.d_e_l_e_t_, '') = ''
                LEFT JOIN sb1010 sb1 ON TRIM(sb1.b1_cod) = TRIM(c6.c6_produto) AND COALESCE(sb1.d_e_l_e_t_, '') = ''
                WHERE TRIM(c6.c6_num) = $1
                  AND COALESCE(c6.d_e_l_e_t_, '') = ''
                  AND COALESCE(TRIM(c6.c6_numop), '') != ''
                  ${itemCondition}
            ),
            -- 2. Explosão de Estrutura Recursiva (BOM) começando pelos itens da PV
            estrutura AS (
                -- Level 0: The finished products sold
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
                    pv.op_num AS op_relacionada
                FROM pv_itens pv

                UNION ALL

                -- Recursive Levels: Children of the components
                SELECT
                    e.item_pedido,
                    e.nivel + 1,
                    CAST(TRIM(e.componente) AS VARCHAR(30)) AS produto_pai,
                    CAST(TRIM(g1.g1_comp) AS VARCHAR(30)) AS componente,
                    CAST(TRIM(sb1.b1_desc) AS VARCHAR(100)) AS descricao,
                    CAST(TRIM(sb1.b1_tipo) AS VARCHAR(2)) AS tipo,
                    CAST(TRIM(sb1.b1_um) AS VARCHAR(10)) AS unidade,
                    CAST(TRIM(sb1.b1_urev) AS VARCHAR(10)) AS revisao,
                    g1.g1_quant::numeric AS qtd_base,
                    (e.qtd_necessaria * g1.g1_quant::numeric)::numeric AS qtd_necessaria,
                    COALESCE(
                        (SELECT TRIM(c2_sub.c2_num) || c2_sub.c2_item || c2_sub.c2_sequen
                         FROM sc2010 c2_sub 
                         WHERE TRIM(c2_sub.c2_pedido) = $1 
                           AND c2_sub.c2_itempv = e.item_pedido 
                           AND TRIM(c2_sub.c2_produto) = TRIM(g1.g1_comp) 
                           AND COALESCE(c2_sub.d_e_l_e_t_, '') = '' 
                         LIMIT 1),
                        e.op_relacionada
                    ) AS op_relacionada
                FROM estrutura e
                JOIN sg1010 g1 ON TRIM(g1.g1_cod) = TRIM(e.componente) AND COALESCE(g1.d_e_l_e_t_, '') = ''
                LEFT JOIN sb1010 sb1 ON TRIM(sb1.b1_cod) = TRIM(g1.g1_comp) AND COALESCE(sb1.d_e_l_e_t_, '') = ''
                WHERE e.nivel < 15 -- Prevents infinite loops if circular references exist
            )
            -- RESULTADO DE EXPLOSÃO + ROTEIRO (SG2)
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
                
                -- Aggregating operations for the specific component using JSON
                -- COALESCE returns an empty JSON array '[]' if no operations found
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'seq', TRIM(g2.g2_operac),
                                'recurso', TRIM(g2.g2_recurso),
                                'desc_operacao', CASE 
                                    WHEN TRIM(g2.g2_recurso) = 'MO0013' THEN 'LASE'
                                    ELSE TRIM(h1.h1_descri) 
                                END,
                                'setup', g2.g2_setup,
                                'tempo_padrao', g2.g2_tempad,
                                'ferramenta', TRIM(g2.g2_ferram)
                            ) ORDER BY TRIM(g2.g2_operac)
                        )
                        FROM sg2010 g2
                        LEFT JOIN sh1010 h1 ON TRIM(h1.h1_codigo) = TRIM(g2.g2_recurso) AND COALESCE(h1.d_e_l_e_t_, '') = ''
                        WHERE TRIM(g2.g2_produto) = CAST(TRIM(e.componente) AS VARCHAR(30))
                          AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
                          AND TRIM(g2.g2_codigo) = (
                              SELECT MAX(TRIM(g2_sub.g2_codigo))
                              FROM sg2010 g2_sub
                              WHERE TRIM(g2_sub.g2_produto) = CAST(TRIM(e.componente) AS VARCHAR(30))
                                AND COALESCE(g2_sub.d_e_l_e_t_, '') IN ('', ' ')
                          )
                    ), '[]'::json
                ) AS operacoes
            FROM estrutura e
            ORDER BY e.item_pedido ASC, e.nivel ASC, e.produto_pai ASC, e.componente ASC;
        `;

        const explosionResult = await db.query(explosionQuery, [id]);

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

module.exports = router;
