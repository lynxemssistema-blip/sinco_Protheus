require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
    max: 100,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 45000,
});

pool.on('connect', (client) => {
    client.query("SET client_encoding TO 'WIN1252'").catch((err) => {
        console.error('⚠️ Error setting client_encoding:', err.message);
    });
});

pool.on('error', (err) => {
    console.error('⚠️ PG Pool idle client error:', err.message);
    // Don't exit — just log and continue
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    connect: () => pool.connect(),
};
