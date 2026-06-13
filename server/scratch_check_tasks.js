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
        const [rows] = await pool.query('SELECT id, nome, descricao, prompt_execucao, cron_expression, ativo FROM hermes_tasks');
        console.log(JSON.stringify(rows, null, 2));
    } catch(e) { console.error(e); }
    pool.end();
}
run();
