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
        const [rows] = await pool.query("SELECT * FROM usuario WHERE idUsuario = 34");
        console.log('User 34:', rows);
        pool.end();
    } catch(e) { console.error(e); }
})();
