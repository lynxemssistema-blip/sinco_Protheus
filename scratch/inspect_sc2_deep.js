require('dotenv').config({ path: '../server/.env' });
const db = require('../server/db');

async function run() {
    try {
        console.log("=== OPs in sc2010 for c2_pedido = '004830' ===");
        const res1 = await db.query(`
            SELECT TRIM(c2_num) as num, TRIM(c2_item) as item, TRIM(c2_sequen) as sequen, TRIM(c2_seqpai) as seqpai, TRIM(c2_produto) as produto, TRIM(c2_pedido) as pedido, TRIM(c2_itempv) as itempv
            FROM sc2010
            WHERE c2_pedido = '004830' AND d_e_l_e_t_ = ''
            ORDER BY c2_num, c2_item, c2_sequen
        `);
        console.table(res1.rows);

        console.log("\n=== OPs in sc2010 for c2_num = '006372' ===");
        const res2 = await db.query(`
            SELECT TRIM(c2_num) as num, TRIM(c2_item) as item, TRIM(c2_sequen) as sequen, TRIM(c2_seqpai) as seqpai, TRIM(c2_produto) as produto, TRIM(c2_pedido) as pedido, TRIM(c2_itempv) as itempv
            FROM sc2010
            WHERE c2_num = '006372' AND d_e_l_e_t_ = ''
            ORDER BY c2_num, c2_item, c2_sequen
        `);
        console.table(res2.rows);

    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
run();
