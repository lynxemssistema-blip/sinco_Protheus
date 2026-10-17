const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });
const mysqlPool = require('./server/services/mysqlService');

async function run() {
    try {
        const [rows] = await mysqlPool.query("SELECT id, op_numero, op_item, op_sequencia, operacao_codigo FROM app_production_planning WHERE op_numero = '005795' AND op_item = '01'");
        console.table(rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
