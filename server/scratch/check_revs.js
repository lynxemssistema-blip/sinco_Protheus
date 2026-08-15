require('dotenv').config({ path: 'c:/Users/lynx/Documents/MetalFisa Anty/server/.env' });
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

async function main() {
    try {
        console.log('--- REVISIONS FOR ITEMS 13 AND 16 ---');
        const res = await pool.query(
            "SELECT c6_item, c6_produto, c6_xrevm, c6_xrevc FROM sc6010 WHERE c6_num = '004159' AND c6_item IN ('13', '16') AND COALESCE(d_e_l_e_t_, '') = ''"
        );
        res.rows.forEach(r => {
            console.log(`Item: ${r.c6_item} | Prod: ${r.c6_produto} | RevM: [${r.c6_xrevm}] | RevC: [${r.c6_xrevc}]`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
main();
