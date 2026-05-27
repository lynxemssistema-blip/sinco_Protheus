const db = require('../db');

async function checkCanc() {
    try {
        const q = `
            SELECT F3_NFISCAL, F3_SERIE, F3_DTCANC
            FROM SF3010
            WHERE F3_EMISSAO >= '20260501' AND F3_EMISSAO <= '20260519' 
            AND COALESCE(D_E_L_E_T_,' ') = ' '
            AND F3_DTCANC <> ' '
            AND F3_CLIEFOR IN (
                SELECT A1_COD FROM SA1010 WHERE A1_NOME LIKE '%VMI SISTEMAS%'
            )
        `;
        const res = await db.query(q);
        console.table(res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkCanc();
