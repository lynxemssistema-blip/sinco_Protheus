const db = require('./db');
const mysqlPool = require('./services/mysqlService');

async function run() {
    try {
        console.log("=== APP APPOINTMENTS FOR OP 006252 SEQ 001 ===");
        const [mysqlRows] = await mysqlPool.query(
            "SELECT id, op_numero, op_item, op_sequencia, operacao_codigo, quantidade, conferencia_status FROM app_production_appointments WHERE op_numero = '006252' AND op_sequencia = '001'"
        );
        console.log("MySQL Rows (seq 001):", mysqlRows);

        console.log("\n=== ALL APP APPOINTMENTS FOR OP 006252 GROUPED BY SEQ ===");
        const [groupedRows] = await mysqlPool.query(
            "SELECT op_sequencia, COUNT(*) as count, SUM(quantidade) as total_qty FROM app_production_appointments WHERE op_numero = '006252' GROUP BY op_sequencia"
        );
        console.log("Grouped Rows:", groupedRows);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

run();
