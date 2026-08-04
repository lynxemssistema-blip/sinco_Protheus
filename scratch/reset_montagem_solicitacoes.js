const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const mysqlPool = require('../server/services/mysqlService');

async function resetMontagem() {
    try {
        console.log('--- Resetting PCP Montagem Solicitacoes ---');
        
        // Count records before deleting
        const [rows] = await mysqlPool.query('SELECT COUNT(*) as count FROM app_montagem_solicitacoes');
        console.log(`Current records in app_montagem_solicitacoes: ${rows[0].count}`);
        
        console.log('Clearing table app_montagem_solicitacoes...');
        await mysqlPool.query('DELETE FROM app_montagem_solicitacoes');
        
        console.log('✅ app_montagem_solicitacoes cleared successfully!');
    } catch (err) {
        console.error('❌ Reset failed:', err);
    } finally {
        process.exit(0);
    }
}

resetMontagem();
