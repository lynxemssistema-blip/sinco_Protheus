const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

async function run() {
    try {
        console.log("Adding columns to apontamentos_producao...");
        await pool.query(`
            ALTER TABLE apontamentos_producao 
            ADD COLUMN IF NOT EXISTS conferencia_status VARCHAR(50) DEFAULT 'OK',
            ADD COLUMN IF NOT EXISTS conferido_por VARCHAR(100),
            ADD COLUMN IF NOT EXISTS conferido_em TIMESTAMP,
            ADD COLUMN IF NOT EXISTS conferencia_obs TEXT,
            ADD COLUMN IF NOT EXISTS conferencia_fotos TEXT;
        `);
        console.log("Columns added successfully!");
    } catch (e) {
        console.error("Migration error:", e);
    } finally {
        pool.end();
    }
}

run();
