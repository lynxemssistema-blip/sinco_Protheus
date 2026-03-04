
// GET /api/production/tracking-comparison - Compare Planned vs Tracked Production
router.get('/tracking-comparison', async (req, res) => {
    try {
        const {
            data_inicio,
            data_fim,
            pedido,
            op,
            produto
        } = req.query;

        console.log('📊 [TRACKING-COMPARISON] Filters:', { data_inicio, data_fim, pedido, op, produto });

        // 1. Get tracked quantities from appointments (MySQL)
        let appointmentFilters = [];
        let appointmentParams = [];

        if (data_inicio) {
            appointmentFilters.push(`a.data_fim >= ?`);
            appointmentParams.push(data_inicio);
        }
        if (data_fim) {
            appointmentFilters.push(`a.data_fim <= ?`);
            appointmentParams.push(`${data_fim} 23:59:59`);
        }
        if (op) {
            appointmentFilters.push(`a.op_numero LIKE ?`);
            appointmentParams.push(`%${op}%`);
        }

        const appointmentWhere = appointmentFilters.length > 0
            ? `WHERE ${appointmentFilters.join(' AND ')}`
            : '';

        const appointmentsQuery = `
            SELECT 
                a.operacao_codigo,
                SUM(a.quantidade) as qtd_apontada
            FROM app_production_appointments a
            ${appointmentWhere}
            GROUP BY a.operacao_codigo
        `;

        const [appointmentsData] = await mysqlPool.query(appointmentsQuery, appointmentParams);

        // 2. Get planned quantities from Protheus (Postgres)
        let protheusFilters = [];
        let protheusParams = [];
        let paramCount = 1;

        // Base filter: Not deleted
        protheusFilters.push(`COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')`);
        protheusFilters.push(`COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')`);

        if (data_inicio) {
            protheusFilters.push(`c2.c2_datpri >= $${paramCount}`);
            protheusParams.push(data_inicio.replace(/-/g, ''));
            paramCount++;
        }
        if (data_fim) {
            protheusFilters.push(`c2.c2_datpri <= $${paramCount}`);
            protheusParams.push(data_fim.replace(/-/g, ''));
            paramCount++;
        }
        if (pedido) {
            protheusFilters.push(`TRIM(c2.c2_pedido) LIKE $${paramCount}`);
            protheusParams.push(`%${pedido}%`);
            paramCount++;
        }
        if (op) {
            protheusFilters.push(`TRIM(c2.c2_num) LIKE $${paramCount}`);
            protheusParams.push(`%${op}%`);
            paramCount++;
        }
        if (produto) {
            protheusFilters.push(`(TRIM(c2.c2_produto) ILIKE $${paramCount} OR TRIM(c2.c2_descri) ILIKE $${paramCount})`);
            protheusParams.push(`%${produto}%`);
            paramCount++;
        }

        const protheusWhere = protheusFilters.length > 0
            ? `WHERE ${protheusFilters.join(' AND ')}`
            : '';

        // Join SC2 (OPs) with SG2 (Operations) by Product
        // Summing OP Quantity (c2_quant) grouping by Operation
        const plannedQuery = `
            SELECT 
                TRIM(g2.g2_operac) as operacao_codigo,
                TRIM(g2.g2_descri) as operacao_desc,
                SUM(c2.c2_quant::numeric) as qtd_planejada
            FROM public.sc2010 c2
            LEFT JOIN public.sg2010 g2 ON btrim(g2.g2_produto) = btrim(c2.c2_produto)
            ${protheusWhere}
            GROUP BY g2.g2_operac, g2.g2_descri
        `;

        console.log('PG Query:', plannedQuery);
        console.log('PG Params:', protheusParams);

        const pgResult = await db.query(plannedQuery, protheusParams);
        const plannedRows = pgResult.rows;

        // 3. Combine data
        const operationsMap = {};

        // Add planned data
        plannedRows.forEach(row => {
            const codigo = row.operacao_codigo || 'SEM_CODIGO';
            operationsMap[codigo] = {
                codigo,
                descricao: row.operacao_desc || 'Sem descrição',
                planejado: Math.round(parseFloat(row.qtd_planejada || 0) * 100) / 100,
                apontado: 0,
                diferenca: 0,
                percentual: 0,
                status: 'pending'
            };
        });

        // Add tracked data
        appointmentsData.forEach(row => {
            const codigo = row.operacao_codigo;
            if (!operationsMap[codigo]) {
                operationsMap[codigo] = {
                    codigo,
                    descricao: 'Sem descrição',
                    planejado: 0,
                    apontado: 0,
                    diferenca: 0,
                    percentual: 0,
                    status: 'extra'
                };
            }
            operationsMap[codigo].apontado = Math.round(parseFloat(row.qtd_apontada) * 100) / 100;
        });

        // Calculate metrics
        let totalPlanejado = 0;
        let totalApontado = 0;

        Object.values(operationsMap).forEach(op => {
            op.diferenca = Math.round((op.apontado - op.planejado) * 100) / 100;
            op.percentual = op.planejado > 0
                ? Math.round((op.apontado / op.planejado) * 100 * 100) / 100
                : (op.apontado > 0 ? 100 : 0);

            // Determine status
            if (op.percentual >= 100) {
                op.status = 'complete';
            } else if (op.percentual >= 80) {
                op.status = 'partial'; // Changed threshold to 80% per UI code
            } else if (op.percentual > 0) {
                op.status = 'low';
            } else if (op.planejado > 0) {
                op.status = 'pending';
            } else {
                op.status = 'extra'; // For extra ops
            }

            totalPlanejado += op.planejado;
            totalApontado += op.apontado;
        });

        const operacoes = Object.values(operationsMap).sort((a, b) => a.codigo.localeCompare(b.codigo));

        const totalPercentual = totalPlanejado > 0
            ? Math.round((totalApontado / totalPlanejado) * 100 * 100) / 100
            : 0;

        res.json({
            resumo: {
                total_planejado: Math.round(totalPlanejado * 100) / 100,
                total_apontado: Math.round(totalApontado * 100) / 100,
                percentual: totalPercentual,
                diferenca: Math.round((totalApontado - totalPlanejado) * 100) / 100
            },
            operacoes
        });

    } catch (err) {
        console.error('[TRACKING-COMPARISON ERROR]', err.message);
        console.error('[TRACKING-COMPARISON STACK]', err.stack);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});
