const mysql = require('mysql2/promise');
require('dotenv').config();

async function addColumns() {
    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });

    try {
        console.log('Adding columns to usuario table...');

        // Add Observacoes
        try {
            await connection.execute('ALTER TABLE usuario ADD COLUMN Observacoes TEXT');
            console.log('✅ Column Observacoes added.');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('⚠️ Column Observacoes already exists.');
            } else {
                throw err;
            }
        }

        // Add TemPC
        try {
            await connection.execute('ALTER TABLE usuario ADD COLUMN TemPC TINYINT(1) DEFAULT 0');
            console.log('✅ Column TemPC added.');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('⚠️ Column TemPC already exists.');
            } else {
                throw err;
            }
        }

    } catch (error) {
        console.error('Error modifying table:', error);
    } finally {
        await connection.end();
    }
}

addColumns();
