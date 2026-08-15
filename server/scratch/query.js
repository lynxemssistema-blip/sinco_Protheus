const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/Users/lynx/Documents/MetalFisa Anty/server/.env' });
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DB,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
pool.query("SELECT c2_num, c2_item, c2_sequen, c2_produto, c2_pedido FROM sc2010 WHERE c2_pedido LIKE '%4757%' OR c2_num LIKE '%4757%'").then(res => {
  console.log(res.rows);
  pool.end();
}).catch(console.error);
