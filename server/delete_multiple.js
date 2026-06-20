const mysqlService = require('./services/mysqlService');
const db = require('./db');

async function run() {
    try {
        const pedidos = ["004162", "004159", "004145", "004182", "004155", "004143", "004335", "004372"];
        
        for (const pedido of pedidos) {
            console.log(`\n--- Processando Pedido ${pedido} ---`);
            const pgQuery = `
                SELECT TRIM(C6_ITEM) as item 
                FROM SC6010 
                WHERE TRIM(C6_NUM) = $1 
                  AND D_E_L_E_T_ = ''
                  AND (C6_QTDVEN - C6_QTDENT) > 0
            `;
            const pgRes = await db.query(pgQuery, [pedido]);
            const itemsWithBalance = pgRes.rows.map(r => r.item);
            
            if (itemsWithBalance.length === 0) {
                console.log(`Nenhum item com saldo encontrado para o pedido ${pedido}.`);
                continue;
            }
            
            const [delRes] = await mysqlService.query(
                `DELETE FROM app_pcp_delivery_forecasts WHERE TRIM(pedido) = ? AND TRIM(item) IN (?)`,
                [pedido, itemsWithBalance]
            );
            
            console.log(`Sucesso. ${delRes.affectedRows} programações deletadas para o pedido ${pedido}.`);
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
