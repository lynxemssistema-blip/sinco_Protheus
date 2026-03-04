const db = require('./db');

(async () => {
    try {
        console.log('--- Inspecting SC2 (Production Orders) ---');

        // 1. Check for the product involved in the previous order
        console.log('\nSearching for Product MT5-27825 in SC2:');
        const resProd = await db.query(`
            SELECT c2_num, c2_item, c2_sequen, c2_produto, c2_quant, c2_pedido, c2_itempv
            FROM public.sc2010 
            WHERE 
                d_e_l_e_t_ = ' ' AND
                c2_produto LIKE '%MT5-27825%'
            LIMIT 10
        `);
        console.table(resProd.rows);

        // 2. Check ANY OP to see C2_PEDIDO format
        console.log('\nGeneral SC2 Sample (Rows with non-empty pedido):');
        const resGen = await db.query(`
            SELECT c2_num, c2_item, c2_sequen, c2_pedido, c2_itempv
            FROM public.sc2010 
            WHERE 
                d_e_l_e_t_ = ' ' AND
                c2_pedido <> ''
            LIMIT 10
        `);
        console.table(resGen.rows);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
})();
