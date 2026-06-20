require('dotenv').config({ path: '../server/.env' });
const db = require('../server/db');

async function run() {
    try {
        // Let's query all columns in sc2010 that start with c2_rec
        const colRes = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'sc2010' AND column_name LIKE 'c2_rec%'
        `);
        console.log('Columns matching c2_rec%:', colRes.rows);

        // Check if there are OPs with c2_recurso = 'MO0013' or 'MO0002'
        const res = await db.query(`
            SELECT TRIM(c2_num) as num, TRIM(c2_item) as item, TRIM(c2_produto) as produto, TRIM(c2_recurso) as c2_recurso
            FROM public.sc2010
            WHERE d_e_l_e_t_ = ''
              AND TRIM(c2_recurso) IN ('MO0013', 'MO0002')
            LIMIT 10
        `);
        console.log('Sample OPs with c2_recurso directly in sc2010:');
        console.log(res.rows);

        // Count how many OPs have c2_recurso set directly in sc2010 vs how many match via sg2010
        const counts = await db.query(`
            SELECT TRIM(c2_recurso) as recurso, COUNT(*) as cnt
            FROM public.sc2010
            WHERE d_e_l_e_t_ = ''
              AND TRIM(c2_recurso) IN ('MO0013', 'MO0002')
            GROUP BY c2_recurso
        `);
        console.log('OP counts by c2_recurso in sc2010:');
        console.log(counts.rows);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
