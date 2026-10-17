const db = require('./db');
async function run() { 
    const client = await db.connect(); 
    const res = await client.query("SELECT c6_num, c6_item FROM public.sc6010 WHERE TRIM(c6_num) = '004663'"); 
    console.log(res.rows); 
    client.release(); 
    process.exit(0); 
} 
run();
