require('dotenv').config();
const mysql = require('mysql2/promise');

async function check() {
    const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });
    const [tables] = await conn.execute("SHOW TABLES");
    const priorityTables = tables.filter(t => Object.values(t)[0].toLowerCase().includes('prior') || Object.values(t)[0].toLowerCase().includes('op'));
    console.log(priorityTables.map(t => Object.values(t)[0]));
    conn.end();
}
check();
