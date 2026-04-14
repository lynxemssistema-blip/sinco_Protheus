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

        // 1. Get tracked quantities from appointments
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

        // 2. Get planned quantities from Protheus
        let protheusFilters = [];
        let protheusParams = [];

        if (data_inicio) {
            protheusFilters.push(`c2.c2_datpri >= ?`);
            protheusParams.push(data_inicio.replace(/-/g, ''));
        }
        if (data_fim) {
            protheusFilters.push(`c2.c2_datpri <= ?`);
            protheusParams.push(data_fim.replace(/-/g, ''));
        }
        if (pedido) {
            protheusFilters.push(`(c2.c2_pedido LIKE ? OR c2.c2_obs LIKE ?)`);
            protheusParams.push(`%${pedido}%`, `%${pedido}%`);
        }
        if (op) {
            protheusFilters.push(`c2.c2_num LIKE ?`);
            protheusParams.push(`%${op}%`);
        }
        if (produto) {
            protheusFilters.push(`(c2.c2_produto LIKE ? OR c2.c2_descri LIKE ?)`);
            protheusParams.push(`%${produto}%`, `%${produto}%`);
        }

        const protheusWhere = protheusFilters.length > 0
            ? `AND ${protheusFilters.join(' AND ')}`
            : '';

        const plannedQuery = `
            SELECT 
                RTRIM(g2.g2_operac) as operacao_codigo,
                RTRIM(h1.h1_descri) as operacao_desc,
                SUM(CAST(g2.g2_quant AS FLOAT)) as qtd_planejada
            FROM ${process.env.PROTHEUS_DB_NAME}.dbo.sc2010 c2
            INNER JOIN ${process.env.PROTHEUS_DB_NAME}.dbo.sg2010 g2 
                ON RTRIM(c2.c2_num) + RTRIM(c2.c2_item) + RTRIM(c2.c2_sequen) = RTRIM(g2.g2_codigo) + RTRIM(g2.g2_itemapo) + RTRIM(g2.g2_seqapo)
            WHERE c2.d_e_l_e_t_ = ''
                AND g2.d_e_l_e_t_ = ''
                AND g2.g2_operac != ''
                ${protheusWhere}
            GROUP BY g2.g2_operac, h1.h1_descri
        `;

        const plannedData = await protheusPool.query(plannedQuery, protheusParams);

        // 3. Combine data
        const operationsMap = {};

        // Add planned data
        plannedData.recordset.forEach(row => {
            const codigo = row.operacao_codigo;
            operationsMap[codigo] = {
                codigo,
                descricao: row.operacao_desc,
                planejado: Math.round(row.qtd_planejada * 100) / 100,
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
            } else if (op.percentual >= 50) {
                op.status = 'partial';
            } else if (op.percentual > 0) {
                op.status = 'low';
            } else if (op.planejado > 0) {
                op.status = 'pending';
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

