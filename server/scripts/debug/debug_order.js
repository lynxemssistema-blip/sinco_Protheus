const db = require('./db');

(async () => {
    try {
        const orderId = '003718';
        console.log(`--- Debugging Order ${orderId} ---`);

        // 1. Check SC5 (Header) presence
        const header = await db.query(`
            SELECT c5_num, c5_liberok, c5_nota, d_e_l_e_t_ 
            FROM public.sc5010 
            WHERE c5_num = $1
        `, [orderId]);

        if (header.rows.length === 0) {
            console.log('❌ Header SC5 NOT found!');
        } else {
            console.log('✅ Header SC5 found:', header.rows[0]);
        }

        // 2. Check SC6 (Items) presence (Raw)
        const itemsRaw = await db.query(`
            SELECT c6_num, c6_item, c6_produto, d_e_l_e_t_ 
            FROM public.sc6010 
            WHERE c6_num = $1
        `, [orderId]);
        console.log(`✅ Items SC6 found (Raw): ${itemsRaw.rowCount}`);
        if (itemsRaw.rowCount > 0) console.table(itemsRaw.rows);


        // 3. Test the ACTUAL query from pedidos.js
        console.log('\n--- Testing Full Query ---');
        const fullQuery = `
            SELECT 
                c6.c6_item    AS item,
                c6.c6_produto AS codigo,
                sb1.b1_desc   AS descricao,
                c6.c6_um      AS unidade,
                c6.c6_qtdven  AS quantidade,
                TO_CHAR(TO_DATE(c6.c6_entreg, 'YYYYMMDD'), 'DD/MM/YY') AS entrega,
                TRIM(c6.c6_pedcli) AS ped_cliente,
                c2.c2_num     AS op_num,
                c2.c2_quant   AS op_qtd
            FROM public.sc5010 c5
            JOIN public.sc6010 c6
                ON c6.c6_filial = c5.c5_filial
                AND c6.c6_num    = c5.c5_num
                AND COALESCE(c6.d_e_l_e_t_, '') = ''
            LEFT JOIN public.sb1010 sb1 
                ON sb1.b1_cod = c6.c6_produto
                AND COALESCE(sb1.d_e_l_e_t_, '') = ''
            LEFT JOIN public.sc2010 c2
                ON c2.c2_pedido = c5.c5_num
                AND c2.c2_itempv = c6.c6_item
                AND COALESCE(c2.d_e_l_e_t_, '') = ''
            WHERE 
                c5.c5_num = $1
                AND COALESCE(c5.d_e_l_e_t_, '') = ''
                AND c5.c5_tipo <> 'B'
                AND NOT (c5.c5_liberok = 'S' AND COALESCE(c5.c5_nota, '') <> '')
            ORDER BY c6.c6_item ASC
        `;

        const resFull = await db.query(fullQuery, [orderId]);
        console.log(`\nFull Query returned: ${resFull.rowCount} rows.`);
        if (resFull.rowCount === 0) {
            console.log("❌ Full query failed to return items.");
        } else {
            console.table(resFull.rows);
        }

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
})();
