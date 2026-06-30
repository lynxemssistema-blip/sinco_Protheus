require('dotenv').config({ path: '../.env' });
const db = require('./db');
const mysqlPool = require('./services/mysqlService');

async function run() {
    try {
        console.log("=== APP APPOINTMENTS FOR OP 006252 ===");
        const [mysqlRows] = await mysqlPool.query(
            "SELECT id, op_numero, op_item, op_sequencia, operacao_codigo, quantidade, conferencia_status FROM app_production_appointments WHERE op_numero = '006252'"
        );
        console.log("MySQL Rows:", mysqlRows);

        console.log("\n=== PROTHEUS OP FOR PEDIDO 004812 ===");
        const pgRes = await db.query(
            "SELECT c2_num, c2_item, c2_sequen, c2_pedido, c2_itempv, c2_produto, c2_quant, c2_tpop FROM public.sc2010 WHERE TRIM(c2_pedido) = '004812' AND COALESCE(d_e_l_e_t_,'') = ''"
        );
        console.log("PG Rows:", pgRes.rows);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

run();
