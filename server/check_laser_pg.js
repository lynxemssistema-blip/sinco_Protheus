require('dotenv').config({ path: './.env' });
const db = require('./db');

async function check() {
    try {
        const pend = await db.query("SELECT TRIM(c2.c2_num) as op, TRIM(c2.c2_item) as item, TRIM(g2.g2_recurso) as recurso FROM public.sc2010 c2 INNER JOIN public.sg2010 g2 ON TRIM(g2.g2_produto) = TRIM(c2.c2_produto) WHERE g2.g2_recurso IN ('MO0013', 'MO0031') AND COALESCE(c2.d_e_l_e_t_, '') = '' LIMIT 10");
        console.log('PG SC2010 (Laser OPs using MO0013/MO0031):', pend.rows);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
}
check();
