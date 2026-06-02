/**
 * Complementação profunda — busca pedido_venda inclusive em registros históricos
 * e tenta resolver recurso_codigo por produto quando não há correspondência exata de operação
 */
require("dotenv").config();
const { Pool } = require("pg");
const mysql = require("mysql2/promise");

const pg = new Pool({ host:process.env.PGHOST, port:process.env.PGPORT||5432, database:process.env.PGDATABASE||"p12prd", user:process.env.PGUSER, password:process.env.PGPASSWORD });

async function main() {
    const my = await mysql.createConnection({
        host:"metalfisa.mysql.uhserver.com",port:3306,database:"metalfisa",user:"ronaldo2",password:"jHAzhFG848@yN@U"
    });

    // ── 1. pedido_venda — busca INCLUSIVE históricos (d_e_l_e_t_='*') ────────
    console.log("=== PASSO 1: pedido_venda (busca ampliada no Protheus) ===");
    const [pendPed] = await my.execute(`
        SELECT DISTINCT op_numero, op_item, op_sequencia
        FROM app_production_planning
        WHERE pedido_venda IS NULL OR TRIM(pedido_venda) = ''
    `);
    console.log(pendPed.length, "combinações sem pedido_venda");

    const opsP = [...new Set(pendPed.map(r=>(r.op_numero||'').trim()))];
    console.log(opsP.length, "OPs distintas a consultar");

    // Busca inclusive deletados e com c2_pedido mesmo que vazio
    const pgRes = await pg.query(`
        SELECT DISTINCT
            TRIM(c2_num)    AS op,
            TRIM(c2_item)   AS item,
            TRIM(c2_sequen) AS sequen,
            TRIM(c2_pedido) AS pedido,
            TRIM(c2_produto) AS produto
        FROM public.sc2010
        WHERE TRIM(c2_num) = ANY($1)
    `, [opsP]);
    console.log(pgRes.rowCount, "registros encontrados no Protheus (incluindo histórico)");

    const mapaOP = {};
    pgRes.rows.forEach(r => {
        if (!r.pedido) return;
        const ch3 = `${r.op}_${r.item}_${r.sequen}`;
        const ch2 = `${r.op}_${r.item}`;
        const ch1 = r.op;
        if (!mapaOP[ch3]) mapaOP[ch3] = r.pedido;
        if (!mapaOP[ch2]) mapaOP[ch2] = r.pedido;
        if (!mapaOP[ch1]) mapaOP[ch1] = r.pedido;
    });

    let ped_ok = 0;
    for (const reg of pendPed) {
        const ch3 = `${(reg.op_numero||'').trim()}_${(reg.op_item||'').trim()}_${(reg.op_sequencia||'').trim()}`;
        const ch2 = `${(reg.op_numero||'').trim()}_${(reg.op_item||'').trim()}`;
        const ch1 = (reg.op_numero||'').trim();
        const ped = mapaOP[ch3] || mapaOP[ch2] || mapaOP[ch1];
        if (ped && ped.trim() !== '') {
            await my.execute(`
                UPDATE app_production_planning SET pedido_venda = ?
                WHERE op_numero = ? AND op_item = ? AND op_sequencia = ?
                  AND (pedido_venda IS NULL OR TRIM(pedido_venda) = '')
            `, [ped.trim(), reg.op_numero.trim(), reg.op_item.trim(), reg.op_sequencia.trim()]);
            ped_ok++;
        }
    }
    console.log("pedido_venda preenchido:", ped_ok, "registros\n");

    // ── 2. recurso_codigo — tenta por produto sem exigir operação exata ──────
    console.log("=== PASSO 2: recurso_codigo (por produto — operação principal) ===");
    const [pendRec] = await my.execute(`
        SELECT DISTINCT produto_codigo, operacao_codigo
        FROM app_production_planning
        WHERE TRIM(COALESCE(recurso_codigo,'')) = ''
          AND produto_codigo IS NOT NULL AND TRIM(produto_codigo) != ''
    `);
    console.log(pendRec.length, "combinações produto+operacao sem recurso");

    const prods = [...new Set(pendRec.map(r=>(r.produto_codigo||'').trim()))];
    const pgRec = await pg.query(`
        SELECT TRIM(g2_produto) produto, TRIM(g2_operac) operacao, TRIM(g2_recurso) recurso
        FROM public.sg2010
        WHERE TRIM(g2_produto) = ANY($1)
          AND TRIM(COALESCE(g2_recurso,'')) != ''
    `, [prods]);
    console.log(pgRec.rowCount, "linhas encontradas em sg2010");

    // Mapa exato produto+op, e também só produto (fallback op principal = '10')
    const mapaRec   = {};  // produto+op → recurso
    const mapaRec1  = {};  // produto → recurso da op10 (principal)
    pgRec.rows.forEach(r => {
        mapaRec[`${r.produto}_${r.operacao}`] = r.recurso;
        if (r.operacao === '10') mapaRec1[r.produto] = r.recurso;
    });

    let rec_ok = 0;
    for (const reg of pendRec) {
        const chE  = `${(reg.produto_codigo||'').trim()}_${(reg.operacao_codigo||'').trim()}`;
        const prod = (reg.produto_codigo||'').trim();
        // Tenta: exato → op10 → qualquer op do produto
        const recurso = mapaRec[chE] || mapaRec1[prod];
        if (recurso) {
            await my.execute(`
                UPDATE app_production_planning SET recurso_codigo = ?
                WHERE TRIM(COALESCE(recurso_codigo,'')) = ''
                  AND TRIM(produto_codigo) = ? AND TRIM(operacao_codigo) = ?
            `, [recurso.trim(), prod, (reg.operacao_codigo||'').trim()]);
            rec_ok++;
        }
    }
    console.log("recurso_codigo preenchido:", rec_ok, "combinações\n");

    // ── Relatório final ────────────────────────────────────────────────────
    console.log("=== SITUACAO FINAL ===");
    const [[tot]]  = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning");
    const [[ped2]] = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning WHERE pedido_venda IS NULL OR TRIM(pedido_venda) = ''");
    const [[pr2]]  = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning WHERE produto_codigo IS NULL OR TRIM(produto_codigo) = ''");
    const [[rc2]]  = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning WHERE TRIM(COALESCE(recurso_codigo,'')) = ''");
    const [[dur2]] = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning WHERE duracao_dias IS NULL OR duracao_dias = 0");
    console.log("Total:              ", tot.cnt);
    console.log("Sem pedido_venda:   ", ped2.cnt, ped2.cnt > 10000 ? "(historico sem pedido no Protheus)" : ped2.cnt === 0 ? "OK" : "PENDENTE");
    console.log("Sem produto_codigo: ", pr2.cnt,  pr2.cnt  === 0 ? "OK" : "PENDENTE");
    console.log("Sem recurso_codigo: ", rc2.cnt,  rc2.cnt  === 0 ? "OK" : "PENDENTE");
    console.log("Sem duracao_dias:   ", dur2.cnt, dur2.cnt === 0 ? "OK" : "PENDENTE");

    await pg.end(); await my.end();
    console.log("\nComplementacao concluida!");
}
main().catch(e=>{ console.error("ERRO:", e.message); process.exit(1); });
