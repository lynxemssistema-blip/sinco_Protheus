const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const mysqlPool = require('../server/services/mysqlService');

async function descTable() {
    try {
        const [rows] = await mysqlPool.query('DESCRIBE app_production_planning');
        console.log('Columns in app_production_planning:');
        rows.forEach(r => console.log(`- ${r.Field}: ${r.Type}`));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
descTable();
