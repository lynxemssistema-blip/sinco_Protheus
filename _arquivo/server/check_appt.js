const p = require('./services/mysqlService');
async function run() {
    const [rows] = await p.query("SELECT * FROM app_production_appointments WHERE op_numero='002730'");
    console.table(rows.filter(r => r.op_item === '07'));
    process.exit(0);
}
run();
