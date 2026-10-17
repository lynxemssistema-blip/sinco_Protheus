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

        console.log('Checking produtos_docs schema...');
        const [columns] = await pool.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'produtos_docs'
        `, [process.env.MYSQL_DATABASE]);

        console.log('Columns:', columns.map(c => c.COLUMN_NAME));

        const [rows] = await pool.execute('SELECT * FROM produtos_docs WHERE operacao IS NOT NULL LIMIT 5');
        console.log('Rows with operacao:', rows.length);
        if (rows.length > 0) {
            console.log('Sample:', rows[0]);
        } else {
            const [allRows] = await pool.execute('SELECT * FROM produtos_docs LIMIT 1');
            console.log('Any row sample:', allRows[0]);
        }

        pool.end();
    } catch (err) {
        console.error(err);
    }
}

checkSchema();
