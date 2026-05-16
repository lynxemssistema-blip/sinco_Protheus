
const db = require('./db');

async function debugDb() {
    try {
        console.log("--- Row Counts ---");
        const res1 = await db.query("SELECT count(*) FROM sb1010");
        console.log(`sb1010: ${res1.rows[0].count}`);

        const res2 = await db.query("SELECT count(*) FROM sb2010");
        console.log(`sb2010: ${res2.rows[0].count}`);

        console.log("\n--- EXPLAIN ANALYZE (Desc Filter) ---");
        const explainSql = `
            EXPLAIN ANALYZE
            SELECT 
                s.b2_filial as filial,
                p.b1_desc as descricao
            FROM public.sb1010 p
            JOIN public.sb2010 s ON s.b2_cod = p.b1_cod AND s.b2_filial = p.b1_filial
            WHERE TRIM(COALESCE(p.d_e_l_e_t_, '')) = ''
            AND p.b1_cod !~ '^MT[0-9]'
            AND p.b1_desc LIKE '%CHAP%'
            LIMIT 10
        `;
        const resExplain = await db.query(explainSql);
        resExplain.rows.forEach(r => console.log(r['QUERY PLAN']));

    } catch (e) {
        console.error(e);
    }
}

debugDb();
