const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });
(async () => {
    try {
        const pool = mysql.createPool({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            port: process.env.MYSQL_PORT || 3306
        });
        const [rows] = await pool.query("SELECT id, op_numero, op_item, op_sequencia, operacao_codigo, quantidade FROM app_production_appointments WHERE op_numero = '006185'");
        console.table(rows);
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();
