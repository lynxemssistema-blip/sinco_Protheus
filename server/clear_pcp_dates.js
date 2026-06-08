const db = require('./services/mysqlService');

async function clearPcpDates() {
    try {
        console.log('Permitindo NULL na coluna data_entrega_pcp...');
        await db.query('ALTER TABLE app_pcp_delivery_forecasts MODIFY data_entrega_pcp DATE NULL');
        
        console.log('Iniciando limpeza das datas do PCP...');
        const [result] = await db.query('UPDATE app_pcp_delivery_forecasts SET data_entrega_pcp = NULL');
        
        console.log(`Sucesso: ${result.affectedRows} registros foram limpos (data_entrega_pcp setado como NULL).`);
        process.exit(0);
    } catch (error) {
        console.error('Erro ao limpar datas:', error);
        process.exit(1);
    }
}

clearPcpDates();
