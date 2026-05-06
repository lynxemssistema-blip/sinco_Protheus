const protheus = require('./services/protheusDB');
async function run() {
    const q = `
        SELECT C6.C6_ITEM, C6.C6_QTDVEN, C6.C6_QTDENT, (C6.C6_QTDVEN - C6.C6_QTDENT) as saldo
        FROM SC6010 C6
        WHERE C6.C6_NUM = '002730' AND C6.C6_ITEM = '07' AND C6.D_E_L_E_T_ = ''
    `;
    const res = await protheus.query(q);
    console.table(res.rows);
    process.exit(0);
}
run();
