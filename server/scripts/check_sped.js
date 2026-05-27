const db = require('../db');

async function checkSPED() {
    try {
        const q = `
            SELECT SF2.F2_DOC, SPED.STATUS, SPED.CSTAT
            FROM SF2010 SF2
            LEFT JOIN SPED050 SPED ON SPED.NFE_ID = SF2.F2_CHVNFE
            LEFT JOIN SA1010 SA1 ON SA1.A1_COD = SF2.F2_CLIENTE AND SA1.A1_LOJA = SF2.F2_LOJA
            WHERE SF2.F2_EMISSAO >= '20260501' AND SF2.F2_EMISSAO <= '20260519' 
            AND COALESCE(SF2.D_E_L_E_T_,' ') = ' '
            AND SF2.F2_TIPO = 'N'
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
checkSPED();
