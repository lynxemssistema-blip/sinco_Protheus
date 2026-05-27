require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE
    });

    try {
        await pool.query('ALTER TABLE app_planning_history ADD COLUMN pedido_venda VARCHAR(20) DEFAULT NULL');
        console.log('Column pedido_venda added!');
    } catch(err) {
        console.error(err);
    }
    process.exit();
}
run();
