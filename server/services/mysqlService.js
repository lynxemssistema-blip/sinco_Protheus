const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    enableKeepAlive: true,
    keepAliveInitialDelay: 30000,  // ping a cada 30s para manter conexão viva
    connectTimeout: 15000,
    // Descarta conexões ociosas antes do MySQL fechar (wait_timeout padrão = 28800s)
    idleTimeout: 60000,            // libera após 60s ociosa
});

// Testar conexão na inicialização
pool.getConnection()
    .then(connection => {
        console.log('✅ Conectado ao MySQL Remoto com sucesso!');
        connection.release();
    })
    .catch(err => {
        console.error('❌ Erro ao conectar no MySQL Remoto:', err.message);
    });

// Evitar crash do servidor caso o MySQL derrube conexões idle
pool.on('error', (err) => {
    console.error('❌ Erro inesperado no MySQL Pool (ECONNRESET/etc):', err.message);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.error('A conexão com o banco de dados foi perdida.');
    }
});

module.exports = pool;
