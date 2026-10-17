require('dotenv').config({ path: './.env' });
const mysql = require('mysql2/promise');
(async () => {
    try {
        const pool = mysql.createPool({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
        });
        await new Promise(r => setTimeout(r, 1000));
        const [rows] = await pool.query("SELECT * FROM app_production_planning WHERE op_numero = '004663'");
        console.log('004663:', rows);
        await pool.end();
        process.exit(0);
    } catch (e) {
        console.error('MySQL Error:', e.message);
        process.exit(1);
    }
})();
