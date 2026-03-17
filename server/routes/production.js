const express = require('express');
const router = express.Router();
console.log('🔄 [DEBUG] Carregando arquivo routes/production.js');
const db = require('../db'); // Postgres (Protheus)
const mysqlPool = require('../services/mysqlService'); // MySQL (App)

// GET /api/production/analytics-dashboard - Production Analytics Dashboard
// DEBUG MIDDLEWARE
router.use((req, res, next) => {
    console.log('🎯 [PRODUCTION ROUTER] Hit:', req.method, req.url);
    next();
});

// TEST ROUTE
router.get('/test-route', (req, res) => {
    res.json({ message: 'Test route working!', timestamp: new Date() });
});


// GET /api/production/analytics/evolution - Daily Production Evolution
router.get('/analytics/evolution', async (req, res) => {
    try {
        const { startDate, endDate, sector, user } = req.query;
        console.log('📈 [EVOLUTION] Filters:', { startDate, endDate, sector, user });

        let whereClauses = [];
        let params = [];

        if (startDate) {
            whereClauses.push(`a.data_fim >= ?`);
            params.push(startDate);
        }
        if (endDate) {
            whereClauses.push(`a.data_fim <= ?`);
            params.push(`${endDate} 23:59:59`);
        }

        // Note: 'user' in filters corresponds to who MADE the appointment.
        // The table `app_production_appointments` has `usuario`.
        if (user) {
            whereClauses.push(`a.usuario = ?`);
            params.push(user);
        }

        // Sector is trickier. It usually comes from the User's metadata OR the Resource/Machine's sector.
        // IF the appointment table doesn't have sector, we might need to join with `usuario` table or `recurso`.
        // Let's assume for now we filter by User's sector if `usuario` table has it.
        // Or if the frontend passes sector, we look up users in that sector?
        // Let's try to join with `usuario` table if sector is present.

        let joinUser = '';
        if (sector) {
            joinUser = `JOIN usuario u ON u.Login = a.usuario`; // Assuming 'usuario' col in appointment is the Login
            whereClauses.push(`u.Setor = ?`);
            params.push(sector);
        } else {
            // Optional join just to get sector for grouping
            joinUser = `LEFT JOIN usuario u ON u.Login = a.usuario`;
        }

        const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Query for Chart: Group by Date
        const chartQuery = `
            SELECT 
                DATE(a.data_fim) as date,
                SUM(a.quantidade) as total
            FROM app_production_appointments a
            ${joinUser}
            ${whereSQL}
            GROUP BY DATE(a.data_fim)
            ORDER BY date ASC
        `;

        const [chartData] = await mysqlPool.query(chartQuery, params);

        // Query for Details/Grid: Detailed list
        const gridQuery = `
            SELECT 
                DATE(a.data_fim) as date,
                a.usuario,
                u.Setor as setor,
                SUM(a.quantidade) as qtd,
                COUNT(*) as count
            FROM app_production_appointments a
            ${joinUser}
            ${whereSQL}
            GROUP BY DATE(a.data_fim), a.usuario, u.Setor
            ORDER BY date DESC, qtd DESC
            LIMIT 500
        `;

        const [gridData] = await mysqlPool.query(gridQuery, params);

        // Fetch Lists for Filters
        const [sectorsData] = await mysqlPool.query(`SELECT DISTINCT Setor FROM usuario WHERE Setor IS NOT NULL AND Setor != '' ORDER BY Setor`);
        const [usersData] = await mysqlPool.query(`SELECT DISTINCT Login FROM usuario ORDER BY Login`);

        res.json({
            chartData: chartData.map(d => ({
                date: d.date.toISOString().split('T')[0], // Format YYYY-MM-DD
                total: d.total
            })),
            details: gridData,
            sectors: sectorsData.map(s => s.Setor),
            users: usersData.map(u => u.Login)
        });

    } catch (err) {
        console.error("❌ [EVOLUTION ERROR]", err);
        res.status(500).json({ error: err.message });
    }
});

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

        let conditions = [];

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


// GET /api/production/analytics-dashboard - Production Analytics Dashboard
// DEBUG MIDDLEWARE
router.use((req, res, next) => {
    console.log('🎯 [PRODUCTION ROUTER] Hit:', req.method, req.url);
    next();
});

// TEST ROUTE
router.get('/test-route', (req, res) => {
    res.json({ message: 'Test route working!', timestamp: new Date() });
});

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


