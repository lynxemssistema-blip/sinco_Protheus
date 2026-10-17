const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB
};

async function updateSchema() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Conectado ao MySQL!');

        // 1. Add usuario to app_romaneios
        try {
            await connection.execute(`
                ALTER TABLE app_romaneios 
                ADD COLUMN usuario VARCHAR(100) DEFAULT 'Sistema';
            `);
            console.log('Coluna usuario adicionada em app_romaneios.');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('Coluna usuario já existe em app_romaneios.');
            } else {
                console.error(err.message);
            }
        }

        // 2. Add usuario to app_romaneio_revisions
        try {
            await connection.execute(`
                ALTER TABLE app_romaneio_revisions 
                ADD COLUMN usuario VARCHAR(100) DEFAULT 'Sistema';
            `);
            console.log('Coluna usuario adicionada em app_romaneio_revisions.');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('Coluna usuario já existe em app_romaneio_revisions.');
            } else {
                console.error(err.message);
            }
        }

    } catch (error) {
        console.error('Erro:', error);
    } finally {
        if (connection) await connection.end();
    }
}

updateSchema();
