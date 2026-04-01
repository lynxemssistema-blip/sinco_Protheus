
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
  try {
    console.log('--- FINAL SEARCH: OP 2251 AND NEIGHBORS ---');
    
    // 1. Search for "2251" inside any observation
    const q1 = `SELECT c2_num, c2_obs FROM public.sc2010 WHERE c2_obs LIKE '%2251%' LIMIT 10`;
    const res1 = await pool.query(q1);
    console.log(`\nObservations containing "2251": ${res1.rows.length}`);
    if (res1.rows.length > 0) console.log(res1.rows);

    // 2. Check OPs numerically near 2251
    const q2 = `
      SELECT c2_num, c2_pedido, c2_obs 
      FROM public.sc2010 
      WHERE c2_num > '002240' AND c2_num < '002260'
      AND c2_sequen = '001'
      AND COALESCE(d_e_l_e_t_,'') IN ('',' ')
      ORDER BY c2_num
    `;
    const res2 = await pool.query(q2);
    console.log(`\nOPs near 2251 (Items 01, Seq 001):`);
    res2.rows.forEach(r => {
        console.log(`OP: ${r.c2_num} | Pedido: ${r.c2_pedido.trim().padEnd(10)} | Obs: ${r.c2_obs.trim()}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

run();
