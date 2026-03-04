const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixFuncaoColumn() {
    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });

    try {
        console.log('--- STARTING FIX ---');

        // 1. Check if it exists
        const [columns] = await connection.execute("SHOW COLUMNS FROM usuario LIKE 'Funcao'");
        if (columns.length > 0) {
            console.log('⚠️ Column Funcao ALREADY EXISTS. Skipping add.');
        } else {
            console.log('🔴 Column Funcao MISSING. Attempting to add...');
            try {
                await connection.execute('ALTER TABLE usuario ADD COLUMN Funcao VARCHAR(100)');
                console.log('✅ ALTER TABLE executed successfully.');
            } catch (err) {
                console.error('❌ Error executing ALTER TABLE:', err.message);
            }
        }

        // 2. Verify again
        const [verify] = await connection.execute("SHOW COLUMNS FROM usuario LIKE 'Funcao'");
        if (verify.length > 0) {
            console.log('✅ VERIFICATION PASSED: Column Funcao exists.');
            console.table(verify);
        } else {
            console.error('❌ VERIFICATION FAILED: Column Funcao still missing!');
        }

    } catch (error) {
        console.error('Global Error:', error);
    } finally {
        await connection.end();
        console.log('--- FINISHED ---');
    }
}

fixFuncaoColumn();
