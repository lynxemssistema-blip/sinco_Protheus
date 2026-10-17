const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSchema() {
    try {
        const pool = mysql.createPool({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE
        });

        console.log('Checking romaneio_items schema...');
        const [columns] = await pool.execute(`
            SELECT COLUMN_NAME, DATA_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'romaneio_items'
        `, [process.env.MYSQL_DATABASE]);

        console.log('Columns:', columns.map(c => `${c.COLUMN_NAME} (${c.DATA_TYPE})`));
        pool.end();
    } catch (err) {
        console.error(err);
    }
}

checkSchema();
