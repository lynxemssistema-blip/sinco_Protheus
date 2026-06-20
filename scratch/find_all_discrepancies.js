require('dotenv').config({ path: '../server/.env' });
const db = require('../server/db');

async function run() {
    try {
        // Let's get active sales orders in sc5/sc6
        const activeOrdersRes = await db.query(`
            SELECT DISTINCT TRIM(c6.c6_num) as pedido
            FROM public.sc6010 c6
            WHERE c6.d_e_l_e_t_ = ''
              AND (c6_qtdven - c6_qtdent) > 0
            ORDER BY pedido DESC
            LIMIT 100
        `);

        console.log(`Analyzing ${activeOrdersRes.rows.length} active orders for discrepancies...`);

        let discrepanciesFound = 0;

        for (const order of activeOrdersRes.rows) {
            const pedido = order.pedido;

            // Fetch items of the sales order
            const pvItens = await db.query(`
                SELECT TRIM(c6_item) as item, TRIM(c6_produto) as produto, TRIM(c6_numop) as numop
                FROM public.sc6010
                WHERE c6_num = $1 AND d_e_l_e_t_ = ''
                  AND (c6_qtdven - c6_qtdent) > 0
            `, [pedido]);

            for (const pvi of pvItens.rows) {
                const itempv = pvi.item;
                const produto = pvi.produto;

                // 1. Current query components (how it's done in corte.js /corte/explosao):
                const currentExplosion = await db.query(`
                    SELECT DISTINCT 
                        TRIM(sc2_filhas.c2_produto) as componente,
                        TRIM(sc2_filhas.c2_num) || TRIM(sc2_filhas.c2_item) || TRIM(sc2_filhas.c2_sequen) as op_numero
                    FROM sc2010 sc2_pai 
                    JOIN sc2010 sc2_filhas ON sc2_filhas.c2_num = sc2_pai.c2_num AND sc2_filhas.d_e_l_e_t_ = '' 
                    JOIN sb1010 sb1 ON TRIM(sb1.b1_cod) = TRIM(sc2_filhas.c2_produto) AND sb1.d_e_l_e_t_ = ''
                    JOIN sg2010 sg2 ON TRIM(sg2.g2_produto) = TRIM(sc2_filhas.c2_produto) AND sg2.d_e_l_e_t_ = '' AND TRIM(sg2.g2_recurso) IN ('MO0013', 'MO0002') 
                    WHERE sc2_pai.d_e_l_e_t_ = '' 
                      AND TRIM(sc2_pai.c2_pedido) = $1 
                      AND TRIM(sc2_pai.c2_itempv) = $2 
                      AND TRIM(sc2_pai.c2_produto) = $3
                `, [pedido, itempv, produto]);

                const currentComps = currentExplosion.rows.map(r => r.componente);

                // 2. Real components in sc2010 linked to this sales order & item, having MO0013/MO0002 in routing:
                const realOps = await db.query(`
                    SELECT DISTINCT 
                        TRIM(c2.c2_produto) as componente,
                        TRIM(c2.c2_num) || TRIM(c2.c2_item) || TRIM(c2.c2_sequen) as op_numero,
                        TRIM(sg2.g2_recurso) as recurso
                    FROM public.sc2010 c2
                    JOIN public.sg2010 sg2 ON TRIM(sg2.g2_produto) = TRIM(c2.c2_produto) AND sg2.d_e_l_e_t_ = '' AND TRIM(sg2.g2_recurso) IN ('MO0013', 'MO0002')
                    WHERE TRIM(c2.c2_pedido) = $1 
                      AND TRIM(c2.c2_itempv) = $2 
                      AND c2.d_e_l_e_t_ = ''
                `, [pedido, itempv]);

                const realComps = realOps.rows.map(r => r.componente);

                // 3. Find if there are any components in realOps that are NOT in currentExplosion
                const missing = realOps.rows.filter(r => !currentComps.includes(r.componente));

                if (missing.length > 0) {
                    discrepanciesFound++;
                    console.log(`\nDiscrepancy found! Pedido: ${pedido} | Item PV: ${itempv} | Produto Pai: ${produto}`);
                    console.log(`  Current Explosion returned (${currentComps.length} items):`, currentComps);
                    console.log(`  Real OPs returned (${realComps.length} items):`, realComps);
                    console.log(`  Missing items:`);
                    for (const m of missing) {
                        console.log(`    - Component: ${m.componente} | OP: ${m.op_numero} | Recurso: ${m.recurso}`);
                        
                        // Let's print the parent OP for this missing component and the parent OP of the sales order item
                        const childOpParent = m.op_numero.substring(0, 6);
                        const parentOpRes = await db.query(`
                            SELECT TRIM(c2_num) as num, TRIM(c2_item) as item, TRIM(c2_produto) as prod, TRIM(c2_pedido) as ped, TRIM(c2_itempv) as itempv
                            FROM public.sc2010
                            WHERE TRIM(c2_pedido) = $1 AND TRIM(c2_itempv) = $2 AND TRIM(c2_produto) = $3 AND d_e_l_e_t_ = ''
                        `, [pedido, itempv, produto]);
                        
                        console.log(`      Parent OP for sales order item:`, parentOpRes.rows.map(r => `${r.num}-${r.item} (${r.prod})`));
                        console.log(`      This missing component's c2_num: ${childOpParent}`);
                    }
                    if (discrepanciesFound >= 5) {
                        console.log('\nReached limit of 5 discrepancies to display. Stopping search.');
                        process.exit(0);
                    }
                }
            }
        }
        
        if (discrepanciesFound === 0) {
            console.log('No discrepancies found where child OPs had different c2_num but same c2_pedido.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
