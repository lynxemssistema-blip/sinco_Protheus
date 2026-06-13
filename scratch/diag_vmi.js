// Diagnóstico VMI — roda direto no servidor: node /var/www/metalfisa/server/diag_vmi.js
process.chdir(__dirname);
require('dotenv').config();
const db = require('./db');
const mysqlPool = require('./services/mysqlService');

async function main() {
    console.log('\n========== 1. MAPEAMENTO MANUAL (app_demanda_vmi_map) ==========');
    const [mapRows] = await mysqlPool.query('SELECT COUNT(*) as total FROM app_demanda_vmi_map');
    console.log('Total de vínculos salvos:', mapRows[0].total);
    if (mapRows[0].total > 0) {
        const [sample] = await mysqlPool.query('SELECT * FROM app_demanda_vmi_map LIMIT 5');
        console.log('Amostra:', JSON.stringify(sample, null, 2));
    }

    console.log('\n========== 2. CODIGOS CLIENTE NA DEMANDA ATIVA ==========');
    const [demandaRows] = await mysqlPool.query(`
        SELECT DISTINCT codigo_produto_cliente
        FROM app_demanda_vmi
        WHERE lote_importacao = (SELECT lote_id FROM app_demanda_vmi_lotes ORDER BY created_at DESC LIMIT 1)
        LIMIT 20
    `);
    const codigosCliente = demandaRows.map(r => r.codigo_produto_cliente);
    console.log('Primeiros 20 códigos do cliente:', codigosCliente);

    console.log('\n========== 3. NORMALIZACAO DOS CODIGOS ==========');
    const cleanItems = codigosCliente.map(c => ({
        original: c,
        limpo: c.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    }));
    cleanItems.slice(0, 10).forEach(x => console.log(`  "${x.original}" → "${x.limpo}"`));
    const limpos = cleanItems.map(x => x.limpo).filter(Boolean);

    console.log('\n========== 4. SZ1 TOTAL — quantos registros existem? ==========');
    try {
        const totalSZ1 = await db.query(`SELECT COUNT(*) as total FROM public.sz1010 WHERE COALESCE(d_e_l_e_t_, '') = ''`);
        console.log('Total registros ativos em SZ1:', totalSZ1.rows[0].total);
        const sampleSZ1 = await db.query(`
            SELECT TRIM(z1_codcli) as codcli, TRIM(z1_produto) as produto, TRIM(z1_revisao) as rev
            FROM public.sz1010
            WHERE COALESCE(d_e_l_e_t_, '') = '' AND TRIM(z1_produto) <> ''
            LIMIT 10
        `);
        console.log('Amostra SZ1 (primeiros 10):');
        sampleSZ1.rows.forEach(r => console.log(`  codcli="${r.codcli}"  produto="${r.produto}"  rev="${r.rev}"`));
    } catch (e) {
        console.error('Erro SZ1 total:', e.message);
    }

    console.log('\n========== 5. SZ1 EXACT MATCH com códigos normalizados ==========');
    try {
        const sz1Exact = await db.query(`
            SELECT
                TRIM(sz1.z1_codcli) AS z1_codcli_raw,
                UPPER(REGEXP_REPLACE(TRIM(sz1.z1_codcli), '[^a-zA-Z0-9]', '', 'g')) AS z1_codcli_limpo,
                TRIM(sz1.z1_produto) AS z1_produto
            FROM public.sz1010 sz1
            WHERE UPPER(REGEXP_REPLACE(TRIM(sz1.z1_codcli), '[^a-zA-Z0-9]', '', 'g')) = ANY($1::text[])
            AND COALESCE(sz1.d_e_l_e_t_, '') = ''
            AND TRIM(sz1.z1_produto) <> ''
            LIMIT 20
        `, [limpos]);
        console.log(`SZ1 com exact match normalizado: ${sz1Exact.rowCount} resultados`);
        if (sz1Exact.rowCount > 0) sz1Exact.rows.forEach(r =>
            console.log(`  raw="${r.z1_codcli_raw}" → limpo="${r.z1_codcli_limpo}" → produto="${r.z1_produto}"`)
        );
    } catch (e) {
        console.error('Erro SZ1 exact:', e.message);
    }

    console.log('\n========== 6. SZ1 ILIKE com primeiros 9 chars dos códigos ==========');
    const base9 = [...new Set(limpos.map(c => c.substring(0, 9)).filter(x => x.length >= 3))].slice(0, 10);
    console.log('Buscando bases 9 chars:', base9);
    for (const base of base9.slice(0, 5)) {
        try {
            const r = await db.query(`
                SELECT TRIM(z1_codcli) as codcli, TRIM(z1_produto) as produto
                FROM public.sz1010
                WHERE UPPER(REGEXP_REPLACE(TRIM(z1_codcli), '[^a-zA-Z0-9]', '', 'g')) ILIKE '%' || $1 || '%'
                AND COALESCE(d_e_l_e_t_, '') = ''
                LIMIT 5
            `, [base]);
            console.log(`  Base "${base}": ${r.rowCount} resultados`);
            if (r.rowCount > 0) r.rows.forEach(x => console.log(`    "${x.codcli}" → "${x.produto}"`));
        } catch (e) {
            console.error(`  Erro base ${base}:`, e.message);
        }
    }

    console.log('\n========== 7. SC6 — pedido cliente 036622 ==========');
    try {
        const sc6 = await db.query(`
            SELECT TRIM(c6_pedcli) as pedcli, TRIM(c6_num) as num, TRIM(c6_produto) as produto,
                   c6_qtdven as qtd_pedido, c6_qtdent as qtd_entregue
            FROM public.sc6010
            WHERE (c6_pedcli LIKE '%036622%' OR c6_pedcli LIKE '%36622%')
            AND COALESCE(d_e_l_e_t_, '') IN ('', ' ')
            LIMIT 10
        `);
        console.log(`SC6 para pedcli "036622": ${sc6.rowCount} resultados`);
        if (sc6.rowCount > 0) sc6.rows.forEach(r =>
            console.log(`  pedcli="${r.pedcli}" num="${r.num}" produto="${r.produto}" qtdPed=${r.qtd_pedido} qtdEnt=${r.qtd_entregue}`)
        );
    } catch (e) {
        console.error('Erro SC6:', e.message);
    }

    console.log('\n========== 8. SC6 amostra — como é c6_pedcli real? ==========');
    try {
        const sc6sample = await db.query(`
            SELECT DISTINCT TRIM(c6_pedcli) as pedcli
            FROM public.sc6010
            WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')
            AND TRIM(c6_pedcli) <> ''
            LIMIT 15
        `);
        console.log('Exemplos de c6_pedcli no SC6:');
        sc6sample.rows.forEach(r => console.log(`  "${r.pedcli}"`));
    } catch (e) {
        console.error('Erro SC6 sample:', e.message);
    }

    console.log('\n========== 9. SB1 — produto 33.20.10335 ==========');
    try {
        const sb1 = await db.query(`
            SELECT TRIM(b1_cod) as b1_cod, TRIM(b1_desc) as b1_desc
            FROM public.sb1010
            WHERE TRIM(b1_cod) LIKE '%33.20.10335%'
            AND COALESCE(d_e_l_e_t_, '') = ''
        `);
        console.log(`SB1 "33.20.10335": ${sb1.rowCount} resultados`);
        sb1.rows.forEach(r => console.log(`  b1_cod="${r.b1_cod}" desc="${r.b1_desc}"`));
    } catch (e) {
        console.error('Erro SB1:', e.message);
    }

    process.exit(0);
}

main().catch(e => { console.error('ERRO FATAL:', e.message); process.exit(1); });
