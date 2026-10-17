require('dotenv').config();
require('dotenv').config({ path: __dirname + '/.env' });
const mysql = require('mysql2/promise');

async function run() {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST || '192.168.1.77',
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD || 'metalfisa2022',
        database: process.env.MYSQL_DATABASE || 'metalfis_aplicativos',
        waitForConnections: true,
        connectionLimit: 5
    });

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_pcp_lotes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                lote_ref VARCHAR(50) NOT NULL UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_by VARCHAR(100),
                status VARCHAR(20) DEFAULT 'ABERTO',
                observacao TEXT
            );
        `);
        console.log('Tabela app_pcp_lotes verificada/criada.');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_pcp_lote_itens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                lote_id INT NOT NULL,
                pedido VARCHAR(20) NOT NULL,
                item VARCHAR(10) NOT NULL,
                codigo VARCHAR(50),
                qtd_liberada DECIMAL(18,4),
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (lote_id) REFERENCES app_pcp_lotes(id) ON DELETE CASCADE
            );
        `);
        console.log('Tabela app_pcp_lote_itens verificada/criada.');
    } catch(e) {
        console.error('Erro na criação:', e.message);
    } finally {
        await pool.end();
    }
}

run();
