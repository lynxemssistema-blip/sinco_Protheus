// AnÃ¡lise SOMENTE LEITURA do schema u494795077_SINCO: tamanho, Ã­ndices existentes e candidatos a Ã­ndice.
require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const REQUIRED = 'u494795077_SINCO';
if ((process.env.MYSQL_DB || '').trim() !== REQUIRED) {
    console.error('ABORTADO: MYSQL_DB deve ser ' + REQUIRED);
    process.exit(1);
}

// Colunas que costumam ser usadas em WHERE/JOIN/ORDER BY
const HOT = /^(id_?empresa|idempresa|pedido|item|codigo(_produto)?|cod(_produto)?|produto|b1_cod|op|numero_op|status|situacao|data(_\w+)?|dt_\w+|created_at|criado_em|usuario(_id)?|user_id|solicitacao_id|romaneio_id|id_\w+|\w+_id|cliente(_id|_nome)?|fornecedor(_id)?|lote|nf|chave\w*|recurso(_codigo)?|setor(_id)?)$/i;

(async () => {
    const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST, user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS, database: REQUIRED, connectTimeout: 20000
    });
    const [[{ db }]] = await conn.query('SELECT DATABASE() AS db');
    if (db !== REQUIRED) throw new Error('Banco inesperado: ' + db);

    const [tables] = await conn.query(
        `SELECT TABLE_NAME t, TABLE_ROWS r, ROUND((DATA_LENGTH+INDEX_LENGTH)/1048576,1) mb, ROUND(INDEX_LENGTH/1048576,1) idxmb, ENGINE e
         FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE'`, [REQUIRED]);
    const [cols] = await conn.query(
        `SELECT TABLE_NAME t, COLUMN_NAME c, DATA_TYPE d, COLUMN_TYPE ct FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME, ORDINAL_POSITION`, [REQUIRED]);
    const [idx] = await conn.query(
        `SELECT TABLE_NAME t, INDEX_NAME i, SEQ_IN_INDEX s, COLUMN_NAME c, NON_UNIQUE nu FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`, [REQUIRED]);

    const colsBy = {}; cols.forEach(x => (colsBy[x.t] ||= []).push(x));
    const idxBy = {};
    idx.forEach(x => { ((idxBy[x.t] ||= {})[x.i] ||= []).push(x.c); });

    const report = [];
    for (const tb of tables) {
        if (tb.r === null) continue;
        const indexes = idxBy[tb.t] || {};
        const leading = new Set(Object.values(indexes).map(a => a[0].toLowerCase()));
        const candidates = (colsBy[tb.t] || [])
            .filter(c => HOT.test(c.c) && !leading.has(c.c.toLowerCase()) && !/text|blob|json/i.test(c.d))
            .map(c => c.c);
        report.push({ table: tb.t, rows: Number(tb.r), mb: Number(tb.mb), idxmb: Number(tb.idxmb), engine: tb.e,
            indexes, candidates, noSecondaryIndex: Object.keys(indexes).filter(k => k !== 'PRIMARY').length === 0 });
    }
    report.sort((a, b) => b.rows - a.rows);

    const out = path.join(__dirname, '..', '_arquivo_morto', 'analise_indices.json');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(report, null, 1));
    console.log(`Tabelas: ${tables.length} | analisadas: ${report.length} | sem indice secundario: ${report.filter(r => r.noSecondaryIndex).length}`);
    report.slice(0, 60).forEach(r => console.log(`${r.table.padEnd(42)} rows=${String(r.rows).padStart(8)} ${String(r.mb).padStart(7)}MB idx=${r.idxmb}MB nIdx=${Object.keys(r.indexes).length} cand=[${r.candidates.join(',')}]`));
    await conn.end();
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });

