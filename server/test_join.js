
const db = require('./db');

async function testJoinNoFilter() {
    try {
        console.log("Testing JOIN without MT filter...");
        const join = await db.query(`
            SELECT 
                p.b1_cod, p.b1_desc, s.b2_qatu, s.b2_filial, p.b1_filial
            FROM sb1010 p
            JOIN sb2010 s ON s.b2_cod = p.b1_cod AND s.b2_filial = p.b1_filial
            WHERE TRIM(COALESCE(p.d_e_l_e_t_, '')) = ''
            AND TRIM(COALESCE(s.d_e_l_e_t_, '')) = ''
            LIMIT 10
        `);
        console.log("   Found", join.rows.length, "joined records");
        join.rows.forEach((row, i) => {
            console.log(`   ${i + 1}. Produto: "${row.b1_cod.trim()}" Filial P:"${row.b1_filial}" S:"${row.b2_filial}" Saldo: ${row.b2_qatu}`);
        });

        if (join.rows.length === 0) {
            console.log("\n   No matches! Checking if b1_filial exists in SB1...");
            const check = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sb1010' AND column_name LIKE '%filial%'");
            console.log("   Filial columns in SB1:", check.rows.map(r => r.column_name));

            console.log("\n   Trying join without filial filter...");
            const join2 = await db.query(`
                SELECT 
                    p.b1_cod, p.b1_desc, s.b2_qatu
                FROM sb1010 p
                JOIN sb2010 s ON s.b2_cod = p.b1_cod
                WHERE TRIM(COALESCE(p.d_e_l_e_t_, '')) = ''
                AND TRIM(COALESCE(s.d_e_l_e_t_, '')) = ''
                LIMIT 10
            `);
            console.log("   Found", join2.rows.length, "records with simplified JOIN");
            join2.rows.forEach((row, i) => {
                console.log(`   ${i + 1}. "${row.b1_cod.trim()}" - Saldo: ${row.b2_qatu}`);
            });
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}

testJoinNoFilter();
