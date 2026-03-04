
// GET /api/production/tracking-evolution - Production Evolution by Order
router.get('/tracking-evolution', async (req, res) => {
    try {
        const {
            data_inicio,
            data_fim,
            cliente,
            pedido,
            status
        } = req.query;

        console.log('📊 [PEDIDOS-EVOLUTION] Filters:', { pedido, cliente, data_inicio, data_fim, status });

        // 1. Build filters for SC5 (Sales Orders)
        let whereClause = `WHERE COALESCE(c5.d_e_l_e_t_, '') IN ('', ' ')`;
        const params = [];
        let paramCount = 1;

        if (pedido) {
            whereClause += ` AND c5.c5_num LIKE $${paramCount}`;
            params.push(`%${pedido}%`);
            paramCount++;
        }

        if (cliente) {
            whereClause += ` AND (a1.a1_nome ILIKE $${paramCount} OR a1.a1_nreduz ILIKE $${paramCount} OR c5.c5_cliente LIKE $${paramCount})`;
            params.push(`%${cliente.toUpperCase()}%`);
            paramCount++;
        }

        if (data_inicio) {
            whereClause += ` AND c5.c5_emissao >= $${paramCount}`;
            params.push(data_inicio);
            paramCount++;
        }

        if (data_fim) {
            whereClause += ` AND c5.c5_emissao <= $${paramCount}`;
            params.push(data_fim);
            paramCount++;
        }

        // 2. Fetch Sales Orders with Items and OPs (Refactored for Roteiro Explosion)
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
                LIMIT 50
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
            -- 3. Get OPs (Header level for the Item) with Robust Linkage
            OPsCabecalho AS (
                SELECT 
                    TRIM(c2.c2_num) AS op_num,
                    c2.c2_item AS item_op,
                    c2.c2_sequen AS op_sequencia_split, -- Keeps original split seq for ref
                    c2.c2_produto AS cod_produto,
                    c2.c2_quant::numeric AS qtd_planejada,
                    
                    -- Robust Linking to Pedido (Handles Splits)
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
                WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
            ),
            -- 4. JOIN with SG2 (Roteiro) to Explode Operations
            -- This fixes the "Sequence Mixing" by explicitly listing operations
            OPsRoteiro AS (
                SELECT 
                    op.op_num,
                    op.item_op,
                    op.cod_produto AS cod_produto_op,
                    op.pedido,
                    op.item_pedido,
                    op.qtd_planejada,
                    TRIM(g2.g2_operac) AS sequencia, -- Real Operation Sequence (01, 05, 10)
                    TRIM(g2.g2_recurso) AS recurso,
                    TRIM(g2.g2_descri) AS desc_operacao
                FROM OPsCabecalho op
                LEFT JOIN public.sg2010 g2 
                    ON btrim(g2.g2_produto) = btrim(op.cod_produto) 
                    AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
            )
            SELECT 
                pb.pedido,
                pb.cod_cliente,
                pb.loja_cliente,
                pb.nome_cliente,
                pb.fantasia_cliente,
                pb.data_emissao,
                ip.item,
                ip.cod_produto,
                ip.desc_produto,
                ip.qtd_item,
                ip.data_entrega,
                
                ops.op_num AS op,
                ops.item_op,
                ops.sequencia, -- This is now the REAL routing sequence
                ops.cod_produto_op,
                
                -- Description Logic
                CASE 
                    WHEN ops.recurso IS NOT NULL AND ops.recurso != '' 
                    THEN ops.recurso || ' - ' || COALESCE(ops.desc_operacao, '')
                    ELSE ops.desc_operacao 
                END AS desc_operacao,

                ops.qtd_planejada
            FROM PedidosBase pb
            LEFT JOIN ItensPedido ip ON ip.pedido = pb.pedido
            LEFT JOIN OPsRoteiro ops 
                ON ops.pedido = pb.pedido 
                AND ops.item_pedido = ip.item
            ORDER BY pb.pedido DESC, ip.item, ops.op, ops.sequencia
        `;

        console.log('⏳ [PEDIDOS-EVOLUTION] Executing query...');
        // console.log(query);
        const pgRes = await db.query(query, params);
        const rows = pgRes.rows;

        console.log(`✅ [PEDIDOS-EVOLUTION] Found ${rows.length} rows`);

        if (rows.length === 0) {
            return res.json({ pedidos: [], resumo: { total_pedidos: 0, concluidos: 0, em_andamento: 0, nao_iniciados: 0 } });
        }

        // 3. Fetch all appointments from MySQL
        const [appointments] = await mysqlPool.query(`
            SELECT 
                op_numero, op_item, operacao_codigo, -- Changed to operacao_codigo (Seq)
                SUM(quantidade) as total_produzido,
                MAX(data_fim) as ultima_atualizacao
            FROM app_production_appointments
            GROUP BY op_numero, op_item, operacao_codigo
        `);

        // Create appointments map for quick lookup
        const appointmentsMap = {};
        appointments.forEach(a => {
            // Key format: OP_ITEM_SEQ (Note: OP Item from MySQL might need verify)
            // Ideally match by OP + SEQ. 
            // Protheus OP is usually "12345601" or "123456" + Item "01"
            // App OP_NUMERO usually matches "123456" + "01" (if user entered strictly)
            // Let's assume op_numero in App matches op_num from Protheus query (which is TRIMmed)

            // Note: operacao_codigo in App (01, 05) matches g2_operac (sequencia)
            const key = `${a.op_numero}_${a.operacao_codigo}`;
            appointmentsMap[key] = a;
        });

        // 4. Build hierarchical structure
        const pedidosMap = {};

        rows.forEach(row => {
            const pedidoNum = row.pedido;

            // Initialize pedido if not exists
            if (!pedidosMap[pedidoNum]) {
                pedidosMap[pedidoNum] = {
                    numero: pedidoNum,
                    cliente: {
                        codigo: row.cod_cliente,
                        loja: row.loja_cliente,
                        nome: row.nome_cliente,
                        fantasia: row.fantasia_cliente
                    },
                    data_emissao: row.data_emissao,
                    itens: {}
                };
            }

            // Initialize item if exists and not added yet
            if (row.item && !pedidosMap[pedidoNum].itens[row.item]) {
                pedidosMap[pedidoNum].itens[row.item] = {
                    item: row.item,
                    produto: {
                        codigo: row.cod_produto,
                        descricao: row.desc_produto
                    },
                    quantidade_item: parseFloat(row.qtd_item) || 0,
                    data_entrega: row.data_entrega,
                    ops: []
                };
            }

            // Add OP to item if exists
            if (row.op && row.item) {
                // Key matching: OP + Sequence
                const apptKey = `${row.op}_${row.sequencia}`;
                const appt = appointmentsMap[apptKey];

                const qtdApontada = appt ? parseFloat(appt.total_produzido) || 0 : 0;
                const qtdPlanejada = parseFloat(row.qtd_planejada) || 0;
                const percentual = qtdPlanejada > 0 ? Math.round((qtdApontada / qtdPlanejada) * 100) : 0;

                pedidosMap[pedidoNum].itens[row.item].ops.push({
                    op: row.op,
                    item_op: row.item_op,
                    sequencia: row.sequencia,
                    cod_produto: row.cod_produto_op,
                    operacao: row.desc_operacao || 'N/A',
                    qtd_planejada: qtdPlanejada,
                    qtd_apontada: qtdApontada,
                    percentual: Math.min(percentual, 100),
                    ultima_atualizacao: appt ? appt.ultima_atualizacao : null
                });
            }
        });

        // 5. Calculate percentages for items and pedidos
        const pedidosArray = Object.values(pedidosMap).map(pedido => {
            const itensArray = Object.values(pedido.itens).map(item => {
                // Calculate item percentage (average of OPs completion)
                let percentualItem = 0;
                if (item.ops.length > 0) {
                    // Sum of pre-capped percentages divided by count
                    const somaPercentuais = item.ops.reduce((sum, op) => sum + op.percentual, 0);
                    percentualItem = Math.round(somaPercentuais / item.ops.length);
                }

                return {
                    ...item,
                    percentual_item: percentualItem
                };
            });

            // Calculate pedido percentage (average of items completion)
            let percentualGeral = 0;
            if (itensArray.length > 0) {
                const somaPercentuaisItens = itensArray.reduce((sum, item) => sum + item.percentual_item, 0);
                percentualGeral = Math.round(somaPercentuaisItens / itensArray.length);
            }

            // Determine status
            let statusPedido = 'nao_iniciado';
            if (percentualGeral >= 100) statusPedido = 'concluido';
            else if (percentualGeral > 0) statusPedido = 'em_andamento';

            // Calculate Delivery Date (Max of items)
            let dataEntrega = null;
            if (itensArray.length > 0) {
                const dates = itensArray
                    .map(i => i.data_entrega)
                    .filter(d => d)
                    .sort((a, b) => new Date(b) - new Date(a));
                if (dates.length > 0) dataEntrega = dates[0];
            }

            return {
                numero: pedido.numero,
                cliente: pedido.cliente,
                data_emissao: pedido.data_emissao,
                data_entrega: dataEntrega,
                total_itens: itensArray.length,
                percentual_geral: percentualGeral,
                status: statusPedido,
                itens: itensArray
            };
        });

        // 6. Apply status filter if provided
        let filteredPedidos = pedidosArray;
        if (status) {
            const statusArray = status.split(',').map(s => s.trim());
            filteredPedidos = pedidosArray.filter(p => statusArray.includes(p.status));
        }

        // 7. Calculate summary
        const resumo = {
            total_pedidos: filteredPedidos.length,
            concluidos: filteredPedidos.filter(p => p.status === 'concluido').length,
            em_andamento: filteredPedidos.filter(p => p.status === 'em_andamento').length,
            nao_iniciados: filteredPedidos.filter(p => p.status === 'nao_iniciado').length
        };

        console.log('📊 [PEDIDOS-EVOLUTION] Resumo:', resumo);

        res.json({
            pedidos: filteredPedidos,
            resumo
        });

    } catch (err) {
        console.error('❌ [PEDIDOS-EVOLUTION] Error:', err);
        res.status(500).json({ error: err.message });
    }
});
