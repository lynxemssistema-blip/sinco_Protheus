const db = require('./db');

async function debug() {
    try {
        console.log('🔍 Executing Production Query Logic for OP 002663...');

        const query = `
            SELECT 
                c2.c2_sequen,
                c2.c2_pedido as my_pedido,
                root_op.c2_sequen as root_seq,
                root_op.c2_pedido as root_pedido,
                CASE WHEN btrim(c2.c2_pedido) <> '' THEN btrim(c2.c2_pedido) ELSE btrim(root_op.c2_pedido) END as resolved_pedido,
                c5.c5_num,
                c5.c5_cliente,
                a1.a1_nome
            FROM public.sc2010 c2
            LEFT JOIN public.sc2010 root_op ON 
                root_op.c2_num = c2.c2_num AND 
                root_op.c2_item = c2.c2_item AND 
                root_op.c2_sequen = '001' AND 
                COALESCE(root_op.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sc5010 c5 ON 
                c5.c5_filial = c2.c2_filial AND 
                c5.c5_num = (CASE WHEN btrim(c2.c2_pedido) <> '' THEN btrim(c2.c2_pedido) ELSE btrim(root_op.c2_pedido) END) AND 
                COALESCE(c5.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sa1010 a1 ON 
                a1.a1_cod = c5.c5_cliente AND 
                a1.a1_loja = c5.c5_lojacli AND 
                COALESCE(a1.d_e_l_e_t_, '') IN ('', ' ')
            WHERE 
                c2.c2_num = '002663' AND 
                c2.c2_item = '02' AND
                COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
            ORDER BY c2.c2_sequen
        `;

        const res = await db.query(query);
        console.table(res.rows);

    } catch (err) {
        console.error(err);
    }
}

debug();
