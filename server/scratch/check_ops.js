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
        console.log('--- SC2010 OPS FOR PEDIDO 004159 ---');
        const res = await pool.query(
            "SELECT TRIM(c2_itempv) as item, TRIM(c2_num) as op, TRIM(c2_sequen) as seq FROM sc2010 WHERE TRIM(c2_pedido) = '004159' AND COALESCE(d_e_l_e_t_, '') = '' ORDER BY c2_itempv, c2_sequen"
        );
        console.log('Total OPs found:', res.rows.length);
        res.rows.forEach(r => {
            console.log(`Itempv: ${r.item} | OP: ${r.op} | Seq: ${r.seq}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
main();
