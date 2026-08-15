const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/Users/lynx/Documents/MetalFisa Anty/server/.env' });
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DB,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
pool.query("SELECT c2_num, c2_item, c2_produto FROM sc2010 WHERE c2_num = '004547'").then(res => {
  console.log(res.rows);
  pool.end();
}).catch(console.error);
