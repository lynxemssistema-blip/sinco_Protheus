const mysqlService = require('./services/mysqlService');
const db = require('./db');

async function run() {
    try {
        const pedido = '004168';
        console.log(`Buscando itens com saldo a faturar do pedido ${pedido} no PostgreSQL...`);
        
        const pgQuery = `
            SELECT TRIM(C6_ITEM) as item 
            FROM SC6010 
            WHERE TRIM(C6_NUM) = $1 
              AND D_E_L_E_T_ = ''
              AND (C6_QTDVEN - C6_QTDENT) > 0
        `;
        const pgRes = await db.query(pgQuery, [pedido]);
        const itemsWithBalance = pgRes.rows.map(r => r.item);
        
        console.log(`Itens com saldo a faturar: ${itemsWithBalance.join(', ')}`);
        
        if (itemsWithBalance.length === 0) {
            console.log('Nenhum item com saldo encontrado.');
            process.exit(0);
        }
        
        console.log('Removendo programações no MySQL...');
        const [delRes] = await mysqlService.query(
            `DELETE FROM app_pcp_delivery_forecasts WHERE TRIM(pedido) = ? AND TRIM(item) IN (?)`,
            [pedido, itemsWithBalance]
        );
        
        console.log(`Sucesso. ${delRes.affectedRows} programações deletadas.`);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
