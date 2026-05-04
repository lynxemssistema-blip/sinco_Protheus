require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });
    
    try {
        await pool.query('ALTER TABLE pcp_manutencao_ordens ADD COLUMN tempo_execucao_segundos INT DEFAULT 0;');
        console.log("Column tempo_execucao_segundos added successfully");
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log("Column already exists");
        } else {
            console.error(e);
        }
    }
    process.exit(0);
}
run();
