
const db = require('./db');
require('dotenv').config();

async function debugRecentOrders() {
    console.log(`\n--- INSPECTING RECENT ORDERS SC5 ---`);

    const q = `
        SELECT c5_num, c5_cliente, c5_emissao, c5_nota, coalesce(d_e_l_e_t_, '') as del 
        FROM public.sc5010 c5
        WHERE COALESCE(c5.d_e_l_e_t_, '') IN ('', ' ')
        ORDER BY c5.c5_num DESC
        LIMIT 10
    `;
    const res = await db.query(q);
    console.log(`\n[SC5] Top 10 Recent Orders:`);
    console.table(res.rows);

    if (res.rows.length > 0) {
        const topOrder = res.rows[0].c5_num;
        console.log(`\nChecking Items (SC6) for top order: ${topOrder}`);
        const qItems = `SELECT c6_item, c6_produto, c6_qtdven FROM public.sc6010 WHERE c6_num = '${topOrder}'`;
        const resItems = await db.query(qItems);
        console.table(resItems.rows);
    }
}

debugRecentOrders();
