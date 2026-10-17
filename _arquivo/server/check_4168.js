const mysqlService = require('./services/mysqlService');
async function run() {
    try {
        const [rows] = await mysqlService.query(`SELECT * FROM app_pcp_delivery_forecasts WHERE pedido LIKE '%4168%'`);
        console.log(rows);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
