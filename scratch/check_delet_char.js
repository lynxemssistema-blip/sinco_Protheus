require('dotenv').config({ path: '../server/.env' });
const db = require('../server/db');

async function run() {
    try {
        const sg2 = await db.query(`SELECT DISTINCT d_e_l_e_t_, LENGTH(d_e_l_e_t_) FROM public.sg2010 LIMIT 5`);
        console.log('sg2010 d_e_l_e_t_ values:', sg2.rows);

        const sc2 = await db.query(`SELECT DISTINCT d_e_l_e_t_, LENGTH(d_e_l_e_t_) FROM public.sc2010 LIMIT 5`);
        console.log('sc2010 d_e_l_e_t_ values:', sc2.rows);

        const sb1 = await db.query(`SELECT DISTINCT d_e_l_e_t_, LENGTH(d_e_l_e_t_) FROM public.sb1010 LIMIT 5`);
        console.log('sb1010 d_e_l_e_t_ values:', sb1.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
