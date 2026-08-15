require("dotenv").config({ path: ".env" });
const mysql = require("mysql2/promise");
(async () => {
    const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        port: process.env.MYSQL_PORT || 3306,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });
    console.log("Conectado ao MySQL:", process.env.MYSQL_HOST, "/", process.env.MYSQL_DB);

    // 1. Ver o que existe em app_production_planning para os dias 17-18/08
    const [rows] = await conn.query(`
        SELECT recurso_codigo, DATE(data_planejada_inicio) as dia_inicio, DATE(data_planejada_fim) as dia_fim,
               COUNT(*) as total_ops
        FROM app_production_planning
        WHERE data_planejada_inicio >= '2026-08-17'
          AND data_planejada_inicio <= '2026-08-18 23:59:59'
        GROUP BY recurso_codigo, DATE(data_planejada_inicio), DATE(data_planejada_fim)
        ORDER BY recurso_codigo, dia_inicio
    `);
    console.log("\n=== app_production_planning para 17-18/08 ===");
    if (rows.length === 0) {
        console.log("  !! NENHUM REGISTRO para 17-18/08 !!");
    } else {
        rows.forEach(r => console.log(" ", r.recurso_codigo, "| inicio:", String(r.dia_inicio).substring(0,10), "| fim:", String(r.dia_fim).substring(0,10), "| ops:", r.total_ops));
    }

    // 2. Total e range da tabela
    const [[total]] = await conn.query("SELECT COUNT(*) as total, MIN(data_planejada_inicio) as min_data, MAX(data_planejada_fim) as max_data FROM app_production_planning");
    console.log("\n=== Totais ===");
    console.log("  Total registros:", total.total);
    console.log("  Menor data:", String(total.min_data).substring(0,10));
    console.log("  Maior data:", String(total.max_data).substring(0,10));

    // 3. Ultimos inseridos
    const [recentes] = await conn.query(`
        SELECT op_numero, recurso_codigo, data_planejada_inicio, data_planejada_fim, usuario_planejador
        FROM app_production_planning ORDER BY id DESC LIMIT 10
    `);
    console.log("\n=== Ultimos 10 registros ===");
    recentes.forEach(r => console.log(" ", r.op_numero, "|", r.recurso_codigo, "|",
        String(r.data_planejada_inicio).substring(0,10), "->", String(r.data_planejada_fim).substring(0,10),
        "| user:", r.usuario_planejador));

    await conn.end();
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });
