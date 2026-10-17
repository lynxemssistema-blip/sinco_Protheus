const mysql = require('../services/mysqlService');

async function main() {
    const [tables] = await mysql.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    console.log('Tables with roteiro, operac, g2, sh, bom:');
    for (const t of tableNames) {
        if (/roteir|operac|sg2|sh1|sh6|sg1|bom|estrutur/i.test(t)) {
            try {
                const [rows] = await mysql.query(`SELECT COUNT(*) as count FROM \`${t}\``);
                console.log(`  ${t}: ${rows[0].count} rows`);
            } catch(e) {
                console.log(`  ${t}: error: ${e.message}`);
            }
        }
    }
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
