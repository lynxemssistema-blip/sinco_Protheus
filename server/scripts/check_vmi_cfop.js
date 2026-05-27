const db = require('../db');

async function checkCFOP() {
    try {
        const q = `
            SELECT SD2.D2_CF as cfop, SUM(SD2.D2_TOTAL) as total
            FROM SF2010 SF2
            LEFT JOIN SD2010 SD2 ON SD2.D2_DOC = SF2.F2_DOC AND SD2.D2_SERIE = SF2.F2_SERIE AND SD2.D2_CLIENTE = SF2.F2_CLIENTE
            LEFT JOIN SA1010 SA1 ON SA1.A1_COD = SF2.F2_CLIENTE AND SA1.A1_LOJA = SF2.F2_LOJA
            WHERE SF2.F2_EMISSAO >= '20260501' AND SF2.F2_EMISSAO <= '20260519' 
            AND COALESCE(SF2.D_E_L_E_T_,' ') = ' '
            AND COALESCE(SD2.D_E_L_E_T_,' ') = ' '
            AND SF2.F2_TIPO = 'N'
            AND SA1.A1_NOME LIKE '%VMI SISTEMAS%'
            GROUP BY SD2.D2_CF
        `;
        const res = await db.query(q);
        console.table(res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkCFOP();
