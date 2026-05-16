
const db = require('./db');

async function debugCounts() {
    try {
        console.log("--- Checking Matches ---");
        const res = await db.query("SELECT count(*) FROM sb1010 WHERE b1_desc LIKE '%CHAPA%'");
        console.log(`'CHAPA' matches in sb1010: ${res.rows[0].count}`);

        const res9 = await db.query("SELECT count(*) FROM sb1990 WHERE b1_desc LIKE '%CHAPA%'");
        console.log(`'CHAPA' matches in sb1990: ${res9.rows[0].count}`);

        console.log("\n--- Testing Explicit LIMIT in Subquery ---");
        const start = performance.now();
        // Simulating the UNION with LIMIT pushed down
        const sql = `
            SELECT * FROM (
                SELECT 
                    '010'::text as empresa,
                    s.b2_filial as filial,
                    s.b2_local as almoxarifado,
                    p.b1_desc as descricao
                FROM public.sb1010 p
                JOIN public.sb2010 s ON s.b2_cod = p.b1_cod AND s.b2_filial = p.b1_filial
                WHERE TRIM(COALESCE(p.d_e_l_e_t_, '')) = '' 
                AND p.b1_cod !~ '^MT[0-9]' 
                AND p.b1_desc LIKE '%CHAPA%'
                LIMIT 500
            ) q1
            UNION ALL
            SELECT * FROM (
                SELECT 
                    '990'::text as empresa,
                    s.b2_filial as filial,
                    s.b2_local as almoxarifado,
                    p.b1_desc as descricao
                FROM public.sb1990 p
                JOIN public.sb2990 s ON s.b2_cod = p.b1_cod AND s.b2_filial = p.b1_filial
                WHERE TRIM(COALESCE(p.d_e_l_e_t_, '')) = '' 
                AND p.b1_cod !~ '^MT[0-9]' 
                AND p.b1_desc LIKE '%CHAPA%'
                LIMIT 500
            ) q2
            LIMIT 500
        `;
        const res2 = await db.query(sql);
        console.log(`With Pushed Limit: ${(performance.now() - start).toFixed(2)}ms | Rows: ${res2.rows.length}`);

    } catch (e) {
        console.error(e);
    }
}

debugCounts();
