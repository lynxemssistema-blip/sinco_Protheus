
const { Pool } = require('pg');
require('dotenv').config({ path: './server/.env' });

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

async function run() {
  const op = '002251';
  try {
    console.log(`Checking ALL rows for OP ${op} in SC2010 for any non-empty C2_OBS...`);
    const q1 = `SELECT c2_num, c2_item, c2_sequen, c2_obs FROM public.sc2010 WHERE TRIM(c2_num) = '${op}' AND LENGTH(TRIM(c2_obs)) > 0`;
    const res1 = await pool.query(q1);
    console.log(`Matches in SC2: ${res1.rows.length}`);
    if (res1.rows.length > 0) console.log(res1.rows);

    console.log(`\nChecking SH6 (Produção) for OP ${op}...`);
    const q2 = `SELECT h6_num, h6_item, h6_operac, h6_obs FROM public.sh6010 WHERE TRIM(h6_num) = '${op}' LIMIT 10`;
    const res2 = await pool.query(q2);
    console.log(`Matches in SH6: ${res2.rows.length}`);
    if (res2.rows.length > 0) {
        res2.rows.forEach(r => {
            if (r.h6_obs && r.h6_obs.trim().length > 0) {
                console.log(`OP ${r.h6_num} Seq ${r.h6_item} Obs: ${r.h6_obs.trim()}`);
            }
        });
    }

    // List all columns of SH6 to see if there is a more likely field
    const q3 = `SELECT column_name FROM information_schema.columns WHERE table_name = 'sh6010' AND table_schema = 'public'`;
    const res3 = await pool.query(q3);
    const cols = res3.rows.map(r => r.column_name);
    const obsCols = cols.filter(c => c.includes('obs'));
    console.log(`\nSH6 Observation columns: ${obsCols}`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

run();
