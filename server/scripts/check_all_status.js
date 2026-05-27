const db = require('../db');

async function checkAllStatus() {
    try {
        const q = `
            SELECT F2_STATUS, COUNT(*) as qtd, SUM(F2_VALBRUT) as sum_bruto, SUM(F2_VALMERC) as sum_merc
            FROM SF2010
            WHERE F2_EMISSAO >= '20260501' AND F2_EMISSAO <= '20260519' 
            AND COALESCE(D_E_L_E_T_,' ') = ' '
            GROUP BY F2_STATUS
        `;
        const res = await db.query(q);
        console.table(res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkAllStatus();
