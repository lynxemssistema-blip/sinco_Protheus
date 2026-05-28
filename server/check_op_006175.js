require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool();

async function run() {
    try {
        const orderRes = await pool.query(`SELECT TRIM(c5_num) as num FROM sc5010 WHERE TRIM(c5_num)='006175' AND COALESCE(d_e_l_e_t_, '') IN ('', ' ')`);
        console.log('Order 006175 in sc5010:', orderRes.rows);
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}
run();
