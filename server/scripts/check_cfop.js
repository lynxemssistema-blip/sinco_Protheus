const db = require('../db');

async function checkCFOP() {
    try {
        const q = `
            SELECT F2_DOC, F2_VALMERC, D2_CFOP, D2_TOTAL
            FROM SF2010 SF2
            LEFT JOIN SD2010 SD2 ON SD2.D2_DOC = SF2.F2_DOC AND SD2.D2_SERIE = SF2.F2_SERIE AND SD2.D2_CLIENTE = SF2.F2_CLIENTE
            WHERE F2_EMISSAO >= '20260501' AND F2_EMISSAO <= '20260519' 
            AND COALESCE(SF2.D_E_L_E_T_,' ') = ' '
            AND COALESCE(SD2.D_E_L_E_T_,' ') = ' '
            AND F2_TIPO = 'N'
            AND SF2.F2_CLIENTE IN (
                SELECT A1_COD FROM SA1010 WHERE A1_NOME LIKE '%VMI SISTEMAS%'
            )
        `;
        const res = await db.query(q);
        const grouped = res.rows.reduce((acc, row) => {
            if (!acc[row.d2_cfop]) acc[row.d2_cfop] = 0;
            acc[row.d2_cfop] += parseFloat(row.d2_total || 0);
            return acc;
        }, {});
        console.log("Totais por CFOP para VMI:");
        console.table(grouped);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkCFOP();
