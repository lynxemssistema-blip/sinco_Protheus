const protheus = require('./services/protheusDB');
async function run() {
    const res = await protheus.query("SELECT TRIM(C2.C2_ITEM) as op_item, TRIM(C2.C2_PRODUTO) as produto FROM SC2010 C2 WHERE C2.C2_NUM = '002730' AND C2.C2_ITEM IN ('71', '91', '9B') AND C2.D_E_L_E_T_ = ''");
    console.table(res.rows);
    process.exit(0);
}
run();
