require('dotenv').config({ path: '../.env' });
const mysqlPool = require('../services/mysqlService');

async function clean() {
    try {
        console.log('Limpando app_ind_production_appointments...');
        await mysqlPool.query('TRUNCATE TABLE app_ind_production_appointments');
        console.log('app_ind_production_appointments limpa com sucesso.');

        console.log('Limpando app_ind_producao_ativa...');
        await mysqlPool.query('TRUNCATE TABLE app_ind_producao_ativa');
        console.log('app_ind_producao_ativa limpa com sucesso.');

        console.log('Limpando planejamentos de OPs fracionadas...');
        const [result] = await mysqlPool.query('DELETE FROM app_production_planning WHERE op_numero LIKE "%-%"');
        console.log(`Foram deletados ${result.affectedRows} planejamentos fracionados.`);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

clean();
