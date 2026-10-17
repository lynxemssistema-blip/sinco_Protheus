require('dotenv').config();
const db = require('./db');
const mysqlPool = require('./services/mysqlService');

(async () => {
    let forecastJson = '[]';
    try {
        const [forecastRows] = await mysqlPool.query(`
            SELECT TRIM(pedido) as pedido, TRIM(item) as item, 
                   MAX(data_entrega_pcp) as data_entrega_pcp, 
                   MAX(data_prevista_faturamento) as data_prevista_faturamento 
            FROM app_pcp_delivery_forecasts
            WHERE pedido IS NOT NULL AND item IS NOT NULL
            GROUP BY TRIM(pedido), TRIM(item)
            LIMIT 5000
        `);
        if (forecastRows.length > 0) {
            forecastJson = JSON.stringify(forecastRows.map(row => ({
                pedido: row.pedido,
                item: row.item,
                data_entrega_pcp: row.data_entrega_pcp || null,
                data_prevista_faturamento: row.data_prevista_faturamento || null
            })));
        }
    } catch(err) {
        console.log('mysql err', err.message);
    }

    const pgClient = await db.connect();
    try {
        await pgClient.query(`SET LOCAL statement_timeout = '120000'`);
        
        let query = `
            WITH paged_items AS (
                SELECT
                    COUNT(*) OVER() AS full_count,
                    TRIM(c5.c5_num) as pedido,
                    c5.c5_emissao as emissao,
                    TRIM(c6.c6_item) as item,
                    TRIM(c6.c6_produto) as codigo,
                    TRIM(c6.c6_xrevm) as rev_codigo,
                    TRIM(c6.c6_xrevc) as c6_rev_cliente,
                    sb1.b1_desc as descricao,
                    TRIM(sb1.b1_msblql) as b1_msblql,
                    fc.data_entrega_pcp,
                    fc.data_prevista_faturamento
                FROM public.sc5010 c5
                JOIN public.sc6010 c6
                    ON COALESCE(c6.d_e_l_e_t_, '') = ''
                    AND c6.c6_filial = c5.c5_filial
                    AND c6.c6_num = c5.c5_num
                LEFT JOIN public.sb1010 sb1
                    ON sb1.b1_cod = c6.c6_produto
                    AND COALESCE(sb1.d_e_l_e_t_, '') = ''
                LEFT JOIN jsonb_to_recordset($1::jsonb) AS fc(pedido varchar, item varchar, data_entrega_pcp varchar, data_prevista_faturamento varchar)
                    ON fc.pedido = TRIM(c5.c5_num) AND fc.item = TRIM(c6.c6_item)
                WHERE COALESCE(c5.d_e_l_e_t_, '') = '' AND c5.c5_tipo <> 'B' AND COALESCE(c6.d_e_l_e_t_, '') = '' 
                  AND (
                    COALESCE(c5.c5_nota, '') = '' 
                    OR EXISTS (
                        SELECT 1 FROM public.sc6010 c6_ex 
                        WHERE c6_ex.c6_num = c5.c5_num 
                        AND c6_ex.c6_filial = c5.c5_filial 
                        AND COALESCE(c6_ex.d_e_l_e_t_, '') = ''
                        AND ((c6_ex.c6_qtdven - c6_ex.c6_qtdent) > 0 OR c6_ex.c6_qtdlib > 0)
                    )
                  )
                  AND ((c6.c6_qtdven - c6.c6_qtdent) > 0 OR c6.c6_qtdlib > 0)
                ORDER BY c5.c5_emissao DESC, c5.c5_num DESC, c6.c6_item ASC
                LIMIT $2 OFFSET $3
            )
            SELECT
                pi.*,
                CASE
                    WHEN pi.b1_msblql IN ('1','S','T','Y') OR sz0_agg.produto IS NOT NULL THEN 'Restrição'
                    WHEN COALESCE(pi.rev_codigo, '') <> COALESCE(pi.c6_rev_cliente, '') THEN 'Revisão'
                    WHEN sg1_agg.produto IS NULL AND sg2_agg.produto IS NULL THEN 'Novo'
                    ELSE 'PCP'
                END AS status_tipo_item,
                TRIM(c2.c2_num) AS op_num,
                c2.c2_quant::numeric(18,6) AS op_qtd
            FROM paged_items pi
            LEFT JOIN public.sc2010 c2
                ON TRIM(c2.c2_pedido) = pi.pedido
                AND TRIM(c2.c2_itempv) = pi.item
                AND c2.c2_sequen = '001'
                AND COALESCE(c2.d_e_l_e_t_, '') = ''
            LEFT JOIN LATERAL (
                SELECT 1 AS produto FROM public.sz0010
                WHERE TRIM(z0_produto) = TRIM(pi.codigo) AND COALESCE(d_e_l_e_t_, '') <> '*' AND z0_status = 'P'
                LIMIT 1
            ) sz0_agg ON true
            LEFT JOIN LATERAL (
                SELECT 1 AS produto FROM public.sg1010
                WHERE TRIM(g1_cod) = TRIM(pi.codigo) AND COALESCE(d_e_l_e_t_, '') <> '*'
                LIMIT 1
            ) sg1_agg ON true
            LEFT JOIN LATERAL (
                SELECT 1 AS produto FROM public.sg2010
                WHERE TRIM(g2_produto) = TRIM(pi.codigo) AND COALESCE(d_e_l_e_t_, '') <> '*'
                LIMIT 1
            ) sg2_agg ON true
            ORDER BY pi.emissao DESC, pi.pedido DESC, pi.item ASC, c2.c2_sequen ASC, c2.c2_num ASC
        `;
        
        const params = [forecastJson, 50, 0];
        
        await pgClient.query(query, params);
        console.log('SUCCESS');
    } catch(err) {
        console.error('PG ERROR:', err.message);
    } finally {
        pgClient.release();
        process.exit();
    }
})();
