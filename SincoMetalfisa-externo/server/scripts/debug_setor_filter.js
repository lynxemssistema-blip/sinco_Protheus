const db = require('../db');

async function main() {
    try {
        console.log('Testando query de production com pedido=3731...');
        const t = Date.now();
        
        const pgRes = await db.query(`
            SELECT
                c2.c2_num     AS op,
                c2.c2_item    AS item_op,
                c2.c2_sequen  AS sequen,
                c2.c2_produto AS cod_produto_op,
                MAX(TRIM(c2.c2_pedido)) OVER (PARTITION BY c2.c2_num, c2.c2_item) AS pedido_venda,
                sb1.b1_desc   AS desc_produto,
                g2.g2_operac  AS operacao,
                g2.g2_recurso AS recurso
            FROM public.sc2010 c2
            LEFT JOIN public.sc2010 root_op ON root_op.c2_num = c2.c2_num AND root_op.c2_item = c2.c2_item AND root_op.c2_sequen = '001' AND COALESCE(root_op.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sb1010 sb1 ON sb1.b1_cod = c2.c2_produto AND COALESCE(sb1.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sg2010 g2 ON btrim(g2.g2_produto) = btrim(c2.c2_produto) AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sh1010 h1 ON btrim(h1.h1_codigo) = btrim(g2.g2_recurso) AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sc6010 c6 
                ON c6.c6_filial = c2.c2_filial 
                AND c6.c6_num = c2.c2_pedido
                AND c6.c6_item = c2.c2_itempv
                AND COALESCE(c6.d_e_l_e_t_, '') = ''
            LEFT JOIN public.sc5010 c5 ON c5.c5_num = c6.c6_num AND c5.c5_filial = c6.c6_filial AND COALESCE(c5.d_e_l_e_t_, '') = ''
            LEFT JOIN public.sa1010 a1 ON a1.a1_cod = c5.c5_cliente AND a1.a1_loja = c5.c5_lojacli AND COALESCE(a1.d_e_l_e_t_, '') IN ('', ' ')
            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
              AND (TRIM(c2.c2_pedido) ILIKE $1 OR TRIM(root_op.c2_pedido) ILIKE $1)
            ORDER BY c2.c2_num, c2.c2_item, c2.c2_sequen, g2.g2_operac
            LIMIT 5000
        `, ['%3731%']);
        
        console.log('Tempo:', Date.now() - t, 'ms');
        console.log('Linhas:', pgRes.rows.length);
        if (pgRes.rows.length > 0) {
            console.log('Amostra:', JSON.stringify(pgRes.rows[0]));
        }
    } catch (e) {
        console.error('ERRO:', e.message);
        console.error('CODIGO:', e.code);
    }
    process.exit(0);
}
main();
