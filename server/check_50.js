require('dotenv').config();
const mysqlPool = require('./services/mysqlService');

async function check() {
    try {
        const [rows] = await mysqlPool.query("SELECT id, pedido, item, op_protheus FROM app_pcp_delivery_forecasts WHERE pedido='004619' AND item='50'");
        console.log("ITEM 50 RESULTADO:", rows);
    } catch (e) { console.error(e); }
    process.exit(0);
}
check();
