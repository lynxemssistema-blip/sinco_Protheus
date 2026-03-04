
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB,
    port: 3306
};

async function updateSchema() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected to MySQL');

        const alterQuery = `
            ALTER TABLE app_romaneios
            ADD COLUMN cliente_endereco VARCHAR(255),
            ADD COLUMN cliente_bairro VARCHAR(100),
            ADD COLUMN cliente_cidade VARCHAR(100),
            ADD COLUMN cliente_uf VARCHAR(2),
            ADD COLUMN cliente_cep VARCHAR(20),
            ADD COLUMN cliente_telefone VARCHAR(20),
            ADD COLUMN motorista_nome VARCHAR(100),
            ADD COLUMN motorista_cnh VARCHAR(20),
            ADD COLUMN motorista_cnh_validade DATE,
            ADD COLUMN veiculo_modelo VARCHAR(100),
            ADD COLUMN veiculo_placa VARCHAR(20);
        `;

        await connection.execute(alterQuery);
        console.log('✅ app_romaneios table updated successfully!');

    } catch (error) {
        console.error('❌ Error updating schema:', error);
    } finally {
        if (connection) await connection.end();
    }
}

updateSchema();
