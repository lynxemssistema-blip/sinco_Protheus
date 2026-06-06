const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB,
    waitForConnections: true,
    connectionLimit: 20,       // Maximum pool size — constrained to 20 per client instance
    queueLimit: 200,           // Max queued requests before rejecting (prevents infinite hang)
    charset: 'utf8mb4',
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: 10000,
    idleTimeout: 120000,
});

// DBA-tuned session variables set on connection initialization (avoids pool configuration warnings)
pool.on('connection', (connection) => {
    connection.query(
        'SET SESSION tmp_table_size = 67108864, max_heap_table_size = 67108864, sort_buffer_size = 4194304, join_buffer_size = 2097152, read_rnd_buffer_size = 1048576',
        (err) => {
            if (err) {
                console.warn('⚠️ Falha ao definir variáveis de sessão na nova conexão:', err.message);
            }
        }
    );
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

pool.on('error', (err) => {
    console.error('❌ Erro inesperado no MySQL Pool:', err.message);
});

// Wrapper com retry automático para ECONNRESET
const RETRYABLE = new Set(['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'ECONNREFUSED', 'ETIMEDOUT']);
const originalQuery = pool.query.bind(pool);
pool.query = async function queryWithRetry(sql, params) {
    try {
        return await originalQuery(sql, params);
    } catch (err) {
        if (RETRYABLE.has(err.code)) {
            console.warn(`⚠️ MySQL retry após ${err.code}...`);
            return await originalQuery(sql, params);
        }
        throw err;
    }
};

module.exports = pool;
