require('dotenv').config({ path: '../server/.env' });
const db = require('../server/db');

async function run() {
    try {
        // Query to find components (g1_comp) in sg1010 for products that have laser/punching operations,
        // and see what prefix they have.
        const res = await db.query(`
            SELECT DISTINCT TRIM(g1.g1_comp) as component_code
            FROM public.sg1010 g1
            JOIN public.sg2010 sg2 ON TRIM(sg2.g2_produto) = TRIM(g1.g1_cod) AND sg2.d_e_l_e_t_ = ''
            WHERE g1.d_e_l_e_t_ = ''
              AND TRIM(sg2.g2_recurso) IN ('MO0013', 'MO0002')
            LIMIT 50
        `);
        console.log('Material codes for laser/punching parts:');
        console.log(res.rows.map(r => r.component_code));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
