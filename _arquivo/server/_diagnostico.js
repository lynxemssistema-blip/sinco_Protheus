require('dotenv').config();
require("dotenv").config();
const mysql = require("mysql2/promise");

async function main() {
    const my = await mysql.createConnection({
        host:process.env.MYSQL_HOST, port:3306,
        database: process.env.MYSQL_DB, user:process.env.MYSQL_USER, password:process.env.MYSQL_PASS
    });

    const [[tot]]     = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning");
    const [[comData]] = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning WHERE data_planejada_inicio IS NOT NULL");
    const [[semData]] = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning WHERE data_planejada_inicio IS NULL");
    const [[semRec]]  = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning WHERE recurso_codigo IS NULL OR recurso_codigo = ''");
    const [[semProd]] = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning WHERE produto_codigo IS NULL OR produto_codigo = ''");
    const [[semPed]]  = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning WHERE pedido_venda IS NULL OR pedido_venda = ''");
    const [[semDur]]  = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning WHERE duracao_dias IS NULL OR duracao_dias = 0");

    console.log("=== DIAGNOSTICO app_production_planning ===");
    console.log("Total registros:    ", tot.cnt);
    console.log("Com data inicio:    ", comData.cnt);
    console.log("SEM data inicio:    ", semData.cnt, "<-- sem planejamento");
    console.log("SEM recurso_codigo: ", semRec.cnt);
    console.log("SEM produto_codigo: ", semProd.cnt);
    console.log("SEM pedido_venda:   ", semPed.cnt);
    console.log("SEM duracao_dias:   ", semDur.cnt);

    const [amostra] = await my.execute(`
        SELECT op_numero, op_item, op_sequencia, operacao_codigo,
               recurso_codigo, produto_codigo, pedido_venda,
               data_planejada_inicio, duracao_dias
        FROM app_production_planning
        WHERE recurso_codigo IS NULL OR recurso_codigo = ''
           OR produto_codigo IS NULL OR produto_codigo = ''
           OR pedido_venda IS NULL OR pedido_venda = ''
        LIMIT 15
    `);
    console.log("\n=== AMOSTRA DE REGISTROS INCOMPLETOS ===");
    amostra.forEach(r => console.log(JSON.stringify(r)));

    await my.end();
}
main().catch(e => console.error("ERRO:", e.message));
