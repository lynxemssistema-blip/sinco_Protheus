require('dotenv').config({ path: '../server/.env' });
const db = require('../server/db');

async function run() {
    try {
        const res = await db.query(`
            SELECT TRIM(h1_codigo) as code, TRIM(h1_descri) as desc 
            FROM public.sh1010 
            WHERE COALESCE(d_e_l_e_t_, '') = ''
            ORDER BY code
        `);
        console.log('All Protheus Resources:');
        console.log(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
