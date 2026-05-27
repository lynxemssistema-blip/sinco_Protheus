const db = require('../db');

async function checkDel() {
    try {
        const q = `SELECT D2_DOC, D_E_L_E_T_ as del FROM SD2010 WHERE D2_DOC = '000042767' AND D2_SERIE = '1  '`;
        const res = await db.query(q);
        console.table(res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkDel();
