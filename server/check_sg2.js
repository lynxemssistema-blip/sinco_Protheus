require('dotenv').config({ path: './server/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
pool.query(`SELECT TRIM(g2_produto) as prod, TRIM(g2_operac) as opc, TRIM(g2_recurso) as rec, g2_tempad FROM public.sg2010 WHERE TRIM(g2_produto) = 'MT6-6095' AND COALESCE(d_e_l_e_t_,'') IN ('',' ')`)
  .then(r => { console.log('SG2010 MT6-6095:', r.rows); pool.end(); })
  .catch(e => { console.error('Erro:', e.message); pool.end(); });
