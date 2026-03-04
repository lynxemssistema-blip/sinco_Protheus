const express = require('express');
const router = express.Router();
const db = require('../db');
const mysqlPool = require('../services/mysqlService');

// GET /api/pedidos
router.get('/', async (req, res) => {
    try {
        const { cliente, pedido, produto, dataInicial, dataFinal, page = 1, limit = 50, only_active = 'false' } = req.query;

        // Paginação
        const limitParsed = parseInt(limit, 10) || 50;
        const pageParsed = parseInt(page, 10) || 1;
        const offset = (pageParsed - 1) * limitParsed;

        // Parâmetros para query
        const params = [];
        let paramCount = 1;

        // Construção dinâmica de filtros
        let whereClause = "WHERE COALESCE(c5.d_e_l_e_t_, '') = '' AND c5.c5_tipo <> 'B'";

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
        TO_CHAR(TO_DATE(NULLIF(TRIM(c5.c5_emissao), ''), 'YYYYMMDD'), 'DD/MM/YY') AS emissao,
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
                WHERE c2.c2_pedido = c6_op.c6_num
                AND c2.c2_itempv = c6_op.c6_item
                AND COALESCE(c2.d_e_l_e_t_, '') = ''
            )
        ) AS itens_com_op,
        (
            SELECT TO_CHAR(TO_DATE(NULLIF(TRIM(MAX(c6_sub.c6_entreg)), ''), 'YYYYMMDD'), 'DD/MM/YY')
            FROM public.sc6010 c6_sub
            WHERE c6_sub.c6_num = c5.c5_num
            AND c6_sub.c6_filial = c5.c5_filial
            AND COALESCE(c6_sub.d_e_l_e_t_, '') = ''
        ) AS entrega,
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
                WHERE c2_m.c2_pedido = c5.c5_num AND COALESCE(c2_m.d_e_l_e_t_, '') = ''
            ) AND EXISTS (
                SELECT 1 FROM public.sc2010 c2_e WHERE c2_e.c2_pedido = c5.c5_num AND COALESCE(c2_e.d_e_l_e_t_, '') = ''
            ) THEN 'orange'

            -- Todos os itens sem OP
            WHEN NOT EXISTS (SELECT 1 FROM public.sc2010 c2_none WHERE c2_none.c2_pedido = c5.c5_num AND COALESCE(c2_none.d_e_l_e_t_, '') = '') THEN 'red'

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

        res.json({
            data: result.rows,
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
        const { cliente, pedido, produto, dataInicial, dataFinal, dateType = 'pedido', page = 1, limit = 50, only_active = 'false', tipo_item = '' } = req.query;
        const limitParsed = parseInt(limit, 10) || 50;
        const pageParsed = parseInt(page, 10) || 1;
        const offset = (pageParsed - 1) * limitParsed;

        params = [];
        let paramCount = 1;

        // Base Filter Logic
        let whereClause = "WHERE COALESCE(c5.d_e_l_e_t_, '') = '' AND c5.c5_tipo <> 'B' AND COALESCE(c6.d_e_l_e_t_, '') = ''";

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

        // --- Novo Filtro de Tipo de Item ---
        if (tipo_item) {
            if (tipo_item === 'Restrição') {
                whereClause += ` AND (
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
                )`;
            } else if (tipo_item === 'Revisão') {
                whereClause += ` AND COALESCE(c6.c6_xrevm, '') <> COALESCE(c6.c6_xrevc, '')`;
            } else if (tipo_item === 'Novo') {
                whereClause += ` AND NOT EXISTS (
                    SELECT 1 FROM public.sg1010 sg1
                    WHERE TRIM(sg1.g1_cod) = TRIM(c6.c6_produto)
                    AND COALESCE(sg1.d_e_l_e_t_, '') <> '*'
                ) AND NOT EXISTS (
                    SELECT 1 FROM public.sg2010 sg2
                    WHERE TRIM(sg2.g2_produto) = TRIM(c6.c6_produto)
                    AND COALESCE(sg2.d_e_l_e_t_, '') <> '*'
                )`;
            } else if (tipo_item === 'PCP') {
                whereClause += ` AND NOT (
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
                )`;
            }
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

        // Query joining Header + Items
        // Query based on USER REFERENCE SQL
        query = `
            SELECT
                TRIM(c5.c5_num) as pedido,
                TRIM(c5.c5_cliente) as cod_cliente,
                (SELECT STRING_AGG(DISTINCT TRIM(z1.z1_codcli), ' / ') FROM public.sz1010 z1 WHERE z1.z1_cliente = c5.c5_cliente AND z1.z1_loja = c5.c5_lojacli AND TRIM(z1.z1_produto) = TRIM(c6.c6_produto) AND COALESCE(z1.d_e_l_e_t_, '') = '') as ref_cliente,
                (SELECT STRING_AGG(DISTINCT TRIM(z1.z1_revisao), ' / ') FROM public.sz1010 z1 WHERE z1.z1_cliente = c5.c5_cliente AND z1.z1_loja = c5.c5_lojacli AND TRIM(z1.z1_produto) = TRIM(c6.c6_produto) AND COALESCE(z1.d_e_l_e_t_, '') = '') as rev_cliente,
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
                TRIM(COALESCE(c6.c6_entreg, '')) as entrega,
                (
                    SELECT json_agg(
                        json_build_object(
                            'nota', TRIM(d2.d2_doc),
                            'serie', TRIM(d2.d2_serie),
                            'emissao', TO_CHAR(TO_DATE(NULLIF(TRIM(f2.f2_emissao), ''), 'YYYYMMDD'), 'DD/MM/YY'),
                            'natureza', '',
                            'cfop', TRIM(d2.d2_cf),
                            'qtd', d2.d2_quant::numeric(18,2),
                            'valor_unit', d2.d2_prunit::numeric(18,2),
                            'valor_total', d2.d2_total::numeric(18,2),
                            'valor_icms', d2.d2_valicm::numeric(18,2),
                            'valor_ipi', d2.d2_valipi::numeric(18,2),
                            'valor_frete', d2.d2_valfre::numeric(18,2),
                            'peso_bruto', f2.f2_pbruto::numeric(18,2),
                            'peso_liquido', f2.f2_pliqui::numeric(18,2),
                            'transporte', TRIM(f2.f2_transp)
                        )
                    )
                    FROM public.sd2010 d2
                    JOIN public.sf2010 f2 
                        ON f2.f2_doc = d2.d2_doc 
                        AND f2.f2_serie = d2.d2_serie 
                        AND COALESCE(f2.d_e_l_e_t_, '') = ''
                    WHERE d2.d2_pedido = c5.c5_num 
                      AND d2.d2_itempv = c6.c6_item 
                      AND COALESCE(d2.d_e_l_e_t_, '') = ''
                ) AS notas_fiscais,
                c6.c6_pedcli as ped_cliente,
                c2.c2_num as op_num,
                c2.c2_quant as op_qtd,
                
                -- Status color (legacy/compat)
                c5.c5_liberok as status_cor,

                -- Novo Status (Novo/Restricao/Revisao/PCP)
                CASE
                    -- 2. Restrição
                    WHEN EXISTS (
                        SELECT 1 FROM public.sb1010 filter_sb
                        WHERE TRIM(filter_sb.b1_cod) = TRIM(c6.c6_produto)
                        AND COALESCE(filter_sb.d_e_l_e_t_, '') <> '*'
                        AND filter_sb.b1_msblql IN ('1','S','T','Y')
                    ) OR EXISTS (
                        SELECT 1 FROM public.sz0010 filter_sz
                        WHERE TRIM(filter_sz.z0_produto) = TRIM(c6.c6_produto)
                        AND COALESCE(filter_sz.d_e_l_e_t_, '') <> '*'
                        AND filter_sz.z0_status = 'P'
                    ) THEN 'Restrição'
                    
                    -- 3. Revisão
                    WHEN COALESCE(c6.c6_xrevm, '') <> COALESCE(c6.c6_xrevc, '') THEN 'Revisão'
                    
                    -- 1. Novo
                    WHEN NOT EXISTS (
                        SELECT 1 FROM public.sg1010 sg1
                        WHERE TRIM(sg1.g1_cod) = TRIM(c6.c6_produto)
                        AND COALESCE(sg1.d_e_l_e_t_, '') <> '*'
                    ) AND NOT EXISTS (
                        SELECT 1 FROM public.sg2010 sg2
                        WHERE TRIM(sg2.g2_produto) = TRIM(c6.c6_produto)
                        AND COALESCE(sg2.d_e_l_e_t_, '') <> '*'
                    ) THEN 'Novo'

                    -- 4. PCP
                    ELSE 'PCP'
                END AS status_tipo_item,

                -- Detalhe descritivo do tipo
                CASE
                    WHEN EXISTS (
                        SELECT 1 FROM public.sb1010 filter_sb
                        WHERE TRIM(filter_sb.b1_cod) = TRIM(c6.c6_produto)
                        AND COALESCE(filter_sb.d_e_l_e_t_, '') <> '*'
                        AND filter_sb.b1_msblql IN ('1','S','T','Y')
                    ) THEN 'Produto bloqueado no cadastro (SB1 b1_msblql). Rev. MF: ' || COALESCE(TRIM(c6.c6_xrevm), '-') || ' / Rev. Cli: ' || COALESCE(TRIM(c6.c6_xrevc), '-')
                    WHEN EXISTS (
                        SELECT 1 FROM public.sz0010 filter_sz
                        WHERE TRIM(filter_sz.z0_produto) = TRIM(c6.c6_produto)
                        AND COALESCE(filter_sz.d_e_l_e_t_, '') <> '*'
                        AND filter_sz.z0_status = 'P'
                    ) THEN 'Restrição pendente no cadastro (SZ0 status=P). Rev. MF: ' || COALESCE(TRIM(c6.c6_xrevm), '-') || ' / Rev. Cli: ' || COALESCE(TRIM(c6.c6_xrevc), '-')
                    WHEN COALESCE(c6.c6_xrevm, '') <> COALESCE(c6.c6_xrevc, '') THEN 'Diferença de revisão detectada. Rev. MF: ' || COALESCE(TRIM(c6.c6_xrevm), '-') || ' / Rev. Cli: ' || COALESCE(TRIM(c6.c6_xrevc), '-')
                    WHEN NOT EXISTS (
                        SELECT 1 FROM public.sg1010 sg1
                        WHERE TRIM(sg1.g1_cod) = TRIM(c6.c6_produto)
                        AND COALESCE(sg1.d_e_l_e_t_, '') <> '*'
                    ) AND NOT EXISTS (
                        SELECT 1 FROM public.sg2010 sg2
                        WHERE TRIM(sg2.g2_produto) = TRIM(c6.c6_produto)
                        AND COALESCE(sg2.d_e_l_e_t_, '') <> '*'
                    ) THEN 'Produto novo — sem estrutura (BOM) cadastrada no Protheus.'
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
                ON c2.c2_pedido = c5.c5_num
                AND c2.c2_itempv = c6.c6_item
                AND COALESCE(c2.d_e_l_e_t_, '') = ''
            ${whereClause}
            ORDER BY c5.c5_num DESC, c6.c6_item ASC
            LIMIT $${paramCount} OFFSET $${paramCount + 1}
        `;

        params.push(limitParsed, offset);
        errorStep = 'pg_main_query';
        console.log(`📡 [DEBUG] Executando SQL Principal (View: flat)...`);
        const result = await db.query(query, params);
        console.log(`✅ [DEBUG] SQL Principal concluído. Linhas: ${result.rows.length}`);

        // --- PARALLEL ENRICHMENT: Forecasts + Notes + Docs (Promise.all for 3x perf) ---
        if (result.rows.length > 0) {
            // Build safe parameterized pairs for MySQL
            const pairs = result.rows.map(r => [String(r.pedido).trim(), String(r.item).trim()]);
            const pairPlaceholders = pairs.map(() => '(?, ?)').join(',');
            const pairParams = pairs.flat();

            const productCodes = [...new Set(result.rows.map(i => i.codigo).filter(c => c))];

            // Execute all 3 enrichments in parallel
            const [forecastResult, notesResult, docsResult] = await Promise.allSettled([
                // 1. PCP Forecasts
                mysqlPool.query(`
                    SELECT f1.*, TRIM(f1.pedido) as p_trim, TRIM(f1.item) as i_trim
                    FROM app_pcp_delivery_forecasts f1
                    INNER JOIN (
                        SELECT pedido, item, MAX(id) as max_id
                        FROM app_pcp_delivery_forecasts
                        WHERE (TRIM(pedido), TRIM(item)) IN (${pairPlaceholders})
                        GROUP BY pedido, item
                    ) f2 ON f1.id = f2.max_id
                `, pairParams),

                // 2. Notes (engineering dates)
                mysqlPool.query(`
                    SELECT TRIM(pedido) as pedido, TRIM(item) as item,
                           pcp_planned_eng_date, pcp_planned_eng_obs,
                           designer_production_release_date, engineering_start_date
                    FROM app_sales_order_item_notes
                    WHERE (TRIM(pedido), TRIM(item)) IN (${pairPlaceholders})
                `, pairParams),

                // 3. Docs
                (async () => {
                    const docsMap = {};
                    const CHUNK_SIZE = 100;
                    for (let i = 0; i < productCodes.length; i += CHUNK_SIZE) {
                        const chunk = productCodes.slice(i, i + CHUNK_SIZE);
                        const placeholders = chunk.map(() => '?').join(',');
                        const [docsRows] = await mysqlPool.execute(
                            `SELECT DISTINCT TRIM(produto_codigo) as produto_codigo, url_arquivo, tipo FROM produtos_docs WHERE produto_codigo IN (${placeholders})`,
                            chunk
                        );
                        docsRows.forEach(row => {
                            if (!docsMap[row.produto_codigo]) docsMap[row.produto_codigo] = [];
                            docsMap[row.produto_codigo].push(row);
                        });
                    }
                    return docsMap;
                })()
            ]);

            // Merge Forecasts
            if (forecastResult.status === 'fulfilled') {
                const forecastMap = {};
                forecastResult.value[0].forEach(f => {
                    forecastMap[`${f.p_trim}-${f.i_trim}`] = f;
                });
                result.rows.forEach(row => {
                    const forecast = forecastMap[`${String(row.pedido).trim()}-${String(row.item).trim()}`];
                    if (forecast) {
                        row.pcp_delivery_forecast_date = forecast.data_entrega_pcp;
                        row.pcp_delivery_forecast_qtd = forecast.quantidade_pcp;
                        row.pcp_delivery_forecast_user = forecast.usuario;
                        row.pcp_delivery_forecast_at = forecast.created_at;
                    }
                });
            } else {
                console.error('Error merging forecasts:', forecastResult.reason?.message);
            }

            // Merge Notes
            if (notesResult.status === 'fulfilled') {
                const notesMap = {};
                notesResult.value[0].forEach(n => {
                    notesMap[`${n.pedido}-${n.item}`] = n;
                });
                result.rows.forEach(row => {
                    const note = notesMap[`${String(row.pedido).trim()}-${String(row.item).trim()}`];
                    if (note) {
                        row.pcp_planned_eng_date = note.pcp_planned_eng_date;
                        row.pcp_planned_eng_obs = note.pcp_planned_eng_obs;
                        row.designer_production_release_date = note.designer_production_release_date;
                        row.engineering_start_date = note.engineering_start_date;
                    }
                });
            } else {
                console.error('Error merging notes:', notesResult.reason?.message);
            }

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
            } else {
                console.error('Error merging docs:', docsResult.reason?.message);
            }
        }

        // Count Query matching new joins
        countQuery = `
            SELECT count(*) as total
            FROM public.sc5010 c5
            JOIN public.sc6010 c6 
                ON COALESCE(c6.d_e_l_e_t_, '') = ''
                AND c6.c6_filial = c5.c5_filial
                AND c6.c6_num = c5.c5_num
            LEFT JOIN public.sa1010 sa1
                ON COALESCE(sa1.d_e_l_e_t_, '') = ''
                AND TRIM(sa1.a1_cod) = TRIM(c5.c5_cliente)
                AND TRIM(sa1.a1_loja) = TRIM(c5.c5_lojacli)
            ${whereClause}
        `;

        paramsCount = params.slice(0, paramCount - 1);
        errorStep = 'pg_count_query';
        console.log(`📡 [DEBUG] Executando Count Query...`);
        const countResult = await db.query(countQuery, paramsCount);
        console.log(`✅ [DEBUG] Count Query realizada: ${countResult.rows[0].total}`);

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

// GET /api/pedidos/:id/itens
router.get('/:id/itens', async (req, res) => {
    try {
        const { id } = req.params;

        // Same query as before but strictly defined
        // Query based on USER REFERENCE SQL
        const query = `
            SELECT 
                TRIM(c5.c5_num)     AS pedido,
                TRIM(c6.c6_item)    AS item,
                (SELECT STRING_AGG(DISTINCT TRIM(z1.z1_codcli), ' / ') FROM public.sz1010 z1 WHERE z1.z1_cliente = c5.c5_cliente AND z1.z1_loja = c5.c5_lojacli AND TRIM(z1.z1_produto) = TRIM(c6.c6_produto) AND COALESCE(z1.d_e_l_e_t_, '') = '') AS ref_cliente,
                (SELECT STRING_AGG(DISTINCT TRIM(z1.z1_revisao), ' / ') FROM public.sz1010 z1 WHERE z1.z1_cliente = c5.c5_cliente AND z1.z1_loja = c5.c5_lojacli AND TRIM(z1.z1_produto) = TRIM(c6.c6_produto) AND COALESCE(z1.d_e_l_e_t_, '') = '') AS rev_cliente,
                TRIM(c6.c6_produto) AS codigo,
                TRIM(c6.c6_xrevm) AS rev_codigo,
                TRIM(c6.c6_xrevc) AS c6_rev_cliente,
                sb1.b1_desc   AS descricao,
                c6.c6_um      AS unidade,

                -- Quantidade (pedido)
                COALESCE(c6.c6_qtdven, 0)::numeric(18,6)  AS quantidade,

                TO_CHAR(TO_DATE(NULLIF(TRIM(c6.c6_entreg), ''), 'YYYYMMDD'), 'DD/MM/YY') AS entrega,
                TRIM(c6.c6_pedcli) AS ped_cliente,
                
                -- OP Info
                c2.c2_num     AS op_num,
                c2.c2_quant   AS op_qtd,

                -- Qtd Entregue
                COALESCE(c6.c6_qtdent, 0)::numeric(18,6) AS qtd_entreg,
                
                -- Saldo a Entregar (Calculated exactly like user reference)
                (COALESCE(c6.c6_qtdven, 0) - COALESCE(c6.c6_qtdent, 0))::numeric(18,6) AS qtd_faturar,
                
                (
                    SELECT json_agg(
                        json_build_object(
                            'nota', TRIM(d2.d2_doc),
                            'serie', TRIM(d2.d2_serie),
                            'emissao', TO_CHAR(TO_DATE(NULLIF(TRIM(f2.f2_emissao), ''), 'YYYYMMDD'), 'DD/MM/YY'),
                            'natureza', '',
                            'cfop', TRIM(d2.d2_cf),
                            'qtd', d2.d2_quant::numeric(18,2),
                            'valor_unit', d2.d2_prunit::numeric(18,2),
                            'valor_total', d2.d2_total::numeric(18,2),
                            'valor_icms', d2.d2_valicm::numeric(18,2),
                            'valor_ipi', d2.d2_valipi::numeric(18,2),
                            'valor_frete', d2.d2_valfre::numeric(18,2),
                            'peso_bruto', f2.f2_pbruto::numeric(18,2),
                            'peso_liquido', f2.f2_pliqui::numeric(18,2),
                            'transporte', TRIM(f2.f2_transp)
                        )
                    )
                    FROM public.sd2010 d2
                    JOIN public.sf2010 f2 
                        ON f2.f2_doc = d2.d2_doc 
                        AND f2.f2_serie = d2.d2_serie 
                        AND COALESCE(f2.d_e_l_e_t_, '') = ''
                    WHERE d2.d2_pedido = c5.c5_num 
                      AND d2.d2_itempv = c6.c6_item 
                      AND COALESCE(d2.d_e_l_e_t_, '') = ''
                ) AS notas_fiscais,

                CASE
                    -- 2. Restrição
                    WHEN EXISTS (
                        SELECT 1 FROM public.sb1010 filter_sb
                        WHERE TRIM(filter_sb.b1_cod) = TRIM(c6.c6_produto)
                        AND COALESCE(filter_sb.d_e_l_e_t_, '') <> '*'
                        AND filter_sb.b1_msblql IN ('1','S','T','Y')
                    ) OR EXISTS (
                        SELECT 1 FROM public.sz0010 filter_sz
                        WHERE TRIM(filter_sz.z0_produto) = TRIM(c6.c6_produto)
                        AND COALESCE(filter_sz.d_e_l_e_t_, '') <> '*'
                        AND filter_sz.z0_status = 'P'
                    ) THEN 'Restrição'
                    
                    -- 3. Revisão
                    WHEN COALESCE(c6.c6_xrevm, '') <> COALESCE(c6.c6_xrevc, '') THEN 'Revisão'
                    
                    -- 1. Novo
                    WHEN NOT EXISTS (
                        SELECT 1 FROM public.sg1010 sg1
                        WHERE TRIM(sg1.g1_cod) = TRIM(c6.c6_produto)
                        AND COALESCE(sg1.d_e_l_e_t_, '') <> '*'
                    ) AND NOT EXISTS (
                        SELECT 1 FROM public.sg2010 sg2
                        WHERE TRIM(sg2.g2_produto) = TRIM(c6.c6_produto)
                        AND COALESCE(sg2.d_e_l_e_t_, '') <> '*'
                    ) THEN 'Novo'

                    -- 4. PCP
                    ELSE 'PCP'
                END AS status_tipo_item,

                -- Detalhe descritivo do tipo
                CASE
                    WHEN EXISTS (
                        SELECT 1 FROM public.sb1010 filter_sb
                        WHERE TRIM(filter_sb.b1_cod) = TRIM(c6.c6_produto)
                        AND COALESCE(filter_sb.d_e_l_e_t_, '') <> '*'
                        AND filter_sb.b1_msblql IN ('1','S','T','Y')
                    ) THEN 'Produto bloqueado no cadastro (SB1 b1_msblql). Rev. MF: ' || COALESCE(TRIM(c6.c6_xrevm), '-') || ' / Rev. Cli: ' || COALESCE(TRIM(c6.c6_xrevc), '-')
                    WHEN EXISTS (
                        SELECT 1 FROM public.sz0010 filter_sz
                        WHERE TRIM(filter_sz.z0_produto) = TRIM(c6.c6_produto)
                        AND COALESCE(filter_sz.d_e_l_e_t_, '') <> '*'
                        AND filter_sz.z0_status = 'P'
                    ) THEN 'Restrição pendente no cadastro (SZ0 status=P). Rev. MF: ' || COALESCE(TRIM(c6.c6_xrevm), '-') || ' / Rev. Cli: ' || COALESCE(TRIM(c6.c6_xrevc), '-')
                    WHEN COALESCE(c6.c6_xrevm, '') <> COALESCE(c6.c6_xrevc, '') THEN 'Diferença de revisão detectada. Rev. MF: ' || COALESCE(TRIM(c6.c6_xrevm), '-') || ' / Rev. Cli: ' || COALESCE(TRIM(c6.c6_xrevc), '-')
                    WHEN NOT EXISTS (
                        SELECT 1 FROM public.sg1010 sg1
                        WHERE TRIM(sg1.g1_cod) = TRIM(c6.c6_produto)
                        AND COALESCE(sg1.d_e_l_e_t_, '') <> '*'
                    ) AND NOT EXISTS (
                        SELECT 1 FROM public.sg2010 sg2
                        WHERE TRIM(sg2.g2_produto) = TRIM(c6.c6_produto)
                        AND COALESCE(sg2.d_e_l_e_t_, '') <> '*'
                    ) THEN 'Produto novo — sem estrutura (BOM) cadastrada no Protheus.'
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
                ON c2.c2_pedido = c5.c5_num
                AND c2.c2_itempv = c6.c6_item
                AND COALESCE(c2.d_e_l_e_t_, '') = ''

            WHERE c5.c5_num = $1
            AND COALESCE(c5.d_e_l_e_t_, '') = ''
            AND c5.c5_tipo <> 'B'
            AND (
                COALESCE(c5.c5_nota, '') = '' 
                OR EXISTS (
                    SELECT 1 FROM public.sc6010 c6 
                    WHERE c6.c6_num = c5.c5_num 
                    AND c6.c6_filial = c5.c5_filial 
                    AND COALESCE(c6.d_e_l_e_t_, '') = ''
                    AND ((c6.c6_qtdven - c6.c6_qtdent) > 0 OR c6.c6_qtdlib > 0)
                )
            )
            
            ORDER BY c6.c6_item ASC
        `;

        const result = await db.query(query, [id]);

        // Parallel Enrichment: Notes + Docs
        const items = result.rows;
        if (items.length > 0) {
            const productCodes = [...new Set(items.map(i => i.codigo).filter(c => c))];

            const [notesResult, docsResult] = await Promise.allSettled([
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
                })()
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
router.post('/pcp-forecasts', async (req, res) => {
    try {
        const { pedido, item, data_entrega_pcp, quantidade_pcp, usuario } = req.body;

        if (!pedido || !item || !data_entrega_pcp || quantidade_pcp === undefined || !usuario) {
            console.warn('Dados incompletos PCP:', { pedido, item, data_entrega_pcp, quantidade_pcp, usuario });
            return res.status(400).json({
                error: 'Dados incompletos para o planejamento PCP.',
                missing: {
                    pedido: !pedido,
                    item: !item,
                    data: !data_entrega_pcp,
                    quantidade: quantidade_pcp === undefined,
                    usuario: !usuario
                }
            });
        }

        await mysqlPool.query(
            'INSERT INTO app_pcp_delivery_forecasts (pedido, item, data_entrega_pcp, quantidade_pcp, usuario) VALUES (?, ?, ?, ?, ?)',
            [pedido, item, data_entrega_pcp, quantidade_pcp, usuario]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Error saving PCP forecast:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/items/:pedido/:item/pcp-forecasts/history', async (req, res) => {
    try {
        const { pedido, item } = req.params;
        const [rows] = await mysqlPool.query(
            'SELECT * FROM app_pcp_delivery_forecasts WHERE pedido = ? AND item = ? ORDER BY created_at DESC',
            [pedido, item]
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching PCP history:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
