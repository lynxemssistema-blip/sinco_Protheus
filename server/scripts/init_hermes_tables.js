const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

(async () => {
    try {
        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        await db.query(`
            CREATE TABLE IF NOT EXISTS app_hermes_alerts (
                id VARCHAR(100) PRIMARY KEY,
                texto TEXT,
                tipo VARCHAR(50),
                prioridade BOOLEAN DEFAULT FALSE,
                criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS app_hermes_alert_reads (
                alert_id VARCHAR(100),
                idUsuario INT,
                lido_em DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (alert_id, idUsuario)
            );
        `);

        console.log('Tabelas do Hermes criadas com sucesso!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
