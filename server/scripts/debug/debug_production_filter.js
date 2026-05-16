const db = require('./db');

(async () => {
    try {
        console.log('--- Debugging Production Filter Logic ---');
        const pedidoSearch = '3717';

        const sql = `
            SELECT
                c2.c2_num     AS op,
                c2.c2_item    AS item_op,
                c2.c2_sequen  AS sequen,
                TRIM(c2.c2_pedido) AS pedido_direct,
                TRIM(root_op.c2_pedido) AS pedido_root
            FROM public.sc2010 c2
            LEFT JOIN public.sc2010 root_op ON root_op.c2_num = c2.c2_num AND root_op.c2_item = c2.c2_item AND root_op.c2_sequen = '001' AND COALESCE(root_op.d_e_l_e_t_, '') IN ('', ' ')
            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
              AND (c2.c2_pedido LIKE $1 OR root_op.c2_pedido LIKE $1)
            LIMIT 50;
        `;

        console.log(`Executing SQL with param: %docSearch%`);
        const res = await db.query(sql, [`%${pedidoSearch}%`]);

        console.log(`Found ${res.rows.length} rows.`);
        console.table(res.rows);

    } catch (err) {
        console.error('SQL Error:', err);
    } finally {
        process.exit();
    }
})();
