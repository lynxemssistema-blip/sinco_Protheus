require("dotenv").config({ path: ".env" });
const mysql = require("mysql2/promise");
(async () => {
    const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST, port: process.env.MYSQL_PORT || 3306,
        user: process.env.MYSQL_USER, password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });
    const [cols] = await conn.query("SHOW COLUMNS FROM app_production_planning");
    console.log("=== Colunas de app_production_planning ===");
    cols.forEach(c => console.log(" ", c.Field, "|", c.Type));
    
    const [sample] = await conn.query("SELECT * FROM app_production_planning WHERE data_planejada_inicio >= '2026-08-17' LIMIT 3");
    console.log("\n=== Amostra completa ===");
    if(sample.length) console.log(JSON.stringify(sample[0], null, 2));
    await conn.end();
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });
