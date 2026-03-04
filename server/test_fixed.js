
const db = require('./db');

async function testFixed() {
    try {
        const params = [];
        let paramCount = 1;
        const limit = 10;

        let sb2Where = "WHERE TRIM(COALESCE(s.d_e_l_e_t_, '')) = '' ";
        sb2Where += "AND s.b2_cod !~ '^MT[0-9]' ";

        params.push(parseInt(limit));
        const subQueryLimitParamIdx = paramCount++;

        const branches = [{ suffix: '010', name: '010' }];

        const finalQueries = branches.map(b => `
            (SELECT 
                '${b.name}'::text as empresa,
                s.b2_filial as filial,
                s.b2_local as almoxarifado,
                s.b2_cod as cod_produto,
                p.b1_desc as descricao,
                s.b2_qatu as saldo_atual
            FROM public.sb2${b.suffix} s
            JOIN public.sb1${b.suffix} p ON TRIM(p.b1_cod) = TRIM(s.b2_cod)
            ${sb2Where}
            AND TRIM(COALESCE(p.d_e_l_e_t_, '')) = ''
            LIMIT $${subQueryLimitParamIdx})
        `);

        const sql = finalQueries.join(' UNION ALL '); // NO OUTER LIMIT

        console.log("Testing FIXED query...");
        console.log("Params:", params);

        const start = performance.now();
        const result = await db.query(sql, params);
        const duration = performance.now() - start;

        console.log("\n✅ Duration:", duration.toFixed(2), "ms");
        console.log("✅ Rows:", result.rows.length);

        if (result.rows.length > 0) {
            console.log("\nFirst 5 results:");
            result.rows.slice(0, 5).forEach((row, i) => {
                console.log(`${i + 1}. ${row.cod_produto.trim()} - ${row.descricao.trim().substring(0, 50)} - Saldo: ${row.saldo_atual}`);
            });
        } else {
            console.log("\n⚠️ No rows returned even after fix!");
        }

    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

testFixed();
