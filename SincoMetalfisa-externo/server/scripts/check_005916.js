const { Pool } = require('pg');

async function check() {
  const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'p12prd',
    password: 'admin',
    port: 5432,
  });

  try {
    const res = await pool.query(
      `SELECT c2_num, c2_item, d_e_l_e_t_ FROM public.sc2010 WHERE TRIM(c2_num) = '005916'`
    );
    console.log("Rows:", res.rows);
  } catch (e) {
    console.error(e.message);
  } finally {
    pool.end();
  }
}
check();
