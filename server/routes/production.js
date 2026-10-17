const express = require('express');
const router = express.Router();
const db = require('../db'); // Postgres (Protheus)
const mysqlPool = require('../services/mysqlService'); // MySQL (App)
const { getTenantContext } = require('../util/authHelper');
const { getInactiveOrdersFilter } = require('../util/pedidoFilterHelper');
const { hasFinancialAccess } = require('../util/permissionHelper');
const nodemailer = require('nodemailer');
const { getCorporateEmailTemplate } = require('../utils/emailTemplate');

// GET /api/production/analytics-dashboard - Production Analytics Dashboard


// GET /api/production/analytics/evolution - Daily Production Evolution
router.get('/analytics/evolution', async (req, res) => {
    try {
        const { startDate, endDate, sector, user } = req.query;

        const effectiveStart = startDate || new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
        const effectiveEnd = endDate || new Date().toISOString().split('T')[0];
        console.log('📈 [EVOLUTION] Filters:', { startDate: effectiveStart, endDate: effectiveEnd, sector, user });

        let whereClauses = [`a.data_fim IS NOT NULL`];
        let params = [];

        whereClauses.push(`a.data_fim >= ?`);
        params.push(`${effectiveStart} 00:00:00`);

        whereClauses.push(`a.data_fim <= ?`);
        params.push(`${effectiveEnd} 23:59:59`);
        if (user) {
            whereClauses.push(`a.usuario = ?`);
            params.push(user);
        }

        const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // 1. Fetch ALL matching appointments
        const appsQuery = `
            SELECT 
                DATE(a.data_fim) as date,
                a.usuario,
                a.op_numero,
                a.operacao_codigo,
                SUM(a.quantidade) as qtd,
                COUNT(*) as count
            FROM app_production_appointments a
            ${whereSQL}
            GROUP BY DATE(a.data_fim), a.usuario, a.op_numero, a.operacao_codigo
        `;
        const [rawApps] = await mysqlPool.query(appsQuery, params);

        // 2. Fetch Postgres Routing Data for these OPs
        const opNumbers = [...new Set(rawApps.map(a => a.op_numero))].filter(Boolean);
        const opRoutingMap = {}; // KEY: op_numero_codigo -> recurso_codigo

        if (opNumbers.length > 0) {
            const pgQuery = `
                SELECT 
                    TRIM(c2.c2_num) as op,
                    TRIM(g2.g2_operac) as codigo_operacao,
                    TRIM(g2.g2_recurso) as recurso_codigo
                FROM public.sc2010 c2
                JOIN public.sg2010 g2 ON TRIM(g2.g2_produto) = TRIM(c2.c2_produto)
                WHERE TRIM(c2.c2_num) = ANY($1)
                AND COALESCE(c2.d_e_l_e_t_,'') IN ('', ' ')
                AND COALESCE(g2.d_e_l_e_t_,'') IN ('', ' ')
            `;
            const pgRes = await db.query(pgQuery, [opNumbers.map(o => String(o).padStart(6, '0'))]);

            for (const r of pgRes.rows) {
                opRoutingMap[`${r.op}_${r.codigo_operacao}`] = r.recurso_codigo;
            }
        }

        // 3. Fetch MySQL Sectors Data
        const [setores] = await mysqlPool.query(`SELECT id, nome FROM pcp_setores ORDER BY nome`);
        const [recursos] = await mysqlPool.query(`SELECT setor_id, recurso_codigo FROM pcp_setor_recursos`);

        const recToSector = {};
        const sectorDict = {};
        for (const s of setores) sectorDict[s.id] = s.nome;
        for (const r of recursos) {
            recToSector[r.recurso_codigo?.trim()?.toUpperCase()] = {
                id: String(r.setor_id),
                nome: sectorDict[r.setor_id] || 'Desconhecido'
            };
        }

        // 4. Enrich, Filter and Aggregate
        const aggregatedByDate = {};
        const aggregatedGrid = {};

        for (const app of rawApps) {
            const opPad = String(app.op_numero).padStart(6, '0');
            const rec = opRoutingMap[`${opPad}_${app.operacao_codigo}`];
            const sectorObj = rec ? recToSector[rec.toUpperCase()] : null;

            const appSetorId = sectorObj ? sectorObj.id : null;
            const appSetorNome = sectorObj ? sectorObj.nome : 'Sem Setor';

            // Apply Sector Filter
            if (sector && appSetorId !== String(sector)) {
                continue;
            }

            const dateStr = app.date instanceof Date ? app.date.toISOString().split('T')[0] : app.date;

            if (!aggregatedByDate[dateStr]) aggregatedByDate[dateStr] = 0;
            aggregatedByDate[dateStr] += Number(app.qtd);

            const gridKey = `${dateStr}_${app.usuario}_${appSetorNome}`;
            if (!aggregatedGrid[gridKey]) {
                aggregatedGrid[gridKey] = {
                    date: dateStr,
                    usuario: app.usuario,
                    setor: appSetorNome,
                    qtd: 0,
                    count: 0
                };
            }
            aggregatedGrid[gridKey].qtd += Number(app.qtd);
            aggregatedGrid[gridKey].count += Number(app.count);
        }

        const chartDataArray = Object.keys(aggregatedByDate).sort().map(d => {
            return {
                date: d,
                total: aggregatedByDate[d],
                details: Object.values(aggregatedGrid).filter(g => g.date === d)
            };
        });

        const [usersData] = await mysqlPool.query(`SELECT DISTINCT Login FROM usuario ORDER BY Login`);

        res.json({
            chartData: chartDataArray,
            sectors: setores, // Pass objects {id, nome}
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
            appointmentParams.push(`${data_inicio} 00:00:00`);
        }
        if (data_fim) {
            appointmentFilters.push(`a.data_fim <= ?`);
            appointmentParams.push(`${data_fim} 23:59:59`);
        }
        if (op) {
            appointmentFilters.push(`a.op_numero = ?`);
            appointmentParams.push(String(op).trim().padStart(6, '0'));
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
            const paddedPedido = pedido.trim().padStart(6, '0');
            conditions.push(`c2.c2_pedido LIKE $${paramCount}`);
            protheusParams.push(`${paddedPedido}%`);
            paramCount++;
        }
        if (op) {
            const paddedOp = op.trim().padStart(6, '0');
            conditions.push(`c2.c2_num LIKE $${paramCount}`);
            protheusParams.push(`${paddedOp}%`);
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
            opScopeClause = `( ${criteriaClause} OR TRIM(c2.c2_num) = ANY($${paramCount}::text[]) )`;
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
router.get('/analytics-dashboard', async (req, res) => {
    try {
        const { pedido_venda, cliente: clienteFilter, ped_cliente, op, produto, data_inicio, processo } = req.query;

        console.log(`📊 [ANALYTICS] Filters:`, { pedido_venda, cliente: clienteFilter, ped_cliente, op, produto });

        const getInactiveFilter = await getInactiveOrdersFilter();
        let whereClause = `WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ') ${getInactiveFilter('c2.c2_pedido')}`;
        const params = [];
        let paramCount = 1;

        if (pedido_venda) {
            const paddedPedido = pedido_venda.trim().padStart(6, '0');
            whereClause += ` AND c2.c2_pedido LIKE $${paramCount}`;
            params.push(`${paddedPedido}%`);
            paramCount++;
        }

        if (data_inicio) {
            whereClause += ` AND c2.c2_datpri >= $${paramCount}`;
            params.push(data_inicio.replace(/-/g, ''));
            paramCount++;
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

        if (op) {
            // Use exact padded match for better indexing
            const paddedOp = op.trim().padStart(6, '0');
            whereClause += ` AND c2.c2_num LIKE $${paramCount}`;
            params.push(`${paddedOp}%`);
            paramCount++;
        }

        if (produto) {
            whereClause += ` AND (sc6.c6_produto ILIKE $${paramCount} OR sc6.c6_descri ILIKE $${paramCount} OR c2.c2_produto ILIKE $${paramCount})`;
            params.push(`%${produto}%`);
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
                TRIM(c2.c2_produto) AS cod_produto_op,
                c2.c2_quant::numeric AS qtd_planejada_op,
                sc5.c5_cliente AS cod_cliente,
                sa1.a1_nome AS nome_cliente,
                (TRIM(parent.c2_pedido) || ' ') || TRIM(parent.c2_obs) AS raw_pedido_obs,
                parent.c2_itempv AS item_pedido,
                sc6.c6_produto AS produto_item,
                TRIM(sc6.c6_descri) AS desc_produto,
                sc6.c6_entreg AS data_entrega_item
            FROM public.sc2010 c2
            INNER JOIN ParentOPs parent ON parent.c2_num = c2.c2_num
            LEFT JOIN public.sc5010 sc5 ON sc5.c5_num = TRIM(parent.c2_pedido) 
                AND COALESCE(sc5.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sc6010 sc6 ON sc6.c6_num = TRIM(parent.c2_pedido)
                AND sc6.c6_item = parent.c2_itempv
                AND COALESCE(sc6.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sa1010 sa1 ON sa1.a1_cod = sc5.c5_cliente 
                AND sa1.a1_loja = sc5.c5_lojacli 
                AND COALESCE(sa1.d_e_l_e_t_, '') IN ('', ' ')
            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
            ORDER BY parent.c2_itempv, c2.c2_num, c2.c2_sequen
            LIMIT 500
        `;

        const pgRes = await db.query(pgQuery, params);
        const rawOps = pgRes.rows;

        // 1B. Fetch Routing Data (sg2010) safely using array lookup
        const productList = [...new Set(rawOps.map(op => op.cod_produto_op))].filter(Boolean);
        let routingMap = {};

        if (productList.length > 0) {
            const sgQuery = `
                SELECT 
                    TRIM(g2.g2_produto) as produto,
                    TRIM(g2.g2_operac) as operacao,
                    TRIM(g2.g2_recurso) as recurso,
                    TRIM(g2.g2_descri) as desc_operacao
                FROM public.sg2010 g2
                WHERE TRIM(g2.g2_produto) = ANY($1)
                  AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
            `;
            const sgRes = await db.query(sgQuery, [productList]);

            sgRes.rows.forEach(r => {
                if (!routingMap[r.produto]) routingMap[r.produto] = [];
                routingMap[r.produto].push(r);
            });
        }

        // Expand OPs with their routing (simulating the JOIN in memory)
        const operations = [];
        rawOps.forEach(op => {
            const routes = routingMap[op.cod_produto_op] || [];
            if (routes.length === 0) {
                operations.push({
                    ...op,
                    operacao: null,
                    recurso: null,
                    desc_operacao: null
                });
            } else {
                routes.forEach(rt => {
                    operations.push({
                        ...op,
                        operacao: rt.operacao,
                        recurso: rt.recurso,
                        desc_operacao: rt.desc_operacao
                    });
                });
            }
        });

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
                    pedido: (function () {
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

// GET /api/production/fcs-ops
// Retorna TODAS as OPs com saldo pendente (c2_quje < c2_quant) vinculadas a
// pedidos com saldo a faturar (c6_qtdven > c6_qtdent). Usado exclusivamente
// pelo motor FCS (Planejamento Inteligente) — SEM LIMIT, sem filtros de tela.
router.get('/fcs-ops', async (req, res) => {
    let pgClient;
    try {
        pgClient = await db.connect();
        await pgClient.query("SET statement_timeout = '90000'");

        // Pre-fetch inactive pedidos from MySQL to exclude them
        let inactivePedidosSet = new Set();
        try {
            const [settings] = await mysqlPool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'hide_inactive_orders'");
            const hideInactive = !settings.length || settings[0].setting_value === 'true';
            if (hideInactive) {
                const [rows] = await mysqlPool.query("SELECT pedido_numero FROM app_pedidos_inativos");
                inactivePedidosSet = new Set(rows.map(r => r.pedido_numero.trim()));
            }
        } catch (_) { }

        // Query direta no Protheus — sem LIMIT, sem truncamento
        // Joins SC6 para garantir que só OPs com saldo a faturar entram
        const result = await pgClient.query(`
            SELECT DISTINCT
                TRIM(c2.c2_num)       AS op,
                TRIM(c2.c2_item)      AS item_op,
                TRIM(c2.c2_sequen)    AS sequen,
                TRIM(c2.c2_produto)   AS cod_produto_op,
                TRIM(COALESCE(sb1.b1_desc, ''))  AS desc_produto,
                TRIM(COALESCE(NULLIF(TRIM(c2.c2_pedido),''), NULLIF(TRIM(root_op.c2_pedido),''), '')) AS pedido_venda,
                TRIM(COALESCE(NULLIF(TRIM(c2.c2_itempv),''), NULLIF(TRIM(root_op.c2_itempv),''), '')) AS item_pedido,
                TRIM(COALESCE(a1.a1_nome, ''))   AS nome_cliente,
                COALESCE(c2.c2_quant, 0)         AS qtd_planejada_op,
                COALESCE(c2.c2_quje, 0)          AS qtd_apontada_erp
            FROM public.sc2010 c2
            LEFT JOIN public.sc2010 root_op
                ON  root_op.c2_filial  = c2.c2_filial
                AND root_op.c2_num     = c2.c2_num
                AND root_op.c2_item    = c2.c2_item
                AND root_op.c2_sequen  = '001'
                AND COALESCE(root_op.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sb1010 sb1
                ON  sb1.b1_cod = c2.c2_produto
                AND COALESCE(sb1.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sc6010 c6
                ON  c6.c6_filial = c2.c2_filial
                AND c6.c6_num    = COALESCE(NULLIF(c2.c2_pedido,''), root_op.c2_pedido)
                AND c6.c6_item   = COALESCE(NULLIF(c2.c2_itempv,''), root_op.c2_itempv)
                AND COALESCE(c6.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sc5010 c5
                ON  c5.c5_num    = COALESCE(NULLIF(c2.c2_pedido,''), root_op.c2_pedido)
                AND c5.c5_filial = c2.c2_filial
                AND COALESCE(c5.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sa1010 a1
                ON  a1.a1_cod  = c5.c5_cliente
                AND a1.a1_loja = c5.c5_lojacli
                AND COALESCE(a1.d_e_l_e_t_, '') IN ('', ' ')
            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
              AND TRIM(c2.c2_num) <> ''
              AND COALESCE(c2.c2_quant, 0) > 0
              AND COALESCE(c2.c2_quje, 0) < COALESCE(c2.c2_quant, 0)
              AND (
                  -- OPs sem pedido: produção para estoque, sempre incluir
                  TRIM(COALESCE(c2.c2_pedido, '')) = ''
                  -- OPs de pedido: apenas se ainda tem saldo a faturar
                  -- NULLIF+TRIM previne erro de cast em campos Protheus com string vazia
                  OR COALESCE(NULLIF(TRIM(c6.c6_qtdven::text), '')::numeric, 0)
                     - COALESCE(NULLIF(TRIM(c6.c6_qtdent::text), '')::numeric, 0) > 0
              )
            ORDER BY op DESC, item_op, sequen
        `);

        // Filtrar pedidos inativos (JS-side para consistência com o dashboard)
        let rows = result.rows;
        if (inactivePedidosSet.size > 0) {
            rows = rows.filter(r => {
                const pv = (r.pedido_venda || '').trim();
                return !pv || !inactivePedidosSet.has(pv);
            });
        }

        // Deduplicar por OP número (FCS trabalha por OP, não por linha de roteiro)
        const uniqueOpsMap = {};
        rows.forEach(r => {
            if (!uniqueOpsMap[r.op]) uniqueOpsMap[r.op] = r;
        });
        const uniqueOps = Object.values(uniqueOpsMap);

        console.log(`✅ [FCS-OPS] ${rows.length} linhas → ${uniqueOps.length} OPs únicas com saldo pendente.`);

        res.json({
            data: uniqueOps,
            total: uniqueOps.length,
            raw_rows: rows.length
        });
    } catch (err) {
        console.error('❌ [FCS-OPS] Erro:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        if (pgClient) {
            pgClient.query('SET statement_timeout = 45000').catch(() => { });
            pgClient.release();
        }
    }
});

// GET /api/production - List OPs with Planning and Progress
router.get('/', async (req, res) => {
    const t0 = Date.now();
    try {
        const { op, item, sequencia, produto, cliente, operacao, planned_date_start, planned_date_end, setor } = req.query;
        const pedido = req.query.pedido;
        
        // Paginacao
        const limitSql = parseInt(req.query.limit, 10) || 500;
        const offsetSql = parseInt(req.query.offset, 10) || 0;

        // 0. Pre-filter by Planned Dates (MySQL) if provided
        let plannedOpsFilter = null;
        if (planned_date_start || planned_date_end) {
            let planSql = `SELECT op_numero, op_item, op_sequencia, operacao_codigo FROM app_production_planning WHERE 1=1`;
            const planParams = [];
            if (req.query.date_filter_type === 'intersection') {
                if (planned_date_end) {
                    planSql += ` AND data_planejada_inicio <= ?`;
                    planParams.push(planned_date_end + ' 23:59:59');
                }
                if (planned_date_start) {
                    planSql += ` AND data_planejada_fim >= ?`;
                    planParams.push(planned_date_start + ' 00:00:00');
                }
            } else {
                const dateField = req.query.date_filter_type === 'fim' ? 'data_planejada_fim' : 'data_planejada_inicio';
                if (planned_date_start) { planSql += ` AND ${dateField} >= ?`; planParams.push(planned_date_start + ' 00:00:00'); }
                if (planned_date_end) { planSql += ` AND ${dateField} <= ?`; planParams.push(planned_date_end + ' 23:59:59'); }
            }
            const [plannedRows] = await mysqlPool.execute(planSql, planParams, 5000);
            if (plannedRows.length === 0) return res.json({ data: [], total: 0 });
            plannedOpsFilter = plannedRows;
        }

        // 1. Pre-fetch inactive pedidos from MySQL (applied as JS filter later)
        let inactivePedidosSet = new Set();
        try {
            const [settings] = await mysqlPool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'hide_inactive_orders'");
            const hideInactive = !settings.length || settings[0].setting_value === 'true';
            if (hideInactive) {
                const [rows] = await mysqlPool.query("SELECT pedido_numero FROM app_pedidos_inativos");
                inactivePedidosSet = new Set(rows.map(r => r.pedido_numero.trim()));
            }
        } catch (_) { }

        // 2. Build Stage 1 conditions (SC2010 + root_op + SB1010 only — no SC5/SA1/SC6)
        const params = [];
        let pn = 1;
        const s1Conds = [`COALESCE(c2.d_e_l_e_t_,'') IN ('', ' ')`];

        // Excluir OPs fracionadas
        let fracExclude = '';
        try {
            const [fracOps] = await mysqlPool.execute('SELECT op_base FROM app_ind_producao_ativa', [], 5000);
            if (fracOps.length > 0) {
                const bases = fracOps.map(r => r.op_base);
                fracExclude = `AND (c2.c2_num || c2.c2_item) <> ALL($${pn})`;
                params.push(bases);
                pn++;
            }
        } catch (_) { }

        // Date cutoff (18 months) — always applied to keep query bounded
        // c2_datpri is stored as YYYYMMDD (char), safe to compare without TRIM
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - 18);
        const cutoffStr = cutoffDate.toISOString().slice(0, 10).replace(/-/g, '');
        // Inject planned dates OPs into Postgres to prevent LIMIT truncation
        if (plannedOpsFilter && plannedOpsFilter.length > 0) {
            const plannedOpNums = [...new Set(plannedOpsFilter.map(p => (p.op_numero || '').trim().padEnd(6, ' ')))];
            s1Conds.push(`c2.c2_num = ANY($${pn})`);
            params.push(plannedOpNums);
            pn++;
        }

        // Only apply date cutoff when no specific OP/pedido/item/planned filter — those are already selective
        const hasSelectiveFilter = !!(op || pedido || item || plannedOpsFilter);
        if (!hasSelectiveFilter) {
            s1Conds.push(`c2.c2_datpri >= '${cutoffStr}'`);
        }

        // Simple text filters in Stage 1
        if (op) {
            const opArr = op.split(',').map(s => s.trim()).filter(Boolean);
            if (opArr.length === 1) {
                const paddedOp = opArr[0].padStart(6, '0');
                s1Conds.push(`TRIM(c2.c2_num) = $${pn++}`);
                params.push(paddedOp);
            } else if (opArr.length > 1) {
                const paddedOps = opArr.map(s => s.padStart(6, '0'));
                s1Conds.push(`TRIM(c2.c2_num) = ANY($${pn})`);
                params.push(paddedOps);
                pn++;
            }
        }
        if (pedido) {
            const paddedPedido = pedido.trim().padStart(6, '0');
            s1Conds.push(`(TRIM(c2.c2_pedido) = $${pn} OR TRIM(root_op.c2_pedido) = $${pn})`);
            params.push(paddedPedido);
            pn++;
        }
        if (item) {
            const itemArr = item.split(',').map(s => s.trim()).filter(Boolean);
            if (itemArr.length === 1) {
                s1Conds.push(`TRIM(c2.c2_item) ILIKE $${pn++}`);
                params.push(`%${itemArr[0]}%`);
            } else if (itemArr.length > 1) {
                // Exact match for each value (items are usually '01', '02', etc.)
                const placeholders = itemArr.map((_, i) => `TRIM(c2.c2_item) ILIKE $${pn + i}`).join(' OR ');
                s1Conds.push(`(${placeholders})`);
                for (const it of itemArr) { params.push(`%${it}%`); }
                pn += itemArr.length;
            }
        }
        if (sequencia) { s1Conds.push(`TRIM(c2.c2_sequen) ILIKE $${pn++}`); params.push(`%${sequencia.trim()}%`); }
        if (produto) {
            s1Conds.push(`TRIM(c2.c2_produto) = $${pn}`);
            params.push(produto.trim().toUpperCase());
            pn++;
        }

        // Setor/operação: pre-fetch produtos correspondentes em SG2010 (query separada, evita subquery lenta)
        if (operacao || setor) {
            let recursoArray = [];
            const operacaoArray = operacao ? operacao.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : [];
            if (setor) {
                try {
                    const [sectorRecs] = await mysqlPool.execute(`SELECT recurso_codigo FROM pcp_setor_recursos WHERE setor_id = ?`, [setor], 3000);
                    recursoArray = sectorRecs.length > 0
                        ? sectorRecs.map(r => r.recurso_codigo?.trim()?.toUpperCase()).filter(Boolean)
                        : ['___NO_MATCH___'];
                } catch (e) { console.error('Erro ao buscar recursos do setor:', e.message); }
            }

            const sgConds = [];
            const sgParams = [];
            let sgPn = 1;

            if (recursoArray.length > 0) {
                sgConds.push(`TRIM(g2_recurso) = ANY($${sgPn})`);
                sgParams.push(recursoArray);
                sgPn++;
            }
            if (operacaoArray.length > 0) {
                const conds = operacaoArray.map((_, i) => `(TRIM(g2_operac) ILIKE $${sgPn + i} OR g2_descri ILIKE $${sgPn + i} OR TRIM(g2_recurso) ILIKE $${sgPn + i})`);
                sgConds.push(`(${conds.join(' OR ')})`);
                for (const s of operacaoArray) sgParams.push(`%${s}%`);
                sgPn += operacaoArray.length;
            }

            if (sgConds.length > 0) {
                try {
                    const sgRes = await db.query(`
                        SELECT DISTINCT TRIM(g2_produto) AS cod
                        FROM public.sg2010
                        WHERE COALESCE(d_e_l_e_t_,'') IN ('', ' ')
                        AND (${sgConds.join(' AND ')})
                    `, sgParams);
                    const matchingProdCodes = sgRes.rows.map(r => r.cod).filter(Boolean);
                    if (matchingProdCodes.length > 0) {
                        s1Conds.push(`TRIM(c2.c2_produto) = ANY($${pn})`);
                        params.push(matchingProdCodes);
                        pn++;
                    } else {
                        return res.json({ data: [], total: 0 });
                    }
                } catch (e) { console.error('Erro ao pré-filtrar setor/operacao:', e.message); }
            }
        }

        // Stage 2 filter: cliente (applied after enrichment)
        let clienteClause = '';
        if (cliente) {
            clienteClause = `AND (a1.a1_nome ILIKE $${pn} OR a1.a1_nreduz ILIKE $${pn} OR c5.c5_cliente ILIKE $${pn})`;
            params.push(`%${cliente.trim().toUpperCase()}%`); pn++;
        }

        // Stage 2 filter: Default behavior is to ALWAYS hide orders with no balance to bill (c6_qtdven - c6_qtdent <= 0),
        // unless they specifically check "pending_delivery = false" which we'll ignore for now since they want it always off.
        // We also keep stock OPs (pedido_raw IS NULL) unless explicitly requested to hide.
        const pendingClause = `AND (ob.pedido_raw IS NULL OR TRIM(ob.pedido_raw) = '' OR (COALESCE(NULLIF(TRIM(c6.c6_qtdven::text), '')::numeric, 0) - COALESCE(NULLIF(TRIM(c6.c6_qtdent::text), '')::numeric, 0)) > 0)`;


        const s1Where = `WHERE ${s1Conds.join(' AND ')} ${fracExclude}`;

        // 3. Three-stage CTE:
        //   op_base   : SC2010 + root_op (+ SB1 if needed). Fast. LIMIT 5000.
        //   op_enrich : join those 5000 rows with SB1/SC5/SA1/SC6. Apply client+pending filter. LIMIT 500.
        //   final     : join 500 rows with SG2010 + SH1010. Window functions.
        const pgQuery = `
WITH op_base AS (
    SELECT
        c2.c2_num, c2.c2_item, c2.c2_sequen,
        c2.c2_produto AS produto_raw,
        TRIM(c2.c2_produto) AS produto,
        COALESCE(NULLIF(c2.c2_pedido,''), NULLIF(root_op.c2_pedido,'')) AS pedido_raw,
        COALESCE(NULLIF(TRIM(c2.c2_pedido),''), NULLIF(TRIM(root_op.c2_pedido),'')) AS pedido_resolved,
        COALESCE(NULLIF(c2.c2_itempv,''), NULLIF(root_op.c2_itempv,'')) AS itempv_raw,
        COALESCE(NULLIF(TRIM(c2.c2_itempv),''), NULLIF(TRIM(root_op.c2_itempv),'')) AS itempv_resolved,
        c2.c2_filial,
        c2.c2_quant::numeric AS qtd_planejada_op,
        c2.c2_quje::numeric  AS qtd_apontada_erp,
        TRIM(c2.c2_um)       AS um_op
    FROM public.sc2010 c2
    LEFT JOIN public.sc2010 root_op
        ON  root_op.c2_filial = c2.c2_filial
        AND root_op.c2_num    = c2.c2_num
        AND root_op.c2_item   = c2.c2_item
        AND root_op.c2_sequen = '001'
        AND COALESCE(root_op.d_e_l_e_t_,'') IN ('', ' ')
    ${s1Where}
    ORDER BY c2.c2_num DESC, c2.c2_item, c2.c2_sequen
    LIMIT ${limitSql} OFFSET ${offsetSql}
),
op_enrich AS (
    SELECT
        ob.*,
        TRIM(sb1.b1_desc)    AS desc_produto,
        TRIM(sb1.b1_tipo)    AS tipo_produto,
        TRIM(c5.c5_cliente)  AS cod_cliente,
        TRIM(a1.a1_nome)     AS nome_cliente,
        TRIM(a1.a1_nreduz)   AS nome_fantasia,
        TRIM(c6.c6_pedcli)   AS ped_cliente,
        TRIM(c6.c6_entreg)   AS data_entrega_comercial,
        (COALESCE(NULLIF(TRIM(c6.c6_qtdven::text), '')::numeric, 0) - COALESCE(NULLIF(TRIM(c6.c6_qtdent::text), '')::numeric, 0)) AS qtd_faturar
    FROM op_base ob
    LEFT JOIN public.sb1010 sb1
        ON  sb1.b1_cod = ob.produto_raw
        AND COALESCE(sb1.d_e_l_e_t_,'') IN ('', ' ')
    LEFT JOIN public.sc5010 c5
        ON  c5.c5_filial = ob.c2_filial
        AND c5.c5_num = ob.pedido_raw
        AND COALESCE(c5.d_e_l_e_t_,'') IN ('', ' ')
    LEFT JOIN public.sa1010 a1
        ON  a1.a1_cod  = c5.c5_cliente
        AND a1.a1_loja = c5.c5_lojacli
        AND COALESCE(a1.d_e_l_e_t_,'') IN ('', ' ')
    LEFT JOIN public.sc6010 c6
        ON  c6.c6_filial = ob.c2_filial
        AND c6.c6_num  = ob.pedido_raw
        AND c6.c6_item = ob.itempv_raw
        AND COALESCE(c6.d_e_l_e_t_,'') IN ('', ' ')
    WHERE 1=1
    ${clienteClause}
    ${pendingClause}
    ORDER BY ob.c2_num DESC, ob.c2_item, ob.c2_sequen
)
SELECT
    oe.c2_num AS op, oe.c2_item AS item_op, oe.c2_sequen AS sequen,
    oe.produto_raw AS cod_produto_op_raw, oe.produto AS cod_produto_op, oe.pedido_resolved AS pedido_venda,
    oe.desc_produto, oe.tipo_produto, oe.um_op,
    oe.qtd_planejada_op, oe.qtd_apontada_erp, oe.qtd_faturar,
    oe.cod_cliente, oe.nome_cliente, oe.nome_fantasia, oe.ped_cliente, oe.data_entrega_comercial
FROM op_enrich oe
ORDER BY oe.c2_num DESC, oe.c2_item, oe.c2_sequen
        `;

        const pgRes = await db.query(pgQuery, params);
        const opRows = pgRes.rows;

        // Query 2: roteiro dos produtos distintos (IN clause — muito mais rápido que JOIN em 57K rows)
        let routingByProduto = {};
        if (opRows.length > 0) {
            const produtos = [...new Set(opRows.map(r => r.cod_produto_op_raw).filter(Boolean))];
            if (produtos.length > 0) {
                const ph2 = produtos.map((_, i) => `$${i + 1}`).join(',');
                const r2 = await db.query(`
                    SELECT TRIM(g2.g2_produto) AS produto, g2.g2_codigo AS cod_roteiro,
                           g2.g2_operac AS operacao, g2.g2_descri AS desc_operacao,
                           g2.g2_recurso AS recurso, TRIM(h1.h1_descri) AS desc_recurso,
                           g2.g2_tempad, g2.g2_setup
                    FROM public.sg2010 g2
                    LEFT JOIN public.sh1010 h1
                        ON h1.h1_codigo = g2.g2_recurso
                        AND COALESCE(h1.d_e_l_e_t_,'') IN ('', ' ')
                    WHERE g2.g2_produto IN (${ph2})
                    AND COALESCE(g2.d_e_l_e_t_,'') IN ('', ' ')
                    ORDER BY g2.g2_produto, g2.g2_operac
                `, produtos);
                r2.rows.forEach(r => {
                    if (!routingByProduto[r.produto]) routingByProduto[r.produto] = [];
                    routingByProduto[r.produto].push(r);
                });
            }
        }

        // Expand OP rows × routing (prev/next computed in JS — equivalent to LAG/LEAD)
        let ops = opRows.flatMap(row => {
            const routing = routingByProduto[row.cod_produto_op] || [];
            if (routing.length === 0) {
                return [{ ...row, cod_roteiro: null, operacao: null, desc_operacao: null, recurso: null, desc_recurso: null, prev_operacao: null, next_operacao: null, prev_desc_operacao: null, next_desc_operacao: null }];
            }
            return routing.map((r, idx) => ({
                ...row,
                cod_roteiro: r.cod_roteiro,
                operacao: r.operacao,
                desc_operacao: r.desc_operacao,
                recurso: r.recurso,
                desc_recurso: r.desc_recurso,
                tempad: Math.round((parseFloat(r.g2_tempad) || 0) * 1000) / 1000,
                setup: parseFloat(r.g2_setup) || 0,
                prev_operacao: idx > 0 ? routing[idx - 1].operacao : null,
                next_operacao: idx < routing.length - 1 ? routing[idx + 1].operacao : null,
                prev_desc_operacao: idx > 0 ? routing[idx - 1].desc_operacao : null,
                next_desc_operacao: idx < routing.length - 1 ? routing[idx + 1].desc_operacao : null,
            }));
        });

        console.log(`[production GET /] ${opRows.length} OPs + ${ops.length} rows (c/roteiro) em ${Date.now() - t0}ms`);


        // Apply specific operation/recurso filter to the expanded rows
        if (operacao || setor) {
            let recursoArray = [];
            const operacaoArray = operacao ? operacao.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : [];

            if (setor) {
                try {
                    const [sectorRecs] = await mysqlPool.execute(`SELECT recurso_codigo FROM pcp_setor_recursos WHERE setor_id = ?`, [setor], 3000);
                    if (sectorRecs.length > 0) {
                        recursoArray = sectorRecs.map(r => r.recurso_codigo?.trim()?.toUpperCase()).filter(Boolean);
                    } else {
                        recursoArray = ['___NO_MATCH___'];
                    }
                } catch (e) { console.error(e); }
            }

            if (recursoArray.length > 0 || operacaoArray.length > 0) {
                ops = ops.filter(row => {
                    const opName = (row.operacao || '').trim().toUpperCase();
                    const recName = (row.recurso || '').trim().toUpperCase();
                    const descName = (row.desc_operacao || '').trim().toUpperCase();

                    let matchRecurso = recursoArray.length === 0 || recursoArray.includes(recName);

                    let matchOperacao = operacaoArray.length === 0 || operacaoArray.some(val =>
                        opName.includes(val) || descName.includes(val) || recName.includes(val)
                    );

                    if (setor && operacao) {
                        return matchRecurso && matchOperacao;
                    }
                    if (setor) return matchRecurso;
                    if (operacao) return matchOperacao;
                    return true;
                });
            } // fecha: if (recursoArray.length > 0 || operacaoArray.length > 0)
        } // fecha: if (operacao || setor)
        // 3. Apply MySQL pre-filter (planned dates)
        if (plannedOpsFilter) {
            // Re-adding op_sequencia to prevent cross-sequence pollution (e.g., 33/1 bug)
            const plannedSet = new Set(plannedOpsFilter.map(p => `${(p.op_numero || '').trim()}|${(p.op_item || '').trim()}|${(p.op_sequencia || '').trim()}|${(p.operacao_codigo || '').trim()}`));
            ops = ops.filter(row => plannedSet.has(`${(row.op || '').trim()}|${(row.item_op || '').trim()}|${(row.sequen || '').trim()}|${(row.operacao || '').trim()}`));
        }

        // 4. Fetch Plans & Appointments from MySQL — chunks paralelos (2 queries por chunk simultâneas)
        const relevantOpNums = [...new Set(ops.map(o => o.op).filter(Boolean))];
        let plans = [], appointments = [];
        if (relevantOpNums.length > 0) {
            const CHUNK = 500;
            const chunkResults = await Promise.all(
                Array.from({ length: Math.ceil(relevantOpNums.length / CHUNK) }, (_, i) => {
                    const chunk = relevantOpNums.slice(i * CHUNK, (i + 1) * CHUNK);
                    const ph = chunk.map(() => '?').join(',');
                    return Promise.all([
                        mysqlPool.execute(`SELECT * FROM app_production_planning WHERE op_numero IN (${ph})`, chunk),
                        mysqlPool.execute(`
                            SELECT op_numero, op_item, op_sequencia, operacao_codigo,
                                   SUM(quantidade) as total_produzido,
                                   COUNT(*) as num_apontamentos,
                                   SUM(CASE WHEN conferencia_status = 'PENDENTE' THEN 1 ELSE 0 END) as pendencias_conferencia,
                                   MIN(data_inicio) as data_real_inicio,
                                   MAX(data_fim) as data_real_fim,
                                   MAX(data_fim) as ultimo_apontamento
                            FROM app_production_appointments
                            WHERE op_numero IN (${ph})
                            GROUP BY op_numero, op_item, op_sequencia, operacao_codigo
                        `, chunk)
                    ]);
                })
            );
            for (const [[pr], [ar]] of chunkResults) {
                for (const r of pr) plans.push(r);
                for (const a of ar) appointments.push(a);
            }
        }

        // 5. Merge Plans & Appointments (O(1) Maps)
        const mkKey = o => `${(o.op_numero || '').trim()}|${(o.op_item || '').trim()}|${(o.op_sequencia || '').trim()}|${(o.operacao_codigo || '').trim()}`;
        const plansMap = new Map(plans.map(p => [mkKey(p), p]));
        const apptMap = new Map(appointments.map(a => [mkKey(a), a]));

        let mergedOps = ops.map(row => {
            const key = `${(row.op || '').trim()}|${(row.item_op || '').trim()}|${(row.sequen || '').trim()}|${(row.operacao || '').trim()}`;
            const plan = plansMap.get(key);
            const prog = apptMap.get(key);
            return {
                ...row,
                data_planejada_inicio: plan?.data_planejada_inicio || null,
                data_planejada_fim: plan?.data_planejada_fim || null,
                ordem_recurso: plan?.ordem_recurso ?? null,
                selecionado: plan?.selecionado ?? null,
                dias_espera: plan?.dias_espera || 0,
                qtd_produzida_real: prog?.total_produzido || 0,
                tem_pendencia_conferencia: prog ? prog.pendencias_conferencia > 0 : false,
                ultimo_apontamento: prog?.ultimo_apontamento || null,
                data_real_fim: prog?.data_real_fim || null,
            };
        });

        // 6. Apply inactive pedidos filter (JS-side, avoids SQL NULL issues)
        if (inactivePedidosSet.size > 0) {
            mergedOps = mergedOps.filter(row => {
                const pv = (row.pedido_venda || '').trim();
                return !pv || !inactivePedidosSet.has(pv);
            });
        }

        // 7. Apply Status Filter
        const rawStatus = req.query.status || req.query['status[]'];
        if (rawStatus) {
            const statusArray = Array.isArray(rawStatus) ? rawStatus : rawStatus.split(',');
            const now = new Date();
            mergedOps = mergedOps.filter(op => {
                const start = op.data_planejada_inicio ? new Date(op.data_planejada_inicio) : null;
                const end = op.data_planejada_fim ? (() => { const d = new Date(op.data_planejada_fim); d.setHours(23, 59, 59, 999); return d; })() : null;
                const done = Number(op.qtd_produzida_real) >= Number(op.qtd_planejada_op);
                const started = Number(op.qtd_produzida_real) > 0;
                let cur = 'waiting';
                if (done) cur = 'done';
                else if (end && now > end) cur = 'late_delivery';
                else if (start && now > start && !started) cur = 'late_start';
                else if (started) cur = 'in_progress';
                else if (start && end) cur = 'planned';
                return statusArray.includes(cur);
            });
        }

        const total = mergedOps.length;

        // 7. Enrich with Documents (MySQL)
        const productCodes = [...new Set(mergedOps.map(o => (o.cod_produto_op || '').trim().toUpperCase()).filter(Boolean))];
        let docsMap = {};
        if (productCodes.length > 0) {
            try {
                const CHUNK = 500;
                for (let i = 0; i < productCodes.length; i += CHUNK) {
                    const chunk = productCodes.slice(i, i + CHUNK);
                    const ph = chunk.map(() => '?').join(',');
                    const [docs] = await mysqlPool.execute(
                        `SELECT produto_codigo, url_arquivo, area_pintura_m2, operacao FROM produtos_docs WHERE produto_codigo IN (${ph})`,
                        chunk
                    );
                    docs.forEach(d => {
                        const k = (d.produto_codigo || '').trim().toUpperCase();
                        if (!docsMap[k]) docsMap[k] = { url: d.url_arquivo, area: d.area_pintura_m2, operacao: d.operacao };
                    });
                }
            } catch (docErr) { console.error('Doc Error:', docErr.message); }
        }

        // 8. Enrich with PCP Delivery Forecast (última data_entrega_pcp por pedido+item)
        let pcpForecastMap = {};
        try {
            const pedidoItemPairs = [...new Set(mergedOps
                .filter(o => o.pedido_venda)
                .map(o => `${String(o.pedido_venda).trim()}|${String(o.item_op || '').trim()}`)
            )];
            if (pedidoItemPairs.length > 0) {
                const pedidos = [...new Set(mergedOps.map(o => (o.pedido_venda || '').trim()).filter(Boolean))];
                const ph = pedidos.map(() => '?').join(',');
                const [fcRows] = await mysqlPool.execute(
                    `SELECT pedido, item, MAX(data_entrega_pcp) as data_entrega_pcp
                     FROM app_pcp_delivery_forecasts
                     WHERE pedido IN (${ph})
                     GROUP BY pedido, item`,
                    pedidos
                );
                fcRows.forEach(r => {
                    const k = `${String(r.pedido).trim()}|${String(r.item || '').trim()}`;
                    pcpForecastMap[k] = r.data_entrega_pcp;
                });
            }
        } catch (fcErr) { /* tabela pode não existir em ambientes sem forecast */ }

        const finalOps = mergedOps.map(op => {
            const doc = docsMap[(op.cod_produto_op || '').trim().toUpperCase()];
            const fcKey = `${String(op.pedido_venda || '').trim()}|${String(op.item_op || '').trim()}`;
            // Fallback: se não há previsão PCP salva, usa a data de entrega comercial do Protheus (c6_entreg)
            // Converte formato YYYYMMDD → ISO (YYYY-MM-DD) para o frontend processar
            let entregaFallback = null;
            const rawComercial = String(op.data_entrega_comercial || '').trim();
            if (rawComercial.length === 8) {
                entregaFallback = `${rawComercial.slice(0, 4)}-${rawComercial.slice(4, 6)}-${rawComercial.slice(6, 8)}`;
            }
            return {
                ...op,
                doc_url: doc?.url || null,
                tem_arquivos: !!doc?.url,
                area_pintura: doc?.area || null,
                operacao_doc: doc?.operacao || null,
                data_entrega_pcp: pcpForecastMap[fcKey] || entregaFallback || null,
            };
        });

        res.json({ data: finalOps, total });
    } catch (err) {
        console.error('[production GET /] ERROR:', err.message, err.stack);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/production/matrix - Matrix View (Items as Rows, Operations as Columns)
router.get('/matrix', async (req, res) => {
    let pgClient = null;
    try {
        pgClient = await db.connect();
        await pgClient.query("SET client_encoding TO 'WIN1252'");

        const { op, produto, cliente, pedido, operacao, data_inicio, data_fim } = req.query;

        if (!op && !produto && !cliente && !pedido && !operacao && !data_inicio && !data_fim) {
            return res.status(400).json({
                success: false,
                error: 'Informe ao menos um filtro (op, produto, cliente, pedido ou operacao) para carregar a matriz.'
            });
        }

        console.log('📊 [MATRIX] Fetching matrix view data...');

        const params = [];
        let paramCount = 1;

        // Pre-filter by produto
        let prodCond = '';
        if (produto) {
            try {
                const prodMatchRes = await pgClient.query(`
                    SELECT TRIM(b1_cod) as cod
                    FROM public.sb1010
                    WHERE (b1_cod ILIKE $1 OR b1_desc ILIKE $1)
                    AND COALESCE(d_e_l_e_t_, '') IN ('', ' ')
                `, [`%${produto.trim().toUpperCase()}%`]);
                const matchingProdCodes = prodMatchRes.rows.map(r => r.cod).filter(Boolean);
                if (matchingProdCodes.length > 0) {
                    prodCond = `AND TRIM(c2.c2_produto) = ANY($${paramCount++})`;
                    params.push(matchingProdCodes);
                } else {
                    prodCond = `AND 1=0`;
                }
            } catch (err) {
                console.error('Erro ao pré-filtrar produtos matrix:', err);
            }
        }

        // Pre-filter by operacao
        let opCond = '';
        if (operacao) {
            try {
                const sgRes = await pgClient.query(`
                    SELECT DISTINCT TRIM(g2_produto) as cod
                    FROM public.sg2010
                    WHERE COALESCE(d_e_l_e_t_,'') IN ('', ' ')
                    AND (TRIM(g2_operac) = $1 OR TRIM(g2_recurso) ILIKE $1 OR g2_descri ILIKE $1)
                `, [operacao.trim()]);
                const matchingOpsCodes = sgRes.rows.map(r => r.cod).filter(Boolean);
                if (matchingOpsCodes.length > 0) {
                    opCond = `AND TRIM(c2.c2_produto) = ANY($${paramCount++})`;
                    params.push(matchingOpsCodes);
                } else {
                    opCond = `AND 1=0`;
                }
            } catch (err) {
                console.error('Erro ao pré-filtrar operacoes matrix:', err);
            }
        }

        // -------------------------------------------------------------
        // FONTE 1: Banco Novo (MySQL - erp_ordens_producao e operacoes)
        // -------------------------------------------------------------
        let mysqlItems = [];
        let mysqlRoutings = [];
        try {
            let myConditions = ['1=1'];
            let myParams = [];

            if (op) {
                const cleanOp = String(op).trim();
                myConditions.push('(p.numero_op LIKE ? OR SUBSTRING(p.numero_op, 1, 6) = ?)');
                myParams.push(`%${cleanOp}%`, cleanOp);
            }

            if (pedido) {
                const pStr = String(pedido).trim().padStart(6, '0');
                myConditions.push('(p.pedido_venda = ? OR p.pedido_venda = ?)');
                myParams.push(pStr, String(parseInt(pStr, 10) || pStr));
            }

            if (produto) {
                const prodTrim = String(produto).trim();
                myConditions.push('(p.produto_codigo LIKE ?)');
                myParams.push(`%${prodTrim}%`);
            }

            const [myRows] = await mysqlPool.query(`
                SELECT 
                    SUBSTRING(p.numero_op, 1, 6) AS op,
                    SUBSTRING(p.numero_op, 7, 2) AS item_op,
                    SUBSTRING(p.numero_op, 9, 3) AS sequencia,
                    p.produto_codigo AS cod_produto,
                    p.pedido_venda,
                    p.quantidade_planejada AS qtd_planejada_item,
                    p.numero_op
                FROM erp_ordens_producao p
                WHERE ${myConditions.join(' AND ')}
                ORDER BY p.pedido_venda ASC, p.item_pedido ASC, p.numero_op ASC
                LIMIT 100
            `, myParams);

            if (myRows && myRows.length > 0) {
                const peds = [...new Set(myRows.map(r => String(r.pedido_venda || '').trim()).filter(Boolean))];
                const prods = [...new Set(myRows.map(r => String(r.cod_produto || '').trim()).filter(Boolean))];
                const fullOps = myRows.map(r => r.numero_op);

                let clientMap = new Map();
                if (peds.length > 0) {
                    try {
                        const { rows: cliRows } = await db.query(`
                            SELECT TRIM(c5.c5_num) as pedido, TRIM(c5.c5_cliente) as cod_cliente, TRIM(sa1.a1_nome) as nome_cliente
                            FROM public.sc5010 c5
                            LEFT JOIN public.sa1010 sa1 ON sa1.a1_cod = c5.c5_cliente AND sa1.a1_loja = c5.c5_lojacli AND COALESCE(sa1.d_e_l_e_t_, '') = ''
                            WHERE TRIM(c5.c5_num) = ANY($1) AND COALESCE(c5.d_e_l_e_t_, '') = ''
                        `, [peds]);
                        cliRows.forEach(c => clientMap.set(c.pedido, c));
                    } catch (_) {}
                }

                let prodMap = new Map();
                if (prods.length > 0) {
                    const [pDbRows] = await mysqlPool.query(`SELECT codigo, descricao FROM erp_produtos WHERE codigo IN (?)`, [prods]);
                    pDbRows.forEach(p => prodMap.set(String(p.codigo).trim(), p.descricao));
                    try {
                        const { rows: sbRows } = await db.query(
                            `SELECT TRIM(b1_cod) as cod, TRIM(b1_desc) as descri FROM public.sb1010 WHERE TRIM(b1_cod) = ANY($1)`,
                            [prods]
                        );
                        sbRows.forEach(sb => { if (!prodMap.has(sb.cod)) prodMap.set(sb.cod, sb.descri); });
                    } catch (_) {}
                }

                mysqlItems = myRows.map(r => {
                    const cli = clientMap.get(r.pedido_venda) || {};
                    return {
                        op: r.op,
                        item_op: r.item_op,
                        sequencia: r.sequencia,
                        cod_produto: r.cod_produto,
                        pedido_venda: r.pedido_venda,
                        desc_produto: prodMap.get(r.cod_produto) || '',
                        qtd_planejada_item: parseFloat(r.qtd_planejada_item) || 0,
                        nome_cliente: cli.nome_cliente || '',
                        cod_cliente: cli.cod_cliente || ''
                    };
                });

                const [myOps] = await mysqlPool.query(`
                    SELECT 
                        SUBSTRING(o.numero_op, 1, 6) as op,
                        SUBSTRING(o.numero_op, 7, 2) as item_op,
                        SUBSTRING(o.numero_op, 9, 3) as sequen,
                        o.produto_codigo as cod_produto,
                        o.quantidade_planejada as qtd_planejada,
                        o.operacao_seq as operacao,
                        o.codigo_recurso as recurso,
                        COALESCE(o.descricao_operacao, '') as desc_operacao,
                        o.codigo_recurso as master_desc_recurso
                    FROM erp_ordens_producao_operacoes o
                    WHERE o.numero_op IN (?)
                    ORDER BY o.numero_op ASC, CAST(o.operacao_seq AS UNSIGNED) ASC
                `, [fullOps]);

                mysqlRoutings = myOps.map(o => ({
                    ...o,
                    master_desc_recurso: o.recurso === 'MO0013' ? 'LASE' : (o.desc_operacao || o.recurso)
                }));
            }
        } catch (myErr) {
            console.error('⚠️ [MATRIX] Erro ao buscar OPs do MySQL:', myErr.message);
        }

        // -------------------------------------------------------------
        // FONTE 2: Protheus Legado (PostgreSQL - sc2010)
        // -------------------------------------------------------------
        let pgItems = [];
        let pgRoutings = [];
        let skipPgSearch = false;

        if (pedido) {
            const paddedPedido = pedido.trim().padStart(6, '0');
            try {
                const { rows: pgOrderOps } = await pgClient.query(
                    `SELECT DISTINCT TRIM(c2_num) as num FROM public.sc2010 WHERE TRIM(c2_pedido) = $1 AND COALESCE(d_e_l_e_t_, '') = ''`,
                    [paddedPedido]
                );
                if (pgOrderOps.length === 0) {
                    skipPgSearch = true;
                }
            } catch (_) {}
        }

        if (!skipPgSearch) {
            let pgQuery = `
                WITH filtered_ops AS (
                    SELECT DISTINCT
                        c2.c2_num,
                        c2.c2_item
                    FROM public.sc2010 c2
                    WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
                    AND TRIM(c2.c2_num) != ''
                    AND c2.c2_datpri >= '20240101'
            `;

            if (data_inicio) {
                pgQuery += ` AND c2.c2_datpri >= $${paramCount++}`;
                params.push(data_inicio.replace(/-/g, ''));
            }
            if (data_fim) {
                pgQuery += ` AND c2.c2_datpri <= $${paramCount++}`;
                params.push(data_fim.replace(/-/g, ''));
            }
            if (op) {
                pgQuery += ` AND c2.c2_num LIKE $${paramCount++}`;
                params.push(`%${op}%`);
            }
            if (produto) {
                pgQuery += ` ${prodCond}`;
            }
            if (cliente) {
                pgQuery += ` AND (a1.a1_nome LIKE $${paramCount} OR c5.c5_cliente LIKE $${paramCount})`;
                params.push(`%${cliente.toUpperCase()}%`);
                paramCount++;
            }
            if (pedido) {
                const paddedPedido = pedido.trim().padStart(6, '0');
                pgQuery += ` AND c2.c2_pedido LIKE $${paramCount++}`;
                params.push(`${paddedPedido}%`);
            }
            if (operacao) {
                pgQuery += ` ${opCond}`;
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

            try {
                const pgRes = await pgClient.query(pgQuery, params);
                pgItems = pgRes.rows;

                if (pgItems.length > 0) {
                    const itemCodes = pgItems.map(i => i.op);
                    const pgPlaceholders = itemCodes.map((_, idx) => `$${idx + 1}`).join(',');
                    const routingRes = await pgClient.query(`
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
                            c2.c2_num IN (${pgPlaceholders})
                            AND COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
                        ORDER BY c2.c2_num, c2.c2_item, g2.g2_operac
                    `, itemCodes);
                    pgRoutings = routingRes.rows;
                }
            } catch (errPg) {
                console.warn('⚠️ [MATRIX] Erro ao consultar Postgres:', errPg.message);
            }
        }

        // Unificação Híbrida de Itens da Matriz
        const combinedItemsMap = new Map();
        mysqlItems.forEach(i => combinedItemsMap.set(`${i.op}_${i.item_op}_${i.sequencia}`, i));
        pgItems.forEach(i => {
            const key = `${i.op}_${i.item_op}_${i.sequencia}`;
            if (!combinedItemsMap.has(key)) combinedItemsMap.set(key, i);
        });
        const items = Array.from(combinedItemsMap.values());
        const routingRaw = [...mysqlRoutings, ...pgRoutings];

        console.log(`📦 [MATRIX] Found ${items.length} items (MySQL: ${mysqlItems.length}, PG: ${pgItems.length})`);

        if (items.length === 0) {
            return res.json({ operations: [], items: [] });
        }

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
                    `SELECT op_numero, op_item, op_sequencia, operacao_codigo, data_planejada_inicio, data_planejada_fim, lote_id, usuario_planejador, observacao_lote
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

                // Encontrar TODAS as rotas que correspondem a este RECURSO
                const matchingRoutes = itemRouting.filter(r => r.recurso && r.recurso.trim() === targetResource);

                if (matchingRoutes.length > 0) {
                    let totalPlanejada = 0;
                    let totalProduzida = 0;
                    let minRealStart = null;
                    let maxRealEnd = null;
                    let planStart = null;
                    let planEnd = null;
                    let tem_pendencia = false;
                    let realOpCodes = [];

                    matchingRoutes.forEach(route => {
                        const realOpCode = route.operacao ? route.operacao.trim() : '';
                        realOpCodes.push(realOpCode);
                        
                        totalPlanejada += Number(route.qtd_planejada || 0);

                        let plan = plans.find(p =>
                            String(p.op_numero).trim() === route.op.trim() &&
                            String(p.op_item).trim() === route.item_op.trim() &&
                            String(p.op_sequencia).trim() === route.sequen.trim() &&
                            String(p.operacao_codigo).trim() === realOpCode
                        );

                        let appt = appointments.find(a =>
                            String(a.op_numero).trim() === route.op.trim() &&
                            String(a.op_item).trim() === route.item_op.trim() &&
                            String(a.op_sequencia).trim() === route.sequen.trim() &&
                            String(a.operacao_codigo).trim() === realOpCode
                        );

                        if (appt) {
                            totalProduzida += Number(appt.total_produzido || 0);
                            if (appt.data_real_inicio) {
                                const d = new Date(appt.data_real_inicio);
                                if (!minRealStart || d < minRealStart) minRealStart = d;
                            }
                            if (appt.data_real_fim) {
                                const d = new Date(appt.data_real_fim);
                                if (!maxRealEnd || d > maxRealEnd) maxRealEnd = d;
                            }
                            if (appt.pendencias_conferencia > 0) tem_pendencia = true;
                        }

                        // Dates
                        let s = plan?.data_planejada_inicio ? new Date(plan.data_planejada_inicio) : (route.data_inicio_erp ? new Date(route.data_inicio_erp) : null);
                        let e = plan?.data_planejada_fim ? new Date(plan.data_planejada_fim) : (route.data_fim_erp ? new Date(route.data_fim_erp) : null);

                        if (s && (!planStart || s < planStart)) planStart = s;
                        if (e && (!planEnd || e > planEnd)) planEnd = e;
                    });

                    const percentual = totalPlanejada > 0
                        ? Math.min(100, Math.round((totalProduzida / totalPlanejada) * 100))
                        : 0;

                    let status = 'waiting';
                    const now = new Date();
                    if (percentual >= 100) status = 'done';
                    else if (planEnd && now > planEnd && percentual < 100) status = 'late';
                    else if (percentual > 0) status = 'in_progress';
                    else if (planStart && now > planStart) status = 'late_start';

                    itemOps[targetResource] = {
                        code: targetResource,
                        recurso: targetResource,
                        sequen: matchingRoutes[0].sequen,
                        operacao_real: realOpCodes.join(', '), // Pode ser "10, 30"
                        qtd_planejada: totalPlanejada,
                        qtd_produzida: totalProduzida,
                        percentual,
                        status,
                        tem_pendencia,
                        dates: {
                            plan_start: planStart,
                            plan_end: planEnd,
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
    } finally {
        if (pgClient) {
            await pgClient.query("SET client_encoding TO 'WIN1252'").catch(e => console.error('Erro resetando encoding:', e));
            pgClient.release();
        }
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
                AND COALESCE(c6.d_e_l_e_t_, '') IN ('', ' ')
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
            ordem_recurso: plan?.ordem_recurso ?? null,
            selecionado: plan?.selecionado ?? null,
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

// DELETE /api/production/clear-planning-by-pedido - Remove todas as datas planejadas de um pedido de venda
// Segurança: requer { pedido_venda, confirmar: true } no body. Nunca altera o Protheus.
router.delete('/clear-planning-by-pedido', async (req, res) => {
    try {
        const { pedido_venda, confirmar } = req.body;

        if (!pedido_venda || !pedido_venda.trim()) {
            return res.status(400).json({ error: 'Informe o número do pedido de venda.' });
        }
        if (!confirmar) {
            return res.status(400).json({ error: 'Confirmação obrigatória. Envie { confirmar: true } para executar.' });
        }

        const pedido = pedido_venda.trim().padStart(6, '0');

        // 1. Busca os op_numero do pedido no Protheus (PostgreSQL — somente leitura)
        const pgRes = await db.query(
            `SELECT DISTINCT TRIM(c2_num) AS op_numero
             FROM public.sc2010
             WHERE TRIM(c2_pedido) = $1
               AND COALESCE(d_e_l_e_t_, '') IN ('', ' ')`,
            [pedido]
        );

        if (pgRes.rows.length === 0) {
            return res.status(404).json({ error: `Nenhuma OP encontrada para o pedido ${pedido} no Protheus.` });
        }

        const opNums = pgRes.rows.map(r => r.op_numero);
        console.log(`🗑️ [CLEAR PLANNING] Pedido ${pedido} → ${opNums.length} OP(s): ${opNums.join(', ')}`);

        // 2. Apaga planejamento do MySQL para essas OPs
        const placeholders = opNums.map(() => '?').join(',');

        const [delMain] = await mysqlPool.execute(
            `DELETE FROM app_production_planning WHERE op_numero IN (${placeholders})`,
            opNums
        );

        // 3. Também limpa o histórico de planejamento dessas OPs (opcional mas consistente)
        const [delHist] = await mysqlPool.execute(
            `DELETE FROM app_planning_history WHERE op_numero IN (${placeholders})`,
            opNums
        );

        const [delLotes] = await mysqlPool.execute(
            `DELETE FROM app_planning_lotes WHERE op_numero IN (${placeholders})`,
            opNums
        );

        console.log(`✅ [CLEAR PLANNING] Concluído — planning: ${delMain.affectedRows} | histórico: ${delHist.affectedRows} | lotes: ${delLotes.affectedRows}`);

        res.json({
            message: `Planejamento do pedido ${pedido} removido com sucesso.`,
            pedido,
            ops_afetadas: opNums,
            linhas_removidas: {
                planning: delMain.affectedRows,
                historico: delHist.affectedRows,
                lotes: delLotes.affectedRows
            }
        });

    } catch (err) {
        console.error('[CLEAR PLANNING ERROR]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/production/cascade-preview - Calcula a cascata de programação baseada em capacidade e tempo padrão
router.post('/cascade-preview', async (req, res) => {
    try {
        const { ops, start_date, incluiSabado } = req.body;

        if (!Array.isArray(ops) || ops.length === 0) {
            return res.status(400).json({ error: 'Nenhuma OP fornecida para a cascata.' });
        }

        // 1. Obter capacidades cadastradas — tudo em MINUTOS direto (sem conversão hora)
        const [mysqlCaps] = await mysqlPool.execute('SELECT recurso_codigo, capacidade_diaria_minutos, tempo_padrao_minutos FROM app_recursos_capacidade');
        const capMap = {};
        mysqlCaps.forEach(c => {
            capMap[c.recurso_codigo.trim().toUpperCase()] = {
                cap_dia_min: parseFloat(c.capacidade_diaria_minutos) || 528,  // minutos/dia disponíveis
                tempo_padrao: parseFloat(c.tempo_padrao_minutos) || 1         // minutos/peça padrão (fallback)
            };
        });

        // 2. Obter tempos padrão do Protheus (SG2010)
        const productCodes = [...new Set(ops.map(o => (o.cod_produto_op || o.produto || '').trim().toUpperCase()))].filter(Boolean);
        let sgMap = {};

        if (productCodes.length > 0) {
            const ph = productCodes.map((_, i) => `$${i + 1}`).join(',');
            const sgRes = await db.query(`
                SELECT TRIM(g2_produto) as produto, TRIM(g2_operac) as operacao, TRIM(g2_recurso) as recurso,
                       g2_tempad, g2_setup
                FROM public.sg2010
                WHERE TRIM(g2_produto) IN (${ph}) AND COALESCE(d_e_l_e_t_,'') IN ('', ' ')
            `, productCodes);

            sgRes.rows.forEach(r => {
                const key = `${r.produto}_${r.operacao}`;
                sgMap[key] = {
                    tempad: Math.round((parseFloat(r.g2_tempad) || 0) * 1000) / 1000,
                    setup: parseFloat(r.g2_setup) || 0,
                    recurso: r.recurso
                };
            });
        }

        // 3. Ordenar as operações para simular a cascata (Primeiro prioridade/pedido, depois sequencia)
        ops.sort((a, b) => {
            // Se vier prioridade manual, tem precedência máxima
            if (a.prioridade !== b.prioridade) return (a.prioridade || 99) - (b.prioridade || 99);

            // Ordenar por data de entrega comercial (ascendente - mais cedo primeiro)
            // c6_entreg no protheus vem como YYYYMMDD, ordenação lexicográfica funciona bem.
            const dA = (a.data_entrega_comercial || '99999999').trim();
            const dB = (b.data_entrega_comercial || '99999999').trim();
            if (dA !== dB) return dA.localeCompare(dB);

            // Agrupar pela mesma OP e Item OP para itens que entregam no mesmo dia
            if (a.op !== b.op) return (a.op || '').localeCompare(b.op || '');
            if (a.item_op !== b.item_op) return (a.item_op || '').localeCompare(b.item_op || '');

            // Por fim, ordenar pela sequencia para garantir N+1 apos N na mesma OP
            return (a.sequen || '').localeCompare(b.sequen || '');
        });

        // Lógica de Sequenciamento
        // resourceCalendar guarda quantos minutos já foram usados de cada recurso por dia (YYYY-MM-DD)
        let resourceCalendar = {};
        // opFinish e opStart guardam quando a sequência anterior da mesma OP iniciou e terminou
        let opFinish = {};
        let opStartCache = {};

        let globalStart = start_date ? new Date(start_date) : new Date();
        // Zera as horas para a data global (usaremos 08:00 para alinhamento)
        globalStart.setHours(8, 0, 0, 0);

        const results = ops.map(op => {
            const produto = (op.cod_produto_op || op.produto || '').trim().toUpperCase();
            const operacao = (op.operacao || '').trim().toUpperCase();
            const recurso = (op.recurso || '').trim().toUpperCase();

            const planejado = parseFloat(op.qtd_planejada_op) || parseFloat(op.qtd) || 0;
            const produzido = parseFloat(op.qtd_produzida_real) || 0;
            const qtd = Math.max(0, planejado - produzido);

            const sgData = sgMap[`${produto}_${operacao}`] || {};
            const capData = capMap[recurso] || capMap[(sgData?.recurso || '').toUpperCase()] || { cap_dia_min: 528, tempo_padrao: 1 };

            const g2_tempo_min = Math.round((parseFloat(sgData.tempad) || 0) * 1000) / 1000;
            const tempoUnitarioMinutos = g2_tempo_min > 0.001 ? g2_tempo_min : capData.tempo_padrao;
            const setupMinutos = (sgData.setup || 0) * 60;

            let tempoTotalMinutos = qtd > 0 ? setupMinutos + (qtd * tempoUnitarioMinutos) : 0;
            const capacidadeDiariaMinutos = capData.cap_dia_min;
            const diasNecessariosFloat = capacidadeDiariaMinutos > 0 ? tempoTotalMinutos / capacidadeDiariaMinutos : 0;

            const opKey = `${op.op}_${op.item_op}`;
            const opSeqKey = `${op.op}_${op.item_op}_${op.sequen}`;

            let startDate = new Date(globalStart);

            // Lógica de Sobreposição (Máx 180 min)
            if (opStartCache[opKey]) {
                // A próxima operação pode começar 180 minutos de trabalho APÓS o início da anterior
                // Para simplificar no calendário de dias, adicionamos 3 horas reais de relógio.
                let overlapStart = new Date(opStartCache[opKey].getTime() + (180 * 60000));

                // Mas se a operação anterior foi rápida e acabou antes desses 180 min, usamos o Finish real
                if (opFinish[opKey] && opFinish[opKey] < overlapStart) {
                    overlapStart = new Date(opFinish[opKey]);
                }

                if (overlapStart > startDate) {
                    startDate = new Date(overlapStart);
                }
            } else if (opFinish[opKey] && opFinish[opKey] > startDate) {
                // Fallback de segurança
                startDate = new Date(opFinish[opKey]);
            }

            // Pula domingos, e pula sábados APENAS se incluiSabado for falso
            while (startDate.getDay() === 0 || (!incluiSabado && startDate.getDay() === 6)) {
                startDate.setDate(startDate.getDate() + 1);
                startDate.setHours(8, 0, 0, 0); // Reseta a hora ao pular dia
            }

            if (!resourceCalendar[recurso]) resourceCalendar[recurso] = {};

            let currentDate = new Date(startDate);
            let actualStartDate = null;
            let tempoRestante = tempoTotalMinutos;

            if (tempoRestante <= 0) {
                actualStartDate = new Date(currentDate);
            }

            while (tempoRestante > 0) {
                let dateKey = currentDate.toISOString().split('T')[0];
                let usedToday = resourceCalendar[recurso][dateKey] || 0;
                let availableToday = capacidadeDiariaMinutos - usedToday;

                if (availableToday <= 0) {
                    currentDate.setDate(currentDate.getDate() + 1);
                    currentDate.setHours(8, 0, 0, 0);
                    while (currentDate.getDay() === 0 || (!incluiSabado && currentDate.getDay() === 6)) {
                        currentDate.setDate(currentDate.getDate() + 1);
                    }
                    continue;
                }

                if (!actualStartDate) {
                    // Guarda o dia exato que começou a processar
                    actualStartDate = new Date(currentDate);
                }

                if (tempoRestante <= availableToday) {
                    resourceCalendar[recurso][dateKey] = usedToday + tempoRestante;

                    // Ajusta o currentDate para adicionar as horas gastas hoje
                    // (Regra de três para manter o offset do relógio em um turno de 9 horas, ~540 min reais)
                    // Exemplo: se usou 120 min de capacidade, adiciona 2h no relógio.
                    currentDate.setTime(currentDate.getTime() + (tempoRestante * 60000));

                    tempoRestante = 0;
                } else {
                    resourceCalendar[recurso][dateKey] = capacidadeDiariaMinutos;
                    tempoRestante -= availableToday;

                    currentDate.setDate(currentDate.getDate() + 1);
                    currentDate.setHours(8, 0, 0, 0);
                    while (currentDate.getDay() === 0 || (!incluiSabado && currentDate.getDay() === 6)) {
                        currentDate.setDate(currentDate.getDate() + 1);
                    }
                }
            }

            const endDate = new Date(currentDate);

            if (!actualStartDate) actualStartDate = new Date(endDate);

            opStartCache[opKey] = new Date(actualStartDate);
            opFinish[opKey] = new Date(endDate);
            opFinish[opSeqKey] = new Date(endDate);

            return {
                ...op,
                data_inicio_calc: actualStartDate.toISOString().split('T')[0] + 'T08:00:00',
                data_fim_calc: endDate.toISOString().split('T')[0] + 'T17:00:00',
                tempo_total_horas: tempoTotalMinutos / 60,
                dias_necessarios: diasNecessariosFloat
            };
        });

        res.json({ cascade: results });
    } catch (error) {
        console.error('[CASCADE ERROR]', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/production/plan-batch - Save Batch Planning v2 (Macro)
// Melhorias v2: validação de datas, lote_id no backend, auditoria de usuário,
//               campo de observação, gravação em app_planning_history
router.post('/plan-batch', async (req, res) => {
    try {
        const { plans, observacao, modo_calculo, preferencias, atualizar_data_pcp, data_entrega_pcp_valor, pedido_pcp, item_pcp } = req.body;

        if (!Array.isArray(plans) || plans.length === 0) {
            return res.status(400).json({ error: 'Nenhum plano fornecido.' });
        }

        // Captura identidade do usuário autenticado (padrão do projeto)
        const usuario = req.user?.login || req.user?.Login || req.user?.username ||
            req.user?.name || req.user?.email || 'planejador';

        // Gera lote_id único no backend para evitar colisão entre usuários simultâneos
        const tsHex = Date.now().toString(16).toUpperCase();
        const randPart = Math.random().toString(16).slice(2, 6).toUpperCase();
        const lote_id = `LOTE-${tsHex}-${randPart}`;

        // Pega op_numero da primeira OP do lote (todas pertencem à mesma OP no modal macro)
        const op_numero_lote = plans[0]?.op_numero || null;

        // VALIDAÇÃO: verificar integridade de datas antes de qualquer INSERT
        // Normaliza nomes de campo: aceita data_inicio ou data_planejada_inicio
        for (const p of plans) {
            p.data_inicio = p.data_inicio || p.data_planejada_inicio || null;
            p.data_fim = p.data_fim || p.data_planejada_fim || null;

            if (!p.data_inicio || !p.data_fim) {
                return res.status(400).json({
                    error: `Datas ausentes na operação ${p.operacao_codigo || p.op_sequencia}`
                });
            }
            const s = new Date(p.data_inicio);
            const e = new Date(p.data_fim);
            if (isNaN(s.getTime()) || isNaN(e.getTime())) {
                return res.status(400).json({
                    error: `Formato de data inválido na operação ${p.operacao_codigo}`
                });
            }
            if (s > e) {
                return res.status(400).json({
                    error: `Data de início posterior à data de fim na operação ${p.operacao_codigo} ` +
                        `(${p.data_inicio} > ${p.data_fim})`
                });
            }
        }

        console.log(`⚡[BATCH PLAN v2] lote=${lote_id} usuario=${usuario} total=${plans.length}`);

        const CHUNK_SIZE = 500;
        const connection = await mysqlPool.getConnection();

        try {
            await connection.beginTransaction();

            // ── INSERT metadados do lote (preferências + ordem) ────────────────
            await connection.execute(`
                INSERT INTO app_planning_lotes
                    (lote_id, op_numero, usuario, observacao, modo_calculo,
                     dias_modo, inclui_sabado, inclui_domingo, inclui_st, ordem_recursos)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                lote_id,
                op_numero_lote,
                usuario,
                observacao || null,
                modo_calculo || null,
                preferencias?.diasModo || 'calendar',
                preferencias?.incluiSabado ? 1 : 0,
                preferencias?.incluiDomingo ? 1 : 0,
                preferencias?.incluiST ? 1 : 0,
                preferencias?.ordemRecursos ? JSON.stringify(preferencias.ordemRecursos) : null
            ]);

            // ── INSERT / UPDATE em app_production_planning ───────────────────
            for (let i = 0; i < plans.length; i += CHUNK_SIZE) {
                const chunk = plans.slice(i, i + CHUNK_SIZE);
                if (chunk.length === 0) continue;

                const placeholders = chunk.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
                const sql = `
                    INSERT INTO app_production_planning
                        (op_numero, op_item, op_sequencia, operacao_codigo,
                         recurso_codigo, produto_codigo,
                         data_planejada_inicio, data_planejada_fim,
                         lote_id, usuario_planejador, observacao_lote,
                         duracao_dias, modo_calculo, ordem_recurso, selecionado)
                    VALUES ${placeholders}
                    ON DUPLICATE KEY UPDATE
                        recurso_codigo        = COALESCE(VALUES(recurso_codigo), recurso_codigo),
                        produto_codigo        = COALESCE(VALUES(produto_codigo), produto_codigo),
                        data_planejada_inicio = VALUES(data_planejada_inicio),
                        data_planejada_fim     = VALUES(data_planejada_fim),
                        lote_id               = VALUES(lote_id),
                        usuario_planejador     = VALUES(usuario_planejador),
                        observacao_lote        = VALUES(observacao_lote),
                        duracao_dias           = VALUES(duracao_dias),
                        modo_calculo           = VALUES(modo_calculo),
                        ordem_recurso          = VALUES(ordem_recurso),
                        selecionado            = VALUES(selecionado)
                `;

                const values = [];
                chunk.forEach(p => {
                    values.push(
                        p.op_numero, p.op_item, p.op_sequencia, p.operacao_codigo,
                        p.recurso_codigo || null,
                        p.produto_codigo || null,
                        p.data_inicio, p.data_fim,
                        lote_id, usuario, observacao || null,
                        p.duracao_dias || null,
                        modo_calculo || null,
                        p.ordem_recurso ?? null,
                        p.selecionado === false ? 0 : 1
                    );
                });
                await connection.execute(sql, values);
            }

            // ── FILTER PLANS FOR HISTORY ───────────────────────────────
            // Apenas inserir no histórico se houver MUDANÇA real nas datas ou observação
            const opsToFetch = plans.map(p => p.op_numero);
            let currentPlansMap = {};

            if (opsToFetch.length > 0) {
                const placeholders = opsToFetch.map(() => '?').join(',');
                const [currentRows] = await connection.query(`
                    SELECT op_numero, op_item, op_sequencia, operacao_codigo, data_planejada_inicio, data_planejada_fim, observacao_lote
                    FROM app_production_planning 
                    WHERE op_numero IN (${placeholders})
                `, opsToFetch);

                currentRows.forEach(row => {
                    const key = `${row.op_numero}_${row.op_item}_${row.op_sequencia}_${row.operacao_codigo}`;
                    currentPlansMap[key] = row;
                });
            }

            const plansForHistory = plans.filter(p => {
                const key = `${p.op_numero}_${p.op_item}_${p.op_sequencia}_${p.operacao_codigo}`;
                const curr = currentPlansMap[key];
                if (!curr) return true; // Novo planejamento, deve ir pro histórico

                // Compare values
                const currentStart = new Date(curr.data_planejada_inicio).getTime();
                const currentEnd = new Date(curr.data_planejada_fim).getTime();
                const newStart = new Date(p.data_inicio).getTime();
                const newEnd = new Date(p.data_fim).getTime();
                const currentObs = curr.observacao_lote || '';
                const newObs = observacao || '';

                if (currentStart !== newStart || currentEnd !== newEnd || currentObs !== newObs) {
                    return true; // Mudou
                }
                return false; // Idêntico, ignorar histórico
            });

            // ── INSERT IMUTÁVEL em app_planning_history ───────────────────────
            // Snapshot permanente para rastreabilidade / histórico de versões
            for (let i = 0; i < plansForHistory.length; i += CHUNK_SIZE) {
                const chunk = plansForHistory.slice(i, i + CHUNK_SIZE);
                if (chunk.length === 0) continue;

                const histPH = chunk.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
                const histSql = `
                    INSERT INTO app_planning_history
                        (lote_id, op_numero, op_item, op_sequencia, operacao_codigo,
                         recurso_code, recurso_desc,
                         data_inicio, data_fim, duracao_dias,
                         modo_calculo, usuario_planejador, observacao, pedido_venda)
                    VALUES ${histPH}
                `;

                const histValues = [];
                chunk.forEach(p => {
                    histValues.push(
                        lote_id, p.op_numero, p.op_item, p.op_sequencia, p.operacao_codigo,
                        p.recurso_code || null, p.recurso_desc || null,
                        p.data_inicio, p.data_fim, p.duracao_dias || null,
                        modo_calculo || null, usuario, observacao || null, p.pedido_venda || p.pedido || null
                    );
                });
                await connection.execute(histSql, histValues);
            }

            // ── INSERT into app_pcp_historico_revisao (For PCP Refined Dashboard) ───
            for (let i = 0; i < plansForHistory.length; i += CHUNK_SIZE) {
                const chunk = plansForHistory.slice(i, i + CHUNK_SIZE);
                if (chunk.length === 0) continue;

                const pcpHistValues = [];
                chunk.forEach(p => {
                    const key = `${p.op_numero}_${p.op_item}_${p.op_sequencia}_${p.operacao_codigo}`;
                    const curr = currentPlansMap[key];
                    const formatDbDate = (d) => {
                        if (!d) return 'N/A';
                        if (d instanceof Date) return d.toISOString().split('T')[0];
                        return String(d).split('T')[0];
                    };
                    const mudouDe = curr ? `Início: ${formatDbDate(curr.data_planejada_inicio)} - Fim: ${formatDbDate(curr.data_planejada_fim)}` : 'N/A';
                    const mudouPara = `Início: ${p.data_inicio.split('T')[0]} - Fim: ${p.data_fim.split('T')[0]}`;

                    pcpHistValues.push([
                        p.op_numero,
                        p.operacao_codigo,
                        usuario,
                        new Date(),
                        mudouDe,
                        mudouPara,
                        'Smart Planner / Lote'
                    ]);
                });

                if (pcpHistValues.length > 0) {
                    const pcpHistSql = `
                        INSERT INTO app_pcp_historico_revisao
                            (op_numero, operacao_codigo, usuario, data_alteracao, mudou_de, mudou_para, origem)
                        VALUES ?
                    `;
                    await connection.query(pcpHistSql, [pcpHistValues]);
                }
            }

            await connection.commit();
            console.log(`✅ [BATCH PLAN v2] Sucesso — lote ${lote_id}`);

            // ── UPSERT Data PCP do Produto Pai (opcional) ────────────────────────────────────
            // Apenas quando: OP é produto pai (sequen=001) E usuário marcou a opção
            if (atualizar_data_pcp && data_entrega_pcp_valor && pedido_pcp && item_pcp) {
                try {
                    let enableHistory = true;
                    try {
                        const [paramRows] = await mysqlPool.query("SELECT setting_value FROM system_parameters WHERE setting_key = 'enable_pcp_history'");
                        if (paramRows.length > 0) {
                            let val = paramRows[0].setting_value;
                            if (typeof val === 'string') val = JSON.parse(val);
                            enableHistory = val !== false;
                        }
                    } catch(e) {}

                    if (!enableHistory) {
                        // Apenas atualizar o último registro existente (ou inserir se não houver)
                        const [existing] = await mysqlPool.query(
                            "SELECT id FROM app_pcp_delivery_forecasts WHERE pedido = ? AND item = ? ORDER BY id DESC LIMIT 1",
                            [String(pedido_pcp).trim(), String(item_pcp).trim()]
                        );
                        if (existing.length > 0) {
                            await mysqlPool.query(`
                                UPDATE app_pcp_delivery_forecasts 
                                SET data_entrega_pcp = ?, usuario_pcp = ?, updated_at = NOW()
                                WHERE id = ?
                            `, [data_entrega_pcp_valor, usuario, existing[0].id]);
                        } else {
                            await mysqlPool.query(`
                                INSERT INTO app_pcp_delivery_forecasts (pedido, item, data_entrega_pcp, usuario_pcp, updated_at)
                                VALUES (?, ?, ?, ?, NOW())
                            `, [String(pedido_pcp).trim(), String(item_pcp).trim(), data_entrega_pcp_valor, usuario]);
                        }
                    } else {
                        // Gerar histórico (novo registro)
                        // NOTA: Se houvesse chave única em (pedido, item), isso faria update,
                        // mas se o objetivo é histórico, assumimos que insere (ou a tabela precisa ser ajustada).
                        await mysqlPool.query(`
                            INSERT INTO app_pcp_delivery_forecasts (pedido, item, data_entrega_pcp, usuario_pcp, updated_at)
                            VALUES (?, ?, ?, ?, NOW())
                            ON DUPLICATE KEY UPDATE
                                data_entrega_pcp = VALUES(data_entrega_pcp),
                                usuario_pcp      = VALUES(usuario_pcp),
                                updated_at       = NOW()
                        `, [
                            String(pedido_pcp).trim(),
                            String(item_pcp).trim(),
                            data_entrega_pcp_valor,
                            usuario
                        ]);
                    }

                    console.log(`📅 [DATA PCP] Atualizado: pedido=${pedido_pcp} item=${item_pcp} data=${data_entrega_pcp_valor} (Histórico: ${enableHistory})`);
                } catch (pcpErr) {
                    // Não bloqueia o retorno, apenas loga o erro
                    console.error('⚠️ [DATA PCP] Erro ao atualizar data_entrega_pcp:', pcpErr.message);
                }
            }

            res.json({
                message: 'Planejamento salvo com sucesso!',
                lote_id,
                usuario,
                total: plans.length
            });

        } catch (err) {
            console.error('❌ [BATCH PLAN v2] Erro — rollback:', err.message);
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

    } catch (err) {
        console.error('[BATCH PLAN v2]', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/production/planning-audit - Auditoria global de planejamento
router.get('/planning-audit', async (req, res) => {
    try {
        const { usuario, data_inicio, data_fim, op, pedido } = req.query;
        let where = '1=1';
        let params = [];

        if (usuario) {
            where += ' AND h.usuario_planejador LIKE ?';
            params.push(`%${usuario}%`);
        }
        if (data_inicio) {
            where += ' AND h.criado_em >= ?';
            params.push(`${data_inicio} 00:00:00`);
        }
        if (data_fim) {
            where += ' AND h.criado_em <= ?';
            params.push(`${data_fim} 23:59:59`);
        }
        if (op) {
            where += ' AND h.op_numero LIKE ?';
            params.push(`%${op}%`);
        }
        if (pedido) {
            where += ' AND h.pedido_venda LIKE ?';
            params.push(`%${pedido}%`);
        }

        const [rows] = await mysqlPool.query(`
            SELECT 
                h.id, h.lote_id, h.op_numero, h.op_item, h.op_sequencia, h.operacao_codigo, 
                h.recurso_desc, h.recurso_code, h.data_inicio, h.data_fim, h.usuario_planejador, h.observacao, h.criado_em, h.pedido_venda,
                (SELECT COUNT(*) FROM app_planning_history h2 
                 WHERE h2.op_numero = h.op_numero 
                   AND COALESCE(h2.recurso_code, h2.operacao_codigo) = COALESCE(h.recurso_code, h.operacao_codigo)
                   AND h2.criado_em <= h.criado_em) as revisao
            FROM app_planning_history h
            WHERE ${where}
            ORDER BY h.criado_em DESC
            LIMIT 500
        `, params);

        res.json(rows);
    } catch (err) {
        console.error('[PLANNING-AUDIT ERROR]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/production/planning-history/:op - Histórico de versões de planejamento por OP
// Retorna lotes agrupados com operações, preferências e usuário
router.get('/planning-history/:op', async (req, res) => {
    try {
        const op = String(req.params.op).trim();

        // Busca metadados dos lotes para esta OP, do mais recente para o mais antigo
        const [lotes] = await mysqlPool.query(`
            SELECT
                lote_id, op_numero, usuario, observacao, modo_calculo,
                dias_modo, inclui_sabado, inclui_domingo, inclui_st, ordem_recursos, criado_em
            FROM app_planning_lotes
            WHERE op_numero = ?
            ORDER BY criado_em DESC
            LIMIT 20
        `, [op]);

        if (lotes.length === 0) {
            return res.json([]);
        }

        // Para cada lote, busca as operações do histórico associadas
        const loteIds = lotes.map(l => l.lote_id);
        const placeholders = loteIds.map(() => '?').join(',');
        const [ops] = await mysqlPool.query(`
            SELECT
                lote_id, op_sequencia, operacao_codigo, recurso_code, recurso_desc,
                data_inicio, data_fim, duracao_dias
            FROM app_planning_history
            WHERE op_numero = ? AND lote_id IN (${placeholders})
            ORDER BY criado_em ASC
        `, [op, ...loteIds]);

        // Monta mapa lote_id -> lista de operações
        const opsByLote = {};
        ops.forEach(o => {
            if (!opsByLote[o.lote_id]) opsByLote[o.lote_id] = [];
            opsByLote[o.lote_id].push(o);
        });

        // Combina tudo
        const result = lotes.map((lote, idx) => ({
            lote_id: lote.lote_id,
            op_numero: lote.op_numero,
                         modo_calculo: lote.modo_calculo,
            dias_modo: lote.dias_modo,
            inclui_sabado: !!lote.inclui_sabado,
            inclui_domingo: !!lote.inclui_domingo,
            inclui_st: !!lote.inclui_st,
            ordem_recursos: lote.ordem_recursos ? JSON.parse(lote.ordem_recursos) : null,
            criado_em: lote.criado_em,
            revisao: lotes.length - idx,
            operacoes: opsByLote[lote.lote_id] || []
        }));

        res.json(result);

    } catch (err) {
        console.error('[PLANNING-HISTORY]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/production/planning-prefs/:op - Salva preferências isoladas (sem precisar de datas)
// Persiste daysMode, sábado, domingo, ST mesmo antes de calcular o cronograma
router.put('/planning-prefs/:op', async (req, res) => {
    try {
        const op = String(req.params.op).trim();
        const { diasModo, incluiSabado, incluiDomingo, incluiST, ordemRecursos } = req.body;
        const usuario = req.user?.login || req.user?.Login || req.user?.username || req.user?.name || 'planejador';

        const [existing] = await mysqlPool.query(
            `SELECT lote_id FROM app_planning_lotes WHERE op_numero = ? ORDER BY criado_em DESC LIMIT 1`,
            [op]
        );

        if (existing.length > 0) {
            await mysqlPool.execute(
                `UPDATE app_planning_lotes SET dias_modo=?, inclui_sabado=?, inclui_domingo=?, inclui_st=?, ordem_recursos=?, usuario=? WHERE lote_id=?`,
                [diasModo || 'calendar', incluiSabado ? 1 : 0, incluiDomingo ? 1 : 0, incluiST ? 1 : 0,
                 ordemRecursos ? JSON.stringify(ordemRecursos) : null, usuario, existing[0].lote_id]
            );
        } else {
            const lote_id = `PREFS-${Date.now().toString(16).toUpperCase()}-${Math.random().toString(16).slice(2,6).toUpperCase()}`;
            await mysqlPool.execute(
                `INSERT INTO app_planning_lotes (lote_id, op_numero, usuario, observacao, modo_calculo, dias_modo, inclui_sabado, inclui_domingo, inclui_st, ordem_recursos) VALUES (?,?,?,?,?,?,?,?,?,?)`,
                [lote_id, op, usuario, null, null, diasModo || 'calendar', incluiSabado ? 1 : 0, incluiDomingo ? 1 : 0, incluiST ? 1 : 0, ordemRecursos ? JSON.stringify(ordemRecursos) : null]
            );
        }
        res.json({ ok: true });
    } catch (err) {
        console.error('[PLANNING-PREFS PUT]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/production/planning-prefs/:op - Preferências do último lote de planejamento da OP
// Usado para restaurar as preferências salvas pelo usuário anterior ao abrir o modal
router.get('/planning-prefs/:op', async (req, res) => {
    try {

        const op = String(req.params.op).trim();
        const [rows] = await mysqlPool.query(`
            SELECT dias_modo, inclui_sabado, inclui_domingo, inclui_st, ordem_recursos, usuario, criado_em
            FROM app_planning_lotes
            WHERE op_numero = ?
            ORDER BY criado_em DESC
            LIMIT 1
        `, [op]);

        if (rows.length === 0) return res.json(null);
        const r = rows[0];
        res.json({
            diasModo: r.dias_modo || 'calendar',
            incluiSabado: !!r.inclui_sabado,
            incluiDomingo: !!r.inclui_domingo,
            incluiST: !!r.inclui_st,
            ordemRecursos: r.ordem_recursos ? JSON.parse(r.ordem_recursos) : null,
            usuario: r.usuario,
            criado_em: r.criado_em
        });
    } catch (err) {
        console.error('[PLANNING-PREFS]', err.message);
        res.status(500).json({ error: err.message });
    }
});


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
    let connection;
    try {
        const { op_numero, op_item, op_sequencia, operacao_codigo, usuario, quantidade, data_inicio, data_fim, observacao, materiais_utilizados, skip_cascade } = req.body;

        const qtyNum = Number(quantidade) || 0;
        if (qtyNum <= 0) {
            return res.status(400).json({ error: 'Quantidade deve ser maior que zero.' });
        }

        connection = await mysqlPool.getConnection();
        await connection.beginTransaction();

        // --- PREVENÇÃO CONTRA DUPLO CLIQUE (DOUBLE SUBMIT) ---
        // Verifica se já existe um apontamento idêntico nos últimos 10 segundos
        const [recentApps] = await connection.execute(`
            SELECT id FROM app_production_appointments
            WHERE op_numero=? AND op_item=? AND op_sequencia=? AND operacao_codigo=?
            AND usuario=? AND quantidade=? AND data_inicio=? AND data_fim=?
            AND created_at >= NOW() - INTERVAL 10 SECOND
        `, [op_numero, op_item, op_sequencia, operacao_codigo, usuario, quantidade, data_inicio, data_fim]);

        if (recentApps.length > 0) {
            await connection.rollback();
            return res.status(409).json({ error: 'Apontamento duplicado detectado. Requisição ignorada.' });
        }

        // --- LEITURA DE CONFIG ---
        const [configRows] = await connection.query('SELECT general_config FROM app_company_settings WHERE id = 1');
        let appointmentMode = 'free';
        let enableVerification = false;
        if (configRows.length > 0 && configRows[0].general_config) {
            const cfg = typeof configRows[0].general_config === 'string'
                ? JSON.parse(configRows[0].general_config)
                : configRows[0].general_config;
            appointmentMode = cfg.production_appointment_mode || 'free';
            enableVerification = !!cfg.enable_production_verification;
        }

        // --- VALIDAÇÃO DE SALDO (Sempre ativa, independente do modo configurado) ---
        let qtdPlanejada = 0;
        try {
            const pgPromise = db.query(
                `SELECT c2.c2_quant::numeric AS qtd_planejada
                 FROM public.sc2010 c2
                 WHERE c2.c2_num = $1 AND c2.c2_item = $2 AND c2.c2_sequen = $3
                 AND COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')`,
                [op_numero, op_item, op_sequencia]
            );
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('PG Timeout')), 1500));
            const pgRes = await Promise.race([pgPromise, timeoutPromise]);
            if (pgRes?.rows?.length > 0) {
                qtdPlanejada = Number(pgRes.rows[0].qtd_planejada) || 0;
            }
        } catch (e) {
            // Postgres timeout ou indisponível
        }

        // Fallback MySQL para validação de saldo (OPs criadas localmente)
        if (qtdPlanejada <= 0) {
            try {
                const [mySc] = await connection.query(
                    `SELECT CAST(c2_quant AS DECIMAL(15,4)) AS qtd_planejada
                     FROM sc2010
                     WHERE TRIM(c2_num) = ? AND TRIM(c2_item) = ? AND TRIM(c2_sequen) = ?
                     LIMIT 1`,
                    [op_numero, op_item, op_sequencia]
                );
                if (mySc?.length > 0 && Number(mySc[0].qtd_planejada) > 0) {
                    qtdPlanejada = Number(mySc[0].qtd_planejada);
                } else {
                    const [myErp] = await connection.query(
                        `SELECT CAST(quantidade_planejada AS DECIMAL(15,4)) AS qtd_planejada
                         FROM erp_ordens_producao
                         WHERE numero_op LIKE ?
                         LIMIT 1`,
                        [`${op_numero}%${op_item}%`]
                    );
                    if (myErp?.length > 0 && Number(myErp[0].qtd_planejada) > 0) {
                        qtdPlanejada = Number(myErp[0].qtd_planejada);
                    }
                }
            } catch (myErr) {
                console.warn('⚠️ [APPOINT] Erro ao buscar qtd_planejada no MySQL:', myErr.message);
            }
        }

        if (qtdPlanejada > 0) {
            const [appRows] = await connection.execute(
                `SELECT SUM(quantidade) AS total FROM app_production_appointments
                 WHERE op_numero=? AND op_item=? AND op_sequencia=? AND operacao_codigo=?
                 AND conferencia_status NOT IN ('CANCELADO', 'DIVERGENTE')`,
                 [op_numero, op_item, op_sequencia, operacao_codigo]
            );
            const produzido = Number(appRows[0].total) || 0;
            if (produzido + qtyNum > qtdPlanejada + 0.001) {
                await connection.rollback();
                return res.status(400).json({
                    error: `Quantidade excede saldo! Planejado: ${qtdPlanejada} | Já Produzido: ${produzido} | Tentativa: ${qtyNum}`
                });
            }
        }


        // --- VALIDAÇÃO DE SEQUÊNCIA (modo: sequence) ---
        if (appointmentMode === 'sequence') {
            const prevRes = await db.query(
                `SELECT prev_operacao FROM (
                    SELECT
                        g2.g2_operac AS operacao,
                        LAG(g2.g2_operac) OVER (
                            PARTITION BY c2.c2_num, c2.c2_item, c2.c2_sequen
                            ORDER BY g2.g2_operac
                        ) AS prev_operacao
                    FROM public.sc2010 c2
                    LEFT JOIN public.sg2010 g2
                        ON btrim(g2.g2_produto) = btrim(c2.c2_produto)
                        AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
                    WHERE c2.c2_num = $1 AND c2.c2_item = $2 AND c2.c2_sequen = $3
                    AND COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
                ) t WHERE operacao = $4`,
                [op_numero, op_item, op_sequencia, operacao_codigo]
            );

            if (prevRes.rows.length > 0 && prevRes.rows[0].prev_operacao && qtdPlanejada > 0) {
                const prevOp = prevRes.rows[0].prev_operacao;
                const [prevAppRows] = await connection.execute(
                    `SELECT SUM(quantidade) AS total FROM app_production_appointments
                     WHERE op_numero=? AND op_item=? AND op_sequencia=? AND operacao_codigo=?
                     AND conferencia_status NOT IN ('CANCELADO', 'DIVERGENTE')`,
                    [op_numero, op_item, op_sequencia, prevOp]
                );
                const prevProduzido = Number(prevAppRows[0].total) || 0;
                if (prevProduzido < qtdPlanejada - 0.001) {
                    await connection.rollback();
                    return res.status(400).json({
                        error: `Operação anterior (${prevOp}) não foi concluída. Produzido: ${prevProduzido} / Planejado: ${qtdPlanejada}`
                    });
                }
            }
        }
        // --- FIM DAS VALIDAÇÕES ---

        const materiaisJson = materiais_utilizados ? JSON.stringify(materiais_utilizados) : null;
        const initialStatus = enableVerification ? 'PENDENTE' : 'OK';

        await connection.execute(`
            INSERT INTO app_production_appointments
    (op_numero, op_item, op_sequencia, operacao_codigo, usuario, quantidade, data_inicio, data_fim, observacao, materiais_utilizados, conferencia_status)
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [op_numero, op_item, op_sequencia, operacao_codigo, usuario, quantidade, data_inicio, data_fim, observacao, materiaisJson, initialStatus]);

        // CASCATA (Baixa Automática) - Recursive BOM Explosion and Appointment
        if (!skip_cascade) {
            await processarBaixaCascata(connection, op_numero, op_item, op_sequencia, operacao_codigo, qtyNum, usuario, data_inicio, data_fim, initialStatus);
        }

        // Atualizar status do Lote de Corte se a OP fizer parte de algum lote de corte (Engenharia/PCP)
        const concatenatedOp = String(op_numero).trim() + String(op_item).trim() + String(op_sequencia).trim();
        await connection.execute(`
            UPDATE app_lotes_corte_itens
            SET status = 'Concluído'
            WHERE op_numero = ?
        `, [concatenatedOp]);

        // Se houver op_fracionada, grava na tabela de rastreio de lote fracionado
        if (req.body.op_fracionada) {
            await connection.execute(`
                INSERT INTO app_ind_production_appointments
                (op_fracionada, op_base, operacao_codigo, operacao_nome, quantidade, data_inicio, data_fim, usuario, materiais_utilizados, observacao)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                req.body.op_fracionada,
                op_numero + op_item,
                operacao_codigo,
                req.body.operacao_nome || '',
                quantidade,
                data_inicio,
                data_fim,
                usuario,
                materiaisJson,
                observacao
            ]);
        }

        // Se houver materiais com solicitacao_id, marcar solicitação como ENTREGUE
        if (materiais_utilizados && Array.isArray(materiais_utilizados)) {
            const solicitacoesIds = [...new Set(materiais_utilizados.map(m => m.solicitacao_id).filter(id => id))];

            if (solicitacoesIds.length > 0) {
                const placeholders = solicitacoesIds.map(() => '?').join(',');
                await connection.execute(`
                    UPDATE app_solicitacoes_almoxarifado 
                    SET status = 'ENTREGUE', data_entregue = NOW(), usuario_entrega = 'APONTAMENTO_AUTO'
                    WHERE id IN(${placeholders}) AND status != 'ENTREGUE'
                `, solicitacoesIds);
            }
        }

        await connection.commit();
        res.json({ message: 'Apontamento registrado com sucesso.' });

        // --- INÍCIO VERIFICAÇÃO PPAP / GITS PARA WHATSAPP ---
        (async () => {
            try {
                let pedido = '';
                let itempv = '';
                let produto = '';

                try {
                    const pgRes = await db.query(
                        `SELECT c2_pedido, c2_itempv, c2_produto
                         FROM public.sc2010
                         WHERE c2_num = $1 AND c2_item = $2
                         AND COALESCE(d_e_l_e_t_, '') IN ('', ' ')`,
                        [op_numero, op_item]
                    );
                    if (pgRes.rows.length > 0) {
                        pedido = pgRes.rows[0].c2_pedido;
                        itempv = pgRes.rows[0].c2_itempv;
                        produto = pgRes.rows[0].c2_produto;
                    }
                } catch(e) {}

                if (!pedido) {
                    const [mySc] = await mysqlPool.query(
                        `SELECT c2_pedido, c2_itempv, c2_produto
                         FROM sc2010
                         WHERE TRIM(c2_num) = ? AND TRIM(c2_item) = ?
                         LIMIT 1`,
                        [op_numero, op_item]
                    );
                    if (mySc?.length > 0) {
                        pedido = mySc[0].c2_pedido;
                        itempv = mySc[0].c2_itempv;
                        produto = mySc[0].c2_produto;
                    }
                }

                if (pedido && itempv) {
                    const [classifRows] = await mysqlPool.query(
                        'SELECT classificacao FROM app_pedido_itens_classificacao WHERE pedido = ? AND item = ?',
                        [pedido.trim(), itempv.trim()]
                    );

                        if (classifRows.length > 0) {
                            const classificacao = classifRows[0].classificacao || '';
                            if (classificacao === 'Gits' || classificacao === 'PPAP' || classificacao === 'Gits e PPAP') {
                                const { sendText, msgAvisoPpapGits } = require('../services/whatsapp');
                                const waText = msgAvisoPpapGits({
                                    pedido: pedido.trim(),
                                    item: itempv.trim(),
                                    produto: produto ? produto.trim() : 'Desconhecido',
                                    recurso: operacao_codigo,
                                    usuario: usuario || 'Sistema',
                                    quantidade: qtyNum
                                });
                                
                                const targetJid = '120363357136677244@g.us'; // Grupo PPAP WABTEC 2026
                                await sendText([targetJid], waText, `Aviso PPAP Pedido ${pedido.trim()}`);
                                console.log(`[WhatsApp] Aviso PPAP enviado para grupo referente à OP ${op_numero}`);
                            }
                        }
                }
            } catch (err) {
                console.error('[PPAP WhatsApp Error]', err.message);
            }
        })();
        // --- FIM VERIFICAÇÃO PPAP ---
    } catch (err) {
        console.error('[APPOINT ERROR]', err);
        if (connection) await connection.rollback();

        if (err.isCascataError) {
            await sendCascataErrorEmail(req.body.usuario, req.body.op_numero, err.cascataItems || [], err.message);
            return res.status(400).json({ error: 'Falha no Apontamento em Cascata. Um email foi enviado com os detalhes.', details: err.message });
        }

        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// GET /api/production/appointments/:op - Get History
router.get('/appointments/:op', async (req, res) => {
    try {
        const { item, sequencia, operacao } = req.query;

        let sql = `
            SELECT a.*, MAX(u.fotoUsuario) as usuario_foto 
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

        sql += ' GROUP BY a.id ORDER BY a.data_inicio DESC';

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
                pgSql += ` AND c2.c2_pedido = $${paramCount}`;
                pgParams.push(pedido.trim().padStart(6, '0'));
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
            sql += ` AND a.data_fim >= ?`;
            params.push(`${data_inicio} 00:00:00`);
        }
        if (data_fim) {
            sql += ` AND a.data_fim <= ?`;
            params.push(`${data_fim} 23:59:59`);
        }

        if (op) {
            sql += ` AND a.op_numero = ?`;
            params.push(String(op).trim().padStart(6, '0'));
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
                const normalizedOpNums = [...new Set([
                    ...opNums,
                    ...opNums.map(o => String(o).trim().padStart(6, '0')),
                    ...opNums.map(o => String(o).trim().replace(/^0+/, ''))
                ])].filter(Boolean);
                console.log('[PENDENTES ENRICH] opNums count:', opNums.length, 'sample:', opNums.slice(0, 3));

                const [scRes, [planRows]] = await Promise.all([
                    normalizedOpNums.length ? db.query(
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
                         LEFT JOIN sc5010 c5 ON c5.c5_num = c2.c2_pedido
                             AND c5.c5_filial = c2.c2_filial
                             AND COALESCE(c5.d_e_l_e_t_,'') IN ('',' ')
                         LEFT JOIN sa1010 sa1 ON sa1.a1_cod = c5.c5_cliente
                             AND sa1.a1_loja = c5.c5_lojacli
                             AND COALESCE(sa1.d_e_l_e_t_,'') IN ('',' ')
                         LEFT JOIN public.sg2010 g2 ON
                             g2.g2_produto = c2.c2_produto
                             AND g2.g2_filial = c2.c2_filial
                             AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
                         LEFT JOIN public.sh1010 h1 ON
                             h1.h1_codigo = g2.g2_recurso
                             AND h1.h1_filial = g2.g2_filial
                             AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
                          WHERE COALESCE(c2.d_e_l_e_t_,'') IN ('',' ')
                          AND c2.c2_num = ANY($1)`,
                        [normalizedOpNums]
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

                    // Fallback to parents
                    const scItemHead = scMap[`${cleanOp}_${r.op_item || ''}_001`];
                    const scOpHead = scMap[`${cleanOp}_01_001`] || scMap[`${cleanOp}_001`];

                    const best_pedido = sc?.pedido_venda || scItemHead?.pedido_venda || scOpHead?.pedido_venda || '';
                    const best_obs = sc?.obs_venda || scItemHead?.obs_venda || scOpHead?.obs_venda || '';
                    const best_nome = sc?.nome_cliente || scItemHead?.nome_cliente || scOpHead?.nome_cliente || null;
                    const best_prod = sc?.produto_codigo || scItemHead?.produto_codigo || scOpHead?.produto_codigo || null;

                    r.produto_codigo = best_prod || r.produto_codigo || null;
                    const raw_ped = best_pedido || '';
                    const raw_obs = best_obs || '';
                    r.pedido_venda = raw_ped.trim() || (raw_obs.trim().match(/^\d+/)?.[0] || null);
                    r.nome_cliente = best_nome || null;
                    r.pdf_url = r.produto_codigo ? pdfMap[r.produto_codigo] : null;

                    if (sc) {
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
                console.warn('[PENDENTES ENRICH ERROR]', e.message);
                console.warn('[PENDENTES ENRICH STACK]', e.stack);
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
// Cache em memória para evitar hit no PG a cada navegação
let _processesCache = null;
let _processesCacheTime = 0;
const PROCESSES_CACHE_TTL = 30 * 1000; // 30 segundos

// Fallback estático caso o PG esteja indisponível (recursos conhecidos do roteiro)
const FALLBACK_RESOURCES = [
    { codigo: 'MO0001', descricao: 'FABRICAÇÃO' },
    { codigo: 'MO0002', descricao: 'MONTAGEM' },
    { codigo: 'MO0003', descricao: 'USINAGEM' },
    { codigo: 'MO0004', descricao: 'SOLDA' },
    { codigo: 'MO0005', descricao: 'PINTURA' },
    { codigo: 'MO0006', descricao: 'EXPEDIÇÃO' },
    { codigo: 'MO0013', descricao: 'LASER' },
];

router.get('/processes', async (req, res) => {
    const force = req.query.force === '1';
    const tenantId = getTenantContext(req) || 0;
    const cached = _processesCache && _processesCache[tenantId];

    // Retorna cache se válido e não forçado
    if (!force && cached && (Date.now() - cached.time) < PROCESSES_CACHE_TTL) {
        return res.json({ data: cached.data, source: 'cache' });
    }

    try {
        // Catálogo nativo de recursos do SINCO (cadastro em PCP > Setores/Recursos)
        let sql = `
            SELECT TRIM(codigo) AS codigo,
                   TRIM(COALESCE(NULLIF(nome, ''), descricao, '')) AS descricao
            FROM pcp_recursos
            WHERE TRIM(codigo) <> ''
              AND COALESCE(ativo, 1) = 1
        `;
        const params = [];
        if (tenantId) {
            sql += ' AND IdEmpresa = ?';
            params.push(tenantId);
        }
        sql += ' ORDER BY codigo';

        const [rows] = await mysqlPool.query(sql, params);
        console.log(`✅ [PROCESSES] ${rows.length} recursos no SINCO (empresa ${tenantId || 'todas'})`);

        _processesCache = _processesCache || {};
        _processesCache[tenantId] = { data: rows, time: Date.now() };

        res.json({ data: rows, source: 'db' });
    } catch (err) {
        console.warn('⚠️ [PROCESSES] Erro ao buscar recursos no SINCO:', err.code, err.message);
        if (cached) {
            return res.json({ data: cached.data, source: 'cache_stale' });
        }
        res.json({ data: FALLBACK_RESOURCES, source: 'fallback' });
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
            params.push(data_inicio.replace(/-/g, ''));
            paramCount++;
        }

        if (data_fim) {
            whereClause += ` AND c5.c5_emissao <= $${paramCount}`;
            params.push(data_fim.replace(/-/g, ''));
            paramCount++;
        }

        // 2. Fetch Sales Orders with Items and OPs (usando bytea para decodificação 100% segura de WIN1252)
        const query = `
            WITH PedidosBase AS(
                SELECT DISTINCT
                    c5.c5_num AS pedido,
                    c5.c5_cliente AS cod_cliente,
                    c5.c5_lojacli AS loja_cliente,
                    a1.a1_nome::bytea AS nome_cliente_raw,
                    a1.a1_nreduz::bytea AS fantasia_cliente_raw,
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
                    c6.c6_descri::bytea AS desc_produto_raw,
                    c6.c6_qtdven::numeric AS qtd_item,
                    c6.c6_entreg AS data_entrega
                FROM public.sc6010 c6
                INNER JOIN PedidosBase pb ON pb.pedido = c6.c6_num
                WHERE COALESCE(c6.d_e_l_e_t_, '') IN('', ' ')
            ),
            -- 3. Get OPs (Header level for the Item) with Robust Linkage
            OPsCabecalho AS(
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
                           AND TRIM(parent.c2_item) IN ('01', '001', '1')
                           AND COALESCE(parent.d_e_l_e_t_, '') IN ('', ' ')
                         LIMIT 1)
                    ) AS pedido,
                    COALESCE(
                        NULLIF(TRIM(c2.c2_itempv), ''),
                        (SELECT parent.c2_itempv 
                         FROM public.sc2010 parent 
                         WHERE parent.c2_num = c2.c2_num 
                           AND TRIM(parent.c2_item) IN ('01', '001', '1')
                           AND COALESCE(parent.d_e_l_e_t_, '') IN ('', ' ')
                         LIMIT 1)
                    ) AS item_pedido
                FROM public.sc2010 c2
                WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
                  AND c2.c2_num IN (
                      SELECT DISTINCT c2_inner.c2_num
                      FROM public.sc2010 c2_inner
                      INNER JOIN PedidosBase pb ON TRIM(c2_inner.c2_pedido) = pb.pedido
                      WHERE COALESCE(c2_inner.d_e_l_e_t_, '') IN ('', ' ')
                  )
            ),
            -- 4. JOIN with SG2 (Roteiro) to Explode Operations
            OPsRoteiro AS(
                SELECT 
                    op.op_num,
                    op.item_op,
                    op.cod_produto AS cod_produto_op,
                    op.pedido,
                    op.item_pedido,
                    op.qtd_planejada,
                    TRIM(g2.g2_operac) AS sequencia,
                    g2.g2_recurso::bytea AS recurso_raw,
                    g2.g2_descri::bytea AS desc_operacao_raw
                FROM OPsCabecalho op
                LEFT JOIN public.sg2010 g2 
                    ON btrim(g2.g2_produto) = btrim(op.cod_produto) 
                    AND COALESCE(g2.d_e_l_e_t_, '') IN('', ' ')
            )
            SELECT
                pb.pedido,
                pb.cod_cliente,
                pb.loja_cliente,
                pb.nome_cliente_raw,
                pb.fantasia_cliente_raw,
                pb.data_emissao,
                ip.item,
                ip.cod_produto,
                ip.desc_produto_raw,
                ip.qtd_item,
                ip.data_entrega,
                ops.op_num AS op,
                ops.item_op,
                ops.sequencia,
                ops.cod_produto_op,
                ops.recurso_raw,
                ops.desc_operacao_raw,
                ops.qtd_planejada
            FROM PedidosBase pb
            LEFT JOIN ItensPedido ip ON ip.pedido = pb.pedido
            LEFT JOIN OPsRoteiro ops 
                ON ops.pedido = pb.pedido 
                AND ops.item_pedido = ip.item
            ORDER BY pb.pedido DESC, ip.item, ops.op_num, ops.sequencia
        `;

        console.log('⏳ [PEDIDOS-EVOLUTION] Executing query...');
        const pgRes = await db.query(query, params);
        const rows = pgRes.rows;

        console.log(`✅ [PEDIDOS-EVOLUTION] Found ${rows.length} rows`);

        if (rows.length === 0) {
            return res.json({ pedidos: [], resumo: { total_pedidos: 0, concluidos: 0, em_andamento: 0, nao_iniciados: 0 } });
        }

        const td = new TextDecoder('windows-1252');
        const decodeWin = (val) => {
            if (!val) return '';
            if (typeof val === 'string') return val.trim();
            if (Buffer.isBuffer(val) || val instanceof Uint8Array) {
                try { return td.decode(val).trim(); } catch (e) { return String(val).trim(); }
            }
            return String(val).trim();
        };

        // 3. Fetch all appointments from MySQL
        const [appointments] = await mysqlPool.query(`
            SELECT
                op_numero, op_item, op_sequencia, operacao_codigo,
                SUM(quantidade) as total_produzido,
                MAX(data_fim) as ultima_atualizacao
            FROM app_production_appointments
            GROUP BY op_numero, op_item, op_sequencia, operacao_codigo
        `);

        // Create appointments map for quick lookup
        const appointmentsMap = {};
        appointments.forEach(a => {
            const key = `${a.op_numero}_${a.op_item}_${a.op_sequencia}_${a.operacao_codigo}`;
            appointmentsMap[key] = a;
        });

        // 3.5 Fetch PCP Forecasts
        const pcpForecastMap = {};
        const pedidoItems = rows
            .filter(r => (r.pedido || '').trim() && (r.item || '').trim())
            .map(r => `('${r.pedido.trim()}', '${r.item.trim()}')`);

        if (pedidoItems.length > 0) {
            const uniquePedidoItems = [...new Set(pedidoItems)].join(',');
            const [forecastRows] = await mysqlPool.query(`
                SELECT pedido, item, data_entrega_pcp
                FROM app_pcp_delivery_forecasts
                WHERE (TRIM(pedido), TRIM(item)) IN (${uniquePedidoItems})
                ORDER BY id ASC
            `);
            forecastRows.forEach(f => {
                const key = `${f.pedido.trim()}_${f.item.trim()}`;
                if (!pcpForecastMap[key]) {
                    pcpForecastMap[key] = f.data_entrega_pcp;
                }
            });
        }

        // 4. Build hierarchical structure
        const pedidosMap = {};

        rows.forEach(row => {
            const pedidoNum = row.pedido;
            const nomeCliente = decodeWin(row.nome_cliente_raw);
            const fantasiaCliente = decodeWin(row.fantasia_cliente_raw);
            const descProduto = decodeWin(row.desc_produto_raw);
            const recurso = decodeWin(row.recurso_raw);
            const descOperacao = decodeWin(row.desc_operacao_raw);
            const descOperacaoFormatada = recurso ? (descOperacao ? `${recurso} - ${descOperacao}` : recurso) : descOperacao;

            const emissaoRaw = row.data_emissao ? String(row.data_emissao).trim() : '';
            const emissaoFormatada = emissaoRaw.length === 8 ? `${emissaoRaw.substring(0, 4)}-${emissaoRaw.substring(4, 6)}-${emissaoRaw.substring(6, 8)}` : emissaoRaw;

            // Initialize pedido if not exists
            if (!pedidosMap[pedidoNum]) {
                pedidosMap[pedidoNum] = {
                    numero: pedidoNum,
                    cliente: {
                        codigo: row.cod_cliente,
                        loja: row.loja_cliente,
                        nome: nomeCliente,
                        fantasia: fantasiaCliente
                    },
                    data_emissao: emissaoFormatada,
                    itens: {}
                };
            }

            // Initialize item if exists and not added yet
            if (row.item && !pedidosMap[pedidoNum].itens[row.item]) {
                const pcpData = pcpForecastMap[`${pedidoNum.trim()}_${row.item.trim()}`];

                const entregaRaw = row.data_entrega ? String(row.data_entrega).trim() : '';
                const entregaFormatada = entregaRaw.length === 8 ? `${entregaRaw.substring(0, 4)}-${entregaRaw.substring(4, 6)}-${entregaRaw.substring(6, 8)}` : entregaRaw;

                pedidosMap[pedidoNum].itens[row.item] = {
                    item: row.item,
                    produto: {
                        codigo: row.cod_produto,
                        descricao: descProduto
                    },
                    quantidade_item: parseFloat(row.qtd_item) || 0,
                    data_entrega: pcpData || entregaFormatada,
                    ops: []
                };
            }

            // Add OP to item if exists
            if (row.op && row.item) {
                const apptKey = `${row.op}_${row.item_op}_${row.sequen_op}_${row.sequencia}`;
                const appt = appointmentsMap[apptKey];

                const qtdApontada = appt ? parseFloat(appt.total_produzido) || 0 : 0;
                const qtdPlanejada = parseFloat(row.qtd_planejada) || 0;
                const percentual = qtdPlanejada > 0 ? Math.round((qtdApontada / qtdPlanejada) * 100) : 0;

                pedidosMap[pedidoNum].itens[row.item].ops.push({
                    op: row.op,
                    item_op: row.item_op,
                    sequencia: row.sequencia,
                    cod_produto: row.cod_produto_op,
                    operacao: descOperacaoFormatada || 'N/A',
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
        // Erro específico de encoding (dados WIN1252 corrompidos do Protheus)
        if (err.message && err.message.includes('encoding')) {
            console.error('❌ [PEDIDOS-EVOLUTION] Erro de encoding (WIN1252→UTF8):', err.message);
            return res.status(500).json({
                error: 'Erro de codificação de caracteres nos dados do ERP (WIN1252). Verifique o registro que contém caracteres especiais inválidos.',
                detail: err.message,
                code: 'ENCODING_ERROR'
            });
        }
        console.error('❌ [PEDIDOS-EVOLUTION] Error:', err);
        res.status(500).json({ error: err.message });
    }
};

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
            whereConditions.push(`a.op_numero = ? `);
            params.push(String(op).trim().padStart(6, '0'));
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
            appointmentFilters.push(`a.op_numero = ? `);
            appointmentParams.push(String(op).trim().padStart(6, '0'));
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

        // 1. App BOM (erp_estruturas_bom + erp_produtos), recursive, tenant-scoped
        try {
            const tenantId = getTenantContext(req) || req.user?.IdEmpresa || 1;
            const [bomRows] = await mysqlPool.query(
                `WITH RECURSIVE bom AS (
                    SELECT p.codigo AS codigo, CAST(NULL AS CHAR(50)) AS parent_code, CAST(1 AS DECIMAL(24,6)) AS qtd_necessaria, 0 AS nivel,
                           CAST(CONCAT(':', p.codigo, ':') AS CHAR(2000)) AS path_ids,
                           CAST(p.codigo AS CHAR(2000)) AS path_str
                    FROM erp_produtos p
                    WHERE p.codigo = ? AND p.IdEmpresa = ?
                    UNION ALL
                    SELECT b.produto_filho_codigo,
                           e.codigo AS parent_code,
                           CAST(e.qtd_necessaria * b.quantidade * (1 + COALESCE(b.perda_percentual, 0) / 100) AS DECIMAL(24,6)),
                           e.nivel + 1,
                           CONCAT(e.path_ids, b.id, ':'),
                           CONCAT(e.path_str, '>', LPAD(COALESCE(b.ordem_sequencia, 0), 4, '0'), LPAD(b.id, 8, '0'), '|', b.produto_filho_codigo)
                    FROM erp_estruturas_bom b
                    JOIN bom e ON b.produto_pai_codigo = e.codigo
                    WHERE b.IdEmpresa = ? AND COALESCE(b.ativo, 1) = 1 AND e.nivel < 10
                      AND LOCATE(CONCAT(':', b.id, ':'), e.path_ids) = 0
                      AND (e.parent_code IS NULL OR e.parent_code != e.codigo)
                )
                SELECT bom.codigo, bom.qtd_necessaria, bom.nivel, bom.path_str,
                       p.descricao, p.unidade_medida, p.tipo, p.revisao_atual, p.status, p.custo_standard
                FROM bom
                LEFT JOIN erp_produtos p ON p.codigo = bom.codigo AND p.IdEmpresa = ?
                ORDER BY bom.path_str
                LIMIT 1000`,
                [codLimpo, tenantId, tenantId, tenantId]
            );

            finalItems = bomRows.map(row => ({
                nivel: Number(row.nivel),
                codigo: row.codigo,
                descricao: row.descricao || '',
                unidade: row.unidade_medida || '',
                tipo_produto: row.tipo || '',
                rev_metalfisa: row.revisao_atual || '',
                rev_cliente: '',
                is_restricted: ['bloqueado', 'inativo'].includes(String(row.status || '').toLowerCase()),
                restri_sb1: '',
                restri_sz0: '',
                restricao_sz0_desc: '',
                qtd_necessaria: Number(row.qtd_necessaria),
                preco_padrao: parseFloat(row.custo_standard) || 0,
                tem_arquivos: false,
                primeiro_arquivo: null
            }));
            console.log(`✅[ESTRUTURA] ${finalItems.length} itens na BOM do app para ${codLimpo}`);
        } catch (bomError) {
            console.error('⚠️ [ESTRUTURA] Erro ao consultar BOM do app:', bomError.message);
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
                    tipo_produto: '',
                    qtd_necessaria: i.QtdeTotal || i.qtde,
                    preco_padrao: 0,
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
                            docsMap[d.produto_codigo] = [];
                        }
                        docsMap[d.produto_codigo].push(d.url_arquivo);
                    });

                    finalItems.forEach(i => {
                        if (docsMap[i.codigo] && docsMap[i.codigo].length > 0) {
                            i.tem_arquivos = true;
                            i.primeiro_arquivo = docsMap[i.codigo][0];
                            i.arquivos = docsMap[i.codigo];
                        } else {
                            i.arquivos = [];
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
                    const placeholders = codigos.map(() => '?').join(',');
                    const tenantRef = getTenantContext(req) || req.user?.IdEmpresa || 1;
                    const [refRows] = await mysqlPool.query(
                        `SELECT DISTINCT TRIM(pi.produto_codigo) AS produto, '' AS desenho,
                                COALESCE(cl.nome_fantasia, cl.razao_social, pv.cliente_codigo) AS cliente, '' AS revisao
                         FROM erp_pedidos_itens pi
                         JOIN erp_pedidos_venda pv ON pv.numero_pedido = pi.pedido_numero AND pv.IdEmpresa = pi.IdEmpresa
                         LEFT JOIN erp_clientes cl ON cl.codigo = pv.cliente_codigo AND cl.IdEmpresa = pv.IdEmpresa
                         WHERE pi.IdEmpresa = ? AND TRIM(pi.produto_codigo) IN (${placeholders})`,
                        [tenantRef, ...codigos]
                    );
                    const szRes = { rows: refRows };

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

        // 5. Enriquecimento com Custo (override por estrutura + preço padrão)
        // Um override aqui só vale DENTRO da estrutura deste produto pai (codLimpo) —
        // nunca altera o preço global do material para outros produtos que o utilizem.
        if (finalItems.length > 0) {
            const CUSTO_TIPOS = ['MP', 'MC', 'EM'];
            try {
                const [overrideRows] = await mysqlPool.execute(
                    'SELECT produto_componente, preco_unitario FROM app_estrutura_custo_override WHERE produto_pai = ?',
                    [codLimpo]
                );
                const overrideMap = {};
                overrideRows.forEach(r => { overrideMap[r.produto_componente.trim()] = parseFloat(r.preco_unitario); });

                finalItems.forEach(i => {
                    const padrao = parseFloat(i.preco_padrao) || 0;
                    const override = overrideMap[(i.codigo || '').trim()];
                    i.preco_padrao = padrao;
                    i.preco_override = override != null ? override : null;
                    i.preco_efetivo = override != null ? override : padrao;
                    i.eh_item_custo = CUSTO_TIPOS.includes((i.tipo_produto || '').toUpperCase());
                });
            } catch (custoErr) {
                console.error('⚠️ [ESTRUTURA] Erro ao buscar overrides de custo:', custoErr.message);
                finalItems.forEach(i => {
                    i.preco_padrao = parseFloat(i.preco_padrao) || 0;
                    i.preco_override = null;
                    i.preco_efetivo = i.preco_padrao;
                    i.eh_item_custo = CUSTO_TIPOS.includes((i.tipo_produto || '').toUpperCase());
                });
            }
        }

        // Custo é dado sensível — nunca sai do servidor para quem não tem a permissão
        // "valores_financeiros" (Acessos Sensíveis / RH-Financeiro). Esconder só na tela
        // não é suficiente, pois o valor continuaria visível na aba de rede do navegador.
        if (!(await hasFinancialAccess(req))) {
            finalItems.forEach(i => {
                delete i.preco_padrao;
                delete i.preco_override;
                delete i.preco_efetivo;
            });
        }

        res.json(finalItems);

    } catch (err) {
        console.error('[ESTRUTURA ERROR]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/production/estrutura/:codigo/:componente/preco
// Define um custo unitário específico para este componente, válido SOMENTE dentro
// da estrutura do produto :codigo (não altera o preço padrão global do material).
router.post('/estrutura/:codigo/:componente/preco', async (req, res) => {
    try {
        if (!(await hasFinancialAccess(req))) {
            return res.status(403).json({ error: 'Sem permissão para alterar valores financeiros.' });
        }

        const produtoPai = req.params.codigo.trim();
        const produtoComponente = req.params.componente.trim();
        const { preco, usuario } = req.body;

        if (preco === undefined || preco === null || isNaN(parseFloat(preco))) {
            return res.status(400).json({ error: 'Preço inválido.' });
        }

        await mysqlPool.execute(
            `INSERT INTO app_estrutura_custo_override (produto_pai, produto_componente, preco_unitario, atualizado_por)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE preco_unitario = VALUES(preco_unitario), atualizado_por = VALUES(atualizado_por)`,
            [produtoPai, produtoComponente, parseFloat(preco), usuario || 'Sistema']
        );

        res.json({ success: true, preco_override: parseFloat(preco) });
    } catch (err) {
        console.error('Erro ao salvar custo override da estrutura:', err.message);
        res.status(500).json({ error: 'Erro ao salvar o custo do componente.' });
    }
});

// DELETE /api/production/estrutura/:codigo/:componente/preco
// Remove o override — o componente volta a usar o preço padrão (Protheus) nesta estrutura.
router.delete('/estrutura/:codigo/:componente/preco', async (req, res) => {
    try {
        if (!(await hasFinancialAccess(req))) {
            return res.status(403).json({ error: 'Sem permissão para alterar valores financeiros.' });
        }

        const produtoPai = req.params.codigo.trim();
        const produtoComponente = req.params.componente.trim();

        await mysqlPool.execute(
            'DELETE FROM app_estrutura_custo_override WHERE produto_pai = ? AND produto_componente = ?',
            [produtoPai, produtoComponente]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao remover custo override da estrutura:', err.message);
        res.status(500).json({ error: 'Erro ao remover o custo do componente.' });
    }
});


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

// ==========================================
// FUNÇÕES AUXILIARES DE CASCATA
// ==========================================

function isSeqBefore(seqA, seqB) {
    if (!seqA || !seqB) return false;
    const numA = parseInt(seqA.replace(/[^0-9]/g, ''), 10);
    const numB = parseInt(seqB.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) {
        return numA < numB;
    }
    return seqA.trim().localeCompare(seqB.trim()) < 0;
}

async function processarBaixaCascata(connection, op_numero, op_item, op_sequencia, operacao_gatilho, quantidade_apontada, usuario_original, data_inicio, data_fim, initialStatus) {
    if (op_sequencia !== '001') {
        return; // Apenas inicia a baixa em cascata se for apontamento do produto pai (sequencia '001')
    }

    let cascataItems = [];
    try {
        const pgRes = await db.query(
            `SELECT TRIM(c2_produto) as produto_pai 
             FROM sc2010 
             WHERE c2_num = $1 AND c2_item = $2 AND c2_sequen = $3
             AND COALESCE(d_e_l_e_t_, '') IN ('', ' ')`,
            [op_numero, op_item, op_sequencia]
        );

        if (pgRes.rows.length === 0) return;

        const produtoPai = pgRes.rows[0].produto_pai;

        // 1.5 Auto-apontamento das outras operações do PRÓPRIO Produto Pai (apenas anteriores)
        const parentOpsRes = await db.query(`
            SELECT TRIM(g2.g2_operac) as operacao
            FROM public.sg2010 g2
            WHERE btrim(g2.g2_produto) = $1
            AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
            ORDER BY g2.g2_operac ASC
        `, [produtoPai]);

        // Buscamos a quantidade planejada do pai para segurança de saldo
        const parentPlanRes = await db.query(
            `SELECT c2_quant::numeric AS qtd_planejada
             FROM public.sc2010
             WHERE c2_num = $1 AND c2_item = $2 AND c2_sequen = $3
             AND COALESCE(d_e_l_e_t_, '') IN ('', ' ')`,
            [op_numero, op_item, op_sequencia]
        );
        const parentPlan = parentPlanRes.rows.length > 0 ? Number(parentPlanRes.rows[0].qtd_planejada) || 0 : 0;

        for (const popRow of parentOpsRes.rows) {
            if (!popRow.operacao || !isSeqBefore(popRow.operacao, operacao_gatilho)) continue;

            const [pAppRows] = await connection.execute(`
                SELECT COALESCE(SUM(quantidade), 0) as total_apontado
                FROM app_production_appointments
                WHERE op_numero = ? AND op_item = ? AND op_sequencia = ? AND operacao_codigo = ?
                AND conferencia_status NOT IN ('CANCELADO', 'DIVERGENTE')
            `, [op_numero, op_item, op_sequencia, popRow.operacao]);

            const apontadoPai = Number(pAppRows[0].total_apontado);
            const maxPermitidoPai = parentPlan > 0 ? parentPlan - apontadoPai : quantidade_apontada;
            const qtdEfetivaPai = Math.min(quantidade_apontada, maxPermitidoPai);

            if (qtdEfetivaPai > 0) {
                cascataItems.push({ componente: produtoPai, operacao: popRow.operacao, faltante: qtdEfetivaPai });

                const fantasmaUser = usuario_original || "SISTEMA SINCO - BAIXA AUTOMÁTICA";
                const obsFantasma = `Apontamento automático (Mesmo Produto). Ref: Operação Pendente`;

                await connection.execute(`
                    INSERT INTO app_production_appointments
                    (op_numero, op_item, op_sequencia, operacao_codigo, usuario, quantidade, data_inicio, data_fim, observacao, materiais_utilizados, conferencia_status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
                `, [op_numero, op_item, op_sequencia, popRow.operacao, fantasmaUser, qtdEfetivaPai, data_inicio, data_fim, obsFantasma, initialStatus]);
            }
        }

        // 2. Explosão de Estrutura (BOM) recursiva
        const bomRes = await db.query(`
            WITH RECURSIVE bom_tree AS (
                SELECT 
                    TRIM(g1.g1_cod) AS pai,
                    TRIM(g1.g1_comp) AS componente,
                    g1.g1_quant::numeric AS qtde_necessaria,
                    1 AS nivel,
                    ARRAY[TRIM(g1.g1_comp)] as path
                FROM public.sg1010 g1
                WHERE TRIM(g1.g1_cod) = $1 AND COALESCE(g1.d_e_l_e_t_, '') IN ('', ' ')
                
                UNION ALL
                
                SELECT 
                    TRIM(g1.g1_cod),
                    TRIM(g1.g1_comp),
                    (bt.qtde_necessaria * g1.g1_quant::numeric)::numeric,
                    bt.nivel + 1,
                    bt.path || TRIM(g1.g1_comp)
                FROM public.sg1010 g1
                INNER JOIN bom_tree bt ON TRIM(g1.g1_cod) = bt.componente
                WHERE COALESCE(g1.d_e_l_e_t_, '') IN ('', ' ')
                AND NOT (TRIM(g1.g1_comp) = ANY(bt.path))
            )
            SELECT componente, qtde_necessaria, nivel FROM bom_tree ORDER BY nivel;
        `, [produtoPai]);

        if (bomRes.rows.length === 0) return;

        for (const row of bomRes.rows) {
            const qtdRequeridaPorBOM = Number(row.qtde_necessaria) * quantidade_apontada;

            const opRes = await db.query(`
                SELECT 
                    TRIM(c2.c2_item) as item_op, 
                    TRIM(c2.c2_sequen) as sequen_op,
                    TRIM(g2.g2_operac) as operacao,
                    c2.c2_quant::numeric AS qtd_planejada
                FROM public.sc2010 c2
                LEFT JOIN public.sg2010 g2 ON btrim(g2.g2_produto) = btrim(c2.c2_produto) AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
                WHERE c2.c2_num = $1 AND TRIM(c2.c2_produto) = $2 AND c2.c2_item = $3
                AND COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
            `, [op_numero, row.componente, op_item]);

            if (opRes.rows.length === 0) continue;

            for (const opRow of opRes.rows) {
                if (!opRow.operacao) continue;

                const [appRows] = await connection.execute(`
                    SELECT COALESCE(SUM(quantidade), 0) as total_apontado
                    FROM app_production_appointments
                    WHERE op_numero = ? AND op_item = ? AND op_sequencia = ? AND operacao_codigo = ?
                    AND conferencia_status NOT IN ('CANCELADO', 'DIVERGENTE')
                `, [op_numero, opRow.item_op, opRow.sequen_op, opRow.operacao]);

                const apontado = Number(appRows[0].total_apontado);
                const childPlan = Number(opRow.qtd_planejada) || 0;
                
                // Garantimos que a soma total apontada após a cascata nunca excede a quantidade planejada da OP filha
                const maxPermitido = childPlan > 0 ? childPlan - apontado : qtdRequeridaPorBOM;
                const qtdEfetiva = Math.min(qtdRequeridaPorBOM, maxPermitido);

                if (qtdEfetiva > 0) {
                    cascataItems.push({ componente: row.componente, operacao: opRow.operacao, faltante: qtdEfetiva });

                    const fantasmaUser = "SISTEMA SINCO - BAIXA AUTOMÁTICA";
                    const obsFantasma = `Apontamento automático (Cascata). Ref: Produto Pai ${produtoPai}`;

                    await connection.execute(`
                        INSERT INTO app_production_appointments
                        (op_numero, op_item, op_sequencia, operacao_codigo, usuario, quantidade, data_inicio, data_fim, observacao, materiais_utilizados, conferencia_status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
                    `, [op_numero, opRow.item_op, opRow.sequen_op, opRow.operacao, fantasmaUser, qtdEfetiva, data_inicio, data_fim, obsFantasma, initialStatus]);
                }
            }
        }
    } catch (err) {
        console.error('[CASCATA] Erro interno de execução:', err);
        err.isCascataError = true;
        err.cascataItems = cascataItems;
        throw err;
    }
}

async function sendCascataErrorEmail(usuario, op_numero, missingDetails, errorMsg) {
    try {
        const [rows] = await mysqlPool.query('SELECT Email FROM usuario WHERE NomeCompleto = ? OR Login = ?', [usuario, usuario]);
        if (rows.length === 0 || !rows[0].Email) return;

        const { sendMail } = require('../services/mailService');

        const html = `
            <h2>Falha no Apontamento em Cascata</h2>
            <p>A tentativa de apontamento automático para a OP <strong>${op_numero}</strong> falhou. A transação foi desfeita (Rollback).</p>
            <p><strong>Motivo/Erro:</strong> ${errorMsg}</p>
            <h3>Tentativa de compensação nas seguintes operações (Faltantes):</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th style="border: 1px solid #ddd; padding: 8px;">Componente</th>
                        <th style="border: 1px solid #ddd; padding: 8px;">Operação</th>
                        <th style="border: 1px solid #ddd; padding: 8px;">Qtd Faltante Tentada</th>
                    </tr>
                </thead>
                <tbody>
                    ${missingDetails.length > 0 ? missingDetails.map(d => `
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${d.componente}</td>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${d.operacao}</td>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${d.faltante}</td>
                    </tr>
                    `).join('') : '<tr><td colspan="3" style="text-align: center; padding: 8px;">Nenhuma operação listada.</td></tr>'}
                </tbody>
            </table>
            <br/>
            <p>Por favor, avise o setor de TI ou PCP sobre este erro sistêmico.</p>
        `;

        await sendMail({
            to: rows[0].Email,
            subject: `⚠️ ERRO: Baixa Automática Cascata - OP ${op_numero}`,
            html: getCorporateEmailTemplate ? getCorporateEmailTemplate(html) : html
        });
    } catch (err) {
        console.error('[CASCATA EMAIL ERROR]', err);
    }
}
// GET /api/production/capacities - Obter capacidades (horas_dia e default_tempo)
router.get('/capacities', async (req, res) => {
    try {
        const [mysqlCaps] = await mysqlPool.execute('SELECT recurso_codigo, capacidade_diaria_minutos, tempo_padrao_minutos FROM app_recursos_capacidade');
        const capMap = {};
        mysqlCaps.forEach(c => {
            capMap[c.recurso_codigo.trim().toUpperCase()] = {
                horas_dia: (parseFloat(c.capacidade_diaria_minutos) || 528) / 60,
                default_tempo_peca: (parseFloat(c.tempo_padrao_minutos) || 0) / 60
            };
        });
        res.json(capMap);
    } catch (err) {
        console.error('[CAPACITIES ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/production/resumo-pedidos — Resumo de planejamento agrupado por pedido e recurso
router.get('/resumo-pedidos', async (req, res) => {
    let pgClient = null;
    try {
        const { pedido } = req.query;

        // 1. Busca dados do MySQL agrupados por op_numero + recurso_codigo
        const mysqlWhere = pedido ? `AND op_numero = ?` : '';
        const mysqlParams = pedido ? [pedido] : [];

        const [rows] = await mysqlPool.execute(`
            SELECT
                op_numero,
                recurso_codigo,
                produto_codigo,
                MIN(data_planejada_inicio)  AS data_inicio,
                MAX(data_planejada_fim)     AS data_fim,
                (DATEDIFF(MAX(data_planejada_fim), MIN(data_planejada_inicio)) + 1) AS total_dias,
                COUNT(*)                   AS total_ops,
                GROUP_CONCAT(DISTINCT operacao_codigo ORDER BY operacao_codigo) AS operacoes
            FROM app_production_planning
            WHERE recurso_codigo IS NOT NULL
              AND data_planejada_inicio IS NOT NULL
              ${mysqlWhere}
            GROUP BY op_numero, recurso_codigo, produto_codigo
            ORDER BY op_numero, data_planejada_inicio
        `, mysqlParams);

        if (rows.length === 0) return res.json([]);

        // 2. Busca mapeamento op_numero -> pedido_venda no Protheus
        const uniqueOps = [...new Set(rows.map(r => (r.op_numero || '').trim()))];
        pgClient = await db.connect();
        const pgRes = await pgClient.query(`
            SELECT DISTINCT TRIM(c2_num) AS op, TRIM(c2_pedido) AS pedido, TRIM(c2_itempv) AS ped_item,
                   TRIM(c2_produto) AS produto
            FROM public.sc2010
            WHERE TRIM(c2_num) = ANY($1)
              AND COALESCE(d_e_l_e_t_,'') IN ('',' ')
        `, [uniqueOps]);

        const opPedidoMap = {};
        pgRes.rows.forEach(r => {
            if (!opPedidoMap[r.op]) opPedidoMap[r.op] = r.pedido || r.op;
        });

        // 3. Busca capacidade dos recursos
        const [caps] = await mysqlPool.execute(
            'SELECT recurso_codigo, capacidade_diaria_minutos FROM app_recursos_capacidade'
        );
        const capMap = {};
        caps.forEach(c => { capMap[(c.recurso_codigo || '').trim().toUpperCase()] = parseFloat(c.capacidade_diaria_minutos) || 528; });

        // 4. Monta resultado final com minutos calculados por dias
        const result = rows.map(r => {
            const opTrimmed = (r.op_numero || '').trim();
            const recurso = (r.recurso_codigo || '').trim().toUpperCase();
            const capDia = capMap[recurso] || 528;
            const totalDias = parseFloat(r.total_dias) || 1;
            const totalMin = totalDias * capDia;

            const dtInicio = r.data_inicio ? new Date(r.data_inicio) : null;
            const dtFim = r.data_fim ? new Date(r.data_fim) : null;
            // Dias corridos reais entre inicio e fim
            const diasCorridos = (dtInicio && dtFim)
                ? Math.ceil((dtFim - dtInicio) / (1000 * 60 * 60 * 24)) + 1
                : totalDias;

            return {
                pedido_venda: opPedidoMap[opTrimmed] || opTrimmed,
                op_numero: opTrimmed,
                recurso_codigo: recurso,
                produto_codigo: (r.produto_codigo || '').trim(),
                data_inicio: dtInicio ? dtInicio.toISOString().split('T')[0] : null,
                data_fim: dtFim ? dtFim.toISOString().split('T')[0] : null,
                total_dias_planejados: totalDias,
                dias_corridos: diasCorridos,
                total_minutos: Math.round(totalMin),
                total_horas: parseFloat((totalMin / 60).toFixed(1)),
                capacidade_dia_min: capDia,
                total_ops: parseInt(r.total_ops) || 0,
                operacoes: r.operacoes || ''
            };
        });

        res.json(result);
    } catch (err) {
        console.error('[RESUMO-PEDIDOS ERROR]', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (pgClient) pgClient.release();
    }
});

// GET /api/production/daily-schedule
// Retorna fatias diárias de alocação por peça por operação
// Parâmetros query: ops (csv), recurso, data_inicio, data_fim
router.get('/daily-schedule', async (req, res) => {
    try {
        const { ops, recurso, data_inicio, data_fim } = req.query;

        const conditions = [];
        const params = [];

        if (ops) {
            const opList = ops.split(',').map(o => o.trim()).filter(Boolean);
            if (opList.length > 0) {
                conditions.push(`op_numero IN (${opList.map(() => '?').join(',')})`);
                params.push(...opList);
            }
        }
        if (recurso) {
            conditions.push('recurso_codigo = ?');
            params.push(recurso);
        }
        if (data_inicio) {
            conditions.push('data_alocacao >= ?');
            params.push(data_inicio);
        }
        if (data_fim) {
            conditions.push('data_alocacao <= ?');
            params.push(data_fim);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const [rows] = await mysqlPool.query(
            `SELECT op_numero, op_item, op_sequencia, operacao_codigo, recurso_codigo, produto_codigo,
                    data_alocacao, qtd_alocada, minutos_alocados, usuario_planejador, criado_em
             FROM app_production_planning_diario
             ${where}
             ORDER BY data_alocacao ASC, recurso_codigo ASC, op_numero ASC`,
            params
        );

        // Agrupar por data > recurso para facilitar visualização no chão de fábrica
        const byDate = {};
        for (const row of rows) {
            const d = row.data_alocacao instanceof Date
                ? row.data_alocacao.toISOString().split('T')[0]
                : String(row.data_alocacao).split('T')[0];
            if (!byDate[d]) byDate[d] = {};
            if (!byDate[d][row.recurso_codigo]) byDate[d][row.recurso_codigo] = [];
            byDate[d][row.recurso_codigo].push({
                op_numero: row.op_numero,
                operacao_codigo: row.operacao_codigo,
                produto_codigo: row.produto_codigo,
                qtd_alocada: row.qtd_alocada,
                minutos_alocados: row.minutos_alocados,
            });
        }

        res.json({ success: true, total: rows.length, by_date: byDate, rows });
    } catch (err) {
        console.error('[DAILY-SCHEDULE ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/production/op-materials - Retorna os empenhos (SD4) das OPs solicitadas
router.post('/op-materials', async (req, res) => {
    try {
        const { ops } = req.body;
        if (!ops || !Array.isArray(ops) || ops.length === 0) {
            return res.json({ success: true, materials: [] });
        }

        // Build array of D4_OP values (concatenation of OP + ITEM + SEQUEN)
        const d4Ops = ops.map(op => {
            const num = String(op.op).padEnd(6, ' ');
            const item = String(op.item_op).padStart(2, '0');
            const seq = String(op.sequen).padStart(3, '0');
            return `'${num}${item}${seq}'`;
        }).join(',');

        const query = `
            SELECT 
                TRIM(SD4.D4_OP) as op_formatada,
                TRIM(SD4.D4_COD) as material_codigo,
                TRIM(SB1.B1_DESC) as material_descricao,
                TRIM(SB1.B1_UM) as um,
                TRIM(SB1.B1_TIPO) as tipo,
                TRIM(SB1.B1_GRUPO) as grupo,
                SD4.D4_QTDEORI as qtd_original,
                SD4.D4_QUANT as qtd_pendente,
                TRIM(SD4.D4_DATA) as data_necessidade_op,
                SD4.D4_LOCAL as armazem,
                

                -- Solicitação (Compras)
                TRIM(SC1.C1_NUM) as num_sc,
                TRIM(SC1.C1_EMISSAO) as data_emissao_sc,
                TRIM(SC1.C1_DATPRF) as data_sc,
                
                -- Pedido (Compras)
                TRIM(SC7.C7_NUM) as num_pc,
                TRIM(SC7.C7_EMISSAO) as data_emissao_pc,
                TRIM(SC7.C7_DATPRF) as data_pc,
                TRIM(SC7.C7_FORNECE) as fornecedor_cod
                
            FROM SD4010 SD4
            INNER JOIN SB1010 SB1 ON TRIM(SB1.B1_COD) = TRIM(SD4.D4_COD) AND SB1.D_E_L_E_T_ = ''
            LEFT JOIN SC1010 SC1 ON TRIM(SC1.C1_OP) = TRIM(SD4.D4_OP) AND TRIM(SC1.C1_PRODUTO) = TRIM(SD4.D4_COD) AND SC1.D_E_L_E_T_ = ''
            LEFT JOIN SC7010 SC7 ON TRIM(SC7.C7_NUMSC) = TRIM(SC1.C1_NUM) AND TRIM(SC7.C7_ITEMSC) = TRIM(SC1.C1_ITEM) AND SC7.D_E_L_E_T_ = ''
            WHERE SD4.D_E_L_E_T_ = ''
              AND TRIM(SD4.D4_OP) IN (${ops.map(op => `'${String(op.op).trim()}${String(op.item_op).trim()}${String(op.sequen).trim()}'`).join(',')})
              AND TRIM(SB1.B1_TIPO) = 'MP'
            ORDER BY TRIM(SD4.D4_OP), TRIM(SD4.D4_COD)
        `;

        const result = await db.query(query);
        const materials = result.rows;

        // Fetch stock across ALL warehouses for these materials
        if (materials.length > 0) {
            const uniqueCodes = [...new Set(materials.map(m => m.material_codigo))];
            const sb2Query = `
                SELECT 
                    TRIM(B2_COD) as material_codigo,
                    TRIM(B2_LOCAL) as armazem,
                    B2_QATU as qatu,
                    B2_QEMP as qemp
                FROM SB2010
                WHERE D_E_L_E_T_ = ''
                  AND TRIM(B2_COD) IN (${uniqueCodes.map(c => `'${c}'`).join(',')})
            `;
            const sb2Result = await db.query(sb2Query);
            
            const stockMap = {};
            for(const row of sb2Result.rows) {
                if(!stockMap[row.material_codigo]) stockMap[row.material_codigo] = [];
                const livre = (row.qatu || 0) - (row.qemp || 0);
                if (livre > 0 || row.armazem === '03') { // Keep positive stock, or 03 (standard)
                   stockMap[row.material_codigo].push({ armazem: row.armazem, livre });
                }
            }

            for(const m of materials) {
                const stocks = stockMap[m.material_codigo] || [];
                m.estoques_detalhe = stocks.sort((a,b) => b.livre - a.livre);
                // Set total available stock so frontend logic (estoque_atual - estoque_empenhado) still works for total
                m.estoque_atual = stocks.reduce((acc, curr) => acc + curr.livre, 0);
                m.estoque_empenhado = 0; 
            }
        }

        res.json({ success: true, materials: materials });
    } catch (err) {
        console.error('[OP MATERIALS ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/production/op-priority
router.post('/op-priority', async (req, res) => {
    try {
        const { op_numero, prioridade, usuario } = req.body;
        if (!op_numero) return res.status(400).json({ error: 'op_numero is required' });
        
        await mysqlPool.execute(`
            INSERT INTO app_op_priorities (op_numero, prioridade, atualizado_por)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE prioridade = VALUES(prioridade), atualizado_por = VALUES(atualizado_por)
        `, [op_numero, prioridade || 0, usuario || 'Sistema']);
        
        res.json({ success: true });
    } catch (err) {
        console.error('[OP PRIORITY ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;


