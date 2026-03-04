
// REFACTOR PLAN for /tracking-evolution

/*
    PROBLEM: 
    1. OP Blank: The join 'ops.pedido = pb.pedido' fails because the 'Parent OP' lookup uses strict "c2_sequen = '001'" which might be '  1' or '01'.
    2. Sequence Mixing: The query currently selects 'c2.c2_sequen' (OP Split) but treats it like an Operation. App logs against Routing Operations (01, 05).

    SOLUTION:
    1. Robust Parent Lookup: Use TRIM(c2_sequen) IN ('01', '001', '1').
    2. Routing Expansion: Join SC2 (OP) with SG2 (Operations) to generate the granular rows needed for the "Evolution".
       - Row = OP + Operation (e.g. OP 100 - Seq 01 Corte).
    3. Match Appointments: Match App (OP + OpCode) to this Expanded List.
*/

router.get('/tracking-evolution', async (req, res) => {
    // ... filters ...

    const query = `
        WITH PedidosBase AS (
            // ... same ...
        ),
        ItensPedido AS (
            // ... same ...
        ),
        -- 1. Get OPs (Header level for the Item)
        OPsCabecalho AS (
            SELECT 
                c2.c2_num AS op_num,
                c2.c2_item AS item_op,
                c2.c2_produto AS cod_produto,
                c2.c2_quant::numeric AS qtd_planejada,
                -- Robust Pedido Linking
                COALESCE(
                    NULLIF(TRIM(c2.c2_pedido), ''),
                    (SELECT TRIM(parent.c2_pedido) 
                     FROM public.sc2010 parent 
                     WHERE parent.c2_num = c2.c2_num 
                       AND parent.c2_item = c2.c2_item 
                       AND TRIM(parent.c2_sequen) IN ('01', '001', '1') -- FIX 1: Robust check
                       AND COALESCE(parent.d_e_l_e_t_, '') IN ('', ' ')
                     LIMIT 1)
                ) AS pedido,
                COALESCE(
                    NULLIF(TRIM(c2.c2_itempv), ''),
                    (SELECT parent.c2_itempv 
                     FROM public.sc2010 parent 
                     WHERE parent.c2_num = c2.c2_num 
                       AND parent.c2_item = c2.c2_item 
                       AND TRIM(parent.c2_sequen) IN ('01', '001', '1') -- FIX 1
                       AND COALESCE(parent.d_e_l_e_t_, '') IN ('', ' ')
                     LIMIT 1)
                ) AS item_pedido
            FROM public.sc2010 c2
            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
            -- Optimization: Filter by PedidosBase scope if possible, or leave lateral join later
        ),
        -- 2. Expand to Operations (Routing) -- FIX 2
        OPsRoteiro AS (
            SELECT
                op.op_num,
                op.item_op,
                op.cod_produto,
                op.pedido,
                op.item_pedido,
                op.qtd_planejada,
                TRIM(g2.g2_operac) AS sequencia, -- '01', '05'
                TRIM(g2.g2_recurso) AS recurso,
                TRIM(g2.g2_descri) AS desc_operacao
            FROM OPsCabecalho op
            LEFT JOIN public.sg2010 g2 
                ON btrim(g2.g2_produto) = btrim(op.cod_produto) 
                AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
        )
        SELECT 
            pb.pedido,
            -- ... pb fields ...
            ip.item,
            ops.op_num as op,
            ops.sequencia,
            ops.desc_operacao,
            ops.qtd_planejada
        FROM PedidosBase pb
        LEFT JOIN ItensPedido ip ON ip.pedido = pb.pedido
        LEFT JOIN OPsRoteiro ops 
            ON ops.pedido = pb.pedido 
            AND ops.item_pedido = ip.item
        ORDER BY pb.pedido, ip.item, ops.op_num, ops.sequencia;
    `;

    // ... Fetch and Process ...
});
