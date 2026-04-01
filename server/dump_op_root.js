
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
    console.log(`Deep dumping Row 1 (Seq 001) for OP ${op} in SC2010...`);
    
    const res = await pool.query(`
      SELECT *
      FROM public.sc2010 
      WHERE TRIM(c2_num) = '${op}'
      AND c2_sequen = '001'
      AND COALESCE(d_e_l_e_t_,'') IN ('',' ')
    `);
    
    if (res.rows.length === 0) {
      console.log('No Seq 001 found for this OP.');
    } else {
      const row = res.rows[0];
      const allData = {};
      Object.entries(row).forEach(([k,v]) => {
          if (v !== null && v.toString().trim().length > 0) {
              allData[k] = v.toString().trim();
          }
      });
      console.log(JSON.stringify(allData, null, 2));
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

run();
