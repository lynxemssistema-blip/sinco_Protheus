const mysqlPool = require('./services/mysqlService');

async function createTables() {
    try {
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_lotes_corte (
                id INT AUTO_INCREMENT PRIMARY KEY,
                numero_lote VARCHAR(50) NOT NULL,
                recurso VARCHAR(20) NOT NULL,
                material_codigo VARCHAR(100),
                material_descricao VARCHAR(255),
                data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
                usuario VARCHAR(100),
                status VARCHAR(50) DEFAULT 'Aguardando',
                observacao TEXT
            );
        `);
        
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_lotes_corte_itens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                lote_corte_id INT NOT NULL,
                pedido_pai VARCHAR(50) NOT NULL,
                item_pai VARCHAR(50) NOT NULL,
                produto_pai VARCHAR(100) NOT NULL,
                componente VARCHAR(100) NOT NULL,
                componente_descricao VARCHAR(255),
                qtd_necessaria DECIMAL(18,6) NOT NULL,
                status VARCHAR(50) DEFAULT 'Pendente',
                FOREIGN KEY (lote_corte_id) REFERENCES app_lotes_corte(id) ON DELETE CASCADE
            );
        `);

        // Alter table if it already exists to add status column
        try {
            await mysqlPool.query(`ALTER TABLE app_lotes_corte_itens ADD COLUMN status VARCHAR(50) DEFAULT 'Pendente'`);
            console.log("Coluna 'status' adicionada a app_lotes_corte_itens.");
        } catch(err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log("Coluna 'status' já existe em app_lotes_corte_itens.");
            } else {
                console.error("Erro ao adicionar coluna 'status':", err.message);
            }
        }
        
        
        console.log("Tabelas criadas com sucesso!");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

createTables();
