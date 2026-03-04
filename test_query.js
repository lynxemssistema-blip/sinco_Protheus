const db = require('./server/db');

async function test() {
    try {
        const query = `
            SELECT 
                TRIM(c5.c5_num) as pedido, 
                TRIM(c6.c6_item) as item,
                (
                    SELECT json_agg(
                        json_build_object(
                            'nota', TRIM(d2.d2_doc),
                            'serie', TRIM(d2.d2_serie),
                            'emissao', TO_CHAR(TO_DATE(NULLIF(TRIM(f2.f2_emissao), ''), 'YYYYMMDD'), 'DD/MM/YY'),
                            'qtd', d2.d2_quant::numeric(18,2)
                        )
                    )
                    FROM public.sd2010 d2
                    JOIN public.sf2010 f2 
                        ON f2.f2_doc = d2.d2_doc 
                        AND f2.f2_serie = d2.d2_serie 
                        AND f2.f2_filial = d2.d2_filial 
                        AND COALESCE(f2.d_e_l_e_t_, '') = ''
                    WHERE d2.d2_pedido = c5.c5_num 
                      AND d2.d2_itempv = c6.c6_item 
                      AND d2.d2_filial = c5.c5_filial 
                      AND COALESCE(d2.d_e_l_e_t_, '') = ''
                ) AS notas_fiscais
            FROM public.sc5010 c5
            JOIN public.sc6010 c6 
                ON COALESCE(c6.d_e_l_e_t_, '') = ''
                AND c6.c6_filial = c5.c5_filial
                AND c6.c6_num = c5.c5_num
                AND (COALESCE(c6.c6_qtdent, 0) > 0)
            WHERE c5.c5_tipo <> 'B'
            LIMIT 5;
        `;
        const res = await db.query(query);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) { console.error(e) }
    process.exit(0);
}

test();
