const db = require('./db');

async function debug() {
    try {
        console.log('🔍 Executing Full Production Query for OP 002663 Item 02...');

        // Exact query from production.js (approximate structure with recent changes)
        const query = `
            SELECT 
                c2.c2_sequen,
                g2.g2_operac,
                g2.g2_descri,
                LAG(g2.g2_operac) OVER (PARTITION BY c2.c2_num, c2.c2_item, c2.c2_sequen ORDER BY g2.g2_operac) as prev_operacao,
                LEAD(g2.g2_operac) OVER (PARTITION BY c2.c2_num, c2.c2_item, c2.c2_sequen ORDER BY g2.g2_operac) as next_operacao,
                TRIM(LAG(g2.g2_descri) OVER (PARTITION BY c2.c2_num, c2.c2_item, c2.c2_sequen ORDER BY g2.g2_operac)) as prev_desc,
                TRIM(LEAD(g2.g2_descri) OVER (PARTITION BY c2.c2_num, c2.c2_item, c2.c2_sequen ORDER BY g2.g2_operac)) as next_desc
            FROM public.sc2010 c2
            JOIN public.sg2010 g2 ON btrim(g2.g2_produto) = btrim(c2.c2_produto) AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
            WHERE 
                c2.c2_num = '002663' AND 
                c2.c2_item = '02' AND
                COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
            ORDER BY c2.c2_sequen, g2.g2_operac
        `;

        const res = await db.query(query);
        console.table(res.rows);

    } catch (err) {
        console.error(err);
    }
}

debug();
