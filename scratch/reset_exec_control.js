const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const mysqlPool = require('../server/services/mysqlService');

async function resetExecutionControl() {
    try {
        console.log('--- Resetting PCP Controle Execucao Process ---');
        
        console.log('1. Clearing executions (pcp_programas_execucoes)...');
        await mysqlPool.query('TRUNCATE TABLE pcp_programas_execucoes');
        
        console.log('2. Clearing paradas (pcp_programas_paradas)...');
        await mysqlPool.query('TRUNCATE TABLE pcp_programas_paradas');
        
        console.log('3. Resetting all program statuses to LIBERADO (pcp_programas_liberados)...');
        await mysqlPool.query(`
            UPDATE pcp_programas_liberados 
            SET status = 'LIBERADO', 
                base_time_calculo = NULL,
                tipo_execucao = 'INTERNA',
                terceirizado_empresa = NULL,
                terceirizado_escopo = NULL,
                terceirizado_data_envio = NULL,
                terceirizado_data_retorno = NULL
        `);
        
        console.log('✅ Reset completed successfully!');
    } catch (err) {
        console.error('❌ Reset failed:', err);
    } finally {
        process.exit(0);
    }
}

resetExecutionControl();
