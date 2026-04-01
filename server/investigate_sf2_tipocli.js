const db = require('./db');
async function test() {
    try {
        const sql = `
            SELECT 
                F2.F2_DOC, F2.F2_TIPO, F2.F2_TIPOCLI, F2.F2_CLIENTE, 
                A1.A1_NOME AS "Nome_Cli", A2.A2_NOME AS "Nome_For"
            FROM public.sf2010 F2
            LEFT JOIN public.sa1010 A1 ON A1.A1_COD = F2.F2_CLIENTE AND A1.A1_LOJA = F2.F2_LOJA
            LEFT JOIN public.sa2010 A2 ON A2.A2_COD = F2.F2_CLIENTE AND A2.A2_LOJA = F2.F2_LOJA
            WHERE F2.D_E_L_E_T_ IN ('', ' ')
            ORDER BY F2.F2_EMISSAO DESC
            LIMIT 10;
        `;
        const { rows } = await db.query(sql);
        console.table(rows);
    } catch(err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
test();
