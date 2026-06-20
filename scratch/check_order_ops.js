require('dotenv').config({ path: '../server/.env' });
const db = require('../server/db');

async function run() {
    try {
        // Let's find some active/recent sales orders (c5/c6) that have OPs in sc2010
        const recentOrders = await db.query(`
            SELECT DISTINCT TRIM(c2_pedido) as pedido
            FROM public.sc2010
            WHERE d_e_l_e_t_ = ''
              AND c2_pedido != ''
            ORDER BY pedido DESC
            LIMIT 10
        `);

        for (const ord of recentOrders.rows) {
            const pedido = ord.pedido;
            console.log(`\n================== PEDIDO: ${pedido} ==================`);
            
            // Get all OPs in sc2010 for this sales order
            const ops = await db.query(`
                SELECT TRIM(c2_num) as num, TRIM(c2_item) as item, TRIM(c2_sequen) as sequen, TRIM(c2_produto) as produto, TRIM(c2_recurso) as recurso, c2_quant, c2_itempv
                FROM public.sc2010
                WHERE c2_pedido = $1 AND d_e_l_e_t_ = ''
                ORDER BY num, item, sequen
            `, [pedido]);

            console.log(`Total OPs for this order: ${ops.rows.length}`);
            ops.rows.forEach(r => {
                console.log(`  OP: ${r.num} | Item: ${r.item} | Seq: ${r.sequen} | Prod: ${r.produto} | Rec: ${r.recurso} | Qtd: ${r.c2_quant} | PV Item: ${r.c2_itempv}`);
            });
        }

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
