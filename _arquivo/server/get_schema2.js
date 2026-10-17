const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

async function getDesc() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'metalfisa',
  });
  const [rows] = await connection.execute('DESCRIBE pcp_programas_liberados');
  console.log(rows);
  await connection.end();
}
getDesc().catch(console.error);
