
const db = require('./db');
require('dotenv').config();

async function debugSC5() {
    const pedidoTarget = '003860';

    console.log(`\n--- INSPECTING SC5 FOR PEDIDO: ${pedidoTarget} ---`);

    const q = `
        SELECT c5_num, c5_cliente, c5_lojacli, c5_emissao, c5_nota, c5_liberok  
        FROM public.sc5010 
        WHERE c5_num = '${pedidoTarget}'
    `;
    const res = await db.query(q);
    console.log(`\n[SC5] Order Header: ${res.rows.length} rows`);
    if (res.rows.length > 0) {
        console.log(res.rows[0]);
    } else {
        console.log('Order NOT FOUND in SC5.');
    }
}

debugSC5();
