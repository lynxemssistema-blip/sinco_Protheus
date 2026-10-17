require('dotenv').config({ path: './server/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE
});

async function run() {
  try {
    const res = await pool.query('SELECT * FROM public.sg2010 LIMIT 1');
    console.log('Columns in sg2010:', res.fields.map(f => f.name).join(', '));
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

run();
