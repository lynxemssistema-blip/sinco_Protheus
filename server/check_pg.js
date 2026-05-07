const {Pool} = require('pg');
require('dotenv').config();
const pool = new Pool();
pool.query("SELECT c6_produto FROM sc6010 WHERE c6_num = '003954' AND COALESCE(d_e_l_e_t_, '') = ''").then(res => {
    console.log(res.rows);
    pool.end();
}).catch(console.error);
