require('dotenv').config({ path: '../server/.env' });
const db = require('../server/db');

async function run() {
    try {
        // Find recent sales orders
        const res = await db.query(`
            SELECT TRIM(c2_pedido) as pedido, MAX(c2_num) as max_num
            FROM public.sc2010
            WHERE d_e_l_e_t_ = ''
              AND c2_pedido != ''
            GROUP BY TRIM(c2_pedido)
            ORDER BY max_num DESC
            LIMIT 50
        `);

        console.log(`Analyzing 50 orders for OPs with same c2_pedido but different c2_num and different/empty c2_itempv...`);

        let discrepanciesFound = 0;

        for (const order of res.rows) {
            const pedido = order.pedido;

            // Fetch items of the sales order
            const pvItens = await db.query(`
                SELECT TRIM(c6_item) as item, TRIM(c6_produto) as produto
                FROM public.sc6010
                WHERE c6_num = $1 AND d_e_l_e_t_ = ''
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
                      AND TRIM(sc2_pai.c2_itempv) = $2::text 
                      AND TRIM(sc2_pai.c2_produto) = $3
                `, [pedido, itempv, produto]);

                const currentComps = currentExplosion.rows.map(r => r.componente);

                // 2. Query components linked to this sales order (by c2_pedido only!),
                // that are actually in the BOM structure of this product, and have MO0013/MO0002 in routing:
                const bomOps = await db.query(`
                    WITH RECURSIVE bom AS (
                        SELECT TRIM(g1_comp) as componente, 1 as nivel
                        FROM public.sg1010
                        WHERE TRIM(g1_cod) = $2 AND d_e_l_e_t_ = ''
                        
                        UNION ALL
                        
                        SELECT TRIM(g1.g1_comp) as componente, b.nivel + 1
                        FROM bom b
                        JOIN public.sg1010 g1 ON TRIM(g1.g1_cod) = b.componente AND g1.d_e_l_e_t_ = ''
                        WHERE b.nivel < 15
                    )
                    SELECT DISTINCT 
                        TRIM(c2.c2_produto) as componente,
                        TRIM(c2.c2_num) || TRIM(c2.c2_item) || TRIM(c2.c2_sequen) as op_numero,
                        TRIM(sg2.g2_recurso) as recurso
                    FROM public.sc2010 c2
                    JOIN public.sg2010 sg2 ON TRIM(sg2.g2_produto) = TRIM(c2.c2_produto) AND sg2.d_e_l_e_t_ = '' AND TRIM(sg2.g2_recurso) IN ('MO0013', 'MO0002')
                    WHERE TRIM(c2.c2_pedido) = $1 
                      AND c2.d_e_l_e_t_ = ''
                      AND TRIM(c2.c2_produto) IN (SELECT componente FROM bom)
                `, [pedido, produto]);

                const missing = bomOps.rows.filter(r => !currentComps.includes(r.componente));

                if (missing.length > 0) {
                    discrepanciesFound++;
                    console.log(`\nDiscrepancy found! Pedido: ${pedido} | Item PV: ${itempv} | Produto Pai: ${produto}`);
                    console.log(`  Current Explosion returned:`, currentComps);
                    console.log(`  BOM OPs by c2_pedido returned:`, bomOps.rows.map(r => `${r.componente} (OP: ${r.op_numero})`));
                    console.log(`  Missing items:`);
                    for (const m of missing) {
                        console.log(`    - Component: ${m.componente} | OP: ${m.op_numero} | Recurso: ${m.recurso}`);
                    }
                    if (discrepanciesFound >= 5) {
                        console.log('\nStopping search after 5 examples.');
                        process.exit(0);
                    }
                }
            }
        }

        if (discrepanciesFound === 0) {
            console.log('No discrepancies found where child OPs had same c2_pedido but different c2_num.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
