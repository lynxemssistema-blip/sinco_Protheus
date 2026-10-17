require('dotenv').config({ path: './server/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
// SCR010 = tabela de Centros de Custo/Recursos no Protheus
pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='scr010' ORDER BY column_name LIMIT 30`)
  .then(r => { 
      console.log('SCR010 colunas:', r.rows.map(c => c.column_name).join(', '));
      return pool.query(`SELECT * FROM public.scr010 WHERE COALESCE(d_e_l_e_t_,'') IN ('',' ') LIMIT 3`);
  })
  .then(r => {
      console.log('SCR010 sample:', r.rows);
      pool.end();
  })
  .catch(e => { console.error('Erro:', e.message); pool.end(); });
