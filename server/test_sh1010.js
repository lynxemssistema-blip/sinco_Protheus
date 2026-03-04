require('dotenv').config();
const db = require('./db');

async function testQuery() {
    try {
        console.log("Connecting...");
        const resQuery = `
            SELECT 
                h1_codigo  AS cod_recurso,
                h1_descri  AS desc_recurso
            FROM public.sh1010
            WHERE d_e_l_e_t_ = ' '
            ORDER BY h1_codigo
        `;

        const res = await db.query(resQuery);
        console.log(`Found ${res.rows.length} rows.`);
        if (res.rows.length > 0) {
            console.log("First 3 rows:", res.rows.slice(0, 3));

            // Check mapping
            const mapped = res.rows.map(r => ({
                codigo: r.cod_recurso ? r.cod_recurso.trim() : '',
                descricao: r.desc_recurso ? r.desc_recurso.trim() : ''
            }));
            console.log("Mapped:", mapped.slice(0, 3));
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit();
    }
}

testQuery();
