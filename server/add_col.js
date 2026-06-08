const mysqlPool = require('./services/mysqlService');

async function alterTable() {
    try {
        await mysqlPool.query("ALTER TABLE app_demanda_vmi ADD COLUMN prioridade_cliente VARCHAR(50) DEFAULT NULL;");
        console.log("Table altered successfully.");
    } catch (err) {
        console.error("Error altering table:", err.message);
    } finally {
        process.exit();
    }
}
alterTable();
