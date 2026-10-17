const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkUsuarioSchema() {
    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });

    const [rows] = await connection.execute('DESCRIBE usuario');
    console.log('Usuario Table Schema:');
    console.table(rows);
    await connection.end();
}

checkUsuarioSchema();
