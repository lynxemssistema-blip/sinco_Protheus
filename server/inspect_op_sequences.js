const db = require('./db');

(async () => {
    try {
        console.log('--- Inspecting OP 005027 sequences ---');

        const res = await db.query(`
            SELECT 
                c2_num, 
                c2_item, 
                c2_sequen, 
                c2_produto, 
                c2_pedido, 
                d_e_l_e_t_
            FROM public.sc2010 
            WHERE c2_num = '005027'
            ORDER BY c2_item, c2_sequen
        `);

        console.table(res.rows);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
})();
