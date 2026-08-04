const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const mysqlPool = require('../server/services/mysqlService');

async function check() {
    try {
        console.log('--- Querying app_pcp_delivery_forecasts table ---');
        const [rows] = await mysqlPool.query(
            "SELECT id, pedido, item, data_entrega_pcp, quantidade_pcp, op_protheus FROM app_pcp_delivery_forecasts ORDER BY id DESC LIMIT 20"
        );
        console.log(rows);
    } catch(e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
check();
