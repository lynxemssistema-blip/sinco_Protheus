require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
    max: 20,                         // Otimizado: aumentado para o máximo viável sem comprometer o PG
    idleTimeoutMillis: 30000,        // Mantém conexões quentes por 30 segundos
    connectionTimeoutMillis: 10000,
    statement_timeout: 45000,
});

pool.on('error', (err) => {
    console.error('⚠️ PG Pool idle client error:', err.message);
    // Don't exit — just log and continue
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};
