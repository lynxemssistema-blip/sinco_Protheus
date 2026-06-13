const db = require('./db');

const query = `
            WITH paged_items AS (
                SELECT
                    COUNT(*) OVER() AS full_count,
                    TRIM(c5.c5_num) as pedido
                FROM public.sc5010 c5
                JOIN public.sc6010 c6
                    ON COALESCE(c6.d_e_l_e_t_, '') = ''
                    AND c6.c6_filial = c5.c5_filial
                    AND c6.c6_num = c5.c5_num
                WHERE COALESCE(c5.d_e_l_e_t_, '') = '' AND c5.c5_tipo <> 'B' AND COALESCE(c6.d_e_l_e_t_, '') = ''
                AND (
                    COALESCE(c5.c5_nota, '') = '' 
                    OR EXISTS (
                        SELECT 1 FROM public.sc6010 c6_ex 
                        WHERE c6_ex.c6_num = c5.c5_num 
                        AND c6_ex.c6_filial = c5.c5_filial 
                        AND COALESCE(c6_ex.d_e_l_e_t_, '') = ''
                        AND ((c6_ex.c6_qtdven - c6_ex.c6_qtdent) > 0 OR c6_ex.c6_qtdlib > 0)
                    )
                )
                AND ((c6.c6_qtdven - c6.c6_qtdent) > 0 OR c6.c6_qtdlib > 0)
                LIMIT 50 OFFSET 0
            )
            SELECT * FROM paged_items
`;

db.query(query).then(res => console.log('SUCCESS')).catch(err => console.error(err.message)).finally(() => process.exit());
