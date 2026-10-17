require('dotenv').config();
const db = require('./db');
async function test() {
    console.log('Creating index...');
    await db.query(`
        CREATE INDEX IF NOT EXISTS idx_sc2010_obs_pedido_fast 
        ON public.sc2010 (SUBSTRING(c2_obs FROM 1 FOR 6)) 
        WHERE TRIM(COALESCE(c2_pedido, '')) = '';
    `);
    console.log('Index created.');
    
    const t1 = Date.now();
    const sql2 = `
        SELECT COUNT(*) as total
        FROM public.sc5010 c5
        JOIN public.sc6010 c6 ON c6.c6_num = c5.c5_num AND c6.c6_filial = c5.c5_filial AND COALESCE(c6.d_e_l_e_t_, '') = ''
        LEFT JOIN public.sc2010 c2
            ON c2.c2_pedido = c5.c5_num
            AND c2.c2_itempv = c6.c6_item
            AND COALESCE(c2.d_e_l_e_t_, '') = ''
        LEFT JOIN public.sc2010 c2_fallback
            ON c2_fallback.c2_itempv = c6.c6_item
            AND TRIM(COALESCE(c2_fallback.c2_pedido, '')) = ''
            AND SUBSTRING(c2_fallback.c2_obs FROM 1 FOR 6) = c5.c5_num
            AND COALESCE(c2_fallback.d_e_l_e_t_, '') = ''
        WHERE COALESCE(c5.d_e_l_e_t_, '') = '' AND c5.c5_tipo <> 'B'
        AND ((c6.c6_qtdven - c6.c6_qtdent) > 0 OR c6.c6_qtdlib > 0)
    `;
    const res2 = await db.query(sql2);
    console.log('Com index e split joins:', Date.now() - t1, 'ms', res2.rows);
    process.exit();
}
test();
