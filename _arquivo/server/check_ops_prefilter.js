require('dotenv').config();
const db = require('./db');
async function test() {
    const t0 = Date.now();
    const sql = `
        WITH orphan_ops AS (
            SELECT c2_itempv, c2_num, c2_item, c2_sequen, c2_quant, c2_obs, SUBSTRING(c2_obs, 1, 6) as pedido
            FROM public.sc2010
            WHERE TRIM(COALESCE(c2_pedido, '')) = '' 
              AND c2_obs ~ '^[0-9]{6}'
              AND COALESCE(d_e_l_e_t_, '') = ''
        )
        SELECT COUNT(*) as total
        FROM public.sc5010 c5
        JOIN public.sc6010 c6 ON c6.c6_num = c5.c5_num AND c6.c6_filial = c5.c5_filial AND COALESCE(c6.d_e_l_e_t_, '') = ''
        LEFT JOIN public.sc2010 c2
            ON c2.c2_pedido = c5.c5_num
            AND c2.c2_itempv = c6.c6_item
            AND COALESCE(c2.d_e_l_e_t_, '') = ''
        LEFT JOIN orphan_ops c2_fallback
            ON c2_fallback.pedido = c5.c5_num
            AND c2_fallback.c2_itempv = c6.c6_item
        WHERE COALESCE(c5.d_e_l_e_t_, '') = '' AND c5.c5_tipo <> 'B'
        AND ((c6.c6_qtdven - c6.c6_qtdent) > 0 OR c6.c6_qtdlib > 0)
    `;
    const res = await db.query(sql);
    console.log('Com pre-filter CTE:', Date.now() - t0, 'ms', res.rows);
    process.exit();
}
test();
