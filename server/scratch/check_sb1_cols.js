require('dotenv').config({ path: 'c:/Users/lynx/Documents/MetalFisa Anty/server/.env' });
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

async function main() {
    try {
        const res = await pool.query(
            "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='sb1010' ORDER BY ordinal_position"
        );
        console.log(res.rows.map(r => r.column_name).join('\n'));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
main();
