require('dotenv').config();
const mysql = require('mysql2/promise');

async function testConnection() {
    console.log('------------------------------------------------');
    console.log('📡 Iniciando Teste de Conexão MySQL Remoto...');
    console.log(`📍 Host: ${process.env.MYSQL_HOST}`);
    console.log(`👤 User: ${process.env.MYSQL_USER}`);
    console.log(`🗄️  DB:   ${process.env.MYSQL_DB}`);
    console.log('------------------------------------------------');

    try {
        const connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASS,
            database: process.env.MYSQL_DB
        });
        console.log('✅ SUCESSO! Conexão estabelecida com o servidor da UOL.');

        // Tentar listar tabelas para garantir permissão
        const [rows] = await connection.execute('SHOW TABLES');
        console.log(`📊 Tabelas encontradas: ${rows.length}`);
        rows.forEach(row => {
            console.log(`   - ${Object.values(row)[0]}`);
        });

        await connection.end();
    } catch (err) {
        console.error('❌ FALHA NA CONEXÃO:');
        console.error(`   Erro: ${err.message}`);
        console.error(`   Code: ${err.code}`);
    }
    console.log('------------------------------------------------');
}

testConnection();
