const db = require('./db');

async function debug() {
    try {
        console.log('🔍 Executing Window Function Debug for Seq 001...');

        const query = `
            SELECT 
                c2.c2_sequen,
                g2.g2_operac,
                g2.g2_descri,
                LEAD(g2.g2_operac) OVER (PARTITION BY c2.c2_num, c2.c2_item, c2.c2_sequen ORDER BY g2.g2_operac) as next_op,
                COUNT(*) OVER (PARTITION BY c2.c2_num, c2.c2_item, c2.c2_sequen) as partition_count
            FROM public.sc2010 c2
            JOIN public.sg2010 g2 ON btrim(g2.g2_produto) = btrim(c2.c2_produto) AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
            WHERE 
                c2.c2_num = '002663' AND 
                c2.c2_item = '02' AND
                c2.c2_sequen = '001' AND
                COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
            ORDER BY g2.g2_operac
        `;

        const res = await db.query(query);
        console.table(res.rows);

    } catch (err) {
        console.error(err);
    }
}

debug();
