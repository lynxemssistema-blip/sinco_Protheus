const db = require('./db');

(async () => {
    try {
        console.log('--- Verifying SC2 Content (OP vs Pedido) ---');

        const res = await db.query(`
            SELECT c2_num AS op, c2_pedido AS pedido, c2_itempv AS item_ped 
            FROM public.sc2010 
            WHERE d_e_l_e_t_ = ' ' 
            LIMIT 10
        `);

        console.table(res.rows);

        // Check specifically for user's example if possible
        // User mentioned 003717
        const resSpecific = await db.query(`
            SELECT c2_num AS op, c2_pedido AS pedido 
            FROM public.sc2010 
            WHERE c2_pedido = '003717' AND d_e_l_e_t_ = ' '
            LIMIT 5
        `);
        console.log('\n--- Specific Check for Order 003717 ---');
        if (resSpecific.rows.length === 0) console.log('No OPs found for Order 003717');
        else console.table(resSpecific.rows);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
})();
