const mysqlPool = require('../services/mysqlService');

async function setupDb() {
    try {
        const sql = `
            CREATE TABLE IF NOT EXISTS app_demanda_vmi (
                id INT AUTO_INCREMENT PRIMARY KEY,
                lote_importacao VARCHAR(50) NOT NULL,
                ordem_compra_cliente VARCHAR(100),
                produto_pai VARCHAR(100),
                produto_pai_desc VARCHAR(255),
                codigo_produto_cliente VARCHAR(100),
                descricao_produto_cliente VARCHAR(255),
                mes_referencia VARCHAR(50),
                quantidade DECIMAL(18,4) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ordem (ordem_compra_cliente),
                INDEX idx_codigo (codigo_produto_cliente)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;
        await mysqlPool.query(sql);
        console.log('Tabela app_demanda_vmi criada com sucesso.');
    } catch (err) {
        console.error('Erro ao criar tabela:', err);
    } finally {
        process.exit(0);
    }
}

setupDb();
