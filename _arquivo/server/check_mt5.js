const mysql = require('./services/mysqlService');
const pool = require('./db');

async function run() {
    try {
        console.log("--- PostgreSQL ---");
        const pgRes = await pool.query("SELECT b1_cod, b1_desc, b1_xdesenh FROM public.sb1010 WHERE b1_xdesenh LIKE '%MT5-29193%'");
        console.log(pgRes.rows);
        
        console.log("\n--- MySQL ---");
        const [myRes] = await mysql.query("SELECT * FROM produtos_docs WHERE url_arquivo LIKE '%MT5-29193%'");
        console.log(myRes);
    } catch(e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
