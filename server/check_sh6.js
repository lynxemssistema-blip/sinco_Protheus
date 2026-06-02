require('dotenv').config({ path: './server/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
pool.query(`SELECT TRIM(h6_op) as op, TRIM(h6_operac) as operac, SUM(h6_qtdprod) as prod FROM public.sh6010 WHERE COALESCE(d_e_l_e_t_,'') IN ('',' ') AND h6_qtdprod > 0 GROUP BY h6_op, h6_operac LIMIT 5`)
  .then(r => { console.log('SH6010:', r.rows); pool.end(); })
  .catch(e => { console.error('Erro:', e.message); pool.end(); });
