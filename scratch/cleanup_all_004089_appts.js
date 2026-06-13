const mysqlPool = require('c:/Users/adm/Desktop/MetalFisa Anty/server/services/mysqlService');

async function run() {
    let connection;
    try {
        console.log("=== EXECUTING TOTAL CLEANUP FOR ORDER 004089 (ALL RESOURCES) ===");
        
        connection = await mysqlPool.getConnection();
        
        // Start transaction
        await connection.beginTransaction();
        console.log("Transaction started...");

        const opList = ['006169', '004089'];
        const placeholders = opList.map(() => '?').join(',');

        // 1. Fetch the IDs of all appointments to be deleted
        const [apptsToPurge] = await connection.query(
            `SELECT id, op_numero, op_item, op_sequencia, operacao_codigo, quantidade 
             FROM app_production_appointments 
             WHERE op_numero IN (${placeholders})`,
            opList
        );

        const targetCount = apptsToPurge.length;
        console.log(`Found ${targetCount} appointments to delete.`);

        if (targetCount === 0) {
            console.log("No appointments found to delete. Rolling back transaction.");
            await connection.rollback();
            process.exit(0);
        }

        const idsToDelete = apptsToPurge.map(r => r.id);

        // 2. Perform the deletion
        const [deleteResult] = await connection.query(
            "DELETE FROM app_production_appointments WHERE id IN (?)",
            [idsToDelete]
        );
        console.log(`Deleted rows count from database: ${deleteResult.affectedRows} (Expected: ${targetCount})`);

        if (deleteResult.affectedRows !== targetCount) {
            throw new Error(`Mismatch in deleted rows count! Expected ${targetCount}, but deleted ${deleteResult.affectedRows}`);
        }

        // 3. Commit transaction
        await connection.commit();
        console.log("Transaction committed successfully!");

        // 4. Verify count after deleting
        const [afterRows] = await connection.query(
            `SELECT COUNT(*) as cnt FROM app_production_appointments WHERE op_numero IN (${placeholders})`,
            opList
        );
        console.log(`Appointments remaining in DB for these OPs: ${afterRows[0].cnt} (Expected: 0)`);

    } catch (err) {
        console.error("Error during total cleanup transaction, rolling back...", err);
        if (connection) {
            await connection.rollback();
        }
    } finally {
        if (connection) {
            connection.release();
        }
    }
    process.exit(0);
}

run();
