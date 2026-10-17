require('dotenv').config();
require("dotenv").config();
const { Pool } = require("pg");
const mysql = require("mysql2/promise");

const pg = new Pool({ host:process.env.PGHOST, port:process.env.PGPORT||5432, database:process.env.PGDATABASE||"p12prd", user:process.env.PGUSER, password:process.env.PGPASSWORD });

async function main() {
    const my = await mysql.createConnection({host:process.env.MYSQL_HOST,port:3306,database: process.env.MYSQL_DB,user:process.env.MYSQL_USER,password:process.env.MYSQL_PASS});

    console.log("=== ANALISE DOS PENDENTES ===\n");

    // Verifica como recurso_codigo está guardado nos 7866 registros
    const [amRec] = await my.execute(`
        SELECT op_numero, produto_codigo, operacao_codigo, recurso_codigo,
               HEX(recurso_codigo) AS hex_recurso, LENGTH(recurso_codigo) AS len
        FROM app_production_planning
        WHERE recurso_codigo IS NULL OR TRIM(recurso_codigo) = ''
        LIMIT 5
    `);
    console.log("Amostra sem recurso_codigo:");
    amRec.forEach(r=>console.log(" ",JSON.stringify(r)));

    // Quantos tem produto_codigo mas sem recurso
    const [[r1]] = await my.execute(`
        SELECT COUNT(*) cnt FROM app_production_planning
        WHERE TRIM(COALESCE(recurso_codigo,'')) = ''
          AND produto_codigo IS NOT NULL AND TRIM(produto_codigo) != ''
    `);
    console.log("\nSem recurso MAS COM produto:", r1.cnt);

    // Quantos sem recurso E sem produto
    const [[r2]] = await my.execute(`
        SELECT COUNT(*) cnt FROM app_production_planning
        WHERE TRIM(COALESCE(recurso_codigo,'')) = ''
          AND (produto_codigo IS NULL OR TRIM(produto_codigo) = '')
    `);
    console.log("Sem recurso E sem produto:  ", r2.cnt);

    // ── CORRIGE recurso_codigo dos que têm produto ──────────────────────────
    console.log("\n=== CORRIGINDO recurso_codigo via sg2010 ===");
    const [pendRec] = await my.execute(`
        SELECT DISTINCT produto_codigo, operacao_codigo
        FROM app_production_planning
        WHERE TRIM(COALESCE(recurso_codigo,'')) = ''
          AND produto_codigo IS NOT NULL AND TRIM(produto_codigo) != ''
          AND operacao_codigo IS NOT NULL AND TRIM(operacao_codigo) != ''
    `);
    console.log(pendRec.length, "combinações produto+operação a resolver");

    if (pendRec.length > 0) {
        const prods = [...new Set(pendRec.map(r=>(r.produto_codigo||'').trim()))];
        const res = await pg.query(`
            SELECT TRIM(g2_produto) produto, TRIM(g2_operac) operacao, TRIM(g2_recurso) recurso
            FROM public.sg2010
            WHERE TRIM(g2_produto) = ANY($1)
              AND COALESCE(d_e_l_e_t_,'') IN ('',' ')
              AND TRIM(COALESCE(g2_recurso,'')) != ''
        `, [prods]);
        const mapa = {};
        res.rows.forEach(r=>{ mapa[`${r.produto}_${r.operacao}`] = r.recurso; });

        let ok = 0;
        for (const reg of pendRec) {
            const chave = `${(reg.produto_codigo||'').trim()}_${(reg.operacao_codigo||'').trim()}`;
            if (mapa[chave]) {
                await my.execute(`
                    UPDATE app_production_planning SET recurso_codigo = ?
                    WHERE TRIM(COALESCE(recurso_codigo,'')) = ''
                      AND TRIM(produto_codigo) = ? AND TRIM(operacao_codigo) = ?
                `, [mapa[chave].trim(), reg.produto_codigo.trim(), reg.operacao_codigo.trim()]);
                ok++;
            }
        }
        console.log("recurso_codigo corrigidos:", ok, "combinações");
    }

    // ── CORRIGE produto_codigo via sc2010 ──────────────────────────────────
    console.log("\n=== CORRIGINDO produto_codigo via sc2010 ===");
    const [pendProd] = await my.execute(`
        SELECT DISTINCT op_numero, op_item, op_sequencia
        FROM app_production_planning
        WHERE produto_codigo IS NULL OR TRIM(produto_codigo) = ''
    `);
    console.log(pendProd.length, "combinações op+item sem produto");

    if (pendProd.length > 0) {
        const opsP = [...new Set(pendProd.map(r=>(r.op_numero||'').trim()))];
        const resP = await pg.query(`
            SELECT TRIM(c2_num) op, TRIM(c2_item) item, TRIM(c2_sequen) sequen, TRIM(c2_produto) produto
            FROM public.sc2010
            WHERE TRIM(c2_num) = ANY($1)
              AND COALESCE(d_e_l_e_t_,'') IN ('',' ')
        `, [opsP]);
        const mapaP = {};
        resP.rows.forEach(r=>{ mapaP[`${r.op}_${r.item}_${r.sequen}`] = r.produto; mapaP[`${r.op}_${r.item}`] = r.produto; });

        let okP = 0;
        for (const reg of pendProd) {
            const ch1 = `${(reg.op_numero||'').trim()}_${(reg.op_item||'').trim()}_${(reg.op_sequencia||'').trim()}`;
            const ch2 = `${(reg.op_numero||'').trim()}_${(reg.op_item||'').trim()}`;
            const produto = mapaP[ch1] || mapaP[ch2];
            if (produto) {
                await my.execute(`
                    UPDATE app_production_planning SET produto_codigo = ?
                    WHERE op_numero = ? AND op_item = ? AND op_sequencia = ?
                      AND (produto_codigo IS NULL OR TRIM(produto_codigo) = '')
                `, [produto.trim(), reg.op_numero.trim(), reg.op_item.trim(), reg.op_sequencia.trim()]);
                okP++;
            }
        }
        console.log("produto_codigo corrigidos:", okP, "registros");
    }

    // ── Relatório final ────────────────────────────────────────────────────
    console.log("\n=== SITUACAO FINAL ===");
    const [[tot]]  = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning");
    const [[ped2]] = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning WHERE pedido_venda IS NULL OR TRIM(pedido_venda) = ''");
    const [[pr2]]  = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning WHERE produto_codigo IS NULL OR TRIM(produto_codigo) = ''");
    const [[rc2]]  = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning WHERE TRIM(COALESCE(recurso_codigo,'')) = ''");
    const [[dur2]] = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning WHERE duracao_dias IS NULL OR duracao_dias = 0");
    console.log("Total:              ", tot.cnt);
    console.log("Sem pedido_venda:   ", ped2.cnt, ped2.cnt > 0 ? "(OPs sem pedido no Protheus — historico)" : "OK");
    console.log("Sem produto_codigo: ", pr2.cnt,  pr2.cnt  === 0 ? "OK" : "PENDENTE");
    console.log("Sem recurso_codigo: ", rc2.cnt,  rc2.cnt  === 0 ? "OK" : "PENDENTE");
    console.log("Sem duracao_dias:   ", dur2.cnt, dur2.cnt  === 0 ? "OK" : "PENDENTE");

    await pg.end(); await my.end();
}
main().catch(e=>{ console.error("ERRO:", e.message); process.exit(1); });
