require('dotenv').config({ path: '../server/.env' });
const db = require('../server/db');

async function run() {
    try {
        // Let's find some active/recent OPs in sc2010
        const activeOps = await db.query(`
            SELECT TRIM(c2_num) as c2_num, TRIM(c2_pedido) as pedido, TRIM(c2_itempv) as itempv, TRIM(c2_produto) as produto, c2_quant
            FROM public.sc2010
            WHERE d_e_l_e_t_ = ''
              AND c2_pedido != ''
            ORDER BY c2_num DESC
            LIMIT 50
        `);

        console.log(`Found ${activeOps.rows.length} recent OPs in Protheus.`);

        // For each OP, let's find:
        // 1. The child components returned by the current query in corte.js (joined by c2_num)
        // 2. The child components actually in the BOM structure of that product (via sg1010 recursion)
        // that have recurso MO0013 or MO0002.
        
        for (const op of activeOps.rows) {
            const c2_num = op.c2_num;
            const pedido = op.pedido;
            const itempv = op.itempv;
            const produto = op.produto;

            // Query 1: Joined by c2_num (current logic)
            const currentRes = await db.query(`
                SELECT DISTINCT TRIM(c2_filhas.c2_produto) as componente
                FROM public.sc2010 c2_filhas
                JOIN public.sg2010 sg2 ON TRIM(sg2.g2_produto) = TRIM(c2_filhas.c2_produto) AND sg2.d_e_l_e_t_ = '' AND TRIM(sg2.g2_recurso) IN ('MO0013', 'MO0002')
                WHERE c2_filhas.d_e_l_e_t_ = ''
                  AND c2_filhas.c2_num = $1
            `, [c2_num]);

            const currentComponents = currentRes.rows.map(r => r.componente);

            // Query 2: BOM structure recursion (recursive CTE)
            const bomRes = await db.query(`
                WITH RECURSIVE bom AS (
                    SELECT TRIM(g1_comp) as componente, 1 as nivel
                    FROM public.sg1010
                    WHERE TRIM(g1_cod) = $1 AND d_e_l_e_t_ = ''
                    
                    UNION ALL
                    
                    SELECT TRIM(g1.g1_comp) as componente, b.nivel + 1
                    FROM bom b
                    JOIN public.sg1010 g1 ON TRIM(g1.g1_cod) = b.componente AND g1.d_e_l_e_t_ = ''
                    WHERE b.nivel < 10
                )
                SELECT DISTINCT b.componente
                FROM bom b
                JOIN public.sg2010 sg2 ON TRIM(sg2.g2_produto) = b.componente AND sg2.d_e_l_e_t_ = '' AND TRIM(sg2.g2_recurso) IN ('MO0013', 'MO0002')
            `, [produto]);

            const bomComponents = bomRes.rows.map(r => r.componente);

            // If there's a discrepancy where BOM has more components than the current query, let's print it!
            const missing = bomComponents.filter(c => !currentComponents.includes(c));
            if (missing.length > 0 && bomComponents.length > 0) {
                console.log(`\n--- OP: ${c2_num} | Pedido: ${pedido} | Item: ${itempv} | Produto: ${produto} ---`);
                console.log(`Current query returned:`, currentComponents);
                console.log(`BOM recursion returned:`, bomComponents);
                console.log(`Missing laser/punching components in current query:`, missing);

                // Let's investigate one of the missing components to see why it was left out of sc2010 for this c2_num!
                for (const mComp of missing) {
                    const sc2Check = await db.query(`
                        SELECT TRIM(c2_num) as num, TRIM(c2_item) as item, TRIM(c2_sequen) as sequen, TRIM(c2_produto) as produto, d_e_l_e_t_
                        FROM public.sc2010
                        WHERE TRIM(c2_produto) = $1
                          AND c2_pedido = $2
                    `, [mComp, pedido]);
                    console.log(`  Investigation for missing component ${mComp}:`);
                    console.log(`    Is it in sc2010 for this pedido?`, sc2Check.rows);
                }
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
