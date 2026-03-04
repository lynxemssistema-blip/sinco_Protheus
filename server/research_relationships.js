const db = require('./db');

(async () => {
    try {
        const orderNum = '%003121%'; // Changing to an order known to have OPs
        console.log(`\n🔍 Researching Order: ${orderNum}`);

        // 1. Fetch Order & Items
        const items = await db.query(`
            SELECT 
                c6.c6_num, c6.c6_item, c6.c6_produto, c6.c6_descri, 
                c6.c6_op, c6.c6_numop, c6.c6_itemop,
                sb1.b1_desc
            FROM public.sc6010 c6
            LEFT JOIN public.sb1010 sb1 ON c6.c6_produto = sb1.b1_cod AND sb1.d_e_l_e_t_ = ' '
            WHERE c6.c6_num LIKE $1 AND c6.d_e_l_e_t_ = ' '
            ORDER BY c6.c6_item
        `, [orderNum]);

        console.log(`Found ${items.rowCount} items.`);

        for (const item of items.rows) {
            console.log(`\n---------------------------------------------------`);
            console.log(`📦 ITEM: ${item.c6_item} | Product: ${item.c6_produto} (${item.b1_desc})`);
            console.log(`   SC6 Links -> C6_OP: '${item.c6_op}' | C6_NUMOP: '${item.c6_numop}'`);

            // 2. Find OP in SC2 linked to this item
            // Using TRIM and LIKE to handle padding differences
            const ops = await db.query(`
                SELECT c2_num, c2_item, c2_sequen, c2_produto, c2_quant, c2_emissao, c2_pedido, c2_itempv
                FROM public.sc2010 
                WHERE 
                    d_e_l_e_t_ = ' ' AND
                    (
                        (TRIM(c2_pedido) = TRIM($1) AND c2_itempv = $2) 
                        OR 
                        (c2_pedido LIKE $3) -- broad search by order num
                    )
            `, [item.c6_num, item.c6_item, `%${item.c6_num.trim()}%`]);

            if (ops.rowCount > 0) {
                console.log(`   🏭 OPs Found (${ops.rowCount}):`);
                // Filter in memory for exact item match if SQL is too broad, or just show all to debug
                const relevantOps = ops.rows.filter(o => o.c2_itempv === item.c6_item || o.c2_produto === item.c6_produto);

                if (relevantOps.length > 0) {
                    relevantOps.forEach(op => {
                        console.log(`      -> MATCH! OP: ${op.c2_num}.${op.c2_item}.${op.c2_sequen} | Qty: ${op.c2_quant} | Link: Ped=${op.c2_pedido} It=${op.c2_itempv}`);
                    });
                } else {
                    console.log(`      (Found linked OPs for this order, but checked items/products didn't match exactly. Listing first 3 matches:)`);
                    ops.rows.slice(0, 3).forEach(op => console.log(`      -> OP: ${op.c2_num}.${op.c2_item} (Prod: ${op.c2_produto})`));
                }
            } else {
                console.log(`   ⚠️ No OP found in SC2 linked to this Item (Order Link).`);
            }

            // 3. Find Product Structure (BOM) in SG1
            const bom = await db.query(`
                SELECT g1_comp, g1_quant, sb1.b1_desc
                FROM public.sg1010 g1
                LEFT JOIN public.sb1010 sb1 ON g1.g1_comp = sb1.b1_cod AND sb1.d_e_l_e_t_ = ' '
                WHERE g1.g1_cod = $1 AND g1.d_e_l_e_t_ = ' '
            `, [item.c6_produto]);

            console.log(`   🧬 BOM Structure (First Level): ${bom.rowCount} components`);
            if (bom.rowCount > 0) {
                // Print first 3
                bom.rows.slice(0, 3).forEach(c => console.log(`      - ${c.g1_comp} x ${c.g1_quant} (${c.b1_desc})`));
                if (bom.rowCount > 3) console.log(`      ... +${bom.rowCount - 3} more`);
            }

            // 4. Find Processes/Operations in SG2
            const processesSafe = await db.query(`
                SELECT g2_operac, g2_recurso, g2_descri, g2_setup, g2_tempad
                FROM public.sg2010
                WHERE (g2_produto = $1 OR g2_codigo = $1) AND d_e_l_e_t_ = ' '
                ORDER BY g2_operac
            `, [item.c6_produto]);

            console.log(`   ⚙️ Processes (Routing): ${processesSafe.rowCount} operations`);
            processesSafe.rows.forEach(p => {
                console.log(`      [${p.g2_operac}] Rec: ${p.g2_recurso} - ${p.g2_descri || '(No desc)'}`);
            });

        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit();
    }
})();
