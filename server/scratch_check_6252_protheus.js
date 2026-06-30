const db = require('./db');

async function run() {
    try {
        console.log("=== PROTHEUS OPs FOR OP_NUM = 006252 ===");
        const pgRes = await db.query(
            "SELECT c2_num, c2_item, c2_sequen, c2_produto, c2_quant, c2_recurso FROM public.sc2010 WHERE c2_num = '006252' AND COALESCE(d_e_l_e_t_,'') = '' ORDER BY c2_sequen"
        );
        console.log("PG OPs for 006252:", pgRes.rows.slice(0, 10));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

run();
