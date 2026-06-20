require('dotenv').config({ path: '../server/.env' });
const db = require('../server/db');

async function run() {
    try {
        const res = await db.query(`
            SELECT TRIM(c2_num) as num, TRIM(c2_item) as item, TRIM(c2_sequen) as sequen, TRIM(c2_produto) as produto, TRIM(c2_seqpai) as seqpai
            FROM public.sc2010
            WHERE d_e_l_e_t_ = '' AND TRIM(c2_seqpai) != ''
            LIMIT 20
        `);
        console.log('Ops with c2_seqpai:');
        console.log(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
