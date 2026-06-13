const mysqlPool = require('c:/Users/adm/Desktop/MetalFisa Anty/server/services/mysqlService');

async function run() {
    try {
        console.log("=== CHECKING ALL DISTINCT OPS IN APPOINTMENTS ===");
        const query = `
            SELECT DISTINCT op_numero 
            FROM app_production_appointments 
            WHERE op_numero LIKE '006169%' OR op_numero LIKE '004089%'
        `;
        const [rows] = await mysqlPool.query(query);
        console.log("Distinct OPs found in app_production_appointments:");
        console.log(rows);
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

run();
