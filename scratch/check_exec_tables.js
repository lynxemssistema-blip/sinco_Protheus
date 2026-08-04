const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const mysqlPool = require('../server/services/mysqlService');

async function describeTable() {
    try {
        console.log('--- Describing pcp_programas_execucoes ---');
        const [columns] = await mysqlPool.query('DESCRIBE pcp_programas_execucoes');
        console.log('Columns:', columns.map(c => `${c.Field}: ${c.Type}`));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit(0);
    }
}

describeTable();
