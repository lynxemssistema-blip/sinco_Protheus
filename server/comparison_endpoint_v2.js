
// GET /api/production/tracking-comparison - Compare Planned vs Tracked Production (V2 - Resource/Desc Grouping)
router.get('/tracking-comparison', async (req, res) => {
    try {
        const {
            data_inicio,
            data_fim,
            pedido,
            op,
            produto
        } = req.query;

        console.log('📊 [TRACKING-COMPARISON V2] Filters:', { data_inicio, data_fim, pedido, op, produto });

        // =================================================================================
        // STEP 1: Get Tracked Quantities from Appointments (MySQL)
        // We select OP_NUMERO too, because we need it to resolve the Real Operation Name
        // =================================================================================
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

        // Group by OP + Sequence to keep granularity for mapping
        const appointmentsQuery = `
            SELECT 
                a.op_numero,
                a.operacao_codigo,
                SUM(a.quantidade) as qtd_apontada
            FROM app_production_appointments a
            ${appointmentWhere}
            GROUP BY a.op_numero, a.operacao_codigo
        `;

        const [appointmentsData] = await mysqlPool.query(appointmentsQuery, appointmentParams);

        // Extract unique OPs involved in appointments to fetch their routing
        const appointmentOps = [...new Set(appointmentsData.map(a => a.op_numero))].filter(Boolean);

        // =================================================================================
        // STEP 2: Get Planned Quantities & Metadata from Protheus (Postgres)
        // We need to fetch data that matches the FILTERS OR matches the APPOINTMENT OPs
        // =================================================================================
        let protheusFilters = [];
        let protheusParams = [];
        let paramCount = 1;

        // Base filter: Not deleted
        protheusFilters.push(`COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')`);
        protheusFilters.push(`COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')`);

        // Filter Logic:
        // (Criteria Matches) OR (OP is in Appointment List)
        // Constructing this in SQL: ( (FilterA AND FilterB) OR (c2.c2_num IN (...)) )

        let criteria conditions = [];

        if (data_inicio) {
            conditions.push(`c2.c2_datpri >= $${paramCount}`);
            protheusParams.push(data_inicio.replace(/-/g, ''));
            paramCount++;
        }
        if (data_fim) {
            conditions.push(`c2.c2_datpri <= $${paramCount}`);
            protheusParams.push(data_fim.replace(/-/g, ''));
            paramCount++;
        }
        if (pedido) {
            conditions.push(`TRIM(c2.c2_pedido) LIKE $${paramCount}`);
            protheusParams.push(`%${pedido}%`);
            paramCount++;
        }
        if (op) {
            conditions.push(`TRIM(c2.c2_num) LIKE $${paramCount}`);
            protheusParams.push(`%${op}%`);
            paramCount++;
        }
        if (produto) {
            conditions.push(`(TRIM(c2.c2_produto) ILIKE $${paramCount} OR TRIM(c2.c2_descri) ILIKE $${paramCount})`);
            protheusParams.push(`%${produto}%`);
            paramCount++;
        }

        let criteriaClause = conditions.length > 0 ? `(${conditions.join(' AND ')})` : '1=1';

        // Add Appointment OPs to the scope logic
        // If we have appointments for OP 'X', we MUST fetch OP 'X' routing even if it doesn't match date range
        // so we can map '01' -> 'Corte'.
        let opScopeClause = criteriaClause;

        if (appointmentOps.length > 0) {
            // Optimization: If list is huge, this might be slow, but for 50-100 items it's fine.
            // Using ANY($n) for cleaner array handling
            opScopeClause = `( ${criteriaClause} OR TRIM(c2.c2_num) = ANY($${paramCount}) )`;
            protheusParams.push(appointmentOps);
            paramCount++;
        }

        const protheusWhere = `WHERE ${protheusFilters.join(' AND ')} AND ${opScopeClause}`;

        // Select Resource/Desc to be the GROUP key
        const plannedQuery = `
            SELECT 
                TRIM(c2.c2_num) as op_num,
                TRIM(g2.g2_operac) as seq_codigo,
                TRIM(g2.g2_recurso) as recurso,
                TRIM(g2.g2_descri) as operacao_desc,
                SUM(c2.c2_quant::numeric) as qtd_planejada
            FROM public.sc2010 c2
            LEFT JOIN public.sg2010 g2 ON btrim(g2.g2_produto) = btrim(c2.c2_produto)
            ${protheusWhere}
            GROUP BY c2.c2_num, g2.g2_operac, g2.g2_recurso, g2.g2_descri
        `;

        // console.log('PG Query:', plannedQuery);
        // console.log('PG Params:', protheusParams);

        const pgResult = await db.query(plannedQuery, protheusParams);
        const plannedRows = pgResult.rows;


        // =================================================================================
        // STEP 3: Build Maps & Aggregate
        // =================================================================================

        const operationsMap = {}; // KEY: "ProcessName" -> Data
        const opRoutingMap = {};  // KEY: "OP_NUM" -> { "01": "ProcessName" }

        // Helper to init map entry
        const initOp = (key) => {
            if (!operationsMap[key]) {
                operationsMap[key] = {
                    codigo: key, // Using Name as code for display uniqueness
                    descricao: key,
                    planejado: 0,
                    apontado: 0,
                    diferenca: 0,
                    percentual: 0,
                    status: 'pending'
                };
            }
        };

        // 3A. Process Planned Data
        plannedRows.forEach(row => {
            const opNum = row.op_num;
            const seq = row.seq_codigo;

            // Define the "Real Name" for this process.
            // Priority: Resource > Description > "Op Code"
            let processName = row.operacao_desc || row.seq_codigo || 'SEM_DESC';
            if (row.recurso) {
                processName = `${row.recurso} - ${processName}`;
            }

            // Save to Routing Map for lookup
            if (!opRoutingMap[opNum]) opRoutingMap[opNum] = {};
            opRoutingMap[opNum][seq] = processName;

            // Only aggregate to totals IF this row matches the CRITERIA (not just brought in for mapping)
            // We need to re-verify if this row matches `criteria conditions` logic?
            // Actually, if we use the OR query, we included "extra" rows just for mapping.
            // If the user filtered by Date, we don't want to sum "Planned" for OPs outside that date
            // just because they had an appointment. 
            // BUT: If they had an appointment, it means work was done. Usually we DO want to see the planned amount for that work?
            // User Intention: "Comparator". Comparison implies: (What I did) vs (What I should have done for that thing).
            // So yes, include it.

            initOp(processName);
            operationsMap[processName].planejado += parseFloat(row.qtd_planejada || 0);
        });

        // 3B. Process App Data
        appointmentsData.forEach(row => {
            const opNum = row.op_numero;
            const seq = row.operacao_codigo;

            // Lookup Real Name
            let processName = opRoutingMap[opNum]?.[seq];

            // Fallback if not found (e.g. OP exists in App but not found in Protheus query - maybe archived or different DB?)
            if (!processName) {
                processName = `Indefinido (Seq ${seq})`;
                // console.log('Missing mapping for:', opNum, seq);
            }

            initOp(processName);
            operationsMap[processName].apontado += parseFloat(row.qtd_apontada || 0);
        });

        // =================================================================================
        // STEP 4: Calculate Metrics & Formatting
        // =================================================================================
        let totalPlanejado = 0;
        let totalApontado = 0;

        Object.values(operationsMap).forEach(op => {
            // Round values
            op.planejado = Math.round(op.planejado * 100) / 100;
            op.apontado = Math.round(op.apontado * 100) / 100;

            op.diferenca = Math.round((op.apontado - op.planejado) * 100) / 100;
            op.percentual = op.planejado > 0
                ? Math.round((op.apontado / op.planejado) * 100 * 100) / 100
                : (op.apontado > 0 ? 100 : 0);

            // Determine status
            if (op.percentual >= 100) {
                op.status = 'complete';
            } else if (op.percentual >= 80) {
                op.status = 'partial';
            } else if (op.percentual > 0) {
                op.status = 'low';
            } else if (op.planejado > 0) {
                op.status = 'pending';
            } else {
                op.status = 'extra';
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
