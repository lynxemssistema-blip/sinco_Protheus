const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDb() {
    try {
        const pool = mysql.createPool({
            host: process.env.MYSQL_HOST || 'localhost',
            user: process.env.MYSQL_USER || 'root',
            password: process.env.MYSQL_PASSWORD || '',
            database: process.env.MYSQL_DATABASE || 'metalfisa_pcp',
            port: process.env.MYSQL_PORT || 3306
        });
        const [rows] = await pool.query("SELECT * FROM app_op_priorities WHERE op_numero LIKE '006609%' OR op_numero LIKE '005329%'");
        console.log('Priorities found:', rows);
        process.exit(0);
    } catch(e) {
        console.error('Error connecting to MySQL', e);
        process.exit(1);
    }
}
checkDb();
