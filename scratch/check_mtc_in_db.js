require('dotenv').config({ path: '../server/.env' });
const db = require('../server/db');

async function run() {
    try {
        const res = await db.query(`
            SELECT count(*) as total, count(distinct g1_comp) as distinct_comps
            FROM public.sg1010
            WHERE d_e_l_e_t_ = ''
              AND TRIM(g1_comp) LIKE 'MTC%'
        `);
        console.log('Total sg1010 rows with MTC%:', res.rows[0]);

        const res2 = await db.query(`
            SELECT distinct TRIM(g1_comp) as comp
            FROM public.sg1010
            WHERE d_e_l_e_t_ = ''
              AND TRIM(g1_comp) LIKE 'MTC%'
            LIMIT 10
        `);
        console.log('Sample MTC% codes:', res2.rows);

        // Let's also check all raw material component prefixes in general
        const res3 = await db.query(`
            SELECT SUBSTRING(TRIM(g1_comp), 1, 4) as prefix, COUNT(*) as cnt
            FROM public.sg1010
            WHERE d_e_l_e_t_ = ''
            GROUP BY SUBSTRING(TRIM(g1_comp), 1, 4)
            ORDER BY cnt DESC
            LIMIT 20
        `);
        console.log('Most common component prefixes in sg1010:');
        console.log(res3.rows);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
