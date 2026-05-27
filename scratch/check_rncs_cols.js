const db = require('../server/services/mysqlService');

async function run() {
    try {
        const [rows] = await db.query('DESCRIBE app_sgq_rncs');
        console.log(rows.map(r => `${r.Field}: ${r.Type}`));
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
run();
