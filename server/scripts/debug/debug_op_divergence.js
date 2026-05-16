require('dotenv').config();
const db = require('./db');

async function debugDivergence() {
    try {
        console.log("=== Checking OP 005306 ===");
        const res1 = await db.query(`
            SELECT c2_num, c2_item, c2_sequen, c2_produto, c2_pedido, c2_quant, c2_datpri, c2_datprf
            FROM public.sc2010
            WHERE c2_num = '005306'
        `);
        console.log(res1.rows);

        console.log("\n=== Checking OP 004256 ===");
        const res2 = await db.query(`
            SELECT c2_num, c2_item, c2_sequen, c2_produto, c2_pedido, c2_quant, c2_datpri, c2_datprf
            FROM public.sc2010
            WHERE c2_num = '004256'
        `);
        console.log(res2.rows);

        console.log("\n=== Checking Pedido 2706 ==="); // Note: Pedido might be '002706' or '2706'
        const res3 = await db.query(`
            SELECT c2_num, c2_item, c2_sequen, c2_produto, c2_pedido, c2_quant
            FROM public.sc2010
            WHERE TRIM(c2_pedido) LIKE '%2706%'
        `);
        console.log(`Found ${res3.rows.length} OPs for Pedido 2706`);
        console.log(res3.rows.map(r => `${r.c2_num} - ${r.c2_produto} (Q: ${r.c2_quant})`));

    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit();
    }
}

debugDivergence();
