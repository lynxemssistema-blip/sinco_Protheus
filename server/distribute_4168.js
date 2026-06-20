const mysqlService = require('./services/mysqlService');
const db = require('./db');

// Gera os dias válidos (Segundas, Quartas e Sextas) entre 01/07/2026 e 17/09/2026
function getValidDays() {
    const validDays = [];
    let current = new Date('2026-07-01T12:00:00Z');
    const end = new Date('2026-09-17T12:00:00Z');

    while (current <= end) {
        const dayOfWeek = current.getUTCDay();
        if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
            validDays.push(current.toISOString().split('T')[0]);
        }
        current.setUTCDate(current.getUTCDate() + 1);
    }
    return validDays;
}

async function run() {
    try {
        const pedidos = ["004168"];
        const placeholders = pedidos.map((_, i) => `$${i + 1}`).join(',');
        
        console.log('Buscando itens com saldo a faturar do pedido 4168...');
        const pgQuery = `
            SELECT TRIM(C6_NUM) as pedido, TRIM(C6_ITEM) as item, TRIM(C6_PRODUTO) as produto, (C6_QTDVEN - C6_QTDENT) as saldo
            FROM SC6010 
            WHERE TRIM(C6_NUM) IN (${placeholders}) 
              AND D_E_L_E_T_ = ''
              AND (C6_QTDVEN - C6_QTDENT) > 0
        `;
        const pgRes = await db.query(pgQuery, pedidos);
        const items = pgRes.rows;
        
        console.log(`Encontrados ${items.length} itens.`);

        // Agrupar por produto
        const productGroups = {};
        for (const item of items) {
            if (!productGroups[item.produto]) {
                productGroups[item.produto] = [];
            }
            productGroups[item.produto].push(item);
        }

        const uniqueProducts = Object.keys(productGroups).sort();
        console.log(`Total de produtos únicos no 4168: ${uniqueProducts.length}`);

        const validDays = getValidDays();

        let dayIndex = 0;
        const inserts = [];

        for (const produto of uniqueProducts) {
            const dateToAssign = validDays[dayIndex % validDays.length];
            
            for (const item of productGroups[produto]) {
                inserts.push([
                    item.pedido,
                    item.item,
                    dateToAssign,
                    item.saldo,
                    'Redistribuição Automática',
                    'Gerado por Script - Balanceamento PCP'
                ]);
            }
            
            dayIndex++;
        }

        console.log(`Total de programações a criar: ${inserts.length}`);
        
        if (inserts.length > 0) {
            const mysqlQuery = `
                INSERT INTO app_pcp_delivery_forecasts 
                (pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao)
                VALUES ?
            `;
            const [result] = await mysqlService.query(mysqlQuery, [inserts]);
            console.log(`Sucesso! ${result.affectedRows} programações inseridas no MySQL para o pedido 4168.`);
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
