const db = require('./server/services/mysqlService');

async function createTables() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS app_wabtec_lotes (
                lote_id INT AUTO_INCREMENT PRIMARY KEY,
                nome_arquivo VARCHAR(255) NOT NULL,
                criado_por VARCHAR(100) DEFAULT 'Sistema',
                data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Table app_wabtec_lotes created.");

        await db.query(`
            CREATE TABLE IF NOT EXISTS app_wabtec_estruturas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                lote_id INT,
                nivel VARCHAR(50),
                desenho_cliente VARCHAR(100),
                rev_cliente_raw VARCHAR(50),
                rev_convertida VARCHAR(50),
                titulo VARCHAR(255),
                qtd DECIMAL(10,4),
                FOREIGN KEY (lote_id) REFERENCES app_wabtec_lotes(lote_id) ON DELETE CASCADE
            );
        `);
        console.log("Table app_wabtec_estruturas created.");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

createTables();
