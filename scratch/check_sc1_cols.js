const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../server/.env') });
const db = require('../server/db');

async function run() {
    try {
        const sql = `
            SELECT *
            FROM v_pedidos_flat
            LIMIT 1;
        `;
        const res = await db.query(sql);
        console.log('PEDIDO FLAT SAMPLE FIELDS:', res.rows[0]);
    } catch(e) {
        // Fallback to query table directly if view doesn't exist
        try {
            const res2 = await db.query(`
                SELECT c6_num, c6_item, c6_produto, c6_entrega, c6_qtdven
                FROM sc6010
                LIMIT 1;
            `);
            console.log('SC6010 SAMPLE FIELDS:', res2.rows[0]);
        } catch(e2) {
            console.error(e2);
        }
    }
    process.exit(0);
}
run();
