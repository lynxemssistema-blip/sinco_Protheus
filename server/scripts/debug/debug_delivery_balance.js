
const db = require('./db');
require('dotenv').config();

async function debugDeliveryBalance() {
    console.log('🔍 Testing Delivery Balance SQL...');

    // User's query with a generic filter (or specific one if needed)
    // Changing like '%2730%' to a limit for safety if no specific order is known, 
    // but the user's example had '%2730%'. I'll use a LIMIT 5 to see structure.

    const query = `
        SELECT
            c6.c6_filial,
            c6.c6_num         AS pedido,
            c6.c6_item        AS item,
            c6.c6_produto     AS produto,
            c6.c6_qtdven      AS qtd_pedido,

            COALESCE(SUM(d2.d2_quant), 0) AS qtd_entregue,

            c6.c6_qtdven - COALESCE(SUM(d2.d2_quant), 0) AS saldo_a_entregar
        FROM public.sc6010 c6
        LEFT JOIN public.sd2010 d2
            ON d2.d2_filial = c6.c6_filial
            AND d2.d2_pedido = c6.c6_num
            AND d2.d2_itempv = c6.c6_item
            AND d2.d_e_l_e_t_ = ' '
            -- AND d2.d2_tipo = 'N' -- Uncomment if needed based on business logic
        WHERE c6.d_e_l_e_t_ = ' '
        GROUP BY
            c6.c6_filial,
            c6.c6_num,
            c6.c6_item,
            c6.c6_produto,
            c6.c6_qtdven
        ORDER BY
            c6.c6_num DESC,
            c6.c6_item
        LIMIT 10;
    `;

    try {
        const res = await db.query(query);
        console.table(res.rows);
    } catch (err) {
        console.error('❌ Query Failed:', err);
    }
}

debugDeliveryBalance();
