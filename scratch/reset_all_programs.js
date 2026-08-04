const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const mysqlPool = require('../server/services/mysqlService');

async function resetAllPrograms() {
    try {
        console.log('--- Clearing All Programs in PCP ---');
        
        console.log('1. Clearing executions (pcp_programas_execucoes)...');
        await mysqlPool.query('DELETE FROM pcp_programas_execucoes');
        
        console.log('2. Clearing paradas (pcp_programas_paradas)...');
        await mysqlPool.query('DELETE FROM pcp_programas_paradas');
        
        console.log('3. Clearing all released programs (pcp_programas_liberados)...');
        await mysqlPool.query('DELETE FROM pcp_programas_liberados');
        
        console.log('✅ All program records cleared successfully!');
    } catch (err) {
        console.error('❌ Clearance failed:', err);
    } finally {
        process.exit(0);
    }
}

resetAllPrograms();
