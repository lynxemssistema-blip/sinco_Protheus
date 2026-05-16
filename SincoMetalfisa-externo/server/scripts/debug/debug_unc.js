require('dotenv').config();
const pool = require('./db');

async function run() {
    try {
        const anyRes = await pool.query(
            "SELECT b1_cod, b1_desc, d_e_l_e_t_ FROM sb1010 WHERE b1_cod ILIKE '%MT2-2382%'"
        );
        console.log('Postgres:', anyRes.rows);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
