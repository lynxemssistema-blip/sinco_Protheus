const mysqlPool = require('./services/mysqlService');

async function run() {
    try {
        await mysqlPool.query('ALTER TABLE app_planning_history ADD COLUMN pedido_venda VARCHAR(20) DEFAULT NULL');
        console.log('Column pedido_venda added!');
    } catch(err) {
        console.error(err);
    }
    process.exit();
}
run();
