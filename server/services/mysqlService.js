const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB,
    waitForConnections: true,
    connectionLimit: 25,       // Aumentado: 5 era insuficiente para cargas simultâneas
    queueLimit: 200,           // Fila maior para absorver picos de requisições
    charset: 'utf8mb4',
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: 10000,
    idleTimeout: 60000,
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

const RETRYABLE = new Set(['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'ECONNREFUSED', 'ETIMEDOUT']);
const originalQuery   = pool.query.bind(pool);
const originalExecute = pool.execute.bind(pool);

// Wraps a mysql2 pool call in a hard timeout so indefinite hangs (queue waits,
// silent TCP drops, slow networks) never block the Node.js event loop forever.
function makeWithTimeout(acquireTimeoutMs) {
    return (promise) => {
        let timer;
        return Promise.race([
            promise.finally(() => clearTimeout(timer)),
            new Promise((_, reject) => {
                timer = setTimeout(() => {
                    const e = new Error('MySQL pool acquire/execute timeout');
                    e.code = 'POOL_TIMEOUT';
                    reject(e);
                }, acquireTimeoutMs);
            })
        ]);
    };
}

async function wrappedCall(originalFn, sql, params, acquireTimeoutMs) {
    const withTimeout = makeWithTimeout(acquireTimeoutMs);
    try {
        return await withTimeout(originalFn(sql, params));
    } catch (err) {
        if (RETRYABLE.has(err.code)) {
            console.warn(`⚠️ MySQL retry após ${err.code}...`);
            return await withTimeout(originalFn(sql, params));
        }
        throw err;
    }
}

// Default: 20s — enough for bulk inserts but fast enough to fail light queries early.
pool.query   = (sql, params, acquireTimeoutMs = 20000) => wrappedCall(originalQuery,   sql, params, acquireTimeoutMs);
pool.execute = (sql, params, acquireTimeoutMs = 20000) => wrappedCall(originalExecute, sql, params, acquireTimeoutMs);

module.exports = pool;
