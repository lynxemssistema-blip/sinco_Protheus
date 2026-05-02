const mysqlPool = require('../server/services/mysqlService');
async function run() {
    try {
        const [rows] = await mysqlPool.query('SELECT id, quantidade_pcp, op_protheus FROM app_pcp_delivery_forecasts WHERE pedido="004619" AND item="50"');
        console.log(rows);
    } catch(err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
run();
