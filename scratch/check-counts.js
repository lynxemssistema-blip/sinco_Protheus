const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const mysqlPool = require('../server/services/mysqlService');

async function checkCounts() {
    try {
        const [planCount] = await mysqlPool.query('SELECT COUNT(*) AS count FROM app_production_planning');
        const [appCount] = await mysqlPool.query('SELECT COUNT(*) AS count FROM app_production_appointments');
        console.log('--- Database Counts ---');
        console.log('app_production_planning rows:', planCount[0].count);
        console.log('app_production_appointments rows:', appCount[0].count);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
checkCounts();
