require('dotenv').config({ path: './server/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
const prod = process.argv[2] || 'MT3-12297';
pool.query(`SELECT TRIM(g2_produto) as prod, TRIM(g2_codigo) as rot, TRIM(g2_operac) as opc, TRIM(g2_descri) as descri, TRIM(g2_recurso) as rec, g2_tempad, g2_setup FROM public.sg2010 WHERE TRIM(g2_produto) = $1 AND COALESCE(d_e_l_e_t_,'') IN ('',' ') ORDER BY g2_operac`, [prod])
  .then(r => { console.log(`SG2010 ${prod}:`, r.rows); pool.end(); })
  .catch(e => { console.error('Erro:', e.message); pool.end(); });
