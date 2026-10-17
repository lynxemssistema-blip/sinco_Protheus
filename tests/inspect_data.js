const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });
const db = require('../server/services/mysqlService');

async function main() {
    console.log('--- INSPECIONANDO TABELAS DO BANCO SINCO ---');
    const [tables] = await db.query('SHOW TABLES');
    const tableKey = Object.keys(tables[0])[0];
    const withData = [];
    const emptyTables = [];

    for (const row of tables) {
        const t = row[tableKey];
        try {
            const [cnt] = await db.query(`SELECT COUNT(*) as c FROM \`${t}\``);
            const count = cnt[0].c;
            if (count > 0) {
                withData.push({ table: t, count });
            } else {
                emptyTables.push(t);
            }
        } catch (e) {
            // ignore
        }
    }

    withData.sort((a, b) => b.count - a.count);
    console.log(`\nTOTAL DE TABELAS COM DADOS (${withData.length}):`);
    console.table(withData);

    console.log(`\nTOTAL DE TABELAS VAZIAS (${emptyTables.length}):`);
    console.log(emptyTables.join(', '));
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
