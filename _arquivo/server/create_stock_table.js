const mysql = require('mysql2/promise');
require('dotenv').config();

async function createStockTable() {
    let connection;
    try {
        console.log('🔌 Conectando ao MySQL...');
        connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASS,
            database: process.env.MYSQL_DB
        });

        console.log('📦 Criando tabela app_estoque_movimentos...');

        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS app_estoque_movimentos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                produto_codigo VARCHAR(50) NOT NULL,
                tipo ENUM('E', 'S') NOT NULL COMMENT 'E=Entrada, S=Saída',
                quantidade DECIMAL(10,4) NOT NULL,
                saldo_anterior DECIMAL(10,4) NOT NULL,
                observacao TEXT,
                usuario VARCHAR(100) DEFAULT 'Admin',
                data_movimento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_produto (produto_codigo)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;

        await connection.execute(createTableSQL);
        console.log('✅ Tabela app_estoque_movimentos criada com sucesso!');

    } catch (error) {
        console.error('❌ Erro ao criar tabela:', error);
    } finally {
        if (connection) await connection.end();
    }
}

createStockTable();
