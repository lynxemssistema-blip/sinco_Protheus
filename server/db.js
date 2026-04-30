require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
    max: 3,                          // Reduzido: PG tem muitos clientes de outros sistemas
    idleTimeoutMillis: 3000,         // Libera conexões ociosas rapidamente
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
