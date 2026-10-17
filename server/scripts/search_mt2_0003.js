const mysql = require('../services/mysqlService');

async function main() {
    const [tables] = await mysql.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    console.log('Searching MT2-0003 across tables...');
    for (const t of tableNames) {
        try {
            const [cols] = await mysql.query(`SHOW COLUMNS FROM \`${t}\``);
            const charCols = cols.filter(c => c.Type.includes('char') || c.Type.includes('text')).map(c => c.Field);
            if (!charCols.length) continue;
            const where = charCols.map(c => `\`${c}\` = 'MT2-0003'`).join(' OR ');
            const [rows] = await mysql.query(`SELECT COUNT(*) as count FROM \`${t}\` WHERE ${where}`);
            if (rows[0].count > 0) {
                console.log(`Found in ${t}: ${rows[0].count} rows`);
            }
        } catch(e) {}
    }
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
