process.chdir(__dirname);
require('dotenv').config();
const db = require('./db');
const mysql = require('mysql2/promise');

async function main() {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB,
        connectionLimit: 3
    });

    console.log('=== 1. Produto 33.20.10335.01 no mapeamento ===');
    const [m] = await pool.query(
        'SELECT codigo_produto_cliente, b1_cod FROM app_demanda_vmi_map WHERE codigo_produto_cliente LIKE ?',
        ['33.20.10335%']
    );
    console.log('Resultado:', m.length > 0 ? JSON.stringify(m) : 'NAO ENCONTRADO');

    if (m.length === 0) {
        // Procura sem os pontos
        const [m2] = await pool.query(
            'SELECT codigo_produto_cliente, b1_cod FROM app_demanda_vmi_map WHERE REPLACE(REPLACE(codigo_produto_cliente,".",""),"-","") LIKE ?',
            ['3320103350%']
        );
        console.log('Busca normalizada:', m2.length > 0 ? JSON.stringify(m2) : 'TAMBÉM NAO ENCONTRADO');
    }

    console.log('\n=== 2. Pedido 036622 no SC6 (todos os produtos) ===');
    const sc6all = await db.query(
        "SELECT TRIM(c6_pedcli) as pedcli, TRIM(c6_num) as num, TRIM(c6_produto) as prod, c6_qtdven as ven, c6_qtdent as ent FROM public.sc6010 WHERE c6_pedcli LIKE '%36622%' AND COALESCE(d_e_l_e_t_,'') IN ('',' ') LIMIT 20"
    );
    console.log('SC6 para pedcli 36622:', sc6all.rowCount, 'resultados');
    sc6all.rows.forEach(r => console.log(`  pedcli="${r.pedcli}" num="${r.num}" prod="${r.prod}" ven=${r.ven} ent=${r.ent}`));

    if (m.length > 0) {
        const b1cod = m[0].b1_cod;
        console.log('\n=== 3. SC6 pedido 36622 + produto mapeado', b1cod, '===');
        const sc6prod = await db.query(
            "SELECT TRIM(c6_num) as num, TRIM(c6_produto) as prod, c6_qtdven, c6_qtdent FROM public.sc6010 WHERE c6_pedcli LIKE '%36622%' AND TRIM(c6_produto) = $1 AND COALESCE(d_e_l_e_t_,'') IN ('',' ')",
            [b1cod]
        );
        console.log('Resultado:', sc6prod.rowCount, 'rows', JSON.stringify(sc6prod.rows));
    }

    console.log('\n=== 4. Total produtos mapeados vs não mapeados no lote ativo ===');
    const [loteRes] = await pool.query('SELECT lote_id FROM app_demanda_vmi_lotes ORDER BY created_at DESC LIMIT 1');
    const lote = loteRes[0].lote_id;
    const [allCods] = await pool.query('SELECT DISTINCT codigo_produto_cliente FROM app_demanda_vmi WHERE lote_importacao = ?', [lote]);
    const codigos = allCods.map(r => r.codigo_produto_cliente);
    const ph = codigos.map(() => '?').join(',');
    const [mapped] = await pool.query('SELECT codigo_produto_cliente, b1_cod FROM app_demanda_vmi_map WHERE codigo_produto_cliente IN (' + ph + ')', codigos);
    console.log('Total produtos únicos no lote:', codigos.length);
    console.log('Total mapeados:', mapped.length);
    console.log('Sem mapeamento:', codigos.length - mapped.length);

    if (mapped.length > 0) {
        console.log('\nExemplos mapeados:');
        mapped.slice(0, 5).forEach(r => console.log(`  "${r.codigo_produto_cliente}" -> "${r.b1_cod}"`));
    }

    // Verifica se app_vmi_pdfs existe
    console.log('\n=== 5. Tabela app_vmi_pdfs existe? ===');
    try {
        const [t] = await pool.query('SELECT COUNT(*) as cnt FROM app_vmi_pdfs');
        console.log('EXISTE, total:', t[0].cnt);
    } catch (e) {
        console.log('NAO EXISTE:', e.message);
    }

    await pool.end();
    process.exit(0);
}
main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
