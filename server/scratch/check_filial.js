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
        console.log('--- FILIAL CHECK FOR PEDIDO 004159 ---');
        const res5 = await pool.query(
            "SELECT c5_filial, c5_num FROM sc5010 WHERE c5_num = '004159' AND COALESCE(d_e_l_e_t_, '') = ''"
        );
        res5.rows.forEach(r => {
            console.log(`SC5 Filial: [${r.c5_filial}] | Num: ${r.c5_num}`);
        });

        const res6 = await pool.query(
            "SELECT DISTINCT c6_filial FROM sc6010 WHERE c6_num = '004159' AND COALESCE(d_e_l_e_t_, '') = ''"
        );
        res6.rows.forEach(r => {
            console.log(`SC6 Filial: [${r.c6_filial}]`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
main();
