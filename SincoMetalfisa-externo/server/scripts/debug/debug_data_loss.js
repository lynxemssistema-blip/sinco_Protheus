
const db = require('./db');
require('dotenv').config();

async function debugDataLoss() {
    console.log('🔍 Debugging Data Loss in /tracking-evolution...');

    // Use a specific Pedido that is likely to have data
    // From previous logs, we saw '003860' in the successful debug run.
    // Let's try to query it again with the "Bad" optimization and see headers vs OPs.

    const pedidoTarget = '003860';

    console.log(`\n--- TESTING PEDIDO: ${pedidoTarget} ---`);

    const queryWithJoin = `
        WITH PedidosBase AS (
            SELECT '${pedidoTarget}'::text as pedido
        ),
        ItensPedido AS (
            SELECT 
                c6.c6_num AS pedido,
                c6.c6_item AS item,
                c6.c6_produto AS cod_produto
            FROM public.sc6010 c6
            WHERE c6.c6_num = '${pedidoTarget}'
            AND COALESCE(c6.d_e_l_e_t_, '') IN ('', ' ')
        ),
        OPsCabecalho AS (
            SELECT 
                TRIM(c2.c2_num) AS op_num,
                c2.c2_item AS item_op,
                c2.c2_produto AS cod_produto,
                c2.c2_quant::numeric AS qtd_planejada
            FROM public.sc2010 c2
            INNER JOIN ItensPedido ip ON btrim(c2.c2_produto) = btrim(ip.cod_produto) -- THE SUSPECT
            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
        )
        SELECT count(*) as count FROM OPsCabecalho;
    `;

    const queryWithoutJoin = `
        WITH PedidosBase AS (
            SELECT '${pedidoTarget}'::text as pedido
        ),
        ItensPedido AS (
            SELECT 
                c6.c6_num AS pedido,
                c6.c6_item AS item,
                c6.c6_produto AS cod_produto
            FROM public.sc6010 c6
            WHERE c6.c6_num = '${pedidoTarget}'
            AND COALESCE(c6.d_e_l_e_t_, '') IN ('', ' ')
        ),
        OPsCabecalho AS (
            SELECT 
                TRIM(c2.c2_num) AS op_num,
                c2.c2_item AS item_op,
                c2.c2_produto AS cod_produto,
                c2.c2_quant::numeric AS qtd_planejada
            FROM public.sc2010 c2
            -- INNER JOIN ItensPedido ip ON btrim(c2.c2_produto) = btrim(ip.cod_produto) -- REMOVED
            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
            AND TRIM(c2.c2_pedido) = '${pedidoTarget}' -- Strict filter by Pedido for test equality
        )
        SELECT count(*) as count FROM OPsCabecalho;
    `;

    try {
        console.time('WithJoin');
        const resJoin = await db.query(queryWithJoin);
        console.timeEnd('WithJoin');
        console.log(`Rows with Product Join: ${resJoin.rows[0].count}`);

        console.time('WithoutJoin');
        const resNoJoin = await db.query(queryWithoutJoin);
        console.timeEnd('WithoutJoin');
        console.log(`Rows without Product Join (Filtered by Pedido directly): ${resNoJoin.rows[0].count}`);

    } catch (err) {
        console.error(err);
    }
}

debugDataLoss();
