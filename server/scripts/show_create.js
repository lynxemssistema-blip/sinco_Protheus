require('dotenv').config();
const mysql = require('mysql2/promise');
(async () => {
    try {
        const pool = mysql.createPool({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASS,
            database: process.env.MYSQL_DB
        });
        const [rows] = await pool.query("SHOW CREATE TABLE app_recursos_ocupacao_diaria");
        console.log(rows[0]['Create Table']);
        pool.end();
    } catch(e) { console.error(e); }
})();
