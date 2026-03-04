
const db = require('./db');

async function testSimplifiedRoute() {
    try {
        // Simulate the route logic
        const empresa = undefined;
        const limit = 5;

        const params = [];
        let paramCount = 1;

        let whereClause = "WHERE TRIM(COALESCE(s.d_e_l_e_t_, '')) = '' AND TRIM(COALESCE(p.d_e_l_e_t_, '')) = '' ";
        whereClause += "AND s.b2_cod !~ '^MT[0-9]' ";

        params.push(parseInt(limit));
        const limitParam = paramCount++;

        const queries = [];

        if (!empresa || empresa === '010') {
            queries.push(`
                SELECT 
                    '010'::text as empresa,
                    s.b2_filial as filial,
                    s.b2_cod as cod_produto,
                    p.b1_desc as descricao
                FROM public.sb2010 s
                JOIN public.sb1010 p ON TRIM(p.b1_cod) = TRIM(s.b2_cod)
                ${whereClause}
                LIMIT $${limitParam}
            `);
        }

        if (!empresa || empresa === '990') {
            queries.push(`
                SELECT 
                    '990'::text as empresa,
                    s.b2_filial as filial,
                    s.b2_cod as cod_produto,
                    p.b1_desc as descricao
                FROM public.sb2990 s
                JOIN public.sb1990 p ON TRIM(p.b1_cod) = TRIM(s.b2_cod)
                ${whereClause}
                LIMIT $${limitParam}
            `);
        }

        const sql = queries.join(' UNION ALL ');

        console.log("=== GENERATED SQL ===");
        console.log(sql);
        console.log("\n=== PARAMS ===");
        console.log(params);

        console.log("\n=== EXECUTING ===");
        const result = await db.query(sql, params);
        console.log("✅ SUCCESS! Rows:", result.rows.length);

    } catch (e) {
        console.error("\n❌ ERROR:", e.message);
        console.error("Detail:", e.detail);
    }
}

testSimplifiedRoute();
