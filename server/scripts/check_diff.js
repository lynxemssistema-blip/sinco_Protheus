const db = require('../db');

async function checkDiff() {
    try {
        const q = `
            SELECT F2_DOC, F2_SERIE, SA1.A1_NOME as cliente, F2_VALBRUT, F2_VALMERC, F2_VALFAT, F2_ESPECIE, F2_TIPO
            FROM SF2010 SF2
            LEFT JOIN SA1010 SA1 ON SA1.A1_COD = SF2.F2_CLIENTE AND SA1.A1_LOJA = SF2.F2_LOJA
            WHERE F2_EMISSAO >= '20260501' AND F2_EMISSAO <= '20260519' 
            AND COALESCE(SF2.D_E_L_E_T_,' ') = ' '
            AND F2_TIPO = 'N'
            ORDER BY F2_VALBRUT DESC
            LIMIT 15;
        `;
        const res = await db.query(q);
        console.table(res.rows);

        // Group by client like Excel
        const qCli = `
            SELECT 
                SA1.A1_NOME as cliente,
                SUM(F2_VALBRUT) as total_bruto,
                SUM(F2_VALMERC) as total_merc,
                SUM(F2_VALFAT) as total_fat
            FROM SF2010 SF2
            LEFT JOIN SA1010 SA1 ON SA1.A1_COD = SF2.F2_CLIENTE AND SA1.A1_LOJA = SF2.F2_LOJA
            WHERE F2_EMISSAO >= '20260501' AND F2_EMISSAO <= '20260519' 
            AND COALESCE(SF2.D_E_L_E_T_,' ') = ' '
            AND F2_TIPO = 'N'
            GROUP BY SA1.A1_NOME
            ORDER BY total_bruto DESC
            LIMIT 10;
        `;
        const resCli = await db.query(qCli);
        console.table(resCli.rows);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkDiff();
