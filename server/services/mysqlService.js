const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mysql = require('mysql2/promise');

// =============================================================================
// PREMISSA INVIOLÁVEL: ISOLAMENTO TOTAL DO BANCO DE DADOS
// =============================================================================
const REQUIRED_DATABASE = 'u494795077_SINCO';
if (!process.env.MYSQL_DB || process.env.MYSQL_DB.trim() !== REQUIRED_DATABASE) {
    console.error('\n=============================================================================');
    console.error('🚨 [FATAL SECURITY ERROR] TENTATIVA DE CONEXÃO COM BANCO NÃO AUTORIZADO!');
    console.error(`   Banco Solicitado : "${process.env.MYSQL_DB}"`);
    console.error(`   Banco Obrigatório: "${REQUIRED_DATABASE}"`);
    console.error('🔒 [PREMISSA INVIOLÁVEL] Este aplicativo só tem autorização para conectar');
    console.error(`   exclusivamente ao banco de dados "${REQUIRED_DATABASE}".`);
    console.error('🛑 Execução cancelada imediatamente para proteção dos dados.');
    console.error('=============================================================================\n');
    process.exit(1);
}

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: REQUIRED_DATABASE,
    waitForConnections: true,
    connectionLimit: 8,        // Pool otimizado para reaproveitar conexões persistentes
    queueLimit: 200,           // Fila para absorver picos de requisições
    charset: 'utf8mb4',
    enableKeepAlive: true,
    keepAliveInitialDelay: 5000,
    connectTimeout: 10000,
    idleTimeout: 0,            // 0 = Nunca fechar conexões ociosas prematuramente (evita estourar max_connections_per_hour do Hostinger)
});

// DBA-tuned session variables set on connection initialization (avoids pool configuration warnings)
pool.on('connection', (connection) => {
    connection.query(
        "SET SESSION tmp_table_size = 67108864, max_heap_table_size = 67108864, sort_buffer_size = 4194304, join_buffer_size = 2097152, read_rnd_buffer_size = 1048576, sql_mode = CONCAT(@@sql_mode, ',PIPES_AS_CONCAT')",
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
        // Carrega todas as tabelas isoladas por IdEmpresa na memória
        const { loadTenantTables } = require('./tenantQueryRewriter');
        loadTenantTables(pool).catch(() => { });
        // Garante templates de setores para empresas cadastradas
        const { seedAllMissingCompanies } = require('./tenantSeedService');
        seedAllMissingCompanies().catch(() => { });
    })
    .catch(err => {
        console.error('❌ Erro ao conectar no MySQL Remoto:', err.message);
    });

pool.on('error', (err) => {
    console.error('❌ Erro inesperado no MySQL Pool:', err.message);
});

const RETRYABLE = new Set(['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'ECONNREFUSED', 'ETIMEDOUT']);
const originalQuery = pool.query.bind(pool);
const originalExecute = pool.execute.bind(pool);

const { getTenantId } = require('./tenantContext');
const { injectTenantSql } = require('./tenantQueryRewriter');

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
    let finalSql = sql;
    if (typeof sql === 'string') {
        const tenantId = getTenantId();
        if (tenantId) {
            finalSql = injectTenantSql(sql, tenantId);
        }
    }

    const withTimeout = makeWithTimeout(acquireTimeoutMs);
    try {
        return await withTimeout(originalFn(finalSql, params));
    } catch (err) {
        if (RETRYABLE.has(err.code)) {
            console.warn(`⚠️ MySQL retry após ${err.code}...`);
            return await withTimeout(originalFn(finalSql, params));
        }
        throw err;
    }
}

// Default: 20s — enough for bulk inserts but fast enough to fail light queries early.
pool.query = (sql, params, acquireTimeoutMs = 20000) => wrappedCall(originalQuery, sql, params, acquireTimeoutMs);
pool.execute = (sql, params, acquireTimeoutMs = 20000) => wrappedCall(originalExecute, sql, params, acquireTimeoutMs);

module.exports = pool;
