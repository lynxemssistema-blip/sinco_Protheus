const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../server/.env') });
const db = require('../server/services/mysqlService');

async function check() {
    try {
        const [rows] = await db.query('SELECT * FROM app_sgq_rncs WHERE id IN (10, 11, 12)');
        console.log('RNCs 10, 11, 12 details:', JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
