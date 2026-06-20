require('dotenv').config({ path: '../server/.env' });
const db = require('../server/db');

async function run() {
    try {
        // Find a recent sales order with a lot of items and OPs
        const res = await db.query(`
            SELECT TRIM(c2_pedido) as pedido, MAX(c2_num) as max_num
            FROM public.sc2010
            WHERE d_e_l_e_t_ = ''
              AND c2_pedido != ''
            GROUP BY TRIM(c2_pedido)
            ORDER BY max_num DESC
            LIMIT 5
        `);

        for (const order of res.rows) {
            const pedido = order.pedido;
            console.log(`\n======================================================`);
            console.log(`ANALYZING PEDIDO: ${pedido}`);
            console.log(`======================================================`);

            // Fetch items of the sales order
            const pvItens = await db.query(`
                SELECT TRIM(c6_item) as item, TRIM(c6_produto) as produto, TRIM(c6_numop) as numop
                FROM public.sc6010
                WHERE c6_num = $1 AND d_e_l_e_t_ = ''
            `, [pedido]);

            for (const pvi of pvItens.rows) {
                console.log(`\n  PV Item: ${pvi.item} | Produto: ${pvi.produto} | OP Campo: ${pvi.numop}`);
                
                // Let's find all OPs related to this PV Item in sc2010
                // Typically Protheus links them by c2_pedido and c2_itempv
                const relatedOps = await db.query(`
                    SELECT TRIM(c2_num) as num, TRIM(c2_item) as item, TRIM(c2_sequen) as sequen, TRIM(c2_produto) as produto
                    FROM public.sc2010
                    WHERE c2_pedido = $1 AND c2_itempv = $2 AND d_e_l_e_t_ = ''
                `, [pedido, pvi.item]);

                console.log(`    Related OPs in sc2010 (by c2_pedido and c2_itempv):`, relatedOps.rows.map(r => `${r.num}-${r.item}-${r.sequen} (${r.produto})`));

                // Let's run the /corte/explosao logic for this item
                // 1. Without c2_num (using c2_pedido, c2_itempv, c2_produto)
                const currentExplosion = await db.query(`
                    SELECT DISTINCT 
                        TRIM(sc2_filhas.c2_produto) as componente, 
                        TRIM(sc2_filhas.c2_num) || TRIM(sc2_filhas.c2_item) || TRIM(sc2_filhas.c2_sequen) as op_numero, 
                        TRIM(sg2.g2_recurso) as recurso
                    FROM sc2010 sc2_pai 
                    JOIN sc2010 sc2_filhas ON sc2_filhas.c2_num = sc2_pai.c2_num AND sc2_filhas.d_e_l_e_t_ = '' 
                    JOIN sg2010 sg2 ON TRIM(sg2.g2_produto) = TRIM(sc2_filhas.c2_produto) AND sg2.d_e_l_e_t_ = '' AND TRIM(sg2.g2_recurso) IN ('MO0013', 'MO0002') 
                    WHERE sc2_pai.d_e_l_e_t_ = '' 
                      AND TRIM(sc2_pai.c2_pedido) = $1 
                      AND TRIM(sc2_pai.c2_itempv) = $2 
                      AND TRIM(sc2_pai.c2_produto) = $3
                `, [pedido, pvi.item, pvi.produto]);

                console.log(`    Current explosion returns (sc2_filhas.c2_num = sc2_pai.c2_num):`, currentExplosion.rows.map(r => `${r.componente} (OP: ${r.op_numero}, Recurso: ${r.recurso})`));

                // 2. Let's see if there are other OPs in sc2010 for this sales order (matching c2_pedido) 
                // that have MO0013/MO0002 but are NOT returned by the query above!
                const orderWideOps = await db.query(`
                    SELECT DISTINCT 
                        TRIM(c2.c2_produto) as componente,
                        TRIM(c2.c2_num) || TRIM(c2.c2_item) || TRIM(c2.c2_sequen) as op_numero,
                        TRIM(sg2.g2_recurso) as recurso
                    FROM public.sc2010 c2
                    JOIN public.sg2010 sg2 ON TRIM(sg2.g2_produto) = TRIM(c2.c2_produto) AND sg2.d_e_l_e_t_ = '' AND TRIM(sg2.g2_recurso) IN ('MO0013', 'MO0002')
                    WHERE c2.c2_pedido = $1 AND c2.d_e_l_e_t_ = ''
                `, [pedido]);

                const explodedOpNums = new Set(currentExplosion.rows.map(r => r.op_numero));
                const missingFromExplosion = orderWideOps.rows.filter(r => !explodedOpNums.has(r.op_numero));

                if (missingFromExplosion.length > 0) {
                    console.log(`    ⚠️ MISSING FROM EXPLOSION (exist in order wide OPs but not in explosion):`);
                    missingFromExplosion.forEach(r => {
                        console.log(`      Component: ${r.componente} | OP: ${r.op_numero} | Recurso: ${r.recurso}`);
                    });

                    // Let's find why they are missing! Let's check their parent OP
                    for (const m of missingFromExplosion) {
                        const opnum = m.op_numero.substring(0, 6);
                        const opDetails = await db.query(`
                            SELECT TRIM(c2_num) as num, TRIM(c2_item) as item, TRIM(c2_sequen) as sequen, TRIM(c2_produto) as produto, c2_pedido, c2_itempv
                            FROM public.sc2010
                            WHERE c2_num = $1 AND d_e_l_e_t_ = ''
                        `, [opnum]);
                        console.log(`      OP details for ${m.op_numero}:`, opDetails.rows);
                    }
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
