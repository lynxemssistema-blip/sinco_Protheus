const mysqlPool = require('../../services/mysqlService');

async function main() {
    try {
        console.log('Altering app_recursos_ocupacao_diaria to utf8mb4...');
        await mysqlPool.query(`
            ALTER TABLE app_recursos_ocupacao_diaria 
            CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);
        console.log('✅ Done altering table.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error altering table:', err);
        process.exit(1);
    }
}

main();
