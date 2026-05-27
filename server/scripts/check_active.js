const db = require('../db');

async function checkActive() {
    try {
        console.time("Query Active");
        const query = `
            SELECT c6.c6_produto, c6.c6_item, c5.c5_num, c6.c6_xrevm, c6.c6_xrevc, sb1.b1_msblql
            FROM public.sc5010 c5
            JOIN public.sc6010 c6
                ON c6.c6_filial = c5.c5_filial
                AND c6.c6_num   = c5.c5_num
                AND COALESCE(c6.d_e_l_e_t_, '') = ''
            LEFT JOIN public.sb1010 sb1
                ON sb1.b1_cod = c6.c6_produto
                AND COALESCE(sb1.d_e_l_e_t_, '') = ''
            WHERE COALESCE(c5.d_e_l_e_t_, '') = ''
              AND c5.c5_tipo <> 'B'
              AND ((c6.c6_qtdven - c6.c6_qtdent) > 0 OR c6.c6_qtdlib > 0)
        `;
        const result = await db.query(query);
        console.timeEnd("Query Active");
        console.log("Rows count:", result.rows.length);
        process.exit(0);
    } catch(e) {
        console.error(e.message);
        process.exit(1);
    }
}
checkActive();
