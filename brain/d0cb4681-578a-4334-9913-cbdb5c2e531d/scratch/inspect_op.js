require('dotenv').config({ path: require('path').resolve(__dirname, '../../../server/.env') });
const mysqlPool = require('../../../server/services/mysqlService');

async function run() {
    try {
        console.log('=== INSPECTION OF OP 006240-01 ===');
        const [rows] = await mysqlPool.query(`
            SELECT id, usuario, quantidade, data_inicio, data_fim, created_at, observacao
            FROM app_production_appointments
            WHERE op_numero = '006240' AND op_item = '01' AND operacao_codigo = '10'
            ORDER BY created_at ASC
        `);
        console.log(`Total appointments found: ${rows.length}`);
        rows.forEach(r => {
            console.log(`  ID: ${r.id} | User: ${r.usuario} | Qty: ${r.quantidade} | Created: ${r.created_at} | Obs: ${r.observacao}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
