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
    console.log("Connecting...");
    const res = await pool.query(
      `SELECT c2_num, c2_item, d_e_l_e_t_ FROM sc2010 ORDER BY r_e_c_n_o_ DESC LIMIT 5`
    );
    console.log("Rows:", res.rows);
  } catch (e) {
    console.error("SQL Error:", e.message);
  } finally {
    pool.end();
  }
}
check();
