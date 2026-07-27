const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../server/.env') });
const db = require('../server/services/mysqlService');

async function run() {
    try {
        const [rows] = await db.query('SELECT general_config FROM app_company_settings WHERE id = 1');
        console.log('GENERAL CONFIG:', JSON.stringify(rows[0]?.general_config, null, 2));
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
run();
