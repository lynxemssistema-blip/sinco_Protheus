const mysql = require('mysql2/promise');
require('dotenv').config();
async function run() {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE
    });
    const [rows] = await pool.query("SELECT * FROM produtos_docs WHERE produto_codigo LIKE 'MT2%'");
    console.log(rows.map(r=>r.produto_codigo));
    pool.end();
}
run();
