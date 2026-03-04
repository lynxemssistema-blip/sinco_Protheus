const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB
};

async function updateSchema() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Conectado ao MySQL!');

        // 1. Table for Product Images (One URL per product for main display, or multiple?)
        // User said "inserir o endereço url... e a imagem deve ser exibida".
        // simple 1-to-1 or 1-to-many. Let's do 1-to-many but usage will prioritize latest/main.
        // Actually, "na linha do produto" implies a main image.
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS app_produto_imagens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                produto_codigo VARCHAR(50) NOT NULL,
                url_imagem TEXT NOT NULL,
                descricao VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_prod_img (produto_codigo)
            ) ENGINE=InnoDB;
        `);
        console.log('Tabela app_produto_imagens verificada.');

        // 2. Table for Product Associations
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS app_produto_associacoes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                produto_origem VARCHAR(50) NOT NULL,
                produto_destino VARCHAR(50) NOT NULL,
                tipo_associacao VARCHAR(50) DEFAULT 'Relacionado',
                comentario TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_assoc_origem (produto_origem),
                INDEX idx_assoc_destino (produto_destino)
            ) ENGINE=InnoDB;
        `);
        console.log('Tabela app_produto_associacoes verificada.');

    } catch (error) {
        console.error('Erro:', error);
    } finally {
        if (connection) await connection.end();
    }
}

updateSchema();
