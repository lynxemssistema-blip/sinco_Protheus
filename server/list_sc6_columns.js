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
        console.log('--- COLUMNS OF SC6010 ---');
        const [columns] = await connection.execute("SHOW COLUMNS FROM sc6010");
        columns.forEach(col => {
            console.log(`${col.Field} (${col.Type})`);
        });
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

listColumns();
