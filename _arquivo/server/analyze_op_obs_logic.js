
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
    console.log('--- ANALYZING OP NUMBERS AND OBSERVATIONS ---');
    
    // 1. Check for OP 2251 specifically (with varying leading zeros)
    console.log('\n1. Checking for OP "2251" with flexible zeros...');
    const opQuery = `
      SELECT c2_num, c2_item, c2_sequen, c2_pedido, c2_obs 
      FROM public.sc2010 
      WHERE (TRIM(c2_num) = '2251' OR TRIM(c2_num) = '002251' OR TRIM(c2_num) = '00002251')
      AND COALESCE(d_e_l_e_t_,'') IN ('',' ')
    `;
    const opRes = await pool.query(opQuery);
    console.log(`Found ${opRes.rows.length} rows for OP variations.`);
    if (opRes.rows.length > 0) {
        // Show only rows that have something in c2_obs or c2_pedido
        opRes.rows.forEach(r => {
            if (r.c2_obs.trim() || r.c2_pedido.trim()) {
                console.log(`OP: ${r.c2_num} | Item: ${r.c2_item} | Seq: ${r.c2_sequen} | Pedido: ${r.c2_pedido.trim()} | Obs: ${r.c2_obs.trim()}`);
            }
        });
    }

    // 2. Statistical analysis of c2_obs
    console.log('\n2. Analyzing c2_obs patterns across OPs...');
    const patternQuery = `
      SELECT c2_num, c2_pedido, c2_obs 
      FROM public.sc2010 
      WHERE LENGTH(TRIM(c2_obs)) > 0 
      AND COALESCE(d_e_l_e_t_,'') IN ('',' ')
      LIMIT 50
    `;
    const patternRes = await pool.query(patternQuery);
    
    let matches = 0;
    patternRes.rows.forEach(r => {
        const ped = r.c2_pedido.trim();
        const obs = r.c2_obs.trim();
        
        // Check if pedido (or part of it) is in obs
        if (ped && obs.includes(ped)) {
            matches++;
        }
    });
    
    console.log(`Sample Size: ${patternRes.rows.length}`);
    console.log(`Direct matches (Pedido explicitly in Obs): ${matches}`);
    
    console.log('\nExample patterns:');
    patternRes.rows.slice(0, 10).forEach(r => {
        console.log(`[OP ${r.c2_num}] Pedido: ${r.c2_pedido.trim().padEnd(10)} | Obs: ${r.c2_obs.trim()}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

run();
