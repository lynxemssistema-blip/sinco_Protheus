require('dotenv').config({ path: './server/.env' });
const mysqlPool = require('../server/services/mysqlService');

async function inspect() {
    try {
        const [columns] = await mysqlPool.query('DESCRIBE pcp_programas_liberados');
        console.log('--- COLUMNS OF pcp_programas_liberados ---');
        console.log(columns);
        process.exit(0);
    } catch (e) {
        console.error('Error inspecting:', e);
        process.exit(1);
    }
}

inspect();
