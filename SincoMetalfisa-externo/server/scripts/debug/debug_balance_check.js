const db = require('./db');

async function testQuery() {
    try {
        const query = `
            SELECT 
                c6.c6_item AS item,
                c6.c6_produto AS codigo,
                c6.c6_qtdven AS quantidade,
                COALESCE(c6.c6_qtdent, 0) AS qtd_entregue,
                (c6.c6_qtdven - COALESCE(c6.c6_qtdent, 0)) AS saldo
            FROM public.sc6010 c6 
            INNER JOIN public.sc5010 c5 ON c5.c5_num = c6.c6_num AND c5.c5_filial = c6.c6_filial
            WHERE c5.c5_num = '002553' AND COALESCE(c6.d_e_l_e_t_, '') = ''
            ORDER BY c6.c6_item
        `;

        console.log("Running query for order 002553...");
        const result = await db.query(query);
        console.table(result.rows);
    } catch (err) {
        console.error("Error:", err);
    } finally {
        // Just close the script, connection pooling handles the rest or might hang if not explicitly closed depending on db.js implementation
        process.exit();
    }
}

testQuery();
