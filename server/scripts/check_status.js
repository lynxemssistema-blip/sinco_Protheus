const db = require('../db');

async function checkStatus() {
    try {
        const q = `
            SELECT F2_DOC, F2_SERIE, SA1.A1_NOME as cliente, F2_VALMERC, F2_STATUS
            FROM SF2010 SF2
            LEFT JOIN SA1010 SA1 ON SA1.A1_COD = SF2.F2_CLIENTE AND SA1.A1_LOJA = SF2.F2_LOJA
            WHERE F2_EMISSAO >= '20260501' AND F2_EMISSAO <= '20260519' 
            AND COALESCE(SF2.D_E_L_E_T_,' ') = ' '
            AND F2_TIPO = 'N'
            AND SA1.A1_NOME LIKE '%VMI SISTEMAS%'
        `;
        const res = await db.query(q);
        console.table(res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkStatus();
