require('dotenv').config({ path: '../server/.env' });
const mysqlPool = require('../server/services/mysqlService');

async function clean() {
    try {
        console.log('Iniciando limpeza das 5 tabelas selecionadas...');
        
        // Desativar verificações de chave estrangeira
        await mysqlPool.query('SET FOREIGN_KEY_CHECKS = 0');
        
        console.log('Limpando pcp_programas_paradas...');
        await mysqlPool.query('DELETE FROM pcp_programas_paradas');
        
        console.log('Limpando pcp_programas_execucoes...');
        await mysqlPool.query('DELETE FROM pcp_programas_execucoes');
        
        console.log('Limpando pcp_programas_liberados...');
        await mysqlPool.query('DELETE FROM pcp_programas_liberados');
        
        console.log('Limpando app_lotes_corte_itens...');
        await mysqlPool.query('DELETE FROM app_lotes_corte_itens');
        
        console.log('Limpando app_lotes_corte...');
        await mysqlPool.query('DELETE FROM app_lotes_corte');
        
        // Resetar auto_increment
        console.log('Resetando AUTO_INCREMENT...');
        try {
            await mysqlPool.query('ALTER TABLE pcp_programas_paradas AUTO_INCREMENT = 1');
            await mysqlPool.query('ALTER TABLE pcp_programas_execucoes AUTO_INCREMENT = 1');
            await mysqlPool.query('ALTER TABLE pcp_programas_liberados AUTO_INCREMENT = 1');
            await mysqlPool.query('ALTER TABLE app_lotes_corte_itens AUTO_INCREMENT = 1');
            await mysqlPool.query('ALTER TABLE app_lotes_corte AUTO_INCREMENT = 1');
        } catch (e) {
            console.warn('Aviso ao resetar AUTO_INCREMENT:', e.message);
        }
        
        // Reativar verificações de chave estrangeira
        await mysqlPool.query('SET FOREIGN_KEY_CHECKS = 1');
        
        console.log('✅ Limpeza concluída com sucesso!');
        process.exit(0);
    } catch (e) {
        console.error('❌ Erro na limpeza:', e);
        process.exit(1);
    }
}

clean();
