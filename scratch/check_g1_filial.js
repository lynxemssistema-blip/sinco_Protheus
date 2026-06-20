require('dotenv').config({ path: '../server/.env' });
const db = require('../server/db');

async function run() {
    try {
        const res = await db.query(`
            SELECT DISTINCT g1_filial, LENGTH(g1_filial)
            FROM public.sg1010
            WHERE d_e_l_e_t_ = ''
            LIMIT 10
        `);
        console.log('sg1010 g1_filial values:');
        console.log(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
