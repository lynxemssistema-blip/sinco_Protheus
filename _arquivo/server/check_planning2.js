require("dotenv").config({ path: ".env" });
const mysql = require("mysql2/promise");
(async () => {
    const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST, port: process.env.MYSQL_PORT || 3306,
        user: process.env.MYSQL_USER, password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });

    // Ver o que está em app_production_planning: op_numero, op_item, operacao_codigo
    const [rows] = await conn.query(`
        SELECT op_numero, op_item, op_sequencia, operacao_codigo, recurso_codigo,
               data_planejada_inicio, data_planejada_fim
        FROM app_production_planning
        WHERE data_planejada_inicio >= '2026-08-17'
          AND data_planejada_inicio <= '2026-08-17 23:59:59'
        LIMIT 20
    `);
    console.log("=== Amostra de registros 17/08 ===");
    rows.forEach(r => console.log(
        "op:", r.op_numero,
        "| item:", r.op_item,
        "| seq:", r.op_sequencia,
        "| oper:", r.operacao_codigo,
        "| recurso:", r.recurso_codigo,
        "| datas:", String(r.data_planejada_inicio).substring(0,10), "->", String(r.data_planejada_fim).substring(0,10)
    ));

    await conn.end();
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });
