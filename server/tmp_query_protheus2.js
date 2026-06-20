require('dotenv').config({ path: '../.env' });
const db = require('./db');
db.query("SELECT TRIM(c2_num) as num, TRIM(c2_item) as item, TRIM(c2_pedido) as pedido FROM public.sc2010 WHERE TRIM(c2_num)='004884'").then(r=>{console.log(r.rows); process.exit(0)}).catch(e=>{console.error(e); process.exit(1)});
