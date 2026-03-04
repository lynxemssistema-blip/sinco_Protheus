const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
});

async function run() {
    try {
        const pgQuery = `
                WITH RECURSIVE Estrutura AS(
                        SELECT 
                        TRIM(b1.b1_cod) as codigo,
                        TRIM(b1.b1_desc) as descricao,
                        TRIM(b1.b1_um) as unidade,
                        TRIM(b1.b1_tipo) as tipo_produto,
                        TRIM(b1.b1_xrevm) as rev_metalfisa,
                        TRIM(b1.b1_xrevc) as rev_cliente,
                        b1.b1_msblql as restri_sb1,
                        1:: numeric as qtd_necessaria,
                        0 as nivel,
                        ARRAY[TRIM(b1.b1_cod)]:: text[] as path_array
                    FROM public.sb1010 b1
                    WHERE TRIM(b1.b1_cod) = $1 
                      AND COALESCE(b1.d_e_l_e_t_, '') IN('', ' ')

                    UNION ALL

                    SELECT 
                        TRIM(g1.g1_comp) as codigo,
                        TRIM(b1.b1_desc) as descricao,
                        TRIM(b1.b1_um) as unidade,
                        TRIM(b1.b1_tipo) as tipo_produto,
                        TRIM(b1.b1_xrevm) as rev_metalfisa,
                        TRIM(b1.b1_xrevc) as rev_cliente,
                        b1.b1_msblql as restri_sb1,
                        (e.qtd_necessaria * CAST(g1.g1_quant AS NUMERIC)) as qtd_necessaria,
                        e.nivel + 1,
                        array_append(e.path_array, TRIM(g1.g1_comp))
                    FROM public.sg1010 g1
                    JOIN Estrutura e ON TRIM(g1.g1_cod) = e.codigo
                    LEFT JOIN public.sb1010 b1 ON TRIM(b1.b1_cod) = TRIM(g1.g1_comp) 
                        AND COALESCE(b1.d_e_l_e_t_, '') IN('', ' ')
                    WHERE COALESCE(g1.d_e_l_e_t_, '') IN('', ' ')
                      AND NOT(TRIM(g1.g1_comp) = ANY(e.path_array))
                    )
                SELECT e.*, 
                       (SELECT z0_status FROM public.sz0010 z0 WHERE TRIM(z0.z0_produto) = e.codigo AND COALESCE(z0.d_e_l_e_t_, '') <> '*' LIMIT 1) as restri_sz0 
                FROM Estrutura e
                ORDER BY path_array
                LIMIT 5;
    `;
        const res = await pool.query(pgQuery, ['MT2-2463']);
        console.log(res.rows);
    } catch (e) {
        console.error(e.message);
    } finally {
        pool.end();
    }
}
run();
