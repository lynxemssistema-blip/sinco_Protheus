require('dotenv').config({ path: './.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE
});

async function run() {
  try {
    const res = await pool.query(`
            SELECT
                c2.c2_num     AS op,
                c2.c2_item    AS item_op,
                c2.c2_sequen  AS sequen,
                c2.c2_produto AS cod_produto_op,
                MAX(TRIM(c2.c2_pedido)) OVER (PARTITION BY c2.c2_num, c2.c2_item) AS pedido_venda,
                sb1.b1_desc   AS desc_produto,
                sb1.b1_tipo   AS tipo_produto,
                c2.c2_um                     AS um_op,
                c2.c2_quant::numeric         AS qtd_planejada_op,
                c2.c2_quje::numeric          AS qtd_apontada_erp,
                
                -- Cliente
                c5.c5_cliente AS cod_cliente,
                a1.a1_nome    AS nome_cliente,
                a1.a1_nreduz  AS nome_fantasia,
                TRIM(c6.c6_pedcli) AS ped_cliente,

                -- Roteiro
                g2.g2_codigo  AS cod_roteiro,
                g2.g2_operac  AS operacao,
                h1.h1_descri  AS desc_operacao,
                g2.g2_recurso AS recurso,
                LAG(g2.g2_operac) OVER (PARTITION BY c2.c2_num, c2.c2_item, c2.c2_sequen ORDER BY g2.g2_operac) as prev_operacao,
                LEAD(g2.g2_operac) OVER (PARTITION BY c2.c2_num, c2.c2_item, c2.c2_sequen ORDER BY g2.g2_operac) as next_operacao,
                TRIM(LAG(h1.h1_descri) OVER (PARTITION BY c2.c2_num, c2.c2_item, c2.c2_sequen ORDER BY g2.g2_operac)) as prev_desc_operacao,
                TRIM(LEAD(h1.h1_descri) OVER (PARTITION BY c2.c2_num, c2.c2_item, c2.c2_sequen ORDER BY g2.g2_operac)) as next_desc_operacao

            FROM public.sc2010 c2
            LEFT JOIN public.sc2010 root_op ON root_op.c2_num = c2.c2_num AND root_op.c2_item = c2.c2_item AND root_op.c2_sequen = '001' AND COALESCE(root_op.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sb1010 sb1 ON sb1.b1_cod = c2.c2_produto AND COALESCE(sb1.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sg2010 g2 ON btrim(g2.g2_produto) = btrim(c2.c2_produto) AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sh1010 h1 ON h1.h1_codigo = g2.g2_recurso AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sc6010 c6 
                ON c6.c6_filial = c2.c2_filial 
                AND c6.c6_num = c2.c2_pedido
                AND c6.c6_item = c2.c2_itempv
                AND COALESCE(c6.d_e_l_e_t_, '') = ''
            LEFT JOIN public.sc5010 c5 ON c5.c5_filial = c2.c2_filial AND c5.c5_num = (CASE WHEN btrim(c2.c2_pedido) <> '' THEN btrim(c2.c2_pedido) ELSE btrim(root_op.c2_pedido) END) AND COALESCE(c5.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sa1010 a1 ON a1.a1_cod = c5.c5_cliente AND a1.a1_loja = c5.c5_lojacli AND COALESCE(a1.d_e_l_e_t_, '') IN ('', ' ')

            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ') limit 1
    `);
    console.log('Query success!');
  } catch (e) {
    console.error('QUERY FAILED:', e.message);
  } finally {
    pool.end();
  }
}

run();
