
const db = require('./db');
require('dotenv').config();

async function testQuery() {
    console.log('🔍 Testing Tracking Evolution SQL Query...');

    // Params mimicking a default request
    const params = [];
    // If your query uses $1, $2 params dynamically, we need to match that.
    // The query in production.js builds params dynamically.
    // I will use a simplified version of the logic to build the query text and params.

    let whereClause = `WHERE COALESCE(c5.d_e_l_e_t_, '') IN ('', ' ')`;

    // Just limit results to avoid huge dump
    // No filters for now

    const query = `
        WITH PedidosBase AS (
            SELECT DISTINCT
                c5.c5_num AS pedido,
                c5.c5_cliente AS cod_cliente,
                c5.c5_lojacli AS loja_cliente,
                a1.a1_nome AS nome_cliente,
                a1.a1_nreduz AS fantasia_cliente,
                c5.c5_emissao AS data_emissao
            FROM public.sc5010 c5
            LEFT JOIN public.sa1010 a1 
                ON a1.a1_cod = c5.c5_cliente 
                AND a1.a1_loja = c5.c5_lojacli 
                AND COALESCE(a1.d_e_l_e_t_, '') IN ('', ' ')
            ${whereClause}
            ORDER BY c5.c5_num DESC
            LIMIT 5
        ),
        ItensPedido AS (
            SELECT 
                c6.c6_num AS pedido,
                c6.c6_item AS item,
                c6.c6_produto AS cod_produto,
                TRIM(c6.c6_descri) AS desc_produto,
                c6.c6_qtdven::numeric AS qtd_item,
                c6.c6_entreg AS data_entrega
            FROM public.sc6010 c6
            INNER JOIN PedidosBase pb ON pb.pedido = c6.c6_num
            WHERE COALESCE(c6.d_e_l_e_t_, '') IN ('', ' ')
        ),
        OPsCabecalho AS (
            SELECT 
                TRIM(c2.c2_num) AS op_num,
                c2.c2_item AS item_op,
                c2.c2_sequen AS op_sequencia_split,
                c2.c2_produto AS cod_produto,
                c2.c2_quant::numeric AS qtd_planejada,
                
                COALESCE(
                    NULLIF(TRIM(c2.c2_pedido), ''),
                    (SELECT TRIM(parent.c2_pedido) 
                        FROM public.sc2010 parent 
                        WHERE parent.c2_num = c2.c2_num 
                        AND parent.c2_item = c2.c2_item 
                        AND TRIM(parent.c2_sequen) IN ('01', '001', '1')
                        AND COALESCE(parent.d_e_l_e_t_, '') IN ('', ' ')
                        LIMIT 1)
                ) AS pedido,
                
                COALESCE(
                    NULLIF(TRIM(c2.c2_itempv), ''),
                    (SELECT parent.c2_itempv 
                        FROM public.sc2010 parent 
                        WHERE parent.c2_num = c2.c2_num 
                        AND parent.c2_item = c2.c2_item 
                        AND TRIM(parent.c2_sequen) IN ('01', '001', '1')
                        AND COALESCE(parent.d_e_l_e_t_, '') IN ('', ' ')
                        LIMIT 1)
                ) AS item_pedido

            FROM public.sc2010 c2
            INNER JOIN ItensPedido ip ON btrim(c2.c2_produto) = btrim(ip.cod_produto)
            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
        ),
        OPsRoteiro AS (
            SELECT 
                op.op_num,
                op.item_op,
                op.cod_produto AS cod_produto_op,
                op.pedido,
                op.item_pedido,
                op.qtd_planejada,
                TRIM(g2.g2_operac) AS sequencia, 
                TRIM(g2.g2_recurso) AS recurso,
                TRIM(g2.g2_descri) AS desc_operacao
            FROM OPsCabecalho op
            LEFT JOIN public.sg2010 g2 
                ON btrim(g2.g2_produto) = btrim(op.cod_produto) 
                AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
        )
        SELECT 
            pb.pedido,
            ip.item,
            ops.op_num as op,
            ops.sequencia,
            ops.desc_operacao
        FROM PedidosBase pb
        LEFT JOIN ItensPedido ip ON ip.pedido = pb.pedido
        LEFT JOIN OPsRoteiro ops 
            ON ops.pedido = pb.pedido 
            AND ops.item_pedido = ip.item
        ORDER BY pb.pedido DESC, ip.item, ops.op_num, ops.sequencia;
    `;

    try {
        const result = await db.query(query, params);
        console.log(`✅ Success! Returned ${result.rows.length} rows.`);
        if (result.rows.length > 0) console.log(result.rows[0]);
    } catch (err) {
        console.error('❌ SQL Error:', err.message);
        if (err.position) console.error('Position:', err.position);
    }
}

testQuery();
