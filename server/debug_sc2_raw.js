
const db = require('./db');
require('dotenv').config();

async function debugRawSC2() {
    // Pedido 003860 (from previous logs)
    const pedidoTarget = '003860';

    console.log(`\n--- INSPECTING SC2 FOR PEDIDO: ${pedidoTarget} ---`);

    // 1. Direct match on Headers
    const q1 = `
        SELECT c2_num, c2_item, c2_sequen, c2_produto, c2_pedido, c2_itempv 
        FROM public.sc2010 
        WHERE TRIM(c2_pedido) = '${pedidoTarget}' 
        AND COALESCE(d_e_l_e_t_, '') IN ('', ' ')
        LIMIT 5
    `;
    const res1 = await db.query(q1);
    console.log(`\n[SC2] Direct match on c2_pedido: ${res1.rows.length} rows`);
    if (res1.rows.length > 0) console.log(res1.rows);

    // 2. Probing via Product (from Items)
    // First get products of the order
    const qProducts = `
        SELECT c6_produto 
        FROM public.sc6010 
        WHERE c6_num = '${pedidoTarget}'
    `;
    const resProd = await db.query(qProducts);
    const products = resProd.rows.map(r => r.c6_produto.trim());
    console.log(`\n[SC6] Products in Order: ${products.join(', ')}`);

    if (products.length > 0) {
        // Find OPs with these products (ignoring c2_pedido)
        const q2 = `
            SELECT c2_num, c2_item, c2_sequen, c2_produto, c2_pedido, c2_itempv 
            FROM public.sc2010 
            WHERE TRIM(c2_produto) = ANY($1)
            AND COALESCE(d_e_l_e_t_, '') IN ('', ' ')
            LIMIT 5
        `;
        const res2 = await db.query(q2, [products]);
        console.log(`\n[SC2] OPs with matching Product: ${res2.rows.length} rows`);
        if (res2.rows.length > 0) console.log(res2.rows);
    }
}

debugRawSC2();
