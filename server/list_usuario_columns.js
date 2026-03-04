const mysql = require('mysql2/promise');
require('dotenv').config();

async function listColumns() {
    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });

    try {
        const [rows] = await connection.execute('SHOW COLUMNS FROM usuario');
        console.table(rows);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

listColumns();
