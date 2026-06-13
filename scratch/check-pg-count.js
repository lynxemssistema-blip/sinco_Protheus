const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const db = require('../server/db');

async function checkPgCount() {
    let client;
    try {
        client = await db.connect();
        const pgResult = await client.query(`
            SELECT COUNT(*) AS count
            FROM public.sc2010 c2
            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
              AND c2.c2_quje < c2.c2_quant
              AND TRIM(c2.c2_num) <> ''
              AND COALESCE(TRIM(c2.c2_pedido), '') <> ''
              AND TRIM(c2.c2_itempv) <> ''
        `);
        console.log('Postgres open OPs count:', pgResult.rows[0].count);
    } catch (err) {
        console.error(err);
    } finally {
        if (client) client.release();
        process.exit(0);
    }
}
checkPgCount();
