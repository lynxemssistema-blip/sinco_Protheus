const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mysqlPool = require('./services/mysqlService');

async function init() {
    try {
        console.log('🔄 Iniciando criação da tabela app_pcp_delivery_forecasts...');

        const sql = `
            CREATE TABLE IF NOT EXISTS app_pcp_delivery_forecasts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                pedido VARCHAR(20) NOT NULL,
                item VARCHAR(10) NOT NULL,
                data_entrega_pcp DATE NOT NULL,
                quantidade_pcp DECIMAL(18,6) NOT NULL,
                usuario VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_pedido_item (pedido, item)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `;

        await mysqlPool.query(sql);
        console.log('✅ Tabela app_pcp_delivery_forecasts criada ou já existente!');

        process.exit(0);
    } catch (err) {
        console.error('❌ Erro ao criar tabela:', err);
        process.exit(1);
    }
}

init();
