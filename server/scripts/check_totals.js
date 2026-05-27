const db = require('../db');

async function checkTotals() {
    try {
        const query = `
            SELECT 
                F2_TIPO,
                COUNT(*) as qtd,
                SUM(F2_VALBRUT) as total_bruto,
                SUM(F2_VALMERC) as total_merc,
                SUM(F2_VALFAT) as total_fat
            FROM SF2010
            WHERE F2_EMISSAO >= '20260501' AND F2_EMISSAO <= '20260519' 
            AND COALESCE(D_E_L_E_T_,' ') = ' '
            GROUP BY F2_TIPO
        `;
        const res = await db.query(query);
        console.log("Totais por Tipo:");
        console.table(res.rows);

        const query2 = `
            SELECT 
                F2_TIPO,
                SUM(F2_VALBRUT) as total_bruto,
                SUM(F2_VALMERC) as total_merc,
                SUM(F2_VALFAT) as total_fat
            FROM SF2010
            WHERE F2_EMISSAO >= '20260501' AND F2_EMISSAO <= '20260519' 
            AND COALESCE(D_E_L_E_T_,' ') = ' '
            AND F2_TIPO = 'N  '
        `;
        const res2 = await db.query(query2);
        console.log("Totais Apenas Tipo N:");
        console.table(res2.rows);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkTotals();
