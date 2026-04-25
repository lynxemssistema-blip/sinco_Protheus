require('dotenv').config();
const mysqlPool = require('./services/mysqlService');
async function checkMySQL() {
    let t0 = Date.now();
    await mysqlPool.query(`SELECT * FROM app_pcp_delivery_forecasts LIMIT 1`);
    console.log('MySQL connected in', Date.now() - t0, 'ms');
    
    t0 = Date.now();
    await mysqlPool.query(`SELECT TRIM(pedido) as pedido, TRIM(item) as item FROM app_pedidos_notes WHERE pedido IN ('001421')`);
    console.log('app_pedidos_notes in', Date.now() - t0, 'ms');

    t0 = Date.now();
    await mysqlPool.query(`SELECT * FROM app_pedidos_faturamentos_saldos WHERE pedido IN ('001421')`);
    console.log('app_pedidos_faturamentos_saldos in', Date.now() - t0, 'ms');

    process.exit();
}
checkMySQL();
