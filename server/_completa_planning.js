require('dotenv').config();
/**
 * Migração de Complementação — app_production_planning
 * 
 * Percorre toda a tabela e preenche:
 *   1. pedido_venda   → sc2010 (c2_pedido)
 *   2. produto_codigo → sc2010 (c2_produto)
 *   3. recurso_codigo → sg2010 (g2_recurso)
 *   4. duracao_dias   → calculado pelas datas planejadas
 */
require("dotenv").config();
const { Pool } = require("pg");
const mysql = require("mysql2/promise");

const pg = new Pool({
    host: process.env.PGHOST, port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE || "p12prd",
    user: process.env.PGUSER, password: process.env.PGPASSWORD
});

const LOTE_SIZE = 500;

async function main() {
    const my = await mysql.createConnection({
        host: process.env.MYSQL_HOST, port: 3306,
        database: process.env.MYSQL_DB, user: process.env.MYSQL_USER, password: process.env.MYSQL_PASS
    });

    console.log("╔══════════════════════════════════════════════════════╗");
    console.log("║    COMPLEMENTAÇÃO TOTAL — app_production_planning    ║");
    console.log("╚══════════════════════════════════════════════════════╝\n");

    // ── PASSO 1: pedido_venda e produto_codigo via sc2010 ────────────────────
    console.log("📌 PASSO 1: Buscando pedido_venda + produto_codigo no Protheus (sc2010)...");

    // Busca todos os pares únicos op_numero+op_item no MySQL que faltam dados
    const [registros] = await my.execute(`
        SELECT DISTINCT op_numero, op_item, op_sequencia, produto_codigo
        FROM app_production_planning
        WHERE (pedido_venda IS NULL OR pedido_venda = '')
           OR (produto_codigo IS NULL OR produto_codigo = '')
    `);
    console.log(`   ${registros.length} combinações distintas para completar`);

    const uniqueOps = [...new Set(registros.map(r => (r.op_numero || '').trim()))];
    console.log(`   ${uniqueOps.length} OPs distintas para consultar`);

    // Busca no Protheus em lotes de 500
    const opMap = {}; // op_numero+item+sequen → { pedido, produto }
    for (let i = 0; i < uniqueOps.length; i += LOTE_SIZE) {
        const lote = uniqueOps.slice(i, i + LOTE_SIZE);
        const res = await pg.query(`
            SELECT 
                TRIM(c2_num)    AS op,
                TRIM(c2_item)   AS item,
                TRIM(c2_sequen) AS sequen,
                TRIM(c2_pedido) AS pedido,
                TRIM(c2_produto) AS produto
            FROM public.sc2010
            WHERE TRIM(c2_num) = ANY($1)
              AND COALESCE(d_e_l_e_t_,'') IN ('',' ')
        `, [lote]);
        res.rows.forEach(r => {
            const chave = `${r.op}_${r.item}_${r.sequen}`;
            opMap[chave] = { pedido: r.pedido, produto: r.produto };
            // Também salva sem sequen (fallback por op+item)
            const chaveSemSeq = `${r.op}_${r.item}`;
            if (!opMap[chaveSemSeq]) opMap[chaveSemSeq] = { pedido: r.pedido, produto: r.produto };
        });
        process.stdout.write(`\r   Consultado ${Math.min(i + LOTE_SIZE, uniqueOps.length)}/${uniqueOps.length} OPs...`);
    }
    console.log("\n");

    // Atualiza MySQL em lotes
    let ped_atualizados = 0, prod_atualizados = 0;
    for (const reg of registros) {
        const chave     = `${(reg.op_numero||'').trim()}_${(reg.op_item||'').trim()}_${(reg.op_sequencia||'').trim()}`;
        const chaveFB   = `${(reg.op_numero||'').trim()}_${(reg.op_item||'').trim()}`;
        const dado      = opMap[chave] || opMap[chaveFB];
        if (!dado) continue;

        const updates = [];
        const params  = [];

        if ((!reg.pedido_venda || reg.pedido_venda === '') && dado.pedido) {
            updates.push("pedido_venda = ?");
            params.push(dado.pedido.trim());
        }
        if ((!reg.produto_codigo || reg.produto_codigo === '') && dado.produto) {
            updates.push("produto_codigo = ?");
            params.push(dado.produto.trim());
        }

        if (updates.length > 0) {
            params.push(
                (reg.op_numero || '').trim(),
                (reg.op_item || '').trim(),
                (reg.op_sequencia || '').trim()
            );
            await my.execute(
                `UPDATE app_production_planning SET ${updates.join(', ')}
                 WHERE op_numero = ? AND op_item = ? AND op_sequencia = ?`,
                params
            );
            if (updates.some(u => u.includes('pedido_venda')))  ped_atualizados++;
            if (updates.some(u => u.includes('produto_codigo'))) prod_atualizados++;
        }
    }
    console.log(`   ✅ pedido_venda:   ${ped_atualizados} registros atualizados`);
    console.log(`   ✅ produto_codigo: ${prod_atualizados} registros atualizados`);

    // ── PASSO 2: recurso_codigo via sg2010 ───────────────────────────────────
    console.log("\n📌 PASSO 2: Buscando recurso_codigo no Protheus (sg2010)...");

    const [semRecurso] = await my.execute(`
        SELECT DISTINCT produto_codigo, operacao_codigo
        FROM app_production_planning
        WHERE (recurso_codigo IS NULL OR recurso_codigo = '')
          AND produto_codigo IS NOT NULL AND produto_codigo != ''
          AND operacao_codigo IS NOT NULL AND operacao_codigo != ''
    `);
    console.log(`   ${semRecurso.length} combinações produto+operação para resolver`);

    const prodOpRecurso = {}; // produto+operacao → recurso
    const prods = [...new Set(semRecurso.map(r => (r.produto_codigo || '').trim()))];

    for (let i = 0; i < prods.length; i += LOTE_SIZE) {
        const lote = prods.slice(i, i + LOTE_SIZE);
        const res = await pg.query(`
            SELECT TRIM(g2_produto) AS produto,
                   TRIM(g2_operac)  AS operacao,
                   TRIM(g2_recurso) AS recurso
            FROM public.sg2010
            WHERE TRIM(g2_produto) = ANY($1)
              AND COALESCE(d_e_l_e_t_,'') IN ('',' ')
              AND g2_recurso IS NOT NULL AND TRIM(g2_recurso) != ''
        `, [lote]);
        res.rows.forEach(r => {
            prodOpRecurso[`${r.produto}_${r.operacao}`] = r.recurso;
        });
        process.stdout.write(`\r   Consultado ${Math.min(i + LOTE_SIZE, prods.length)}/${prods.length} produtos...`);
    }
    console.log("\n");

    let rec_atualizados = 0;
    for (const reg of semRecurso) {
        const chave   = `${(reg.produto_codigo||'').trim()}_${(reg.operacao_codigo||'').trim()}`;
        const recurso = prodOpRecurso[chave];
        if (!recurso) continue;
        await my.execute(`
            UPDATE app_production_planning
            SET recurso_codigo = ?
            WHERE produto_codigo = ? AND operacao_codigo = ?
              AND (recurso_codigo IS NULL OR recurso_codigo = '')
        `, [recurso.trim(), (reg.produto_codigo||'').trim(), (reg.operacao_codigo||'').trim()]);
        rec_atualizados++;
    }
    console.log(`   ✅ recurso_codigo: ${rec_atualizados} combinações produto/op atualizadas`);

    // ── PASSO 3: duracao_dias calculado pelas datas ───────────────────────────
    console.log("\n📌 PASSO 3: Calculando duracao_dias pelas datas planejadas...");

    const [semDuracao] = await my.execute(`
        SELECT id, data_planejada_inicio, data_planejada_fim
        FROM app_production_planning
        WHERE (duracao_dias IS NULL OR duracao_dias = 0)
          AND data_planejada_inicio IS NOT NULL
          AND data_planejada_fim IS NOT NULL
    `);
    console.log(`   ${semDuracao.length} registros sem duracao_dias`);

    let dur_atualizados = 0;
    // Processa em lotes de 100 (UPDATE individual é muito lento)
    const lotesDuracao = [];
    for (let i = 0; i < semDuracao.length; i += 100) {
        lotesDuracao.push(semDuracao.slice(i, i + 100));
    }
    for (const lote of lotesDuracao) {
        for (const reg of lote) {
            const ini    = new Date(reg.data_planejada_inicio);
            const fim    = new Date(reg.data_planejada_fim);
            const dias   = Math.max(1, Math.ceil((fim - ini) / (1000 * 60 * 60 * 24)) + 1);
            await my.execute(
                "UPDATE app_production_planning SET duracao_dias = ? WHERE id = ?",
                [dias, reg.id]
            );
            dur_atualizados++;
        }
        process.stdout.write(`\r   Atualizado ${dur_atualizados}/${semDuracao.length}...`);
    }
    console.log("\n");
    console.log(`   ✅ duracao_dias: ${dur_atualizados} registros calculados`);

    // ── RELATÓRIO FINAL ────────────────────────────────────────────────────────
    console.log("\n" + "═".repeat(55));
    console.log("📊 SITUAÇÃO FINAL DA TABELA:");
    console.log("═".repeat(55));
    const [[f_tot]]  = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning");
    const [[f_ped]]  = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning WHERE pedido_venda IS NULL OR pedido_venda = ''");
    const [[f_prod]] = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning WHERE produto_codigo IS NULL OR produto_codigo = ''");
    const [[f_rec]]  = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning WHERE recurso_codigo IS NULL OR recurso_codigo = ''");
    const [[f_dur]]  = await my.execute("SELECT COUNT(*) cnt FROM app_production_planning WHERE duracao_dias IS NULL OR duracao_dias = 0");

    console.log(`  Total registros:    ${f_tot.cnt}`);
    console.log(`  Sem pedido_venda:   ${f_ped.cnt}  ${f_ped.cnt === 0 ? '✅' : '⚠️'}`);
    console.log(`  Sem produto_codigo: ${f_prod.cnt} ${f_prod.cnt === 0 ? '✅' : '⚠️'}`);
    console.log(`  Sem recurso_codigo: ${f_rec.cnt} ${f_rec.cnt === 0 ? '✅' : '⚠️'}`);
    console.log(`  Sem duracao_dias:   ${f_dur.cnt} ${f_dur.cnt === 0 ? '✅' : '⚠️'}`);
    console.log("═".repeat(55));

    await pg.end();
    await my.end();
    console.log("\n✅ Complementação concluída!");
}
main().catch(e => { console.error("ERRO FATAL:", e.message, e.stack); process.exit(1); });
