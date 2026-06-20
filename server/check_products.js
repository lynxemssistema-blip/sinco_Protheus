const db = require('./db');
async function run() {
    try {
        const pedidos = ["004162", "004159", "004145", "004182", "004155", "004143", "004335", "004372"];
        const placeholders = pedidos.map((_, i) => `$${i + 1}`).join(',');
        
        const pgQuery = `
            SELECT TRIM(C6_NUM) as pedido, TRIM(C6_ITEM) as item, TRIM(C6_PRODUTO) as produto, (C6_QTDVEN - C6_QTDENT) as saldo
            FROM SC6010 
            WHERE TRIM(C6_NUM) IN (${placeholders}) 
              AND D_E_L_E_T_ = ''
              AND (C6_QTDVEN - C6_QTDENT) > 0
            ORDER BY C6_PRODUTO
        `;
        const pgRes = await db.query(pgQuery, pedidos);
        console.log(`Found ${pgRes.rows.length} items`);
        console.log(pgRes.rows.slice(0, 10)); // sample
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
