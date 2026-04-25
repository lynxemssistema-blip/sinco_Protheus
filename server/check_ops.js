require('dotenv').config();
const db = require('./db');
async function test() {
    const t0 = Date.now();
    const sql = `
        SELECT COUNT(*) as total
        FROM public.sc5010 c5
        JOIN public.sc6010 c6 ON c6.c6_num = c5.c5_num AND c6.c6_filial = c5.c5_filial AND COALESCE(c6.d_e_l_e_t_, '') = ''
        LEFT JOIN public.sc2010 c2
            ON (c2.c2_pedido = c5.c5_num OR (TRIM(COALESCE(c2.c2_pedido, '')) = '' AND SUBSTRING(c2.c2_obs FROM 1 FOR 6) = c5.c5_num))
            AND c2.c2_itempv = c6.c6_item
            AND COALESCE(c2.d_e_l_e_t_, '') = ''
        WHERE COALESCE(c5.d_e_l_e_t_, '') = '' AND c5.c5_tipo <> 'B'
        AND ((c6.c6_qtdven - c6.c6_qtdent) > 0 OR c6.c6_qtdlib > 0)
    `;
    const res = await db.query(sql);
    console.log('Com LEFT JOIN c2 + SUBSTRING:', Date.now() - t0, 'ms', res.rows);
    process.exit();
}
test();
