const mysqlPool = require('./services/mysqlService');

async function run() {
    try {
        const [rows] = await mysqlPool.query("DESCRIBE app_production_appointments");
        console.table(rows);
    } catch(err) {
        console.error(err);
    }
    process.exit(0);
}

run();
