require('dotenv').config({ path: './.env' });
const mysqlPool = require('./services/mysqlService');

async function check() {
    try {
        const [aRows] = await mysqlPool.query("SELECT op_numero, operacao_codigo, SUM(quantidade) as total_produzido FROM app_production_appointments WHERE op_numero IN ('006214', '001334', '004155', '005865') GROUP BY op_numero, operacao_codigo");
        console.log('Appointments:', aRows);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
}
check();
