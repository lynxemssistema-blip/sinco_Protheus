const db = require('./db');

async function debug() {
    try {
        console.log('🔍 Inspecting OP 002663 Item 02...');

        const res = await db.query(`
            SELECT c2_num, c2_item, c2_sequen, c2_pedido, c2_produto
            FROM public.sc2010 
            WHERE c2_num = '002663' AND c2_item = '02' AND d_e_l_e_t_ = ''
            ORDER BY c2_sequen
        `);

        console.log(res.rows);

        // Also manually check what the previous JOIN would have produced
        const rootCheck = await db.query(`
             SELECT 
                parent.c2_sequen as parent_seq, 
                parent.c2_pedido as parent_pedido,
                child.c2_sequen as child_seq,
                child.c2_pedido as child_pedido
             FROM public.sc2010 child
             LEFT JOIN public.sc2010 parent ON 
                parent.c2_num = child.c2_num AND 
                parent.c2_item = child.c2_item AND 
                parent.c2_sequen = '001'
             WHERE child.c2_num = '002663' AND child.c2_item = '02'
        `);
        console.log('Join Simulation:', rootCheck.rows);

    } catch (err) {
        console.error(err);
    }
}

debug();
