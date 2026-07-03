const { Pool } = require('pg');
require('dotenv').config();

async function run() {
    const pool = new Pool({
        user: process.env.PGUSER,
        host: process.env.PGHOST,
        database: process.env.PGDATABASE,
        password: process.env.PGPASSWORD,
        port: process.env.PGPORT
    });
    const result = await pool.query(`
        SELECT column_name, data_type, character_maximum_length
        FROM information_schema.columns
        WHERE table_name = 'app_pcp_pedidos_itens'
    `);
    console.table(result.rows);
    await pool.end();
}
run().catch(console.error);
