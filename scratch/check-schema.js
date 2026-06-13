const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const mysqlPool = require('../server/services/mysqlService');

async function checkSchema() {
    try {
        const [rows] = await mysqlPool.query('DESCRIBE app_production_planning');
        console.log('--- app_production_planning SCHEMA ---');
        console.table(rows);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
checkSchema();
