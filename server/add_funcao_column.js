const mysql = require('mysql2/promise');
require('dotenv').config();

async function addFuncaoColumn() {
    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });

    try {
        console.log('Adding Funcao column to usuario table...');

        try {
            await connection.execute('ALTER TABLE usuario ADD COLUMN Funcao VARCHAR(100) AFTER Setor');
            console.log('✅ Column Funcao added.');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('⚠️ Column Funcao already exists.');
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

addFuncaoColumn();
