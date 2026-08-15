require('dotenv').config({ path: 'c:/Users/lynx/Documents/MetalFisa Anty/server/.env' });
const mysql = require('mysql2/promise');

async function main() {
    const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });

    try {
        console.log('--- CLEARING CORTE RELEASE BATCHES (STARTING FROM 0) ---');
        
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');
        
        const [resItens] = await conn.query('TRUNCATE TABLE app_lotes_corte_itens');
        console.log('✅ app_lotes_corte_itens truncated.');
        
        const [resLotes] = await conn.query('TRUNCATE TABLE app_lotes_corte');
        console.log('✅ app_lotes_corte truncated (auto-increment reset to 1).');
        
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        
        console.log('🎉 Truncate completed successfully!');
    } catch (e) {
        console.error('❌ Error during truncate:', e);
    } finally {
        await conn.end();
    }
}
main();
