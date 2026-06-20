require('dotenv').config({ path: '../server/.env' });
const db = require('../server/db');

async function run() {
    try {
        // Query to check how many operations in sg2010 (Operations Route) use MO0013, MO0002, MO0031, etc.
        const res = await db.query(`
            SELECT TRIM(g2_recurso) as recurso, COUNT(*) as qtd
            FROM public.sg2010
            WHERE COALESCE(d_e_l_e_t_, '') = ''
              AND TRIM(g2_recurso) IN ('MO0013', 'MO0002', 'MO0031', 'MO0027')
            GROUP BY g2_recurso
        `);
        console.log('SG2010 resource counts:');
        console.log(res.rows);

        // Also query sc2010 (production orders) to see if we have OPs using those resources
        const res2 = await db.query(`
            SELECT TRIM(sg2.g2_recurso) as recurso, COUNT(distinct sc2.c2_num) as ops_count
            FROM public.sc2010 sc2
            JOIN public.sg2010 sg2 ON TRIM(sg2.g2_produto) = TRIM(sc2.c2_produto) AND sg2.d_e_l_e_t_ = ''
            WHERE sc2.d_e_l_e_t_ = ''
              AND TRIM(sg2.g2_recurso) IN ('MO0013', 'MO0002', 'MO0031', 'MO0027')
            GROUP BY sg2.g2_recurso
        `);
        console.log('Active OPs count by resource:');
        console.log(res2.rows);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
