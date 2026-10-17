require('dotenv').config({ path: './.env' });
const db = require('./db');
const mysqlPool = require('./services/mysqlService');

async function check() {
    try {
        console.log('PGHOST:', process.env.PGHOST);
        
        // MySQL Planning for LASER
        const [mysqlRes] = await mysqlPool.query("SELECT op_numero, recurso_codigo, data_planejada_inicio FROM app_production_planning WHERE recurso_codigo LIKE '%LASER%' ORDER BY data_planejada_inicio DESC LIMIT 10");
        console.log('MySQL Planning (Laser):', mysqlRes);

        const pgRes = await db.query("SELECT TRIM(h1_codigo) as code, TRIM(h1_descri) as desc FROM public.sh1010 WHERE h1_descri ILIKE '%LASER%' OR h1_codigo ILIKE '%LASER%' LIMIT 5");
        console.log('Protheus Recurso (Laser):', pgRes.rows);

        // Fetch pending OPs for Laser on PG
        const pend = await db.query("SELECT c2_num, c2_item, g2_recurso FROM public.sc2010 c2 INNER JOIN public.sg2010 g2_r ON TRIM(g2_r.g2_produto) = TRIM(c2.c2_produto) WHERE g2_recurso ILIKE '%LASER%' AND c2.d_e_l_e_t_ = '' LIMIT 5");
        console.log('PG SC2010 (Laser OPs):', pend.rows);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
}
check();
