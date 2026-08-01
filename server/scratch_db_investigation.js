require('dotenv').config();
const mysql = require('mysql2/promise');

async function check() {
    const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST, 
        user: process.env.MYSQL_USER, 
        password: process.env.MYSQL_PASS, 
        database: process.env.MYSQL_DB
    });
    
    console.log("=== GRANTS ===");
    const [rows] = await conn.query('SHOW GRANTS FOR current_user()');
    rows.forEach(r => console.log(Object.values(r)[0]));
    
    console.log("\n=== TABLES (app_*) CREATE TIME ===");
    const [tables] = await conn.query('SELECT table_name, create_time, update_time FROM information_schema.tables WHERE table_schema = ? AND table_name LIKE ?', [process.env.MYSQL_DB, 'app_%']);
    tables.forEach(t => console.log(`${t.table_name.padEnd(30)} | Created: ${t.create_time} | Updated: ${t.update_time}`));
    
    console.log("\n=== RECENT SERVER LOGS for DROP/CREATE ===");
    process.exit(0);
}
check().catch(console.error);
