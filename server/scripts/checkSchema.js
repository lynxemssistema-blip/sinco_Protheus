const mysql = require('mysql2/promise');
require('dotenv').config({path: '../../.env'});

async function run() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'metalfisa'
    });
    const [rows] = await conn.execute('DESCRIBE app_pcp_pedidos_itens');
    console.table(rows);
    await conn.end();
}
run().catch(console.error);
