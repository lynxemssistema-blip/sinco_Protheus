require('dotenv').config();
const mysql = require('mysql2/promise');

async function createTableManually() {
    console.log('🛠️  Tentando criar tabela "produtos_docs" manualmente...');

    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASS,
            database: process.env.MYSQL_DB
        });

        console.log('✅ Conectado.');

        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS produtos_docs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                produto_codigo VARCHAR(50) NOT NULL,
                titulo VARCHAR(255) NOT NULL,
                url_arquivo TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `;

        await connection.execute(createTableQuery);
        console.log('✅ Comando CREATE TABLE executado com sucesso.');
        console.log('🔍 Verificando se ela existe agora...');

        const [rows] = await connection.execute("SHOW TABLES LIKE 'produtos_docs'");
        if (rows.length > 0) {
            console.log('🎉 Tabela ENCONTRADA no banco de dados!');
        } else {
            console.error('⚠️  Estranho: O comando rodou sem erro, mas a tabela não apareceu.');
        }

    } catch (err) {
        console.error('❌ ERRO CRÍTICO ao criar tabela:');
        console.error(`   Message: ${err.message}`);
        console.error(`   Code: ${err.code}`);
        if (err.code === 'ER_TABLEACCESS_DENIED_ERROR' || err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('🔴 O usuário do banco NÃO TEM PERMISSÃO para criar tabelas (CREATE permission).');
        }
    } finally {
        if (connection) await connection.end();
    }
}

createTableManually();
