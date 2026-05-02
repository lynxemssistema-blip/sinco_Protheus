require('dotenv').config();
const pgDb = require('./db');

async function checkPG() {
    try {
        const query = "SELECT c2_num, c2_pedido, c2_itempv FROM public.sc2010 WHERE c2_pedido='004619' AND c2_itempv='50' AND COALESCE(d_e_l_e_t_, '')=''";
        const res = await pgDb.query(query);
        console.log("PG OP:", res.rows);
    } catch(e){ console.error(e); }
    process.exit(0);
}
checkPG();
