const { Pool } = require('pg');

async function fix() {
  const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'p12prd',
    password: 'admin',
    port: 5432,
  });

  try {
    const res = await pool.query(
      `SELECT c2_num, c2_item, c2_sequen, c2_quant, c2_produto FROM sc2010 WHERE c2_pedido = '004546'`
    );
    console.log(res.rows);
  } catch (e) {
    console.error("SQL Error:", e.message);
  } finally {
    pool.end();
  }
}
fix();
