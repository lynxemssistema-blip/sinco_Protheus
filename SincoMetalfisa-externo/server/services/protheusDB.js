const { Pool } = require('pg');

// Configuração centralizada do PostgreSQL de Leitura (Protheus Mirror / p12prd)
// Substitui a chamada insegura de 'new Client()' que esmagava a rede.
const pool = new Pool({
    host: '192.168.1.61',
    port: 5432,
    user: 'sinco2',
    password: 'sinco25',
    database: 'p12prd',
    max: 20, // Limite máximo otimizado para evitar fila de requests, sem derrubar o banco
    idleTimeoutMillis: 30000, // Mantém a conexão quente por 30 segundos
    connectionTimeoutMillis: 10000,
    statement_timeout: 45000,
});

pool.on('error', (err) => {
    console.error('⚠️ [Protheus DB Pool] idle client error:', err.message);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool: pool
};
