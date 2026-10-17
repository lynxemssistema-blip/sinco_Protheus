const { Pool } = require('pg');

async function test() {
    const pool = new Pool({
        user: 'postgres',
        host: process.env.PGHOST || '192.168.1.61',
        database: process.env.PGDATABASE || 'p12prd',
        password: 'admin', // guessing password
        port: 5432,
    });
    try {
        const client = await pool.connect();
        const res = await client.query('GRANT UPDATE ON public.sc2010 TO sinco2');
        console.log('Granted:', res);
        client.release();
    } catch (e) {
        console.error('Error:', e.message);
    }
    process.exit();
}
test();
