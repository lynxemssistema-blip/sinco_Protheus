const mysql = require('mysql2/promise');
require('dotenv').config({path: './server/.env'});

async function run() {
    const db = await mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });

    await db.query(`
        CREATE TABLE IF NOT EXISTS sgq_romaneios (
            id INT AUTO_INCREMENT PRIMARY KEY,
            numero VARCHAR(50) NOT NULL,
            data_envio DATE NOT NULL,
            previsao_retorno DATE NOT NULL,
            status VARCHAR(50) DEFAULT 'enviado',
            observacao TEXT,
            destinatario VARCHAR(255),
            responsavel VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS sgq_romaneios_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            romaneio_id INT NOT NULL,
            asset_id INT NOT NULL,
            FOREIGN KEY (romaneio_id) REFERENCES sgq_romaneios(id) ON DELETE CASCADE,
            FOREIGN KEY (asset_id) REFERENCES sgq_assets(id) ON DELETE CASCADE
        )
    `);

    console.log('Tables created');
    process.exit(0);
}

run().catch(console.error);
