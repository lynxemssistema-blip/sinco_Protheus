process.chdir(__dirname);
require('dotenv').config();
const mysql = require('mysql2/promise');
const db = require('./db');

async function main() {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB,
        charset: 'utf8mb4',
        connectionLimit: 3
    });

    // Lote ativo
    const loteRes = await pool.query('SELECT lote_id FROM app_demanda_vmi_lotes ORDER BY created_at DESC LIMIT 1');
    const lote = loteRes[0][0].lote_id;
    console.log('Lote ativo:', lote);

    // Códigos na DEMANDA ativa
    const [demand] = await pool.query(
        'SELECT DISTINCT codigo_produto_cliente FROM app_demanda_vmi WHERE lote_importacao = ? LIMIT 15',
        [lote]
    );
    const codsVMI = demand.map(r => r.codigo_produto_cliente);
    console.log('\nCódigos na DEMANDA (primeiros 15):');
    codsVMI.forEach(c => console.log('  "' + c + '"'));

    // Códigos no MAP
    const [mapSample] = await pool.query('SELECT codigo_produto_cliente, b1_cod FROM app_demanda_vmi_map LIMIT 15');
    console.log('\nCódigos no MAP (primeiros 15):');
    mapSample.forEach(r => console.log('  "' + r.codigo_produto_cliente + '" -> "' + r.b1_cod + '"'));

    // Match EXATO entre demanda e map
    const ph = codsVMI.map(() => '?').join(',');
    const [found1] = await pool.query(
        'SELECT codigo_produto_cliente, b1_cod FROM app_demanda_vmi_map WHERE codigo_produto_cliente IN (' + ph + ')',
        codsVMI
    );
    console.log('\nMatch EXATO (demanda.cod -> map.cod):', found1.length, 'de', codsVMI.length);

    // Match sem pontos: limpamos os códigos da demanda e buscamos no map
    const codsLimpos = [...new Set(codsVMI.map(c => c.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()))];
    console.log('\nCódigos LIMPOS (sem pontos):');
    codsLimpos.forEach(c => console.log('  "' + c + '"'));

    const ph2 = codsLimpos.map(() => '?').join(',');
    const [found2] = await pool.query(
        'SELECT codigo_produto_cliente, b1_cod FROM app_demanda_vmi_map WHERE codigo_produto_cliente IN (' + ph2 + ')',
        codsLimpos
    );
    console.log('\nMatch LIMPO (demanda.sempontos -> map.cod):', found2.length, 'de', codsLimpos.length);
    if (found2.length > 0) {
        console.log('Exemplos encontrados:');
        found2.slice(0, 5).forEach(r => console.log('  "' + r.codigo_produto_cliente + '" -> "' + r.b1_cod + '"'));
    }

    // Conferir total de mapeamentos que correspondem ao lote atual
    const [allCods] = await pool.query(
        'SELECT DISTINCT codigo_produto_cliente FROM app_demanda_vmi WHERE lote_importacao = ?',
        [lote]
    );
    const allCodsVMI = allCods.map(r => r.codigo_produto_cliente);
    const allCodsLimpos = [...new Set(allCodsVMI.map(c => c.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()))];
    const [totalFound] = await pool.query(
        'SELECT COUNT(*) as cnt FROM app_demanda_vmi_map WHERE codigo_produto_cliente IN (' + allCodsLimpos.map(() => '?').join(',') + ')',
        allCodsLimpos
    );
    console.log('\nTotal de mapeamentos que batem com lote ativo (busca limpa):', totalFound[0].cnt, 'de', allCodsLimpos.length, 'produtos únicos');

    // SC6: como estão os pedidos?
    console.log('\n--- SC6 sample (c6_pedcli) ---');
    try {
        const sc6s = await db.query("SELECT DISTINCT TRIM(c6_pedcli) as pedcli FROM public.sc6010 WHERE COALESCE(d_e_l_e_t_,'') IN ('',' ') AND TRIM(c6_pedcli)<>'' LIMIT 15");
        sc6s.rows.forEach(r => console.log('  "' + r.pedcli + '"'));

        const sc6_36622 = await db.query("SELECT TRIM(c6_pedcli) as pedcli, TRIM(c6_num) as num, TRIM(c6_produto) as prod FROM public.sc6010 WHERE c6_pedcli LIKE '%36622%' AND COALESCE(d_e_l_e_t_,'') IN ('',' ') LIMIT 5");
        console.log('\nSC6 pedcli like 36622:', sc6_36622.rowCount, 'resultados');
        sc6_36622.rows.forEach(r => console.log('  pedcli="' + r.pedcli + '" num="' + r.num + '" prod="' + r.prod + '"'));
    } catch(e) { console.error('Erro SC6:', e.message); }

    await pool.end();
    process.exit(0);
}
main().catch(e => { console.error('ERRO FATAL:', e.message); process.exit(1); });
