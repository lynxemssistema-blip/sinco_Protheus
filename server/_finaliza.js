require('dotenv').config();
require("dotenv").config();
const mysql = require("mysql2/promise");
(async()=>{
  const my = await mysql.createConnection({host:process.env.MYSQL_HOST,port:3306,database: process.env.MYSQL_DB,user:process.env.MYSQL_USER,password:process.env.MYSQL_PASS});

  const [r] = await my.execute(`
    UPDATE app_production_planning
    SET duracao_dias = GREATEST(1, DATEDIFF(data_planejada_fim, data_planejada_inicio) + 1)
    WHERE (duracao_dias IS NULL OR duracao_dias = 0)
      AND data_planejada_inicio IS NOT NULL
      AND data_planejada_fim IS NOT NULL
  `);
  console.log("duracao_dias atualizado:", r.affectedRows, "registros");

  const [[tot]]  = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning");
  const [[ped]]  = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning WHERE pedido_venda IS NULL OR pedido_venda = ''");
  const [[prod]] = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning WHERE produto_codigo IS NULL OR produto_codigo = ''");
  const [[rec]]  = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning WHERE recurso_codigo IS NULL OR recurso_codigo = ''");
  const [[dur]]  = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning WHERE duracao_dias IS NULL OR duracao_dias = 0");

  console.log("\n=== SITUACAO FINAL ===");
  console.log("Total registros:    ", tot.cnt);
  console.log("Sem pedido_venda:   ", ped.cnt,  ped.cnt  === 0 ? "OK" : "PENDENTE");
  console.log("Sem produto_codigo: ", prod.cnt, prod.cnt === 0 ? "OK" : "PENDENTE");
  console.log("Sem recurso_codigo: ", rec.cnt,  rec.cnt  === 0 ? "OK" : "PENDENTE");
  console.log("Sem duracao_dias:   ", dur.cnt,  dur.cnt  === 0 ? "OK" : "PENDENTE");

  await my.end();
})().catch(e=>console.error("ERRO:",e.message));
