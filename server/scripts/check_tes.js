const db = require('../db');

async function checkTES() {
    try {
        const q = `
            SELECT SF2.F2_DOC, SD2.D2_TES, SD2.D2_CF, SD2.D2_TOTAL
            FROM SF2010 SF2
            JOIN SD2010 SD2 ON SD2.D2_DOC = SF2.F2_DOC AND SD2.D2_SERIE = SF2.F2_SERIE AND SD2.D2_CLIENTE = SF2.F2_CLIENTE
            WHERE SF2.F2_DOC IN ('000042767', '000042813') AND SF2.F2_SERIE = '1  '
            AND COALESCE(SD2.D_E_L_E_T_,' ') = ' '
        `;
        const res = await db.query(q);
        console.table(res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkTES();
