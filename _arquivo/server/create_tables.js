const pool = require('./services/mysqlService');

async function run() {
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
        process.exit(0);
    }
}

run();
