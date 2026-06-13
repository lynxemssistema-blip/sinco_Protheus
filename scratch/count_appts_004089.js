const mysqlPool = require('c:/Users/adm/Desktop/MetalFisa Anty/server/services/mysqlService');

async function run() {
    try {
        console.log("=== COUNTING APPOINTMENTS FOR ORDER 004089 / OPs ===");

        const opList = ['006169', '004089'];
        const placeholders = opList.map(() => '?').join(',');

        // Total count
        const [totalRows] = await mysqlPool.query(
            `SELECT COUNT(*) as cnt FROM app_production_appointments WHERE op_numero IN (${placeholders})`,
            opList
        );
        console.log(`Total appointments in table: ${totalRows[0].cnt}`);

        // Group by operacao_codigo (resource)
        const [groupedRows] = await mysqlPool.query(
            `SELECT operacao_codigo, COUNT(*) as cnt, SUM(quantidade) as total_qty 
             FROM app_production_appointments 
             WHERE op_numero IN (${placeholders})
             GROUP BY operacao_codigo`,
            opList
        );
        console.log("Grouped by operacao_codigo / resource:");
        console.table(groupedRows);

    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

run();
