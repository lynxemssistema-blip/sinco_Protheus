const mysql = require('mysql2/promise');
require('dotenv').config();

async function createCadastroCorrecoesTable() {
    let connection;
    try {
        console.log('🔌 Conectando ao MySQL...');
        connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASS,
            database: process.env.MYSQL_DB
        });

        console.log('📦 Criando tabela app_cadastro_correcoes...');

        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS app_cadastro_correcoes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                grupo_uuid VARCHAR(36) NOT NULL,
                tipo_relacao ENUM('duplicado', 'equivalente') NOT NULL,
                produto_codigo VARCHAR(30) NOT NULL,
                produto_descricao VARCHAR(255),
                empresa VARCHAR(3),
                papel ENUM('correto', 'bloquear', 'equivalente') NOT NULL,
                motivo_ia TEXT,
                status ENUM('pendente', 'aplicado', 'ignorado') NOT NULL DEFAULT 'pendente',
                criado_por VARCHAR(100),
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_grupo (grupo_uuid),
                INDEX idx_produto (produto_codigo),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;

        await connection.execute(createTableSQL);
        console.log('✅ Tabela app_cadastro_correcoes criada com sucesso!');

    } catch (error) {
        console.error('❌ Erro ao criar tabela:', error);
    } finally {
        if (connection) await connection.end();
    }
}

createCadastroCorrecoesTable();
