require('dotenv').config({ path: '../server/.env' });
const mysqlPool = require('../server/services/mysqlService');

async function clean() {
    try {
        console.log('Iniciando limpeza...');
        await mysqlPool.query('DELETE FROM app_lotes_corte_itens');
        await mysqlPool.query('DELETE FROM app_lotes_corte');
        
        // Reset auto_increment se possível
        try {
            await mysqlPool.query('ALTER TABLE app_lotes_corte_itens AUTO_INCREMENT = 1');
            await mysqlPool.query('ALTER TABLE app_lotes_corte AUTO_INCREMENT = 1');
        } catch (e) {}
        
        console.log('Lotes de corte limpos com sucesso!');
        process.exit(0);
    } catch (e) {
        console.error('Erro na limpeza:', e);
        process.exit(1);
    }
}

clean();
