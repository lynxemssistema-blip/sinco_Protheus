require('dotenv').config();
const db = require('./db');
async function run() {
    const sql = `
        SELECT COUNT(DISTINCT TRIM(c5.c5_num)) as qtd
        FROM public.sc5010 c5
        WHERE COALESCE(c5.d_e_l_e_t_, '') = '' 
          AND c5.c5_tipo <> 'B'
          AND EXISTS (
              SELECT 1 FROM public.sc6010 c6 WHERE c6.c6_num = c5.c5_num AND c6.c6_filial = c5.c5_filial AND COALESCE(c6.d_e_l_e_t_, '') = ''
          )
          AND NOT EXISTS (
              SELECT 1 FROM public.sc6010 c6 
              WHERE c6.c6_num = c5.c5_num 
                AND c6.c6_filial = c5.c5_filial 
                AND COALESCE(c6.d_e_l_e_t_, '') = ''
                AND (TRIM(c6.c6_entreg) > '20251231' OR TRIM(c6.c6_entreg) = '')
          )
    `;
    const res = await db.query(sql);
    console.log('Orders with ALL items delivered in <= 2025:', res.rows[0].qtd);
    process.exit();
}
run();
