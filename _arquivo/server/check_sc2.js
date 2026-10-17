require('dotenv').config({ path: './server/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
pool.query(`SELECT TRIM(c2_num) as op, TRIM(c2_item) as item, TRIM(c2_produto) as prod FROM public.sc2010 WHERE TRIM(c2_num) = '004774' AND TRIM(c2_produto) = 'MT6-6095'`)
  .then(r => { console.log('SC2010:', r.rows); pool.end(); })
  .catch(e => { console.error('Erro:', e.message); pool.end(); });