// GET /api/production/analytics-dashboard - Production Analytics Dashboard
router.get('/analytics-dashboard', async (req, res) => {
    try {
        const { pedido_venda, cliente: clienteFilter, ped_cliente, data_inicio, processo } = req.query;

        console.log(`📊 [ANALYTICS] Filters:`, { pedido_venda, cliente: clienteFilter, ped_cliente });

        // Build query dynamically based on filters
        let whereClause = `WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')`;
        const params = [];
        let paramCount = 1;

        if (pedido_venda) {
            whereClause += ` AND (TRIM(c2.c2_pedido) = $${paramCount} OR TRIM(c2.c2_obs) LIKE $${paramCount + 1})`;
            params.push(pedido_venda);
            params.push(`${pedido_venda}%`);
            paramCount += 2;
        }

        if (clienteFilter) {
            whereClause += ` AND (sa1.a1_nome ILIKE $${paramCount} OR sa1.a1_nreduz ILIKE $${paramCount})`;
            params.push(`%${clienteFilter}%`);
            paramCount++;
        }

        if (ped_cliente) {
            whereClause += ` AND sc6.c6_pedcli ILIKE $${paramCount}`;
            params.push(`%${ped_cliente}%`);
            paramCount++;
        }

        // 1. Get all operations for this pedido (Inheritance Strategy)
        // Find Parent OPs (Seq 001) that match criteria, then fetch all sequences (Children)
        const pgQuery = `
            WITH ParentOPs AS (
                SELECT 
                    c2.c2_num,
                    c2.c2_pedido,
                    c2.c2_obs,
                    c2.c2_itempv
                FROM public.sc2010 c2
                LEFT JOIN public.sc5010 sc5 ON sc5.c5_num = TRIM(c2.c2_pedido) 
                    AND COALESCE(sc5.d_e_l_e_t_, '') IN ('', ' ')
                LEFT JOIN public.sc6010 sc6 ON sc6.c6_num = TRIM(c2.c2_pedido)
                    AND sc6.c6_item = c2.c2_itempv
                    AND COALESCE(sc6.d_e_l_e_t_, '') IN ('', ' ')
                LEFT JOIN public.sa1010 sa1 ON sa1.a1_cod = sc5.c5_cliente 
                    AND sa1.a1_loja = sc5.c5_lojacli 
                    AND COALESCE(sa1.d_e_l_e_t_, '') IN ('', ' ')
                ${whereClause} 
                AND c2.c2_sequen = '001' -- Only look for parents first
            )
            SELECT
                c2.c2_num AS op,
                c2.c2_item AS item_op,
                c2.c2_sequen AS sequen,
                c2.c2_produto AS cod_produto_op,
                c2.c2_quant::numeric AS qtd_planejada_op,
                g2.g2_operac AS operacao,
                TRIM(g2.g2_recurso) AS recurso,
                TRIM(g2.g2_descri) AS desc_operacao,
                sc5.c5_cliente AS cod_cliente,
                sa1.a1_nome AS nome_cliente,
                (TRIM(parent.c2_pedido) || ' ') || TRIM(parent.c2_obs) AS raw_pedido_obs, -- FETCH RAW FOR JS FALLBACK
                parent.c2_itempv AS item_pedido,        -- INHERIT FROM PARENT
                sc6.c6_produto AS produto_item,
                TRIM(sc6.c6_descri) AS desc_produto,
                sc6.c6_entreg AS data_entrega_item
            FROM public.sc2010 c2
            INNER JOIN ParentOPs parent ON parent.c2_num = c2.c2_num
            LEFT JOIN public.sg2010 g2 ON btrim(g2.g2_produto) = btrim(c2.c2_produto) 
                AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
            -- Join Metadata based on PARENT info
            LEFT JOIN public.sc5010 sc5 ON sc5.c5_num = TRIM(parent.c2_pedido) 
                AND COALESCE(sc5.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sc6010 sc6 ON sc6.c6_num = TRIM(parent.c2_pedido)
                AND sc6.c6_item = parent.c2_itempv
                AND COALESCE(sc6.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sa1010 sa1 ON sa1.a1_cod = sc5.c5_cliente 
                AND sa1.a1_loja = sc5.c5_lojacli 
                AND COALESCE(sa1.d_e_l_e_t_, '') IN ('', ' ')
            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
            ORDER BY parent.c2_itempv, c2.c2_num, c2.c2_sequen, g2.g2_operac
            LIMIT 500
        `;

        const pgRes = await db.query(pgQuery, params);
        const operations = pgRes.rows;

        console.log(`📦 [ANALYTICS] Found ${operations.length} operations`);

        if (operations.length === 0) {
            return res.json({
                pedido: pedido_venda,
                cliente: null,
                data_entrega: null,
                processos: [],
                resumo: {
                    total_processos: 0,
                    concluidos: 0,
                    em_andamento: 0,
                    nao_iniciados: 0,
                    percentual_geral: 0
                }
            });
        }

        const cliente = operations[0]?.nome_cliente || null;
        const data_entrega = operations[0]?.data_entrega_item || null;

        // 2. Get planning data
        // For optimization, use WHERE IN (...) with found OPs
        const opList = [...new Set(operations.map(o => o.op))];
        const opPlaceholders = opList.map(() => '?').join(',');

        let plans = [];
        let appointments = [];

        if (opList.length > 0) {
            const [p] = await mysqlPool.query(`
                SELECT op_numero, op_item, op_sequencia, operacao_codigo,
                       data_planejada_inicio, data_planejada_fim
                FROM app_production_planning
                WHERE op_numero IN (${opPlaceholders})
            `, opList);
            plans = p;

            const [a] = await mysqlPool.query(`
                SELECT op_numero, op_item, op_sequencia, operacao_codigo,
                       SUM(quantidade) as total_produzido,
                       MIN(data_inicio) as data_real_inicio,
                       MAX(data_fim) as data_real_fim
                FROM app_production_appointments
                WHERE op_numero IN (${opPlaceholders})
                GROUP BY op_numero, op_item, op_sequencia, operacao_codigo
            `, opList);
            appointments = a;
        }

        // 4. Aggregate by Process + Pedido
        const processMap = {};

        operations.forEach(op => {
            const processCode = op.operacao || 'SEM_PROCESSO';
            // NEW KEY: Include Item PV to differentiate items
            const key = `${op.pedido_venda || 'SEM_PEDIDO'}_${op.item_pedido || '00'}_${processCode}`;

            if (!processMap[key]) {
                processMap[key] = {
                    key: key,
                    codigo: processCode,
                    recurso: op.recurso || '',
                    descricao: op.desc_operacao || '',
                    pedido: op.pedido_venda,
                    item_pedido: op.item_pedido, // Item Number e.g. 01, 02
                    produto_item: op.produto_item, // Product Code of the Item
                    desc_produto: op.desc_produto, // Product Description
                    cliente: op.nome_cliente,
                    data_entrega: op.data_entrega_item,
                    pedido: (function() {
                        const parts = (op.raw_pedido_obs || '').split(' ');
                        const ped = parts[0] || '';
                        const obs = parts.slice(1).join(' ') || '';
                        return ped.trim() || (obs.trim().match(/^\d+/)?.[0] || '');
                    })(),
                    total_pecas: 0,
                    pecas_produzidas: 0,
                    planejado_inicio_min: null,
                    planejado_fim_max: null,
                    real_inicio_min: null,
                    real_fim_max: null,
                    componentes: [] // List of components in this process
                };
            }

            // Aggregate pieces
            const qtd = parseFloat(op.qtd_planejada_op) || 0;
            processMap[key].total_pecas += qtd;

            // Add component details
            processMap[key].componentes.push({
                op: op.op,
                codigo: op.cod_produto_op,
                qtd: qtd
            });

            // Find planning for this operation
            const plan = plans.find(p =>
                p.op_numero === op.op &&
                p.op_item === op.item_op &&
                p.op_sequencia === op.sequen &&
                p.operacao_codigo === processCode
            );

            if (plan) {
                const inicio = plan.data_planejada_inicio;
                const fim = plan.data_planejada_fim;

                if (inicio && (!processMap[key].planejado_inicio_min || inicio < processMap[key].planejado_inicio_min)) {
                    processMap[key].planejado_inicio_min = inicio;
                }
                if (fim && (!processMap[key].planejado_fim_max || fim > processMap[key].planejado_fim_max)) {
                    processMap[key].planejado_fim_max = fim;
                }
            }

            // Find appointments
            const appt = appointments.find(a =>
                a.op_numero === op.op &&
                a.op_item === op.item_op &&
                a.op_sequencia === op.sequen &&
                a.operacao_codigo === processCode
            );

            if (appt) {
                processMap[key].pecas_produzidas += parseFloat(appt.total_produzido) || 0;

                const realInicio = appt.data_real_inicio;
                const realFim = appt.data_real_fim;

                if (realInicio && (!processMap[key].real_inicio_min || realInicio < processMap[key].real_inicio_min)) {
                    processMap[key].real_inicio_min = realInicio;
                }
                if (realFim && (!processMap[key].real_fim_max || realFim > processMap[key].real_fim_max)) {
                    processMap[key].real_fim_max = realFim;
                }
            }
        });

        // 5. Calculate status and return
        const processos = Object.values(processMap).map(p => {
            const percentual = p.total_pecas > 0 ? Math.round((p.pecas_produzidas / p.total_pecas) * 100) : 0;
            let status = 'NAO_INICIADO';
            if (p.pecas_produzidas >= p.total_pecas) status = 'CONCLUIDO';
            else if (p.pecas_produzidas > 0) status = 'EM_ANDAMENTO';

            return {
                key: p.key,
                codigo: p.codigo,
                recurso: p.recurso,
                descricao: p.descricao,
                pedido: p.pedido,
                item_pedido: p.item_pedido,
                produto_item: p.produto_item,
                desc_produto: p.desc_produto,
                componentes: p.componentes,
                cliente: p.cliente,
                data_entrega: p.data_entrega,
                total_pecas: p.total_pecas,
                pecas_produzidas: p.pecas_produzidas,
                percentual,
                planejado: {
                    inicio: p.planejado_inicio_min,
                    fim: p.planejado_fim_max
                },
                real: {
                    inicio: p.real_inicio_min,
                    fim: p.real_fim_max
                },
                status
            };
        });

        // Filter by process if specified
        const processosFiltered = processo
            ? processos.filter(p => p.codigo.toLowerCase().includes(processo.toLowerCase()))
            : processos;

        // Calculate summary
        const concluidos = processosFiltered.filter(p => p.status === 'CONCLUIDO').length;
        const em_andamento = processosFiltered.filter(p => p.status === 'EM_ANDAMENTO').length;
        const nao_iniciados = processosFiltered.filter(p => p.status === 'NAO_INICIADO').length;
        const totalProd = processosFiltered.reduce((sum, p) => sum + p.pecas_produzidas, 0);
        const totalPlan = processosFiltered.reduce((sum, p) => sum + p.total_pecas, 0);

        res.json({
            // Remove single-order fields from root
            processos: processosFiltered,
            resumo: {
                total_processos: processosFiltered.length,
                concluidos,
                em_andamento,
                nao_iniciados,
                percentual_geral: totalPlan > 0 ? Math.round((totalProd / totalPlan) * 100) : 0
            }
        });

    } catch (err) {
        console.error('[ANALYTICS ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});


// DEBUG ENDPOINT
router.get('/debug-doc/:code', async (req, res) => {
    const code = req.params.code;
    try {
        console.log(`[DEBUG] Checking docs for: '${code}'`);
        const [exact] = await mysqlPool.execute("SELECT * FROM produtos_docs WHERE produto_codigo = ?", [code]);
        const [trimmed] = await mysqlPool.execute("SELECT * FROM produtos_docs WHERE TRIM(produto_codigo) = ?", [code]);
        const [like] = await mysqlPool.execute("SELECT * FROM produtos_docs WHERE produto_codigo LIKE ?", [`%${code}%`]);

        res.json({
            searched: code,
            exactMatch: exact,
            trimmedMatch: trimmed,
            likeMatch: like
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/production - List OPs with Planning and Progress
router.get('/', async (req, res) => {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📥 [DEBUG] GET /api/production HIT');
    console.log('🔍 RAW Query Params:', JSON.stringify(req.query, null, 2));
    console.log('═══════════════════════════════════════════════════════════');

    try {
        const {
            op, item, sequencia, produto, cliente, operacao,
            planned_date_start, planned_date_end, date_start, date_end,
            status, // Comma-separated or array
            page = 1, limit = 100
        } = req.query;


        console.log('📊 [DEBUG] Extracted Filter Values:');
        console.log('  - OP:', op || '(empty)');
        console.log('  - Pedido:', req.query.pedido || '(empty)');
        console.log('  - Item:', item || '(empty)');
        console.log('  - Sequencia:', sequencia || '(empty)');
        console.log('  - Produto:', produto || '(empty)');
        console.log('  - Cliente:', cliente || '(empty)');
        console.log('  - Operacao:', operacao || '(empty)');

        // Parse pagination params
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 100;
        const offset = (pageNum - 1) * limitNum;

        console.log('📄 [DEBUG] Pagination:', { page: pageNum, limit: limitNum, offset });

        // 0. Pre-filter by Planned Dates (MySQL) if provided
        let plannedOpsFilter = null;
        if (planned_date_start || planned_date_end) {
            console.log('🗓️ [DEBUG] Filtering by planned dates...');
            let planSql = `SELECT op_numero, op_item, op_sequencia, operacao_codigo FROM app_production_planning WHERE 1=1 `;
            const planParams = [];
            if (planned_date_start) {
                planSql += ` AND (data_planejada_inicio >= ? OR data_planejada_fim >= ?)`;
                planParams.push(planned_date_start, planned_date_start);
            }
            if (planned_date_end) {
                planSql += ` AND (data_planejada_inicio <= ? OR data_planejada_fim <= ?)`;
                planParams.push(planned_date_end, planned_date_end);
            }
            const [plannedRows] = await mysqlPool.execute(planSql, planParams);
            console.log(`✅ [DEBUG] Found ${plannedRows.length} planned operations`);

            // If filtering by date and no plans found, return empty early
            if (plannedRows.length === 0) {
                console.log('⚠️ [DEBUG] No planned operations found, returning empty');
                return res.json({ data: [], total: 0, page: pageNum, limit: limitNum, totalPages: 0 });
            }

            plannedOpsFilter = plannedRows;
        }

        // 1. Fetch OPs from Protheus (Base Query)
        console.log('🔨 [DEBUG] Building SQL Query...');
        let pgQuery = `
            SELECT
                c2.c2_num     AS op,
                c2.c2_item    AS item_op,
                c2.c2_sequen  AS sequen,
                c2.c2_produto AS cod_produto_op,
                MAX(TRIM(c2.c2_pedido)) OVER (PARTITION BY c2.c2_num, c2.c2_item) AS pedido_venda,
                sb1.b1_desc   AS desc_produto,
                sb1.b1_tipo   AS tipo_produto,
                c2.c2_um                     AS um_op,
                c2.c2_quant::numeric         AS qtd_planejada_op,
                c2.c2_quje::numeric          AS qtd_apontada_erp,
                
                -- Cliente
                c5.c5_cliente AS cod_cliente,
                a1.a1_nome    AS nome_cliente,
                a1.a1_nreduz  AS nome_fantasia,
                TRIM(c6.c6_pedcli) AS ped_cliente,

                -- Roteiro
                g2.g2_codigo  AS cod_roteiro,
                g2.g2_operac  AS operacao,
                g2.g2_descri  AS desc_operacao,
                g2.g2_recurso AS recurso,
                LAG(g2.g2_operac) OVER (PARTITION BY c2.c2_num, c2.c2_item, c2.c2_sequen ORDER BY g2.g2_operac) as prev_operacao,
                LEAD(g2.g2_operac) OVER (PARTITION BY c2.c2_num, c2.c2_item, c2.c2_sequen ORDER BY g2.g2_operac) as next_operacao,
                TRIM(LAG(g2.g2_descri) OVER (PARTITION BY c2.c2_num, c2.c2_item, c2.c2_sequen ORDER BY g2.g2_operac)) as prev_desc_operacao,
                TRIM(LEAD(g2.g2_descri) OVER (PARTITION BY c2.c2_num, c2.c2_item, c2.c2_sequen ORDER BY g2.g2_operac)) as next_desc_operacao

            FROM public.sc2010 c2
            LEFT JOIN public.sc2010 root_op ON root_op.c2_num = c2.c2_num AND root_op.c2_item = c2.c2_item AND root_op.c2_sequen = '001' AND COALESCE(root_op.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sb1010 sb1 ON sb1.b1_cod = c2.c2_produto AND COALESCE(sb1.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sg2010 g2 ON btrim(g2.g2_produto) = btrim(c2.c2_produto) AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sc6010 c6 
                ON c6.c6_filial = c2.c2_filial 
                AND c6.c6_num = c2.c2_pedido
                AND c6.c6_item = c2.c2_itempv
                AND COALESCE(c6.d_e_l_e_t_, '') = ''
            LEFT JOIN public.sc5010 c5 ON c5.c5_filial = c2.c2_filial AND c5.c5_num = (CASE WHEN btrim(c2.c2_pedido) <> '' THEN btrim(c2.c2_pedido) ELSE btrim(root_op.c2_pedido) END) AND COALESCE(c5.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sa1010 a1 ON a1.a1_cod = c5.c5_cliente AND a1.a1_loja = c5.c5_lojacli AND COALESCE(a1.d_e_l_e_t_, '') IN ('', ' ')

            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
        `;

        const params = [];
        let paramCount = 1;
        const appliedFilters = [];

        if (op) {
            pgQuery += ` AND c2.c2_num LIKE $${paramCount}`;
            params.push(`%${op}%`);
            appliedFilters.push(`OP LIKE '%${op}%'`);
            console.log(`🔧 [DEBUG] Filter ${paramCount}: OP LIKE '%${op}%'`);
            paramCount++;
        }

        if (req.query.pedido) {
            console.log(`🔧 [DEBUG] Filter ${paramCount}: PEDIDO = '${req.query.pedido}'`);
            pgQuery += ` AND (TRIM(c2.c2_pedido) ILIKE $${paramCount} OR TRIM(root_op.c2_pedido) ILIKE $${paramCount})`;
            params.push(`%${req.query.pedido.trim()}%`);
            appliedFilters.push(`PEDIDO ILIKE '%${req.query.pedido.trim()}%'`);
            paramCount++;
        }

        if (item) {
            pgQuery += ` AND c2.c2_item LIKE $${paramCount}`;
            params.push(`%${item}%`);
            appliedFilters.push(`ITEM LIKE '%${item}%'`);
            console.log(`🔧 [DEBUG] Filter ${paramCount}: ITEM LIKE '%${item}%'`);
            paramCount++;
        }

        if (sequencia) {
            pgQuery += ` AND c2.c2_sequen LIKE $${paramCount}`;
            params.push(`%${sequencia}%`);
            appliedFilters.push(`SEQUENCIA LIKE '%${sequencia}%'`);
            console.log(`🔧 [DEBUG] Filter ${paramCount}: SEQUENCIA LIKE '%${sequencia}%'`);
            paramCount++;
        }

        if (produto) {
            pgQuery += ` AND (c2.c2_produto LIKE $${paramCount} OR sb1.b1_desc LIKE $${paramCount})`;
            params.push(`%${produto.toUpperCase()}%`);
            appliedFilters.push(`PRODUTO LIKE '%${produto.toUpperCase()}%'`);
            console.log(`🔧 [DEBUG] Filter ${paramCount}: PRODUTO LIKE '%${produto.toUpperCase()}%'`);
            paramCount++;
        }

        if (cliente) {
            pgQuery += ` AND (a1.a1_nome LIKE $${paramCount} OR a1.a1_nreduz LIKE $${paramCount} OR c5.c5_cliente LIKE $${paramCount})`;
            params.push(`%${cliente.toUpperCase()}%`);
            appliedFilters.push(`CLIENTE LIKE '%${cliente.toUpperCase()}%'`);
            console.log(`🔧 [DEBUG] Filter ${paramCount}: CLIENTE LIKE '%${cliente.toUpperCase()}%'`);
            paramCount++;
        }

        if (operacao) {
            pgQuery += ` AND (g2.g2_operac LIKE $${paramCount} OR g2.g2_descri LIKE $${paramCount} OR g2.g2_recurso LIKE $${paramCount})`;
            params.push(`%${operacao.toUpperCase()}%`);
            appliedFilters.push(`OPERACAO/RECURSO LIKE '%${operacao.toUpperCase()}%'`);
            console.log(`🔧 [DEBUG] Filter ${paramCount}: OPERACAO/RECURSO LIKE '%${operacao.toUpperCase()}%'`);
            paramCount++;
        }

        // Default Filter: Pending Delivery (Saldo a Entregar > 0)
        // If pending_delivery is explicitly 'true' OR undefined (default behavior requested by user?)
        // Actually, user asked "by default". So if frontend sends nothing, maybe we should default?
        // But safer to let frontend control the default state.
        if (req.query.pending_delivery === 'true') {
            pgQuery += ` AND (COALESCE(c6.c6_qtdven, 0) - COALESCE(c6.c6_qtdent, 0)) > 0`;
            appliedFilters.push(`PENDING_DELIVERY > 0`);
            console.log(`🔧 [DEBUG] Filter: PENDING DELIVERY Only`);
        }

        pgQuery += ` ORDER BY c2.c2_num, c2.c2_item, c2.c2_sequen, g2.g2_operac`;

        console.log('═══════════════════════════════════════════════════════════');
        console.log('🔍 [DEBUG] FINAL SQL PREPARATION');
        console.log('📊 Total Parameters:', params.length);
        console.log('📝 Parameters:', JSON.stringify(params));
        console.log('🎯 Applied Filters:', appliedFilters.join(' AND '));
        console.log('═══════════════════════════════════════════════════════════');

        console.log('⏳ [DEBUG] Executing SQL query...');
        const pgRes = await db.query(pgQuery, params);
        let ops = pgRes.rows;

        console.log(`✅ [DEBUG] SQL executed successfully!`);
        console.log(`📦 [DEBUG] Raw SQL returned ${ops.length} rows`);

        if (ops.length > 0) {
            console.log('🔍 [DEBUG] First 3 rows sample:');
            ops.slice(0, 3).forEach((row, idx) => {
                console.log(`  Row ${idx + 1}:`, {
                    op: row.op,
                    pedido_venda: row.pedido_venda,
                    item_op: row.item_op,
                    sequen: row.sequen
                });
            });
        } else {
            console.log('⚠️ [WARNING] SQL returned 0 rows - no matching records found!');
            console.log('💡 Tip: Check if filters are too restrictive or data exists in database');
        }

        // Apply MySQL Pre-Filter (Planned Dates) - Client Side filtering of the Postgres Result set to match MySQL IDs
        if (plannedOpsFilter) {
            ops = ops.filter(op => {
                return plannedOpsFilter.some(p =>
                    p.op_numero === op.op &&
                    p.op_item === op.item_op &&
                    p.op_sequencia === op.sequen &&
                    (p.operacao_codigo === op.operacao || !p.operacao_codigo) // Loose match if needed, but strict is better
                );
            });
        }

        // Fetch MySQL Data (Plans & Appointments) BEFORE pagination to allow status filtering
        const [plans] = await mysqlPool.query(`SELECT * FROM app_production_planning`);
        const [appointments] = await mysqlPool.query(`
            SELECT 
                op_numero, op_item, op_sequencia, operacao_codigo,
                SUM(quantidade) as total_produzido,
                COUNT(*) as num_apontamentos,
                SUM(CASE WHEN conferencia_status = 'PENDENTE' THEN 1 ELSE 0 END) as pendencias_conferencia,
                MIN(data_inicio) as data_real_inicio,
                MAX(data_fim) as data_real_fim,
                MAX(data_fim) as ultimo_apontamento
            FROM app_production_appointments
            GROUP BY op_numero, op_item, op_sequencia, operacao_codigo
        `);

        // 4. Merge Data (All OPs, not just paginated)
        let mergedOps = ops.map(row => {
            const plan = plans.find(p =>
                p.op_numero === row.op &&
                p.op_item === row.item_op &&
                p.op_sequencia === row.sequen &&
                p.operacao_codigo === row.operacao
            );

            const progress = appointments.find(a =>
                a.op_numero === row.op &&
                a.op_item === row.item_op &&
                a.op_sequencia === row.sequen &&
                a.operacao_codigo === row.operacao
            );

            return {
                ...row,
                data_planejada_inicio: plan?.data_planejada_inicio || null,
                data_planejada_fim: plan?.data_planejada_fim || null,
                qtd_produzida_real: progress?.total_produzido || 0,
                tem_pendencia_conferencia: progress ? progress.pendencias_conferencia > 0 : false,
                ultimo_apontamento: progress?.ultimo_apontamento || null,
                data_real_fim: progress?.data_real_fim || null
            };
        });

        // 5. Apply Status Filter
        const rawStatus = req.query.status || req.query['status[]'];
        if (rawStatus) {
            const statusArray = Array.isArray(rawStatus) ? rawStatus : rawStatus.split(',');
            console.log(`🚥 [DEBUG] Filtering by status: ${statusArray.join(', ')}`);

            mergedOps = mergedOps.filter(op => {
                const now = new Date();
                const start = op.data_planejada_inicio ? new Date(op.data_planejada_inicio) : null;

                // End date should be End of Day (23:59:59) for "Late" comparison
                let end = op.data_planejada_fim ? new Date(op.data_planejada_fim) : null;
                if (end) end.setHours(23, 59, 59, 999);

                const done = Number(op.qtd_produzida_real) >= Number(op.qtd_planejada_op);
                const started = Number(op.qtd_produzida_real) > 0;

                let currentStatus = 'waiting'; // default
                if (done) currentStatus = 'done';
                else if (end && now > end) currentStatus = 'late_delivery';
                else if (start && now > start && !started) currentStatus = 'late_start';
                else if (started) currentStatus = 'in_progress';
                else if (start && end) currentStatus = 'planned';

                return statusArray.includes(currentStatus);
            });
        }

        // 6. Pagination
        const total = mergedOps.length;
        const totalPages = Math.ceil(total / limitNum);
        const paginatedOps = mergedOps.slice(offset, offset + limitNum);

        // 7. Enhance with Documents (Only for paginated)
        const productCodes = [...new Set(paginatedOps.map(o => (o.cod_produto_op || '').trim().toUpperCase()))];
        let docsMap = {};

        if (productCodes.length > 0) {
            const placeholders = productCodes.map(() => '?').join(',');
            try {
                const [docs] = await mysqlPool.execute(`
                    SELECT produto_codigo, url_arquivo, area_pintura_m2, operacao
                    FROM produtos_docs 
                    WHERE produto_codigo IN (${placeholders})
                `, productCodes);
                docs.forEach(d => {
                    const cleanCode = (d.produto_codigo || '').trim().toUpperCase();
                    if (!docsMap[cleanCode]) {
                        docsMap[cleanCode] = {
                            url: d.url_arquivo,
                            area: d.area_pintura_m2,
                            operacao: d.operacao
                        };
                    }
                });
            } catch (docErr) { console.error('Doc Error:', docErr); }
        }

        const finalOps = paginatedOps.map(op => {
            const docInfo = docsMap[(op.cod_produto_op || '').trim().toUpperCase()];
            // If product has operation defined in docs, override or attach it
            // Typically we want to show this in the frontend as "Default Operation"
            return {
                ...op,
                doc_url: docInfo?.url || null,
                tem_arquivos: !!docInfo?.url,
                area_pintura: docInfo?.area || null,
                operacao_doc: docInfo?.operacao || null // New field for auto-fill
            };
        });

        res.json({
            data: finalOps,
            total: total,
            page: pageNum,
            limit: limitNum,
            totalPages: totalPages
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/production/matrix - Matrix View (Items as Rows, Operations as Columns)
router.get('/matrix', async (req, res) => {
    try {
        const { op, produto, cliente, pedido, operacao } = req.query;

        console.log('📊 [MATRIX] Fetching matrix view data...');

        // 1. Buscar dados base usando CTE para garantir estrutura completa
        //    (Filtrar OPs/Itens que atendem aos critérios, depois buscar TODAS as sequências deles)

        let pgQuery = `
            WITH filtered_ops AS (
                SELECT DISTINCT
                    c2.c2_num,
                    c2.c2_item
                FROM public.sc2010 c2
                LEFT JOIN public.sb1010 sb1 ON sb1.b1_cod = c2.c2_produto AND COALESCE(sb1.d_e_l_e_t_, '') IN ('', ' ')
                LEFT JOIN public.sc5010 c5 ON c5.c5_num = TRIM(c2.c2_pedido) AND COALESCE(c5.d_e_l_e_t_, '') IN ('', ' ')
                LEFT JOIN public.sa1010 a1 ON a1.a1_cod = c5.c5_cliente AND a1.a1_loja = c5.c5_lojacli AND COALESCE(a1.d_e_l_e_t_, '') IN ('', ' ')
                WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
                AND TRIM(c2.c2_num) != ''
        `;

        const params = [];
        let paramCount = 1;

        if (op) {
            pgQuery += ` AND c2.c2_num LIKE $${paramCount}`;
            params.push(`%${op}%`);
            paramCount++;
        }
        if (produto) {
            pgQuery += ` AND (c2.c2_produto LIKE $${paramCount} OR sb1.b1_desc LIKE $${paramCount})`;
            params.push(`%${produto.toUpperCase()}%`);
            paramCount++;
        }
        if (cliente) {
            pgQuery += ` AND (a1.a1_nome LIKE $${paramCount} OR c5.c5_cliente LIKE $${paramCount})`;
            params.push(`%${cliente.toUpperCase()}%`);
            paramCount++;
        }
        if (pedido) {
            pgQuery += ` AND TRIM(c2.c2_pedido) ILIKE $${paramCount}`;
            params.push(`%${pedido.trim()}%`);
            paramCount++;
        }
        if (operacao) {
            pgQuery += ` AND EXISTS (
                SELECT 1 FROM public.sc2010 op_seq 
                LEFT JOIN public.sg2010 g2_seq ON
                    btrim(g2_seq.g2_produto) = btrim(op_seq.c2_produto)
                    AND btrim(g2_seq.g2_filial) = btrim(op_seq.c2_filial)
                    AND COALESCE(g2_seq.d_e_l_e_t_, '') IN ('', ' ')
                WHERE op_seq.c2_num = c2.c2_num 
                AND op_seq.c2_item = c2.c2_item
                AND (
                    TRIM(g2_seq.g2_operac) = $${paramCount} 
                    OR 
                    TRIM(g2_seq.g2_recurso) ILIKE $${paramCount}
                )
                AND COALESCE(op_seq.d_e_l_e_t_, '') IN ('', ' ')
            )`;
            params.push(operacao.trim());
            paramCount++;
        }

        // Fechar CTE e limitar resultados (paginação)
        pgQuery += `
                LIMIT 100
            )
            SELECT
                c2.c2_num     AS op,
                c2.c2_item    AS item_op,
                c2.c2_sequen  AS sequencia,
                TRIM(c2.c2_produto) AS cod_produto,
                MAX(TRIM(c2.c2_pedido)) AS pedido_venda,
                MAX(sb1.b1_desc) AS desc_produto,
                MAX(c2.c2_quant::numeric) AS qtd_planejada_item,
                MAX(a1.a1_nome) AS nome_cliente,
                MAX(c5.c5_cliente) AS cod_cliente
            FROM public.sc2010 c2
            INNER JOIN filtered_ops fo ON fo.c2_num = c2.c2_num AND fo.c2_item = c2.c2_item
            LEFT JOIN public.sb1010 sb1 ON sb1.b1_cod = c2.c2_produto AND COALESCE(sb1.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sc5010 c5 ON c5.c5_num = TRIM(c2.c2_pedido) AND COALESCE(c5.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sa1010 a1 ON a1.a1_cod = c5.c5_cliente AND a1.a1_loja = c5.c5_lojacli AND COALESCE(a1.d_e_l_e_t_, '') IN ('', ' ')
            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
            AND TRIM(c2.c2_num) != ''
            GROUP BY c2.c2_num, c2.c2_item, c2.c2_sequen, c2.c2_produto
            ORDER BY c2.c2_num, c2.c2_item, c2.c2_sequen
        `;

        const pgRes = await db.query(pgQuery, params);
        const items = pgRes.rows;

        console.log(`📦 [MATRIX] Found ${items.length} items`);

        if (items.length === 0) {
            return res.json({ operations: [], items: [] });
        }

        const itemCodes = items.map(i => i.op); // Use 'op' as the identifier for the main item
        const placeholders = itemCodes.map((_, idx) => `$${idx + 1}`).join(',');

        // 2. [REMOVIDO] Não vamos mais buscar operações globais para evitar 'lixo'.
        // As colunas serão determinadas dinamicamente com base nos roteiros dos itens encontrados.

        // 3. Buscar documentos (MySQL) - MOVIDO PARA BAIXO (Step 4.6)
        // para evitar redeclaração e manter fluxo lógico após ter os itens filtrados.
        console.log('[MATRIX] Step 3: Skipped (Moved to 4.6)');

        // 4. Buscar Roteiros (Postgres Only)
        // JOIN com g2_recurso para informações extras, mas chave principal é g2_operac
        const routingRes = await db.query(`
            SELECT
                c2.c2_num as op,
                c2.c2_item as item_op,
                c2.c2_sequen as sequen,
                c2.c2_produto as cod_produto,
                c2.c2_quant as qtd_planejada,
                c2.c2_datpri as data_inicio_erp,
                c2.c2_datprf as data_fim_erp,
                g2.g2_operac as operacao,
                g2.g2_recurso as recurso,
                g2.g2_descri as desc_operacao,
                h1.h1_descri as master_desc_recurso
            FROM public.sc2010 c2
            LEFT JOIN public.sg2010 g2 ON
                btrim(g2.g2_produto) = btrim(c2.c2_produto)
                AND btrim(g2.g2_filial) = btrim(c2.c2_filial)
                AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sh1010 h1 ON
                h1.h1_codigo = g2.g2_recurso
                AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
            WHERE
                c2.c2_num IN (${placeholders})
                AND COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
            ORDER BY c2.c2_num, c2.c2_item, g2.g2_operac
        `, itemCodes);

        const routingRaw = routingRes.rows;
        console.log(`[MATRIX] Step 4 OK: Found ${routingRaw.length} routing rows`);

        // NOVO: Agrupar por RECURSO (MOxxx, STxxx) conforme solicitado pelo usuário
        const distinctResources = [...new Set(routingRaw.map(r => r.recurso ? r.recurso.trim() : null).filter(Boolean))];

        // Ordenar colunas (alfabeticamente para códigos como ST0055, MO0001)
        const operations = distinctResources.sort().map(code => {
            const sample = routingRaw.find(r => r.recurso && r.recurso.trim() === code);
            let description = sample?.master_desc_recurso ? sample.master_desc_recurso.trim() : (sample?.desc_operacao || code);
            if (code === 'MO0013') description = 'LASE';

            return {
                code, // Agora o código da coluna é o RECURSO (ex: MO0001)
                description,
                resource_code: code // Redundante mas mantido para compatibilidade frontend
            };
        });

        console.log(`[MATRIX] Derived ${operations.length} columns from routing data`);


        // 4.5. Buscar Dados Transacionais do MySQL (Planning & Appointments)
        const uniqueOps = [...new Set(routingRaw.map(r => r.op))];
        let plans = [];
        let appointments = [];

        if (uniqueOps.length > 0) {
            try {
                const mysqlPlaceholders = uniqueOps.map(() => '?').join(',');

                // Fetch Planning
                const [p] = await mysqlPool.query(
                    `SELECT op_numero, op_item, op_sequencia, operacao_codigo, data_planejada_inicio, data_planejada_fim
                     FROM app_production_planning
                     WHERE op_numero IN(${mysqlPlaceholders})`,
                    uniqueOps
                );
                plans = p;

                // Fetch Appointments
                const [a] = await mysqlPool.query(
                    `SELECT op_numero, op_item, op_sequencia, operacao_codigo,
            SUM(quantidade) as total_produzido,
            SUM(CASE WHEN conferencia_status = 'PENDENTE' THEN 1 ELSE 0 END) as pendencias_conferencia,
            MIN(data_inicio) as data_real_inicio,
            MAX(data_fim) as data_real_fim
                     FROM app_production_appointments
                     WHERE op_numero IN(${mysqlPlaceholders})
                     GROUP BY op_numero, op_item, op_sequencia, operacao_codigo`,
                    uniqueOps
                );
                appointments = a;

                console.log(`[MATRIX] Step 4.5 OK: Fetched ${plans.length} plans and ${appointments.length} appointments from MySQL`);
            } catch (mysqlFetchErr) {
                console.error('[MATRIX] MySQL Transactional Fetch Error:', mysqlFetchErr);
            }
        }

        // 4.6 Buscar Documentos (Desenhos PDF)
        const uniqueProducts = [...new Set(items.map(i => i.cod_produto).filter(Boolean))];
        const productDocsMap = {};

        if (uniqueProducts.length > 0) {
            try {
                // MySQL IN clause needs placeholders
                const docPlaceholders = uniqueProducts.map(() => '?').join(',');
                const [docs] = await mysqlPool.query(
                    `SELECT produto_codigo, url_arquivo, revisao FROM produtos_docs WHERE produto_codigo IN(${docPlaceholders})`,
                    uniqueProducts
                );

                docs.forEach(doc => {
                    // Retornar o caminho original do arquivo (UNC ou relativo)
                    // O frontend usará o endpoint /api/docs/view para abrir
                    productDocsMap[doc.produto_codigo] = {
                        url: doc.url_arquivo,
                        revisao: doc.revisao
                    };
                });
                console.log(`[MATRIX] Step 4.6 OK: Fetched ${docs.length} documents`);
            } catch (docErr) {
                console.error('[MATRIX] Document Fetch Error:', docErr);
            }
        }

        // 5. Construir Matriz (Merge Data)
        const matrixItems = items.map(item => {
            const itemRouting = routingRaw.filter(r =>
                r.op.trim() === item.op &&
                r.item_op.trim() === item.item_op &&
                r.sequen === item.sequencia // Match sequence
            );

            const itemOps = {};

            operations.forEach(op => {
                const targetResource = op.code; // Agora é o RECURSO (ex: MO0001)

                // Encontrar a rota que corresponde a este RECURSO
                // NOTA: Se houver 2 operações no mesmo recurso para o mesmo item, pegamos a primeira (limitação aceita p/ visão matricial simplificada)
                // Ou poderíamos somar? Por enquanto, `find` retorna a primeira ocorrência no roteiro.
                const matchingRoute = itemRouting.find(r => r.recurso && r.recurso.trim() === targetResource);

                if (matchingRoute) {
                    const realOpCode = matchingRoute.operacao ? matchingRoute.operacao.trim() : ''; // O código numérico real (01, 10) para buscar no MySQL

                    let totalPlanejada = Number(matchingRoute.qtd_planejada || 0);
                    let totalProduzida = 0;

                    // Dados transacionais (Planning & Appt) continuam usando o código numérico da operação + sequência
                    let plan = plans.find(p =>
                        p.op_numero === matchingRoute.op.trim() &&
                        p.op_item == matchingRoute.item_op.trim() &&
                        p.op_sequencia === matchingRoute.sequen &&
                        p.operacao_codigo === realOpCode // CRÍTICO: Usa o código numérico (ex: 10)
                    );

                    let appt = appointments.find(a =>
                        a.op_numero === matchingRoute.op.trim() &&
                        a.op_item == matchingRoute.item_op.trim() &&
                        a.op_sequencia === matchingRoute.sequen &&
                        a.operacao_codigo === realOpCode // CRÍTICO: Usa o código numérico (ex: 10)
                    );

                    let minRealStart = null;
                    let maxRealEnd = null;
                    let tem_pendencia = false;

                    if (appt) {
                        totalProduzida = Number(appt.total_produzido || 0);
                        if (appt.data_real_inicio) minRealStart = new Date(appt.data_real_inicio);
                        if (appt.data_real_fim) maxRealEnd = new Date(appt.data_real_fim);
                        tem_pendencia = appt.pendencias_conferencia > 0;
                    }

                    // Datas Planejadas (MySQL priority > ERP fallback)
                    let start = plan?.data_planejada_inicio ? new Date(plan.data_planejada_inicio) : (matchingRoute.data_inicio_erp ? new Date(matchingRoute.data_inicio_erp) : null);
                    let end = plan?.data_planejada_fim ? new Date(plan.data_planejada_fim) : (matchingRoute.data_fim_erp ? new Date(matchingRoute.data_fim_erp) : null);

                    const percentual = totalPlanejada > 0
                        ? Math.min(100, Math.round((totalProduzida / totalPlanejada) * 100))
                        : 0;

                    let status = 'waiting';
                    const now = new Date();
                    if (percentual >= 100) status = 'done';
                    else if (end && now > end && percentual < 100) status = 'late';
                    else if (percentual > 0) status = 'in_progress';
                    else if (start && now > start) status = 'late_start';


                    itemOps[targetResource] = {
                        code: targetResource, // Key da coluna é o recurso
                        recurso: targetResource,
                        sequen: matchingRoute.sequen,
                        operacao_real: realOpCode, // Guardar o código real para referência
                        qtd_planejada: totalPlanejada,
                        qtd_produzida: totalProduzida,
                        percentual,
                        status,
                        tem_pendencia,
                        dates: {
                            plan_start: start,
                            plan_end: end,
                            real_start: minRealStart,
                            real_end: maxRealEnd
                        }
                    };
                }
            });

            const docInfo = productDocsMap[item.cod_produto];

            return {
                ...item,
                doc_url: docInfo ? docInfo.url : null,
                operations: itemOps
            };
        });

        // Não precisa mais do filtro final, pois operations já nasce filtrado.

        console.log(`✅[MATRIX] Returning ${matrixItems.length} items x ${operations.length} operations`);

        res.json({
            operations,
            items: matrixItems
        });

    } catch (err) {
        console.error('[MATRIX FATAL ERROR]', err);
        res.status(500).json({ error: err.message, step: 'FATAL', stack: err.stack });
    }
});

// GET /api/production/operations/:id - Fetch Single Operation (For Incremental Refresh)

// GET /api/production/operations/:id - Fetch Single Operation (For Incremental Refresh)
router.get('/operations/:id', async (req, res) => {
    try {
        // Composite ID format: "OP|ITEM|SEQUEN|OPERACAO"
        const parts = req.params.id.split('|');
        if (parts.length !== 4) {
            return res.status(400).json({ error: 'Invalid operation ID format. Expected: OP|ITEM|SEQUEN|OPERACAO' });
        }

        const [op, item_op, sequen, operacao] = parts;
        console.log(`🔍[SINGLE OP] Fetching: ${op} | ${item_op} | ${sequen} | ${operacao}`);

        // 1. Fetch operation from Protheus (Same query as main endpoint, filtered)
        const pgQuery = `
            SELECT
                c2.c2_num     AS op,
            c2.c2_item    AS item_op,
            c2.c2_sequen  AS sequen,
            c2.c2_produto AS cod_produto_op,
            MAX(TRIM(c2.c2_pedido)) OVER(PARTITION BY c2.c2_num, c2.c2_item) AS pedido_venda,
            MAX(TRIM(c2.c2_obs)) OVER(PARTITION BY c2.c2_num, c2.c2_item) AS obs_venda,
            sb1.b1_desc   AS desc_produto,
            sb1.b1_tipo   AS tipo_produto,
            c2.c2_um                     AS um_op,
            c2.c2_quant:: numeric         AS qtd_planejada_op,
            c2.c2_quje:: numeric          AS qtd_apontada_erp,

            --Cliente
                c5.c5_cliente AS cod_cliente,
            a1.a1_nome    AS nome_cliente,
            a1.a1_nreduz  AS nome_fantasia,
            TRIM(c6.c6_pedcli) AS ped_cliente,

            --Roteiro
                g2.g2_codigo  AS cod_roteiro,
            g2.g2_operac  AS operacao,
            g2.g2_descri  AS desc_operacao,
            g2.g2_recurso AS recurso,
            LAG(g2.g2_operac) OVER(PARTITION BY c2.c2_num, c2.c2_item, c2.c2_sequen ORDER BY g2.g2_operac) as prev_operacao,
            LEAD(g2.g2_operac) OVER(PARTITION BY c2.c2_num, c2.c2_item, c2.c2_sequen ORDER BY g2.g2_operac) as next_operacao,
            TRIM(LAG(g2.g2_descri) OVER(PARTITION BY c2.c2_num, c2.c2_item, c2.c2_sequen ORDER BY g2.g2_operac)) as prev_desc_operacao,
            TRIM(LEAD(g2.g2_descri) OVER(PARTITION BY c2.c2_num, c2.c2_item, c2.c2_sequen ORDER BY g2.g2_operac)) as next_desc_operacao

            FROM public.sc2010 c2
            LEFT JOIN public.sc2010 root_op ON root_op.c2_num = c2.c2_num AND root_op.c2_item = c2.c2_item AND root_op.c2_sequen = '001' AND COALESCE(root_op.d_e_l_e_t_, '') IN('', ' ')
            LEFT JOIN public.sb1010 sb1 ON sb1.b1_cod = c2.c2_produto AND COALESCE(sb1.d_e_l_e_t_, '') IN('', ' ')
            LEFT JOIN public.sg2010 g2 ON btrim(g2.g2_produto) = btrim(c2.c2_produto) AND COALESCE(g2.d_e_l_e_t_, '') IN('', ' ')
            LEFT JOIN public.sc6010 c6 
                ON c6.c6_filial = c2.c2_filial 
                AND c6.c6_num = c2.c2_pedido
                AND c6.c6_item = c2.c2_itempv
                AND COALESCE(c6.d_e_l_e_t_, '') = ''
            LEFT JOIN public.sc5010 c5 ON c5.c5_filial = c2.c2_filial AND c5.c5_num = (CASE WHEN btrim(c2.c2_pedido) <> '' THEN btrim(c2.c2_pedido) ELSE btrim(root_op.c2_pedido) END) AND COALESCE(c5.d_e_l_e_t_, '') IN('', ' ')
            LEFT JOIN public.sa1010 a1 ON a1.a1_cod = c5.c5_cliente AND a1.a1_loja = c5.c5_lojacli AND COALESCE(a1.d_e_l_e_t_, '') IN('', ' ')

            WHERE COALESCE(c2.d_e_l_e_t_, '') IN('', ' ')
              AND c2.c2_num = $1
              AND c2.c2_item = $2
              AND c2.c2_sequen = $3
              AND g2.g2_operac = $4
            `;

        const pgRes = await db.query(pgQuery, [op, item_op, sequen, operacao]);

        if (pgRes.rows.length === 0) {
            return res.status(404).json({ error: 'Operation not found' });
        }

        const opData = pgRes.rows[0];

        // 2. Fetch Plan (MySQL)
        const [plans] = await mysqlPool.execute(`
        SELECT * FROM app_production_planning
            WHERE op_numero = ? AND op_item = ? AND op_sequencia = ? AND operacao_codigo = ?
            `, [op, item_op, sequen, operacao]);

        // 3. Fetch Appointments (MySQL)
        const [appointments] = await mysqlPool.execute(`
            SELECT
        SUM(quantidade) as total_produzido,
            COUNT(*) as num_apontamentos,
            MIN(data_inicio) as data_real_inicio,
            MAX(data_fim) as data_real_fim,
            MAX(data_fim) as ultimo_apontamento
            FROM app_production_appointments
            WHERE op_numero = ? AND op_item = ? AND op_sequencia = ? AND operacao_codigo = ?
            GROUP BY op_numero, op_item, op_sequencia, operacao_codigo
                `, [op, item_op, sequen, operacao]);

        const plan = plans[0];
        const progress = appointments[0];

        // 4. Fetch Document (MySQL)
        const productCode = (opData.cod_produto_op || '').trim().toUpperCase();
        let docInfo = null;

        if (productCode) {
            const [docs] = await mysqlPool.execute(`
                SELECT url_arquivo, area_pintura_m2, operacao
                FROM produtos_docs 
                WHERE produto_codigo = ?
            LIMIT 1
            `, [productCode]);

            if (docs.length > 0) {
                docInfo = {
                    url: docs[0].url_arquivo,
                    area: docs[0].area_pintura_m2,
                    operacao: docs[0].operacao
                };
            }
        }

        // 5. Merge and return
        // Extraction logic for fallback
        const raw_pedido = opData.pedido_venda || '';
        const raw_obs = opData.obs_venda || '';
        const pedido_final = raw_pedido.trim() || (raw_obs.trim().match(/^\d+/)?.[0] || '');

        const result = {
            ...opData,
            pedido_venda: pedido_final,
            data_planejada_inicio: plan?.data_planejada_inicio || null,
            data_planejada_fim: plan?.data_planejada_fim || null,
            qtd_produzida_real: progress?.total_produzido || 0,
            ultimo_apontamento: progress?.ultimo_apontamento || null,
            data_real_fim: progress?.data_real_fim || null,
            doc_url: docInfo?.url || null,
            tem_arquivos: !!docInfo?.url,
            area_pintura: docInfo?.area || null,
            operacao_doc: docInfo?.operacao || null
        };

        console.log(`✅[SINGLE OP] Found and merged operation successfully`);
        res.json(result);

    } catch (err) {
        console.error('[SINGLE OP ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});



// POST /api/production/plan - Save Planning
router.post('/plan', async (req, res) => {
    try {
        const { op_numero, op_item, op_sequencia, operacao_codigo, data_inicio, data_fim } = req.body;

        await mysqlPool.execute(`
            INSERT INTO app_production_planning(op_numero, op_item, op_sequencia, operacao_codigo, data_planejada_inicio, data_planejada_fim)
        VALUES(?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
        data_planejada_inicio = VALUES(data_planejada_inicio),
            data_planejada_fim = VALUES(data_planejada_fim)
                `, [op_numero, op_item, op_sequencia, operacao_codigo, data_inicio, data_fim]);

        res.json({ message: 'Planejamento salvo' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/production/plan-batch - Save Batch Planning (Macro) - OPTIMIZED
router.post('/plan-batch', async (req, res) => {
    try {
        const { plans } = req.body; // Array of planning objects

        if (!Array.isArray(plans) || plans.length === 0) {
            return res.status(400).json({ error: 'Nenhum plano fornecido.' });
        }

        console.log(`⚡[BATCH PLAN] Saving ${plans.length} items...`);

        // Chunking to avoid packet size limits (though 1000 is usually fine, being safe with 500)
        const CHUNK_SIZE = 500;
        const connection = await mysqlPool.getConnection();

        try {
            await connection.beginTransaction();

            for (let i = 0; i < plans.length; i += CHUNK_SIZE) {
                const chunk = plans.slice(i, i + CHUNK_SIZE);

                if (chunk.length === 0) continue;

                // Build Bulk Insert Query
                const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
                const sql = `
                    INSERT INTO app_production_planning
    (op_numero, op_item, op_sequencia, operacao_codigo, data_planejada_inicio, data_planejada_fim)
                    VALUES ${placeholders}
                    ON DUPLICATE KEY UPDATE 
                        data_planejada_inicio = VALUES(data_planejada_inicio),
    data_planejada_fim = VALUES(data_planejada_fim)
        `;

                // Flatten values
                const values = [];
                chunk.forEach(p => {
                    values.push(p.op_numero, p.op_item, p.op_sequencia, p.operacao_codigo, p.data_inicio, p.data_fim);
                });

                await connection.execute(sql, values);
                console.log(`   - Saved chunk ${i / CHUNK_SIZE + 1}(${chunk.length} items)`);
            }

            await connection.commit();
            console.log('✅ [BATCH PLAN] Success!');
            res.json({ message: 'Planejamento em lote salvo com sucesso!' });
        } catch (err) {
            console.error('❌ [BATCH PLAN] Error:', err);
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Multer para upload de fotos na conferência
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadDir = path.join(__dirname, '../uploads/conferencias');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const uploadConferencia = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadDir),
        filename: (_req, file, cb) => cb(null, 'conf_' + Date.now() + '_' + Math.random().toString(36).slice(2) + path.extname(file.originalname))
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Somente imagens são permitidas'));
    }
});

// POST /api/production/appoint - Save Appointment
router.post('/appoint', async (req, res) => {
    try {
        const { op_numero, op_item, op_sequencia, operacao_codigo, usuario, quantidade, data_inicio, data_fim, observacao, materiais_utilizados } = req.body;

        const qtyNum = Number(quantidade) || 0;
        if (qtyNum <= 0) {
            return res.status(400).json({ error: 'Quantidade deve ser maior que zero.' });
        }

        // --- VALIDAÇÃO DE SALDO ---
        // 1. Fetch Planejado (Protheus PG)
        const pgQuery = `
            SELECT c2.c2_quant::numeric AS qtd_planejada
            FROM public.sc2010 c2
            WHERE c2.c2_num = $1 AND c2.c2_item = $2 AND c2.c2_sequen = $3
            AND COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
        `;
        const pgRes = await db.query(pgQuery, [op_numero, op_item, op_sequencia]);

        if (pgRes.rows.length > 0) {
            const planejada = Number(pgRes.rows[0].qtd_planejada) || 0;
            if (planejada > 0) {
                // 2. Fetch Produzido (MySQL)
                const [appRows] = await mysqlPool.execute(`
                     SELECT SUM(quantidade) AS total
                     FROM app_production_appointments
                     WHERE op_numero=? AND op_item=? AND op_sequencia=? AND operacao_codigo=?
                 `, [op_numero, op_item, op_sequencia, operacao_codigo]);

                const produzido = Number(appRows[0].total) || 0;
                const newTotal = produzido + qtyNum;

                // Tolerance for floating point
                if (newTotal > planejada + 0.001) {
                    return res.status(400).json({
                        error: `Quantidade excede saldo! Planejado: ${planejada} | Já Produzido: ${produzido} | Tentativa: ${qtyNum}`
                    });
                }
            }
        }
        // --- FIM DA VALIDAÇÃO ---

        const materiaisJson = materiais_utilizados ? JSON.stringify(materiais_utilizados) : null;

        // Fetch verification config
        const [configRows] = await mysqlPool.query('SELECT general_config FROM app_company_settings WHERE id = 1');
        let initialStatus = 'OK';
        if (configRows.length > 0 && configRows[0].general_config) {
            let config = typeof configRows[0].general_config === 'string' ? JSON.parse(configRows[0].general_config) : configRows[0].general_config;
            if (config.enable_production_verification) {
                initialStatus = 'PENDENTE';
            }
        }

        await mysqlPool.execute(`
            INSERT INTO app_production_appointments
    (op_numero, op_item, op_sequencia, operacao_codigo, usuario, quantidade, data_inicio, data_fim, observacao, materiais_utilizados, conferencia_status)
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [op_numero, op_item, op_sequencia, operacao_codigo, usuario, quantidade, data_inicio, data_fim, observacao, materiaisJson, initialStatus]);

        // Se houver materiais com solicitacao_id, marcar solicitação como ENTREGUE (se já não estiver)
        if (materiais_utilizados && Array.isArray(materiais_utilizados)) {
            const solicitacoesIds = [...new Set(materiais_utilizados.map(m => m.solicitacao_id).filter(id => id))];

            if (solicitacoesIds.length > 0) {
                // Atualizar status das solicitações vinculadas
                const placeholders = solicitacoesIds.map(() => '?').join(',');
                await mysqlPool.execute(`
                    UPDATE app_solicitacoes_almoxarifado 
                    SET status = 'ENTREGUE', data_entregue = NOW(), usuario_entrega = 'APONTAMENTO_AUTO'
                    WHERE id IN(${placeholders}) AND status != 'ENTREGUE'
    `, solicitacoesIds);
            }
        }

        res.json({ message: 'Apontamento registrado com consumo de materiais' });
    } catch (err) {
        console.error('[APPOINT ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/production/appointments/:op - Get History
router.get('/appointments/:op', async (req, res) => {
    try {
        const { item, sequencia, operacao } = req.query;

        let sql = `
            SELECT a.*, u.fotoUsuario as usuario_foto 
            FROM app_production_appointments a
            LEFT JOIN usuario u ON u.NomeCompleto = a.usuario OR u.Login = a.usuario
            WHERE a.op_numero = ?
        `;
        const params = [req.params.op];

        // Filter by specific operation if provided
        if (item) {
            sql += ' AND a.op_item = ?';
            params.push(item);
        }
        if (sequencia) {
            sql += ' AND a.op_sequencia = ?';
            params.push(sequencia);
        }
        if (operacao) {
            sql += ' AND a.operacao_codigo = ?';
            params.push(operacao);
        }

        sql += ' ORDER BY a.data_inicio DESC';

        const [rows] = await mysqlPool.query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error('[APPOINTMENTS HISTORY ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// Ensure conferencia history table exists
mysqlPool.execute(`
    CREATE TABLE IF NOT EXISTS app_conferencia_historico (
        id INT AUTO_INCREMENT PRIMARY KEY,
        appointment_id INT NOT NULL,
        status VARCHAR(20) NOT NULL,
        conferido_por VARCHAR(100) NOT NULL,
        observacao TEXT,
        fotos LONGTEXT,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_appointment (appointment_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`).catch(e => console.error('[CONFERENCIA HISTORY TABLE]', e.message));

// POST /api/production/conferencia - Approve/Reject Appointment (aceita JSON ou multipart com fotos)
router.post('/conferencia', uploadConferencia.array('fotos', 5), async (req, res) => {
    try {
        const { id, status, observacao, conferido_por } = req.body;

        if (!id || !status || !conferido_por) {
            return res.status(400).json({ error: 'Campos obrigatórios: id, status, conferido_por' });
        }
        if (!['OK', 'DIVERGENTE'].includes(status)) {
            return res.status(400).json({ error: 'Status inválido. Use OK ou DIVERGENTE.' });
        }

        const fotosPaths = (req.files || []).map(f => '/uploads/conferencias/' + f.filename);
        const fotosJson = fotosPaths.length > 0 ? JSON.stringify(fotosPaths) : null;

        // Update current status on the appointment
        await mysqlPool.execute(`
            UPDATE app_production_appointments
            SET conferencia_status = ?, conferido_por = ?, conferido_em = NOW(), conferencia_obs = ?, conferencia_fotos = ?
            WHERE id = ?
        `, [status, conferido_por, observacao || null, fotosJson, id]);

        // Insert into history log
        await mysqlPool.execute(`
            INSERT INTO app_conferencia_historico (appointment_id, status, conferido_por, observacao, fotos)
            VALUES (?, ?, ?, ?, ?)
        `, [id, status, conferido_por, observacao || null, fotosJson]);

        res.json({ message: 'Conferência registrada com sucesso', fotos: fotosPaths });
    } catch (err) {
        console.error('[CONFERENCIA ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/production/conferencia/bulk - Bulk approve/reject multiple appointments
router.post('/conferencia/bulk', uploadConferencia.array('fotos', 5), async (req, res) => {
    try {
        const { ids, status, observacao, conferido_por } = req.body;

        if (!ids || !status || !conferido_por) {
            return res.status(400).json({ error: 'ids, status e conferido_por são obrigatórios' });
        }
        if (!['OK', 'DIVERGENTE'].includes(status)) {
            return res.status(400).json({ error: 'Status inválido' });
        }

        let idArray;
        try {
            idArray = typeof ids === 'string' ? JSON.parse(ids) : ids;
        } catch (e) {
            return res.status(400).json({ error: 'ids inválido' });
        }
        if (!Array.isArray(idArray) || idArray.length === 0) {
            return res.status(400).json({ error: 'ids deve ser um array não vazio' });
        }

        const fotosPaths = (req.files || []).map(f => '/uploads/conferencias/' + f.filename);
        const fotosJson = fotosPaths.length > 0 ? JSON.stringify(fotosPaths) : null;

        const placeholders = idArray.map(() => '?').join(',');
        await mysqlPool.execute(
            `UPDATE app_production_appointments
             SET conferencia_status = ?, conferido_por = ?, conferido_em = NOW(), conferencia_obs = ?, conferencia_fotos = ?
             WHERE id IN (${placeholders})`,
            [status, conferido_por, observacao || null, fotosJson, ...idArray]
        );

        for (const id of idArray) {
            await mysqlPool.execute(
                `INSERT INTO app_conferencia_historico (appointment_id, status, conferido_por, observacao, fotos)
                 VALUES (?, ?, ?, ?, ?)`,
                [id, status, conferido_por, observacao || null, fotosJson]
            );
        }

        res.json({ ok: true, count: idArray.length });
    } catch (err) {
        console.error('[CONFERENCIA BULK ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/production/conferencia/:id/historico - History of all actions for an appointment
router.get('/conferencia/:id/historico', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await mysqlPool.query(`
            SELECT id, status, conferido_por, observacao, fotos, criado_em
            FROM app_conferencia_historico
            WHERE appointment_id = ?
            ORDER BY criado_em DESC
        `, [id]);
        res.json(rows);
    } catch (err) {
        console.error('[CONFERENCIA HISTORICO ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/production/pendentes - All appointments for conferente dashboard
router.get('/pendentes', async (req, res) => {
    try {
        const { status = 'PENDENTE', data_inicio, data_fim, op, pedido, cliente, produto, apontador } = req.query;

        let validOps = null;

        // 1. Fetch matching OPs from Protheus if any metadata filters are used
        if (pedido || cliente || produto) {
            let pgSql = `
                SELECT DISTINCT c2.c2_num 
                FROM sc2010 c2
                LEFT JOIN sc5010 c5 ON TRIM(c5.c5_num) = TRIM(c2.c2_pedido)
                LEFT JOIN sa1010 sa1 ON TRIM(sa1.a1_cod) = TRIM(c5.c5_cliente)
                WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
            `;
            let pgParams = [];
            let paramCount = 1;

            if (pedido) {
                pgSql += ` AND (c2.c2_pedido ILIKE $${paramCount} OR c2.c2_obs ILIKE $${paramCount})`;
                pgParams.push(`%${pedido}%`);
                paramCount++;
            }
            if (cliente) {
                pgSql += ` AND sa1.a1_nome ILIKE $${paramCount}`;
                pgParams.push(`%${cliente}%`);
                paramCount++;
            }
            if (produto) {
                pgSql += ` AND c2.c2_produto ILIKE $${paramCount}`;
                pgParams.push(`%${produto}%`);
                paramCount++;
            }

            const pgRes = await db.query(pgSql, pgParams);
            validOps = pgRes.rows.map(r => r.c2_num.trim());

            if (validOps.length === 0) {
                return res.json([]); // No matching OPs in ERP
            }
        }

        // 2. Fetch appointments from MySQL
        let sql = `
            SELECT
                a.id,
                a.op_numero,
                a.op_item,
                a.op_sequencia,
                a.operacao_codigo,
                a.usuario,
                a.quantidade,
                a.data_inicio,
                a.data_fim,
                a.observacao,
                a.conferencia_status,
                a.conferido_por,
                a.conferido_em,
                a.conferencia_obs,
                a.data_fim as criado_em
            FROM app_production_appointments a
            WHERE 1=1
        `;
        const params = [];

        if (status !== 'TODOS') {
            sql += ` AND a.conferencia_status = ?`;
            params.push(status);
        }

        if (data_inicio) {
            sql += ` AND DATE(a.data_fim) >= ?`;
            params.push(data_inicio);
        }
        if (data_fim) {
            sql += ` AND DATE(a.data_fim) <= ?`;
            params.push(data_fim);
        }

        if (op) {
            sql += ` AND a.op_numero LIKE ?`;
            params.push(`%${op}%`);
        }
        if (apontador) {
            sql += ` AND a.usuario LIKE ?`;
            params.push(`%${apontador}%`);
        }

        if (validOps && validOps.length > 0) {
            const placeholders = validOps.map(() => '?').join(',');
            sql += ` AND a.op_numero IN (${placeholders})`;
            params.push(...validOps);
        }

        sql += ` ORDER BY a.data_fim DESC LIMIT 500`;

        const [rows] = await mysqlPool.query(sql, params);

        // Enrich with Protheus (PostgreSQL) + MySQL data
        if (rows.length > 0) {
            try {
                const opNums = [...new Set(rows.map(r => r.op_numero).filter(Boolean))];

                const [scRes, [planRows]] = await Promise.all([
                    opNums.length ? db.query(
                    `SELECT TRIM(c2.c2_num) as op_numero,
                            TRIM(c2.c2_item) as item_op,
                            TRIM(c2.c2_sequen) as op_sequencia,
                            TRIM(c2.c2_produto) as produto_codigo,
                            TRIM(c2.c2_pedido) as pedido_venda,
                            TRIM(c2.c2_obs) as obs_venda,
                            TRIM(sa1.a1_nome) as nome_cliente,
                            c2.c2_quant as qtd_planejada,
                            TRIM(g2.g2_operac) as g2_operac,
                            TRIM(g2.g2_recurso) as g2_recurso,
                            TRIM(g2.g2_descri) as desc_operacao,
                            TRIM(h1.h1_descri) as master_desc_recurso
                         FROM sc2010 c2
                         LEFT JOIN sc5010 c5 ON TRIM(c5.c5_num) = TRIM(c2.c2_pedido)
                             AND c5.c5_filial = c2.c2_filial
                             AND COALESCE(c5.d_e_l_e_t_,'') IN ('',' ')
                         LEFT JOIN sa1010 sa1 ON TRIM(sa1.a1_cod) = TRIM(c5.c5_cliente)
                             AND sa1.a1_loja = c5.c5_lojacli
                             AND COALESCE(sa1.d_e_l_e_t_,'') IN ('',' ')
                         LEFT JOIN public.sg2010 g2 ON
                             btrim(g2.g2_produto) = btrim(c2.c2_produto)
                             AND btrim(g2.g2_filial) = btrim(c2.c2_filial)
                             AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
                         LEFT JOIN public.sh1010 h1 ON
                             h1.h1_codigo = g2.g2_recurso
                             AND h1.h1_filial = g2.g2_filial
                             AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
                          WHERE COALESCE(c2.d_e_l_e_t_,'') IN ('',' ')
                          AND (TRIM(c2.c2_num) = ANY($1) OR LTRIM(TRIM(c2.c2_num), '0') = ANY($1))`,
                        [opNums]
                    ) : Promise.resolve({ rows: [] }),
                    opNums.length ? mysqlPool.query(
                        `SELECT op_numero, op_item, op_sequencia, operacao_codigo, data_planejada_inicio, data_planejada_fim
                         FROM app_production_planning
                         WHERE op_numero IN (${opNums.map(() => '?').join(',')})`,
                        opNums
                    ) : Promise.resolve([[]])
                ]);

                // Map results for quick lookup using NORMALIZED keys (no leading zeros)
                const scMap = {};
                const routingMap = {};
                scRes.rows.forEach(r => {
                    const cleanOp = r.op_numero.replace(/^0+/, '');
                    
                    // Specific key for exact Item/Sequence matching
                    const fullKey = `${cleanOp}_${r.item_op || ''}_${r.op_sequencia || ''}`;
                    scMap[fullKey] = r;
                    // Keep a generic fallback for the OP just in case
                    if (!scMap[cleanOp]) scMap[cleanOp] = r;

                    const key = `${cleanOp}_${r.item_op}`;
                    if (!routingMap[key]) routingMap[key] = [];
                    routingMap[key].push(r);
                });

                // Map planning for quick lookup
                const planMap = {};
                (planRows || []).forEach(p => {
                    const cleanOp = (p.op_numero || '').replace(/^0+/, '');
                    const key = `${cleanOp}_${p.op_item}_${p.op_sequencia}_${p.operacao_codigo}`;
                    planMap[key] = p;
                });

                // Collect product codes for PDF check
                const prodCodes = [...new Set(
                    Object.values(scMap).map(r => r.produto_codigo).filter(Boolean)
                )];

                let pdfMap = {};
                if (prodCodes.length) {
                    try {
                        const placeholders = prodCodes.map((_, i) => '?').join(',');
                        const [pdfRows] = await mysqlPool.query(
                            `SELECT produto_codigo, MIN(url_arquivo) as url
                             FROM produtos_docs WHERE produto_codigo IN (${placeholders})
                             GROUP BY produto_codigo`,
                            prodCodes
                        );
                        pdfRows.forEach(r => { pdfMap[r.produto_codigo] = r.url; });
                    } catch (e) {
                        console.warn('[PENDENTES PDF]', e.message);
                    }
                }

                rows.forEach(r => {
                    const cleanOp = (r.op_numero || '').replace(/^0+/, '');
                    const fullKey = `${cleanOp}_${r.op_item || ''}_${r.op_sequencia || ''}`;
                    
                    // Match by Full Key > Generic Key
                    const sc = scMap[fullKey] || scMap[cleanOp];
                    
                    if (sc) {
                        r.produto_codigo = sc.produto_codigo || r.produto_codigo || null;
                        
                        // Fallback logic for Pedido
                        const raw_ped = sc.pedido_venda || '';
                        const raw_obs = sc.obs_venda || '';
                        r.pedido_venda = raw_ped.trim() || (raw_obs.trim().match(/^\d+/)?.[0] || null);
                        
                        r.nome_cliente = sc.nome_cliente || null;
                        r.pdf_url = pdfMap[sc.produto_codigo] || null;
                        r.qtd_planejada = sc.qtd_planejada != null ? Number(sc.qtd_planejada) : null;
                    }

                    // Merge Planned Dates
                    const planKey = `${cleanOp}_${r.op_item || '01'}_${r.op_sequencia}_${r.operacao_codigo}`;
                    const plan = planMap[planKey];
                    if (plan) {
                        r.data_planejada_inicio = plan.data_planejada_inicio;
                        r.data_planejada_fim = plan.data_planejada_fim;
                    }

                    // Match operation description (from Matrix or Vertical)
                    const routeKey = `${cleanOp}_${r.op_item || '01'}`; // Default to 01 if missing
                    const routes = routingMap[routeKey] || [];
                    
                    // Priority 1: Match exactly by operacao_codigo (desc_operacao)
                    // Priority 2: Fallback to resource (master_desc_recurso)
                    const exactRoute = routes.find(route =>
                        route.g2_operac === r.operacao_codigo || route.g2_recurso === r.operacao_codigo
                    );

                    if (exactRoute) {
                        const descBase = exactRoute.desc_operacao || exactRoute.master_desc_recurso || '';
                        const recursoPart = exactRoute.g2_recurso ? `${exactRoute.g2_recurso} - ` : '';
                        r.operacao_nome = `${recursoPart}${descBase}` || r.operacao_codigo;
                    } else {
                        r.operacao_nome = r.operacao_codigo; // Default fallback to code
                    }
                });
            } catch (e) {
                console.warn('[PENDENTES ENRICH]', e.message);
            }
        }

        res.json(rows);
    } catch (err) {
        console.error('[PENDENTES ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/production/analytics - Aggregated Data
router.get('/analytics', async (req, res) => {
    try {
        const { date_start, date_end } = req.query; // Optional filters

        // 1. Daily Evolution (Line Chart)
        const [daily] = await mysqlPool.query(`
SELECT
DATE(data_fim) as data,
    SUM(quantidade) as total_produzido
            FROM app_production_appointments
            WHERE data_fim >= COALESCE(?, DATE_SUB(CURDATE(), INTERVAL 30 DAY))
            GROUP BY DATE(data_fim)
            ORDER BY data ASC
    `, [date_start]);

        // 2. By Work Center/Resource (Bar Chart) - Need to join with Protheus data effectively
        // Since we don't have resource in MySQL appointments yet (unless we added it), 
        // we might group by Operation Code for now as a proxy or just return top OPs.

        // Let's return Top 5 OPs by Quantity
        const [topOps] = await mysqlPool.query(`
            SELECT op_numero, SUM(quantidade) as total
            FROM app_production_appointments
            GROUP BY op_numero
            ORDER BY total DESC
            LIMIT 5
    `);

        res.json({ daily, topOps });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// GET /api/production/processes - Get List of Resources for Legend
router.get('/processes', async (req, res) => {
    try {
        // User Provided SQL - EXACTLY AS REQUESTED
        const resQuery = `
SELECT 
                h1_codigo  AS cod_recurso,
    h1_descri  AS desc_recurso
            FROM public.sh1010
            WHERE d_e_l_e_t_ = ' '
            ORDER BY h1_codigo
        `;

        console.log('📋 [PROCESSES] Fetching resource list from sh1010 (User SQL)...');
        const pgRes = await db.query(resQuery);

        console.log(`✅[PROCESSES] Found ${pgRes.rows.length} resources`);

        // Map to frontend expected format (codigo, descricao) to NOT break the UI
        const mapped = pgRes.rows.map(r => {
            const code = r.cod_recurso ? r.cod_recurso.trim() : '';
            let desc = r.desc_recurso ? r.desc_recurso.trim() : '';
            if (code === 'MO0013') desc = 'LASE';
            return {
                codigo: code,
                descricao: desc
            };
        });

        res.json({
            data: mapped,
            debug_sql: resQuery.replace(/\s+/g, ' ').trim()
        });
    } catch (err) {
        console.error('❌ [PROCESSES] Error:', err);
        res.status(500).json({ error: err.message });
    }
});


// GET /api/production/tracking-evolution - Production Evolution by Order
const trackingEvolutionHandler = async (req, res) => {
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
        let whereClause = `WHERE COALESCE(c5.d_e_l_e_t_, '') IN('', ' ')`;
        const params = [];
        let paramCount = 1;

        if (pedido) {
            whereClause += ` AND c5.c5_num LIKE $${paramCount} `;
            params.push(`% ${pedido}% `);
            paramCount++;
        }

        if (cliente) {
            whereClause += ` AND(a1.a1_nome ILIKE $${paramCount} OR a1.a1_nreduz ILIKE $${paramCount} OR c5.c5_cliente LIKE $${paramCount})`;
            params.push(`% ${cliente.toUpperCase()}% `);
            paramCount++;
        }

        if (data_inicio) {
            whereClause += ` AND c5.c5_emissao >= $${paramCount} `;
            params.push(data_inicio.replace(/-/g, ''));
            paramCount++;
        }

        if (data_fim) {
            whereClause += ` AND c5.c5_emissao <= $${paramCount} `;
            params.push(data_fim.replace(/-/g, ''));
            paramCount++;
        }

        // 2. Fetch Sales Orders with Items and OPs (Refactored for Roteiro Explosion)
        const query = `
            WITH PedidosBase AS(
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
                    AND COALESCE(a1.d_e_l_e_t_, '') IN('', ' ')
                ${whereClause}
                ORDER BY c5.c5_num DESC
                LIMIT 50
    ),
    ItensPedido AS(
        SELECT 
                    c6.c6_num AS pedido,
        c6.c6_item AS item,
        c6.c6_produto AS cod_produto,
        TRIM(c6.c6_descri) AS desc_produto,
        c6.c6_qtdven:: numeric AS qtd_item,
        c6.c6_entreg AS data_entrega
                FROM public.sc6010 c6
                INNER JOIN PedidosBase pb ON pb.pedido = c6.c6_num
                WHERE COALESCE(c6.d_e_l_e_t_, '') IN('', ' ')
    ),
        --3. Get OPs(Header level for the Item) with Robust Linkage
            OPsCabecalho AS(
            SELECT 
                    TRIM(c2.c2_num) AS op_num,
            c2.c2_item AS item_op,
            c2.c2_sequen AS op_sequencia_split, --Keeps original split seq for ref
                    c2.c2_produto AS cod_produto,
        c2.c2_quant::numeric AS qtd_planejada,

            --Robust Linking to Pedido(Handles Splits)
COALESCE(
    NULLIF(TRIM(c2.c2_pedido), ''),
    (SELECT TRIM(parent.c2_pedido) 
                         FROM public.sc2010 parent 
                         WHERE parent.c2_num = c2.c2_num 
                           AND parent.c2_item = c2.c2_item 
                           AND TRIM(parent.c2_sequen) IN('01', '001', '1')
                           AND COALESCE(parent.d_e_l_e_t_, '') IN('', ' ')
                         LIMIT 1)
                    ) AS pedido,

    COALESCE(
        NULLIF(TRIM(c2.c2_itempv), ''),
        (SELECT parent.c2_itempv 
                         FROM public.sc2010 parent 
                         WHERE parent.c2_num = c2.c2_num 
                           AND parent.c2_item = c2.c2_item 
                           AND TRIM(parent.c2_sequen) IN('01', '001', '1')
                           AND COALESCE(parent.d_e_l_e_t_, '') IN('', ' ')
                         LIMIT 1)
                    ) AS item_pedido

                FROM public.sc2010 c2
                INNER JOIN ItensPedido ip ON btrim(c2.c2_produto) = btrim(ip.cod_produto)-- OPTIMIZATION: Scan only relevant products
                WHERE COALESCE(c2.d_e_l_e_t_, '') IN('', ' ')
            ),
--4. JOIN with SG2(Roteiro) to Explode Operations
--This fixes the "Sequence Mixing" by explicitly listing operations
            OPsRoteiro AS(
    SELECT 
                    op.op_num,
    op.item_op,
    op.cod_produto AS cod_produto_op,
    op.pedido,
    op.item_pedido,
    op.qtd_planejada,
    TRIM(g2.g2_operac) AS sequencia, --Real Operation Sequence(01, 05, 10)
                    TRIM(g2.g2_recurso) AS recurso,
    TRIM(g2.g2_descri) AS desc_operacao
                FROM OPsCabecalho op
                LEFT JOIN public.sg2010 g2 
                    ON btrim(g2.g2_produto) = btrim(op.cod_produto) 
                    AND COALESCE(g2.d_e_l_e_t_, '') IN('', ' ')
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
        ops.sequencia, --This is now the REAL routing sequence
ops.cod_produto_op,

    --Description Logic
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
            ORDER BY pb.pedido DESC, ip.item, ops.op_num, ops.sequencia
    `;

        console.log('⏳ [PEDIDOS-EVOLUTION] Executing query...');
        // console.log(query);
        const pgRes = await db.query(query, params);
        const rows = pgRes.rows;

        console.log(`✅[PEDIDOS - EVOLUTION] Found ${rows.length} rows`);

        if (rows.length === 0) {
            return res.json({ pedidos: [], resumo: { total_pedidos: 0, concluidos: 0, em_andamento: 0, nao_iniciados: 0 } });
        }

        // 3. Fetch all appointments from MySQL
        const [appointments] = await mysqlPool.query(`
SELECT
op_numero, op_item, operacao_codigo,
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
            const key = `${a.op_numero}_${a.operacao_codigo} `;
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
                const apptKey = `${row.op}_${row.sequencia} `;
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
            agrupado: filteredPedidos,
            resumo
        });

    } catch (err) {
        console.error('❌ [PEDIDOS-EVOLUTION] Error:', err);
        res.status(500).json({ error: err.message });
    }
};

router.get('/tracking-evolution', trackingEvolutionHandler);
router.get('/pedidos-evolution', trackingEvolutionHandler);


// GET /api/production/appointments/:op - Get Detailed History
router.get('/appointments/:op', async (req, res) => {
    try {
        const { op } = req.params;
        const { item, sequencia, operacao } = req.query;

        console.log(`?? [HISTORY] Fetching for OP: ${op}, Item: ${item}, Seq: ${sequencia}, Oper: ${operacao} `);

        let query = `
SELECT
id, op_numero, op_item, op_sequencia, operacao_codigo,
    quantidade, data_inicio, data_fim, usuario, recurso, data_fim as criado_em, observacao
            FROM app_production_appointments
            WHERE op_numero = ?
    `;
        const params = [op];

        if (item) { query += ` AND op_item = ? `; params.push(item); }
        if (sequencia) { query += ` AND op_sequencia = ? `; params.push(sequencia); }
        if (operacao) { query += ` AND operacao_codigo = ? `; params.push(operacao); }

        query += ` ORDER BY data_fim DESC`;

        const [rows] = await mysqlPool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/production/tracking-evolution - Evolution of Production Tracking with Groupings
router.get('/tracking-evolution', async (req, res) => {
    try {
        const {
            data_inicio,
            data_fim,
            pedido,
            op,
            produto,
            operacao,
            colaborador,
            grupo_por = 'operacao' // Default grouping
        } = req.query;

        console.log('?? [TRACKING-EVOLUTION] Filters:', { data_inicio, data_fim, pedido, op, produto, operacao, colaborador, grupo_por });

        // Build WHERE clause for filters
        let whereConditions = [];
        const params = [];

        if (data_inicio) {
            whereConditions.push(`a.data_fim >= ? `);
            params.push(data_inicio);
        }
        if (data_fim) {
            whereConditions.push(`a.data_fim <= ? `);
            params.push(`${data_fim} 23: 59: 59`);
        }
        if (colaborador) {
            whereConditions.push(`a.usuario LIKE ? `);
            params.push(`% ${colaborador}% `);
        }
        if (op) {
            whereConditions.push(`a.op_numero LIKE ? `);
            params.push(`% ${op}% `);
        }
        if (operacao) {
            whereConditions.push(`a.operacao_codigo LIKE ? `);
            params.push(`% ${operacao}% `);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')} ` : '';

        // Base query to get appointments with related data from Protheus
        const baseQuery = `
SELECT
a.id,
    a.op_numero,
    a.op_item,
    a.op_sequencia,
    a.operacao_codigo,
    a.usuario,
    a.quantidade,
    a.data_inicio,
    a.data_fim,
    a.observacao
            FROM app_production_appointments a
            ${whereClause}
            ORDER BY a.data_fim DESC
        `;

        const [appointments] = await mysqlPool.query(baseQuery, params);

        if (appointments.length === 0) {
            return res.json({
                resumo: { total_pecas: 0, pedidos_unicos: 0, operacoes_unicas: 0, colaboradores_unicos: 0 },
                agrupado: []
            });
        }

        // Get unique OPs to fetch from Protheus
        const uniqueOps = [...new Set(appointments.map(a => a.op_numero))];

        // Fetch OP details from Protheus (PostgreSQL)
        const opPlaceholders = uniqueOps.map((_, i) => `$${i + 1} `).join(',');
        const opQuery = `
SELECT
c2.c2_num AS op,
    c2.c2_produto AS cod_produto,
        TRIM(c2.c2_pedido) AS pedido,
            sb1.b1_desc AS desc_produto,
                g2.g2_descri AS desc_operacao
            FROM public.sc2010 c2
            LEFT JOIN public.sb1010 sb1 ON sb1.b1_cod = c2.c2_produto AND COALESCE(sb1.d_e_l_e_t_, '') IN('', ' ')
            LEFT JOIN public.sg2010 g2 ON btrim(g2.g2_produto) = btrim(c2.c2_produto) AND COALESCE(g2.d_e_l_e_t_, '') IN('', ' ')
            WHERE c2.c2_num IN(${opPlaceholders})
            AND COALESCE(c2.d_e_l_e_t_, '') IN('', ' ')
        `;

        const opResult = await db.query(opQuery, uniqueOps);
        const opMap = {};
        opResult.rows.forEach(row => {
            opMap[row.op] = row;
        });

        // Enrich appointments with Protheus data
        const enrichedAppointments = appointments.map(a => ({
            ...a,
            pedido: opMap[a.op_numero]?.pedido || '',
            cod_produto: opMap[a.op_numero]?.cod_produto || '',
            desc_produto: opMap[a.op_numero]?.desc_produto || '',
            desc_operacao: opMap[a.op_numero]?.desc_operacao || ''
        }));

        // Apply additional filters (pedido, produto) - now that we have Protheus data
        let filteredAppointments = enrichedAppointments;
        if (pedido) {
            filteredAppointments = filteredAppointments.filter(a =>
                a.pedido && a.pedido.toLowerCase().includes(pedido.toLowerCase())
            );
        }
        if (produto) {
            filteredAppointments = filteredAppointments.filter(a =>
                (a.cod_produto && a.cod_produto.toLowerCase().includes(produto.toLowerCase())) ||
                (a.desc_produto && a.desc_produto.toLowerCase().includes(produto.toLowerCase()))
            );
        }

        // Calculate summary statistics
        const totalPecas = filteredAppointments.reduce((sum, a) => sum + parseFloat(a.quantidade || 0), 0);
        const pedidosUnicos = new Set(filteredAppointments.map(a => a.pedido).filter(Boolean)).size;
        const operacoesUnicas = new Set(filteredAppointments.map(a => a.operacao_codigo).filter(Boolean)).size;
        const colaboradoresUnicos = new Set(filteredAppointments.map(a => a.usuario).filter(Boolean)).size;

        // Group data based on grupo_por parameter
        const grouped = {};

        filteredAppointments.forEach(a => {
            let key;
            let label;

            switch (grupo_por) {
                case 'pedido':
                    key = a.pedido || 'SEM_PEDIDO';
                    label = `Pedido: ${key} `;
                    break;
                case 'op':
                    key = a.op_numero || 'SEM_OP';
                    label = `OP: ${key} `;
                    break;
                case 'produto':
                    key = a.cod_produto || 'SEM_PRODUTO';
                    label = `${key} - ${a.desc_produto || 'Sem descri��o'} `;
                    break;
                case 'colaborador':
                    key = a.usuario || 'SEM_USUARIO';
                    label = key;
                    break;
                case 'dia':
                    const date = a.data_fim ? new Date(a.data_fim).toISOString().split('T')[0] : 'SEM_DATA';
                    key = date;
                    label = date;
                    break;
                case 'operacao':
                default:
                    key = a.operacao_codigo || 'SEM_OPERACAO';
                    label = `${key} - ${a.desc_operacao || 'Sem descri��o'} `;
                    break;
            }

            if (!grouped[key]) {
                grouped[key] = {
                    chave: label,
                    total_pecas: 0,
                    num_apontamentos: 0,
                    colaboradores: new Set(),
                    pedidos: new Set(),
                    operacoes: new Set()
                };
            }

            grouped[key].total_pecas += parseFloat(a.quantidade || 0);
            grouped[key].num_apontamentos++;
            if (a.usuario) grouped[key].colaboradores.add(a.usuario);
            if (a.pedido) grouped[key].pedidos.add(a.pedido);
            if (a.operacao_codigo) {
                const opLabel = a.desc_operacao ? `${a.operacao_codigo} - ${a.desc_operacao} ` : a.operacao_codigo;
                grouped[key].operacoes.add(opLabel);
            }
        });

        // Convert Sets to Arrays and sort by total_pecas descending
        const agrupado = Object.values(grouped)
            .map(g => ({
                chave: g.chave,
                total_pecas: Math.round(g.total_pecas * 100) / 100,
                num_apontamentos: g.num_apontamentos,
                colaboradores: Array.from(g.colaboradores),
                pedidos: Array.from(g.pedidos),
                operacoes: Array.from(g.operacoes)
            }))
            .sort((a, b) => b.total_pecas - a.total_pecas);

        res.json({
            resumo: {
                total_pecas: Math.round(totalPecas * 100) / 100,
                pedidos_unicos: pedidosUnicos,
                operacoes_unicas: operacoesUnicas,
                colaboradores_unicos: colaboradoresUnicos
            },
            agrupado
        });

    } catch (err) {
        console.error('[TRACKING-EVOLUTION ERROR]', err.message);
        console.error('[TRACKING-EVOLUTION STACK]', err.stack);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});
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
            appointmentFilters.push(`a.data_fim >= ? `);
            appointmentParams.push(data_inicio);
        }
        if (data_fim) {
            appointmentFilters.push(`a.data_fim <= ? `);
            appointmentParams.push(`${data_fim} 23: 59: 59`);
        }
        if (op) {
            appointmentFilters.push(`a.op_numero LIKE ? `);
            appointmentParams.push(`% ${op}% `);
        }

        const appointmentWhere = appointmentFilters.length > 0
            ? `WHERE ${appointmentFilters.join(' AND ')} `
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
        protheusFilters.push(`COALESCE(c2.d_e_l_e_t_, '') IN('', ' ')`);
        protheusFilters.push(`COALESCE(g2.d_e_l_e_t_, '') IN('', ' ')`);

        if (data_inicio) {
            protheusFilters.push(`c2.c2_datpri >= $${paramCount} `);
            protheusParams.push(data_inicio.replace(/-/g, ''));
            paramCount++;
        }
        if (data_fim) {
            protheusFilters.push(`c2.c2_datpri <= $${paramCount} `);
            protheusParams.push(data_fim.replace(/-/g, ''));
            paramCount++;
        }
        if (pedido) {
            protheusFilters.push(`TRIM(c2.c2_pedido) LIKE $${paramCount} `);
            protheusParams.push(`% ${pedido}% `);
            paramCount++;
        }
        if (op) {
            protheusFilters.push(`TRIM(c2.c2_num) LIKE $${paramCount} `);
            protheusParams.push(`% ${op}% `);
            paramCount++;
        }
        if (produto) {
            protheusFilters.push(`(TRIM(c2.c2_produto) ILIKE $${paramCount} OR TRIM(c2.c2_descri) ILIKE $${paramCount})`);
            protheusParams.push(`% ${produto}% `);
            paramCount++;
        }

        const protheusWhere = protheusFilters.length > 0
            ? `WHERE ${protheusFilters.join(' AND ')} `
            : '';

        // Join SC2 (OPs) with SG2 (Operations) by Product
        // Summing OP Quantity (c2_quant) grouping by Operation
        const plannedQuery = `
SELECT
TRIM(g2.g2_operac) as operacao_codigo,
    TRIM(g2.g2_descri) as operacao_desc,
    SUM(c2.c2_quant:: numeric) as qtd_planejada
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



// GET /api/production/tracking-history - Detailed Tracking History with Pagination
router.get('/tracking-history', async (req, res) => {
    try {
        const {
            data_inicio,
            data_fim,
            pedido,
            produto,
            operacao,
            colaborador,
            page = 1,
            limit = 50
        } = req.query;

        console.log('?? [TRACKING-HISTORY] Filters:', { data_inicio, data_fim, pedido, produto, operacao, colaborador, page, limit });

        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 50;
        const offset = (pageNum - 1) * limitNum;

        // Build WHERE clause
        let whereConditions = [];
        const params = [];

        if (data_inicio) {
            whereConditions.push(`a.data_fim >= ? `);
            params.push(data_inicio);
        }
        if (data_fim) {
            whereConditions.push(`a.data_fim <= ? `);
            params.push(`${data_fim} 23: 59: 59`);
        }
        if (colaborador) {
            whereConditions.push(`a.usuario LIKE ? `);
            params.push(`% ${colaborador}% `);
        }
        if (operacao) {
            whereConditions.push(`a.operacao_codigo LIKE ? `);
            params.push(`% ${operacao}% `);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')} ` : '';

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM app_production_appointments a ${whereClause} `;
        const [countResult] = await mysqlPool.query(countQuery, params);
        const total = countResult[0].total;

        // Get paginated data
        const dataQuery = `
SELECT
a.id,
    a.op_numero,
    a.op_item,
    a.op_sequencia,
    a.operacao_codigo,
    a.usuario,
    a.quantidade,
    a.data_inicio,
    a.data_fim,
    a.observacao
            FROM app_production_appointments a
            ${whereClause}
            ORDER BY a.data_fim DESC, a.id DESC
LIMIT ? OFFSET ?
    `;

        const [appointments] = await mysqlPool.query(dataQuery, [...params, limitNum, offset]);

        // Get unique OPs to fetch from Protheus
        const uniqueOps = [...new Set(appointments.map(a => a.op_numero))];

        if (uniqueOps.length === 0) {
            return res.json({ data: [], total: 0, page: pageNum, limit: limitNum, totalPages: 0 });
        }

        // Fetch OP details from Protheus
        const opPlaceholders = uniqueOps.map((_, i) => `$${i + 1} `).join(',');
        const opQuery = `
SELECT
c2.c2_num AS op,
    c2.c2_produto AS cod_produto,
        TRIM(c2.c2_pedido) AS pedido,
            TRIM(c2.c2_itempv) AS item_pedido,
                sb1.b1_desc AS desc_produto,
                    g2.g2_descri AS desc_operacao
            FROM public.sc2010 c2
            LEFT JOIN public.sb1010 sb1 ON sb1.b1_cod = c2.c2_produto AND COALESCE(sb1.d_e_l_e_t_, '') IN('', ' ')
            LEFT JOIN public.sg2010 g2 ON btrim(g2.g2_produto) = btrim(c2.c2_produto) AND COALESCE(g2.d_e_l_e_t_, '') IN('', ' ')
            WHERE c2.c2_num IN(${opPlaceholders})
            AND COALESCE(c2.d_e_l_e_t_, '') IN('', ' ')
        `;

        const opResult = await db.query(opQuery, uniqueOps);
        const opMap = {};
        opResult.rows.forEach(row => {
            opMap[row.op] = row;
        });

        // Enrich and filter appointments
        let enrichedAppointments = appointments.map(a => ({
            id: a.id,
            data_hora: a.data_fim,
            colaborador: a.usuario,
            pedido: opMap[a.op_numero]?.pedido || '',
            item: opMap[a.op_numero]?.item_pedido || '',
            produto: opMap[a.op_numero]?.cod_produto || '',
            desc_produto: opMap[a.op_numero]?.desc_produto || '',
            operacao: a.operacao_codigo,
            desc_operacao: opMap[a.op_numero]?.desc_operacao || '',
            quantidade: a.quantidade,
            observacao: a.observacao || ''
        }));

        // Apply additional filters (pedido, produto) after enrichment
        if (pedido) {
            enrichedAppointments = enrichedAppointments.filter(a =>
                a.pedido && a.pedido.toLowerCase().includes(pedido.toLowerCase())
            );
        }
        if (produto) {
            enrichedAppointments = enrichedAppointments.filter(a =>
                (a.produto && a.produto.toLowerCase().includes(produto.toLowerCase())) ||
                (a.desc_produto && a.desc_produto.toLowerCase().includes(produto.toLowerCase()))
            );
        }

        const totalPages = Math.ceil(total / limitNum);

        res.json({
            data: enrichedAppointments,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages
        });

    } catch (err) {
        console.error('[TRACKING-HISTORY ERROR]', err.message);
        console.error('[TRACKING-HISTORY STACK]', err.stack);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});





// GET /api/production/estrutura/:codProduto - Estrutura do produto (BOM)
// GET /api/production/estrutura/:codProduto - Estrutura do produto (BOM)
router.get('/estrutura/:codProduto', async (req, res) => {
    try {
        const { codProduto } = req.params;
        const codLimpo = codProduto.replace(/\.(asm|par|psm|dft)$/i, '');
        let finalItems = [];

        console.log(`🔍[ESTRUTURA] Buscando estrutura para: ${codLimpo} (Original: ${codProduto})`);

        // 1. Tentar buscar no Protheus (Postgres) - Fonte Oficial de Engenharia
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
                LIMIT 500;
            `;

            const pgRes = await db.query(pgQuery, [codLimpo]);

            if (pgRes.rows.length > 0) {
                console.log(`✅[ESTRUTURA] Encontrado no Protheus: ${pgRes.rows.length} itens`);

                // Mapeia para o formato esperado pelo frontend e tenta enriquecer com info de arquivos (da tabela local SE)
                finalItems = pgRes.rows.map(row => {
                    const bloqueioSb1 = row.restri_sb1 && ['1', 'S', 'T', 'Y'].includes(row.restri_sb1.trim());
                    const restricaoSz0 = row.restri_sz0 === 'P';
                    const isRestricted = bloqueioSb1 || restricaoSz0;
                    return {
                        nivel: row.nivel,
                        codigo: row.codigo,
                        descricao: row.descricao,
                        unidade: row.unidade,
                        tipo_produto: row.tipo_produto,
                        rev_metalfisa: row.rev_metalfisa,
                        rev_cliente: row.rev_cliente,
                        is_restricted: isRestricted,
                        restri_sb1: bloqueioSb1 ? (row.restri_sb1 || '').trim() : '',
                        restri_sz0: restricaoSz0 ? 'P' : '',
                        qtd_necessaria: Number(row.qtd_necessaria),
                        tem_arquivos: false,
                        primeiro_arquivo: null
                    };
                });
            }
        } catch (pgError) {
            console.error('⚠️ [ESTRUTURA] Erro ao consultar Protheus, tentando fallback MySQL:', pgError.message);
        }

        // 2. Fallback: Buscar no histórico de OS do MySQL (SE não encontrou no Protheus)
        if (finalItems.length === 0) {
            console.log('⚠️ [ESTRUTURA] Produto não encontrado no Protheus. Tentando histórico de OS (MySQL)...');

            const [osRows] = await mysqlPool.execute(
                `SELECT i.IdOrdemServico
                FROM ordemservicoitem i
WHERE(i.CodMatFabricante = ? OR i.CodMatFabricante = ?) AND i.ProdutoPrincipal = 'SIM'
                ORDER BY CAST(i.IdOrdemServico AS UNSIGNED) DESC
                LIMIT 1`,
                [codProduto, codLimpo]
            );

            if (osRows.length > 0) {
                const idOS = osRows[0].IdOrdemServico;
                console.log(`✅[ESTRUTURA] Usando OS ${idOS} como referência.`);

                const [itemsMysql] = await mysqlPool.execute(
                    `SELECT i.Nivel, i.CodMatFabricante, i.DescResumo,
    i.QtdeTotal, i.qtde, i.Unidade, i.TxtTipoDesenho
                    FROM ordemservicoitem i
                    WHERE i.IdOrdemServico = ?
    AND(i.ProdutoPrincipal IS NULL OR i.ProdutoPrincipal != 'SIM')
                    ORDER BY i.Nivel ASC, i.IdOrdemServicoItem ASC`,
                    [idOS]
                );

                // Mapeia para formato padrão
                finalItems = itemsMysql.map(i => ({
                    nivel: i.Nivel,
                    codigo: i.CodMatFabricante,
                    descricao: i.DescResumo,
                    unidade: i.Unidade,
                    qtd_necessaria: i.QtdeTotal || i.qtde,
                    tem_arquivos: false,
                    primeiro_arquivo: null
                }));
            } else {
                console.log('❌ [ESTRUTURA] Nenhuma OS encontrada, retornando vazio.');
            }
        }

        // 3. Enriquecimento Unificado com Documentos (MySQL - produtos_docs)
        if (finalItems.length > 0) {
            try {
                const codigos = [...new Set(finalItems.map(i => i.codigo))];
                if (codigos.length > 0) {
                    const placeholders = codigos.map(() => '?').join(',');

                    const [docs] = await mysqlPool.execute(
                        `SELECT produto_codigo, url_arquivo 
                         FROM produtos_docs 
                         WHERE produto_codigo IN(${placeholders})
                         ORDER BY id DESC`,
                        codigos
                    );

                    const docsMap = {};
                    docs.forEach(d => {
                        if (!docsMap[d.produto_codigo]) {
                            docsMap[d.produto_codigo] = d.url_arquivo;
                        }
                    });

                    finalItems.forEach(i => {
                        if (docsMap[i.codigo]) {
                            i.tem_arquivos = true;
                            i.primeiro_arquivo = docsMap[i.codigo];
                        }
                    });
                }
            } catch (docErr) {
                console.error('⚠️ [ESTRUTURA] Erro ao buscar documentos:', docErr.message);
            }
        }

        // 4. Enriquecimento com Referências (Protheus - SZ1010)
        if (finalItems.length > 0) {
            try {
                const codigos = [...new Set(finalItems.map(i => i.codigo))];
                if (codigos.length > 0) {
                    const placeholders = codigos.map((_, i) => `$${i + 1} `).join(',');

                    const szQuery = `
SELECT
TRIM(z1_produto) as produto,
    TRIM(z1_codcli) as desenho,
    TRIM(z1_nomecli) as cliente,
    TRIM(z1_revisao) as revisao
                        FROM public.sz1010 
                        WHERE TRIM(z1_produto) IN(${placeholders}) 
                        AND TRIM(COALESCE(d_e_l_e_t_, '')) <> '*'
    `;

                    const szRes = await db.query(szQuery, codigos);

                    const refMap = {};
                    szRes.rows.forEach(r => {
                        if (!refMap[r.produto]) refMap[r.produto] = [];
                        refMap[r.produto].push(r);
                    });

                    finalItems.forEach(i => {
                        i.referencias = refMap[i.codigo] || [];
                    });
                }
            } catch (szErr) {
                console.error('⚠️ [ESTRUTURA] Erro ao buscar referências SZ1:', szErr.message);
            }
        }

        res.json(finalItems);

    } catch (err) {
        console.error('[ESTRUTURA ERROR]', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;


// GET /api/production/analytics/apontamento-usuario - Appoints by User/Process for OP
router.get('/analytics/apontamento-usuario', async (req, res) => {
    try {
        const { data_inicio, data_fim, usuario, processo, grupo_por = 'usuario' } = req.query;

        let whereClause = `WHERE data_fim IS NOT NULL`;
        const params = [];

        if (data_inicio && data_fim) {
            whereClause += ` AND DATE(data_fim) BETWEEN ? AND ? `;
            params.push(data_inicio, data_fim);
        }

        if (usuario) {
            whereClause += ` AND UPPER(TRIM(usuario)) = UPPER(TRIM(?))`;
            params.push(usuario);
        }

        if (processo) {
            whereClause += ` AND operacao_codigo = ? `;
            params.push(processo);
        }

        console.log('📊 [OP DASHBOARD] Query params:', { data_inicio, data_fim, usuario, processo, grupo_por });

        const sql = `
                SELECT
UPPER(TRIM(usuario)) AS usuario,
    DATE(data_fim) AS data_apontamento,
        operacao_codigo AS cod_processo,
            GROUP_CONCAT(DISTINCT op_numero ORDER BY op_numero SEPARATOR ',') AS os_ids,
                COUNT(*) AS qtd_apontamentos,
                    SUM(quantidade) AS total_produzido,
                        SUM(quantidade) AS total_previsto
                FROM app_production_appointments
                ${whereClause}
                GROUP BY
UPPER(TRIM(usuario)),
    DATE(data_fim),
    operacao_codigo
                ORDER BY 
                    data_apontamento DESC,
    usuario ASC,
        qtd_apontamentos DESC
            `;

        const [rows] = await mysqlPool.query(sql, params);

        // Grouping logic (Unified for User or Process)
        const result = [];
        const mapAgrupador = {};

        rows.forEach(r => {
            const userName = r.usuario || 'NÃO IDENTIFICADO';
            const processName = r.cod_processo || 'NÃO IDENTIFICADO';

            const groupKey = grupo_por === 'processo' ? processName : userName;
            const detailName = grupo_por === 'processo' ? userName : processName;

            if (!mapAgrupador[groupKey]) {
                mapAgrupador[groupKey] = {
                    chave: groupKey,
                    total_geral: 0,
                    dias: []
                };
                result.push(mapAgrupador[groupKey]);
            }

            const groupObj = mapAgrupador[groupKey];
            const dataIso = r.data_apontamento instanceof Date
                ? r.data_apontamento.toISOString().split('T')[0]
                : String(r.data_apontamento).slice(0, 10);

            if (dataIso === 'Invalid Da' || dataIso === 'null') {
                console.warn('⚠️ [OP DASHBOARD] Invalid data_apontamento:', r.data_apontamento);
            }

            let dayObj = groupObj.dias.find(d => d.data === dataIso);
            if (!dayObj) {
                dayObj = {
                    data: dataIso,
                    total_dia: 0,
                    detalhes: []
                };
                groupObj.dias.push(dayObj);
            }

            const produzido = Number(r.total_produzido) || 0;
            groupObj.total_geral += produzido;
            dayObj.total_dia += produzido;

            dayObj.detalhes.push({
                identificador: detailName,
                nome: detailName, // Could be enhanced with full name later
                qtd_apontamentos: Number(r.qtd_apontamentos) || 0,
                total_produzido: produzido,
                total_previsto: Number(r.total_previsto) || 0,
                os_ids: r.os_ids ? r.os_ids.split(',').map(x => x.trim()).filter(Boolean) : [],
                amostras_pecas: '' // Not applicable for OP
            });
        });

        // Get unique users for the filter dropdown
        const [usersRows] = await mysqlPool.query(`
                SELECT DISTINCT UPPER(TRIM(usuario)) as usuario 
                FROM app_production_appointments 
                WHERE usuario IS NOT NULL AND usuario != ''
                ORDER BY usuario
    `);
        const usuariosLista = usersRows.map(u => u.usuario);

        const [processRows] = await mysqlPool.query(`
                SELECT DISTINCT operacao_codigo as processo 
                FROM app_production_appointments 
                WHERE operacao_codigo IS NOT NULL AND operacao_codigo != ''
                ORDER BY processo
    `);
        const processosLista = processRows.map(p => p.processo);

        res.json({
            grupos: result,
            usuarios_lista: usuariosLista,
            processos_lista: processosLista
        });

    } catch (err) {
        console.error('[APONTAMENTO_USUARIO ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

