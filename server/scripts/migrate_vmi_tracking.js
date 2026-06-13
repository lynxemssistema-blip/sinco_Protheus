const pool = require('../services/mysqlService');

async function migrate() {
    try {
        console.log('Iniciando criação das tabelas VMI Forecast Tracking...');

        // 1. Tabela para salvar as datas de entrega modificadas
        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_demanda_vmi_datas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ordem_compra_cliente VARCHAR(100) NOT NULL,
                codigo_produto_cliente VARCHAR(100) NOT NULL,
                produto_pai VARCHAR(100) NULL,
                data_original VARCHAR(50) NULL,
                data_revisada VARCHAR(50) NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                updated_by VARCHAR(100) NULL,
                UNIQUE KEY uk_vmi_item (ordem_compra_cliente, codigo_produto_cliente)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ Tabela app_demanda_vmi_datas verificada/criada.');

        // 2. Tabela para snapshot diário (histórico de entregas)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_demanda_vmi_entregas_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                data_referencia DATE NOT NULL,
                ordem_compra_cliente VARCHAR(100) NULL,
                codigo_produto_cliente VARCHAR(100) NULL,
                qtd_entregue DECIMAL(18,4) DEFAULT 0,
                qtd_delta DECIMAL(18,4) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_vmi_log_data (data_referencia),
                INDEX idx_vmi_log_item (ordem_compra_cliente, codigo_produto_cliente)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ Tabela app_demanda_vmi_entregas_log verificada/criada.');

        console.log('Migração concluída com sucesso!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Erro na migração:', err);
        process.exit(1);
    }
}

migrate();
