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

        // 1. Add revision column to app_romaneios if not exists
        try {
            await connection.execute(`
                ALTER TABLE app_romaneios 
                ADD COLUMN current_revision INT DEFAULT 1;
            `);
            console.log('Coluna current_revision adicionada em app_romaneios.');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('Coluna current_revision já existe.');
            } else {
                throw err;
            }
        }

        // 2. Create app_romaneio_revisions table
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS app_romaneio_revisions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                romaneio_id INT NOT NULL,
                revision_number INT NOT NULL,
                snapshot_data TEXT NOT NULL, -- JSON string
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reason TEXT,
                FOREIGN KEY (romaneio_id) REFERENCES app_romaneios(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);
        console.log('Tabela app_romaneio_revisions verificada/criada.');

    } catch (error) {
        console.error('Erro:', error);
    } finally {
        if (connection) await connection.end();
    }
}

updateSchema();
