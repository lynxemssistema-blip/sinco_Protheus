require('dotenv').config({ path: './.env' });
const db = require('./db');

async function check() {
    try {
        const pend = await db.query("SELECT c2_num, d_e_l_e_t_ FROM public.sc2010 WHERE c2_num IN ('006214', '001334', '004155', '005865')");
        console.log('PG SC2010:', pend.rows);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
}
check();
