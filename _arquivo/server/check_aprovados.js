require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkRows() {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });

    try {
        const [rows] = await pool.execute('SELECT COUNT(*) as Qtd, aprovado FROM usuario GROUP BY aprovado;');
        console.log(rows);
    } catch(e) {
        console.log(e.message);
    }
    process.exit();
}

checkRows();
