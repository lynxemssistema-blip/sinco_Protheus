require('dotenv').config({ path: './.env' });
const mysqlPool = require('./services/mysqlService');

async function check() {
    try {
        const [mysqlRes] = await mysqlPool.query("SELECT op_numero, recurso_codigo, data_planejada_inicio FROM app_production_planning WHERE recurso_codigo = 'MO0013' ORDER BY data_planejada_inicio DESC LIMIT 10");
        console.log('MySQL Planning (Laser MO0013):', mysqlRes);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
}
check();
