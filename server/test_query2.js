const db = require('./db');

async function test() {
    try {
        const query = `
            SELECT 
                TRIM(c5.c5_num) as pedido, 
                TRIM(c6.c6_item) as item,
                TRIM(c6.c6_produto) as produto,
                (COALESCE(c6.c6_qtdven, 0) - COALESCE(c6.c6_qtdent, 0))::numeric(18,6) as qtd_faturar,
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
                        AND COALESCE(f2.d_e_l_e_t_, '') = ''
                    WHERE d2.d2_pedido = c5.c5_num 
                      AND d2.d2_itempv = c6.c6_item 
                      AND COALESCE(d2.d_e_l_e_t_, '') = ''
                ) AS notas_fiscais,
                (
                    SELECT json_agg(
                        json_build_object(
                            'nota', TRIM(c6_nota),
                            'serie', TRIM(c6_serie)
                        )
                    )
                    FROM public.sc6010 sub_c6
                    WHERE sub_c6.c6_num = c5.c5_num AND sub_c6.c6_item = c6.c6_item
                ) AS c6_notas
            FROM public.sc5010 c5
            JOIN public.sc6010 c6 
                ON COALESCE(c6.d_e_l_e_t_, '') = ''
                AND c6.c6_filial = c5.c5_filial
                AND c6.c6_num = c5.c5_num
            WHERE c5.c5_num = '002702' AND c6.c6_item = '01';
        `;
        const res = await db.query(query);
        console.log("DADOS DO PEDIDO:");
        console.log(JSON.stringify(res.rows, null, 2));

        // Let's also check SD2 plain
        console.log("\nBUSCANDO SD2 (ITENS DE NF DE SAIDA):");
        const sd2 = await db.query(`SELECT d2_doc, d2_serie, d2_itempv, d2_pedido FROM sd2010 WHERE d2_pedido = '002702'`);
        console.log(sd2.rows);

    } catch (e) { console.error(e) }
    process.exit(0);
}

test();
