const express = require('express');
const router = express.Router();
const db = require('../db'); // Postgres (Protheus)
const mysqlPool = require('../services/mysqlService'); // MySQL (App)
const { getInactiveOrdersFilter } = require('../util/pedidoFilterHelper');
const { calcCargaRecurso } = require('../utils/calcCargaRecurso');
// PdfPrinter desativado temporariamente devido a problemas com módulo
// const PdfPrinter = require('pdfmake/src/printer'); 
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

/**
 * Shared Data Fetching Logic
 * Returns { rows, kpis, total, page, totalPages }
 */
async function fetchReportData(filters, pagination = { page: 1, limit: 100 }) {
    const { date_start, date_end, status, client, op } = filters;
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    // 1. Base Query (Postgres - Protheus) - Same logic as Analytics Dashboard
    // We want mainly OPs here.
    const getInactiveFilter = await getInactiveOrdersFilter();
    let whereClause = `WHERE c2.d_e_l_e_t_ = ''` + getInactiveFilter('c2.c2_pedido');
    const params = [];

    if (op) {
        whereClause += ` AND TRIM(c2.c2_num) = $${params.length + 1}`;
        params.push(op);
    }
    if (client) {
        whereClause += ` AND (UPPER(a1.a1_nome) LIKE UPPER($${params.length + 1}) OR UPPER(a1.a1_nreduz) LIKE UPPER($${params.length + 1}))`;
        params.push(`%${client}%`);
    }
    if (date_start) {
        whereClause += ` AND c2.c2_datpri >= $${params.length + 1}`;
        params.push(date_start.replace(/-/g, ''));
    }
    if (date_end) {
        whereClause += ` AND c2.c2_datpri <= $${params.length + 1}`;
        params.push(date_end.replace(/-/g, ''));
    }
    if (filters.pedido) {
        whereClause += ` AND TRIM(c2.c2_pedido) LIKE $${params.length + 1}`;
        params.push(`%${filters.pedido}%`);
    }

    // PROTHEUS Query (Simplified for Reports)
    // Removed GROUP BY c2.c2_num to show all OP items individually
    const sql = `
        SELECT
            TRIM(c2.c2_num) as op,
            TRIM(c2.c2_item) as item,
            TRIM(c2.c2_sequen) as sequen,
            TRIM(c2.c2_produto) as produto,
            TRIM(sb1.b1_desc) as descricao,
            MAX(c5.c5_cliente) as cod_cliente,
            MAX(a1.a1_nome) as cliente_nome,
            MAX(c2.c2_pedido) as raw_pedido,
            MAX(c2.c2_itempv) as raw_item_pedido,
            MAX(c2.c2_obs) as obs_venda,
            MAX(c2.c2_datpri) as data_entrega_prevista,
            MAX(c2.c2_quant::numeric) as qtd_total_planejada,
            MAX(c2.c2_quje::numeric) as qtd_total_apontada_erp
        FROM sc2010 c2
        LEFT JOIN sc5010 c5 ON c5.c5_num = c2.c2_pedido AND c5.d_e_l_e_t_ = ''
        LEFT JOIN sa1010 a1 ON a1.a1_cod = c5.c5_cliente AND a1.d_e_l_e_t_ = ''
        LEFT JOIN sb1010 sb1 ON sb1.b1_cod = c2.c2_produto AND sb1.d_e_l_e_t_ = ''
        ${whereClause}
        GROUP BY c2.c2_num, c2.c2_item, c2.c2_sequen, c2.c2_produto, sb1.b1_desc
        ORDER BY c2.c2_num DESC, c2.c2_item ASC, c2.c2_sequen ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    // Execute Main Query
    const results = await db.query(sql, [...params, limit, offset]);

    // Execute Count Query (for pagination)
    const countSql = `
        SELECT COUNT(c2.r_e_c_n_o_) as total
        FROM sc2010 c2
        LEFT JOIN sc5010 c5 ON c5.c5_num = c2.c2_pedido AND c5.d_e_l_e_t_ = ''
        LEFT JOIN sa1010 a1 ON a1.a1_cod = c5.c5_cliente AND a1.d_e_l_e_t_ = ''
        ${whereClause}
    `;
    const countRes = await db.query(countSql, params);
    const totalRecords = parseInt(countRes.rows[0].total);

    // 2. Enhance with MySQL Data (Status & Progress)
    // Fetch aggregated progress from MySQL for these OPs
    let mysqlMap = {};
    let pcpForecastMap = {};
    if (results.rows.length > 0) {
        const opKeys = results.rows.map(r => `('${r.op}', '${r.item}', '${r.sequen}')`).join(',');
        const [mysqlRows] = await mysqlPool.query(`
            SELECT 
                p.op_numero,
                p.op_item,
                p.op_sequencia,
                MIN(p.data_planejada_inicio) as plan_inicio,
                MAX(p.data_planejada_fim) as plan_fim,
                COALESCE(stats.total_produzido, 0) as total_produzido
            FROM app_production_planning p
            LEFT JOIN (
                SELECT op_numero, op_item, op_sequencia, SUM(quantidade) as total_produzido
                FROM app_production_appointments
                GROUP BY op_numero, op_item, op_sequencia
            ) stats ON stats.op_numero = p.op_numero AND stats.op_item = p.op_item AND stats.op_sequencia = p.op_sequencia
            WHERE (p.op_numero, p.op_item, p.op_sequencia) IN (${opKeys})
            GROUP BY p.op_numero, p.op_item, p.op_sequencia
        `);

        mysqlRows.forEach(row => {
            mysqlMap[`${row.op_numero}_${row.op_item}_${row.op_sequencia}`] = row;
        });

        // Fetch PCP Forecasts
        const pedidoItems = results.rows
            .filter(r => (r.raw_pedido || '').trim() && (r.raw_item_pedido || '').trim())
            .map(r => `('${r.raw_pedido.trim()}', '${r.raw_item_pedido.trim()}')`);
        
        if (pedidoItems.length > 0) {
            const uniquePedidoItems = [...new Set(pedidoItems)].join(',');
            const [forecastRows] = await mysqlPool.query(`
                SELECT pedido, item, data_entrega_pcp, quantidade_pcp
                FROM app_pcp_delivery_forecasts
                WHERE (TRIM(pedido), TRIM(item)) IN (${uniquePedidoItems})
                ORDER BY id ASC
            `);
            
            forecastRows.forEach(row => {
                const key = `${row.pedido.trim()}_${row.item.trim()}`;
                if (!pcpForecastMap[key]) {
                    pcpForecastMap[key] = row; // Keep the first one, matching OrdersTable logic
                }
            });
        }
    }

    // Merge Data
    const rows = results.rows.map(pgRow => {
        const key = `${pgRow.op}_${pgRow.item}_${pgRow.sequen}`;
        const myData = mysqlMap[key] || {};
        const rawP = (pgRow.raw_pedido || '').trim();
        const rawItemP = (pgRow.raw_item_pedido || '').trim();
        
        const forecast = pcpForecastMap[`${rawP}_${rawItemP}`];
        
        const qtdPlan = forecast && forecast.quantidade_pcp ? parseFloat(forecast.quantidade_pcp) : (parseFloat(pgRow.qtd_total_planejada) || 0);
        const qtdProd = parseFloat(myData.total_produzido) || parseFloat(pgRow.qtd_total_apontada_erp) || 0; // Fallback to ERP
        const percent = qtdPlan > 0 ? (qtdProd / qtdPlan) * 100 : 0;

        // Determine Status based on dates and progress
        let status = 'PENDENTE';
        if (date_start && date_end) {
            // Filter logic if needed later
        }

        if (percent >= 100) status = 'CONCLUIDO';
        else if (percent > 0) status = 'EM_ANDAMENTO';

        const rawO = (pgRow.obs_venda || '').trim();

        return {
            op_completa: `${pgRow.op}-${pgRow.item}-${pgRow.sequen}`,
            op: pgRow.op,
            item: pgRow.item,
            sequen: pgRow.sequen,
            produto: pgRow.produto,
            descricao: pgRow.descricao || '',
            cliente: pgRow.cliente_nome?.trim() || 'N/A',
            pedido: rawP || (rawO.match(/^\d+/)?.[0] || 'N/A'),
            data_entrega: forecast ? forecast.data_entrega_pcp : (myData.plan_fim || pgRow.data_entrega_prevista),
            plan_inicio: myData.plan_inicio,
            plan_fim: myData.plan_fim,
            qtd_plan: qtdPlan,
            qtd_prod: qtdProd,
            progresso: Math.min(100, percent).toFixed(1),
            status
        };
    });

    // Calculate KPIs (Simple aggregation of the CURRENT PAGE or TOTAL? Ideally Total but expensive. 
    // For now, let's do a quick estimation or just use page for simplicity in demo, or separate query for KPIs)
    // We will do a separate KPI query if needed, but for now lets aggregate the current page visuals or return basics.
    const kpis = {
        total_ops: totalRecords,
        concluidos: 0, // Would need full scan query
        em_andamento: 0
    };

    return {
        rows,
        kpis,
        total: totalRecords,
        page: parseInt(page),
        totalPages: Math.ceil(totalRecords / limit)
    };
}

// GET /api/reports/production/data - JSON Data for Screen
router.get('/production/data', async (req, res) => {
    try {
        const data = await fetchReportData(req.query, {
            page: req.query.page || 1,
            limit: req.query.limit || 20
        });
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/production/pdf - Generate PDF
// Temporarily disabled due to pdfmake module issues
router.get('/production/pdf', async (req, res) => {
    res.status(503).json({ error: 'PDF generation temporarily unavailable - Excel export is available' });
});

// ALIAS FOR XLSX (Frontend calls 'xlsx', Backend implemented 'excel')
router.get('/production/xlsx', async (req, res) => {
    // Redirect logic or just copy-paste handler? 
    // Express requires re-registering the handler or calling it. 
    // We will just Register the SAME handler function to avoid duplication? 
    // For simplicity in this tool, I'll just redirect or re-implement.
    // Actually, let's just use re-use the handler if I could, but I can't easily extract it here alone.
    // I'll just redirect to the excel route? No, better to simply Map the route.
    req.url = '/production/excel';
    req.app.handle(req, res);
});

// GET /api/reports/production/excel - Generate Excel
router.get(['/production/excel', '/production/xlsx'], async (req, res) => {
    try {
        const { rows } = await fetchReportData(req.query, { page: 1, limit: 10000 });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Base44 System';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Dados de Produção');

        sheet.columns = [
            { header: 'OP Completa', key: 'op_completa', width: 20 },
            { header: 'Produto', key: 'produto', width: 20 },
            { header: 'Descrição', key: 'descricao', width: 40 },
            { header: 'Cliente', key: 'cliente', width: 40 },
            { header: 'Pedido Venda', key: 'pedido', width: 15 },
            { header: 'Entrega Prev.', key: 'entrega', width: 15 },
            { header: 'Qtd. Plan.', key: 'qtd_plan', width: 12 },
            { header: 'Qtd. Prod.', key: 'qtd_prod', width: 12 },
            { header: '% Progresso', key: 'progresso', width: 12 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        // Style Header
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFEEEEEE' }
        };

        rows.forEach(r => {
            sheet.addRow({
                op_completa: r.op_completa,
                produto: r.produto,
                descricao: r.descricao,
                cliente: r.cliente,
                pedido: r.pedido,
                entrega: parseDate(r.data_entrega),
                qtd_plan: r.qtd_plan,
                qtd_prod: r.qtd_prod,
                progresso: parseFloat(r.progresso) / 100, // For Excel percentage format
                status: r.status
            });
        });

        // Formatting
        sheet.getColumn('progresso').numFmt = '0.0%';
        sheet.getColumn('entrega').numFmt = 'dd/mm/yyyy';

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=relatorio_producao.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao gerar Excel: ' + err.message });
    }
});

// --- SALES PLANNING REPORT LOGIC ---
console.log('✅ [Reports] Loading Sales Planning Routes...');

/**
 * Fetch Sales Planning Data
 * Returns structured data for Orders List (hierarchical) or Flattened Items (for Planning View logic)
 */
async function fetchSalesPlanningData(filters, pagination = { page: 1, limit: 100 }) {
    const {
        client, order, product,
        delivery_start, delivery_end,
        emission_start, emission_end,
        status, active_only
    } = filters;

    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    const params = [];
    const getInactiveFilter = await getInactiveOrdersFilter();
    let whereClause = `WHERE c5.c5_tipo <> 'B' AND COALESCE(c5.d_e_l_e_t_, '') = ''` + getInactiveFilter('c5.c5_num');

    // Active Toggle (Exclude Billed/Deleted) - Updated to consider remaining balance
    if (active_only === 'true') {
        whereClause += ` AND (
            COALESCE(c5.c5_nota, '') = '' 
            OR EXISTS (
                SELECT 1 FROM public.sc6010 c6 
                WHERE c6.c6_num = c5.c5_num 
                AND c6.c6_filial = c5.c5_filial 
                AND COALESCE(c6.d_e_l_e_t_, '') = ''
                AND ((c6.c6_qtdven - c6.c6_qtdent) > 0 OR c6.c6_qtdlib > 0)
            )
        )`;
    }

    if (client) {
        whereClause += ` AND (UPPER(a1.a1_nome) LIKE UPPER($${params.length + 1}) OR UPPER(a1.a1_nreduz) LIKE UPPER($${params.length + 1}))`;
        params.push(`%${client}%`);
    }

    if (order) {
        whereClause += ` AND c5.c5_num LIKE $${params.length + 1}`;
        params.push(`%${order}%`);
    }

    if (emission_start) {
        whereClause += ` AND c5.c5_emissao >= $${params.length + 1}`;
        params.push(emission_start.replace(/-/g, ''));
    }
    if (emission_end) {
        whereClause += ` AND c5.c5_emissao <= $${params.length + 1}`;
        params.push(emission_end.replace(/-/g, ''));
    }

    // Product Filter (Exists logic)
    if (product) {
        whereClause += ` AND EXISTS (
            SELECT 1 FROM sc6010 sub_c6 
            LEFT JOIN sb1010 sub_b1 ON sub_b1.b1_cod = sub_c6.c6_produto
            WHERE sub_c6.c6_num = c5.c5_num 
            AND sub_c6.c6_filial = c5.c5_filial
            AND (UPPER(sub_c6.c6_produto) LIKE UPPER($${params.length + 1}) OR UPPER(sub_b1.b1_desc) LIKE UPPER($${params.length + 1}))
        )`;
        params.push(`%${product}%`);
    }

    // Delivery Date Filter (Exists logic on Items)
    if (delivery_start || delivery_end) {
        whereClause += ` AND EXISTS (
            SELECT 1 FROM sc6010 sub_c6 
            WHERE sub_c6.c6_num = c5.c5_num 
            AND sub_c6.c6_filial = c5.c5_filial
            ${delivery_start ? `AND sub_c6.c6_entreg >= '${delivery_start.replace(/-/g, '')}'` : ''}
            ${delivery_end ? `AND sub_c6.c6_entreg <= '${delivery_end.replace(/-/g, '')}'` : ''}
        )`;
    }

    // Count Query
    const countSql = `
        SELECT COUNT(DISTINCT c5.c5_num) as total
        FROM sc5010 c5
        LEFT JOIN sa1010 a1 ON a1.a1_cod = c5.c5_cliente AND a1.d_e_l_e_t_ = ''
        ${whereClause}
    `;
    const countRes = await db.query(countSql, params);
    const totalRecords = parseInt(countRes.rows[0].total);

    // Main Query (Headers)
    const sql = `
        SELECT
            c5.c5_num as pedido,
            MAX(c5.c5_emissao) as emissao,
            MAX(a1.a1_nome) as cliente,
            MAX(c5.c5_liberok) as liberado,
            MAX(c5.c5_nota) as nota,
            COUNT(c6.c6_item) as qtd_itens,
            SUM(COALESCE(c6.c6_qtdven, 0) - COALESCE(c6.c6_qtdent, 0)) as soma_qtd,
            MIN(c6.c6_entreg) as proxima_entrega
        FROM sc5010 c5
        LEFT JOIN sa1010 a1 ON a1.a1_cod = c5.c5_cliente AND a1.d_e_l_e_t_ = ''
        LEFT JOIN sc6010 c6 ON c6.c6_num = c5.c5_num AND c6.c6_filial = c5.c5_filial AND c6.d_e_l_e_t_ = ''
        ${whereClause}
        GROUP BY c5.c5_num
        ORDER BY MIN(c6.c6_entreg) ASC, c5.c5_num DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const results = await db.query(sql, [...params, limit, offset]);

    // Fetch Items for these orders (for expansion/export)
    const orderNumbers = results.rows.map(r => r.pedido);
    let itemsMap = {};
    if (orderNumbers.length > 0) {
        // Fetch full item details including description
        const itemsSql = `
            SELECT 
                c6.c6_num as pedido,
                c6.c6_item as item,
                c6.c6_produto as produto,
                TRIM(sb1.b1_tipo) as tipo_produto,
                sb1.b1_desc as descricao,
                c6.c6_um as um,
                c6.c6_qtdven as qtd,
                COALESCE(c6.c6_qtdent, 0) as qtd_entreg,
                (COALESCE(c6.c6_qtdven, 0) - COALESCE(c6.c6_qtdent, 0)) as qtd_faturar,
                c6.c6_entreg as entrega,
                c6.c6_pedcli as ped_cli,
                COALESCE(TRIM(c2.c2_num) || TRIM(c2.c2_item) || TRIM(c2.c2_sequen), TRIM(c6.c6_numop)) AS op
            FROM sc6010 c6
            LEFT JOIN sb1010 sb1 ON sb1.b1_cod = c6.c6_produto AND sb1.d_e_l_e_t_ = ''
            LEFT JOIN sc2010 c2 ON c2.c2_pedido = c6.c6_num AND c2.c2_itempv = c6.c6_item AND c2.d_e_l_e_t_ = ''
            WHERE c6.c6_num = ANY($1) AND c6.d_e_l_e_t_ = ''
            ORDER BY c6.c6_item ASC
        `;
        const itemsRes = await db.query(itemsSql, [orderNumbers]);

        itemsRes.rows.forEach(item => {
            if (!itemsMap[item.pedido]) itemsMap[item.pedido] = [];
            itemsMap[item.pedido].push({
                ...item,
                pedido:       item.pedido.trim(),
                produto:      item.produto.trim(),
                descricao:    item.descricao?.trim(),
                op:           item.op?.trim(),
                ped_cli:      item.ped_cli?.trim(),
                tipo:         item.tipo_produto || '',
                tag_especial: 'Nenhum' // Default
            });
        });

        // Fetch tags from local MySQL
        const placeholders = orderNumbers.map(() => '?').join(',');
        const [tagsRows] = await mysqlPool.query(
            `SELECT pedido, item, tag_especial FROM app_pedido_itens_tags WHERE pedido IN (${placeholders})`,
            orderNumbers.map(n => n.trim())
        );

        // Merge tags into items
        tagsRows.forEach(tagRecord => {
            const pedido = tagRecord.pedido.trim();
            const itemCode = tagRecord.item.trim();
            if (itemsMap[pedido]) {
                const itemObj = itemsMap[pedido].find(i => i.item.trim() === itemCode);
                if (itemObj) {
                    itemObj.tag_especial = tagRecord.tag_especial || 'Nenhum';
                }
            }
        });

        // Fetch PCP Delivery Forecasts for all items (data_pcp + qtde_pcp)
        const pedidoItemPairs = [];
        const paramsPcp = [];
        Object.values(itemsMap).forEach(itemList => {
            itemList.forEach(it => {
                pedidoItemPairs.push([it.pedido.trim(), it.item.trim()]);
            });
        });
        if (pedidoItemPairs.length > 0) {
            const pairsPlaceholders = pedidoItemPairs.map((_, i) => `(?, ?)`).join(',');
            const pairValues = pedidoItemPairs.flatMap(p => p);
            const [pcpRows] = await mysqlPool.query(
                `SELECT TRIM(pedido) as pedido, TRIM(item) as item,
                        DATE_FORMAT(data_entrega_pcp, '%Y%m%d') as data_entrega_pcp,
                        quantidade_pcp
                 FROM app_pcp_delivery_forecasts
                 WHERE (TRIM(pedido), TRIM(item)) IN (${pairsPlaceholders})
                 ORDER BY id ASC`,
                pairValues
            );
            const pcpMap = {};
            pcpRows.forEach(row => {
                const k = `${row.pedido}_${row.item}`;
                if (!pcpMap[k]) pcpMap[k] = row; // first row wins
            });
            // Merge PCP data into itemsMap
            Object.values(itemsMap).forEach(itemList => {
                itemList.forEach(it => {
                    const k = `${it.pedido.trim()}_${it.item.trim()}`;
                    const pcp = pcpMap[k];
                    it.data_pcp   = pcp ? pcp.data_entrega_pcp : null;
                    it.qtde_pcp   = pcp ? parseFloat(pcp.quantidade_pcp) : null;
                });
            });
        }
    }

    // Process Rows
    const rows = results.rows.map(r => {
        const isBilled = r.liberado === 'S' && r.nota && r.nota.trim() !== '';
        // Status Logic
        let status = 'ABERTO';
        if (isBilled) status = 'FATURADO (Total/Parcial)';
        else if (r.liberado === 'S') status = 'LIBERADO (Com OP)';

        return {
            pedido: r.pedido.trim(),
            emissao: r.emissao,
            cliente: r.cliente?.trim(),
            status,
            itens_count: parseInt(r.qtd_itens),
            soma_qtd: parseFloat(r.soma_qtd),
            proxima_entrega: r.proxima_entrega,
            itens: itemsMap[r.pedido] || []
        };
    });

    // KPI Calculation (Global or Page? For massive data global is expensive. Let's do a lightweight filtered aggregate)
    // We'll stick to basic totals for now from pagination.
    const kpis = {
        total_pedidos: totalRecords,
        total_itens: 0, // Placeholder, accurate requires SUM query
        soma_qtd: 0 // Placeholder
    };

    return {
        rows,
        page: parseInt(page),
        totalPages: Math.ceil(totalRecords / limit),
        total: totalRecords,
        kpis
    };
}

// GET /api/reports/sales-planning/data
router.get('/sales-planning/data', async (req, res) => {
    try {
        const data = await fetchSalesPlanningData(req.query, {
            page: req.query.page || 1,
            limit: req.query.limit || 50
        });
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/reports/sales-planning/item-tag
router.put('/sales-planning/item-tag', async (req, res) => {
    try {
        const { pedido, item, tag_especial } = req.body;
        if (!pedido || !item) {
            return res.status(400).json({ error: 'Pedido e Item so obrigatrios.' });
        }
        
        await mysqlPool.query(
            `INSERT INTO app_pedido_itens_tags (pedido, item, tag_especial) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE tag_especial = VALUES(tag_especial)`,
            [pedido.trim(), item.trim(), tag_especial]
        );
        
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao atualizar tag especial:', err);
        res.status(500).json({ error: 'Erro ao atualizar tag especial.' });
    }
});

// GET /api/reports/sales-planning/pdf
// Temporarily disabled due to pdfmake module issues
router.get('/sales-planning/pdf', async (req, res) => {
    res.status(503).json({ error: 'PDF generation temporarily unavailable - Excel export is available' });
});

// GET /api/reports/sales-planning/excel OR xlsx
router.get(['/sales-planning/excel', '/sales-planning/xlsx'], async (req, res) => {
    try {
        const { rows } = await fetchSalesPlanningData(req.query, { page: 1, limit: 5000 });

        // ── Step 0: Tabelas de apoio ────────────────────────────────────────────
        // 0a) Tempo padrão por recurso (fallback quando SG2 tempad=0)
        let capacidadeMap = {}; // recurso_codigo -> tempo_padrao_minutos
        try {
            const [capRows] = await mysqlPool.query(
                'SELECT recurso_codigo, tempo_padrao_minutos FROM app_recursos_capacidade'
            );
            capRows.forEach(r => {
                capacidadeMap[r.recurso_codigo] = parseFloat(r.tempo_padrao_minutos) || 0;
            });
        } catch (e) {
            console.warn('[Excel] Could not load app_recursos_capacidade:', e.message);
        }

        // 0b) Nome dos recursos via SH1 (Protheus)
        let recursoNomeMap = {}; // cod -> "COD - DESCRICAO"
        try {
            const sh1 = await db.query(
                `SELECT TRIM(h1_codigo) as cod, TRIM(h1_descri) as nome
                 FROM sh1010
                 WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')
                   AND TRIM(h1_codigo) <> ''`
            );
            sh1.rows.forEach(r => {
                recursoNomeMap[r.cod] = r.nome ? `${r.cod} - ${r.nome}` : r.cod;
            });
        } catch (e) {
            console.warn('[Excel] Could not load sh1010 resource names:', e.message);
        }


        // Coleta produtos únicos de todos os itens do resultado
        const allItems      = rows.flatMap(o => (o.itens || []).map(it => ({ ...it, order: o })));
        const uniqueProducts = [...new Set(allItems.map(it => it.produto.trim()))];

        // ── Step 1: BOM recursivo (todos os níveis via CTE) ──────────────────
        // Expande TODA a estrutura com quant acumulada (nível 1 × nível 2 × ...)
        // Componentes em múltiplos caminhos são somados (GROUP BY + SUM)
        // Nível 0 (produto acabado) é somado direto em calcCarga via addTime(produto, qtd)
        let bomMap = {}; // produto -> [{ comp, quant }]  (filhos de todos os níveis)
        if (uniqueProducts.length > 0) {
            const bomRows = await db.query(
                `WITH RECURSIVE bom AS (
                    -- Nível 1: filhos diretos dos produtos acabados
                    SELECT
                        TRIM(g1_cod)  AS raiz,
                        TRIM(g1_comp) AS comp,
                        g1_quant::numeric AS quant,
                        1 AS nivel
                    FROM sg1010
                    WHERE TRIM(g1_cod) = ANY($1::text[])
                      AND COALESCE(d_e_l_e_t_, '') = ''

                    UNION ALL

                    -- Níveis 2+: filhos dos filhos (recursivo)
                    SELECT
                        bom.raiz,
                        TRIM(sg1.g1_comp),
                        bom.quant * sg1.g1_quant::numeric,
                        bom.nivel + 1
                    FROM sg1010 sg1
                    JOIN bom ON TRIM(sg1.g1_cod) = bom.comp
                    WHERE COALESCE(sg1.d_e_l_e_t_, '') = ''
                      AND bom.nivel < 15   -- limite de segurança (evita loop infinito)
                )
                SELECT raiz, comp, SUM(quant) AS quant_total
                FROM bom
                GROUP BY raiz, comp`,
                [uniqueProducts]
            );
            bomRows.rows.forEach(r => {
                if (!bomMap[r.raiz]) bomMap[r.raiz] = [];
                bomMap[r.raiz].push({ comp: r.comp, quant: parseFloat(r.quant_total) || 0 });
            });
        }

        // ── Step 2: All codes = finished products + level-1 BOM components ──────
        const allCodesSet = new Set(uniqueProducts);
        Object.values(bomMap).forEach(comps => comps.forEach(c => allCodesSet.add(c.comp)));
        const allCodesArr = [...allCodesSet];

        // ── Step 3: SG2 routing for all codes (products + components) ────────
        // routingMap: codigo -> { recurso -> { tempo_peca (min/pc), setup } }
        let routingMap  = {};
        let routingSequenceMap = {};
        let operacaoToRecurso = {};
        let allRecursos = [];

        if (allCodesArr.length > 0) {
            const routingRows = await db.query(
                `SELECT TRIM(g2_produto) as produto,
                        TRIM(g2_recurso)  as recurso,
                        TRIM(g2_operac)   as operac,
                        g2_tempad::numeric               as tempad,
                        GREATEST(g2_lotepad::numeric, 1) as lotepad,
                        g2_setup::numeric                as setup
                 FROM sg2010
                 WHERE TRIM(g2_produto) = ANY($1::text[])
                   AND d_e_l_e_t_ = ''
                 ORDER BY g2_produto, g2_recurso, g2_operac`,
                [allCodesArr]
            );

            routingRows.rows.forEach(r => {
                const cod    = r.produto;
                const rec    = r.recurso;
                const operac = r.operac;
                // pg retorna numeric como string; Number() garante coerção
                const tempad = Number(r.tempad);
                const lote   = Math.max(Number(r.lotepad) || 1, 1);
                const setup  = Number(r.setup) || 0;
                const tPeca  = Number.isFinite(tempad / lote) ? tempad / lote : 0;

                if (!routingMap[cod])      routingMap[cod] = {};
                if (!routingMap[cod][rec]) routingMap[cod][rec] = { tempo_peca: 0, setup: 0 };
                routingMap[cod][rec].tempo_peca += tPeca;
                routingMap[cod][rec].setup      += setup;
                
                if (!routingSequenceMap[cod]) routingSequenceMap[cod] = [];
                routingSequenceMap[cod].push({ operac, recurso: rec, tempo_peca: tPeca, setup });

                if (cod && operac && rec) {
                    operacaoToRecurso[`${cod}_${operac}`] = rec;
                }
            });
            
            Object.values(routingSequenceMap).forEach(arr => arr.sort((a,b) => a.operac.localeCompare(b.operac)));

            // Debug trace (3 primeiros produtos)
            Object.entries(routingMap).slice(0, 3).forEach(([cod, recs]) =>
                console.log(`[Excel/SG2] ${cod}:`, JSON.stringify(recs))
            );

            const recursoSet = new Set();
            routingRows.rows.forEach(r => { if (r.recurso) recursoSet.add(r.recurso); });
            allRecursos = [...recursoSet].sort();
        }

        // ── Step 4: Run Forward Scheduling Simulation if data_0 is provided ───
        const data0 = req.query.data_0 || null;
        if (data0) {
            const { simulateForwardScheduling } = require('../utils/simulateFCS');
            const mutableItems = [];
            rows.forEach(o => {
                if (o.itens) {
                    o.itens.forEach(it => {
                        it.order = o;
                        mutableItems.push(it);
                    });
                }
            });
            simulateForwardScheduling(mutableItems, data0, routingSequenceMap, bomMap);
        }
        // ── Build Workbook ────────────────────────────────────────────────────
        const workbook = new ExcelJS.Workbook();
        workbook.creator  = 'MetalFisa Sistema';
        workbook.created  = new Date();
        workbook.modified = new Date();

        const sheetCapa   = workbook.addWorksheet('Capa');
        const sheetDocs   = workbook.addWorksheet('Entendendo a Planilha');
        const sheetResumo = workbook.addWorksheet('Resumo');
        const sheetOrders = workbook.addWorksheet('Pedidos');
        const sheetItems  = workbook.addWorksheet('Itens Detalhados');
        const sheetCarga  = workbook.addWorksheet('Carga por Recurso');
        const sheetExecucao = workbook.addWorksheet('Execução OP');
        const sheetEntregas = workbook.addWorksheet('Prog. Entregas');

        // ── Helpers de estilo ───────────────────────────────────────────────────
        const NAVY   = 'FF1E3A5F';
        const BLUE   = 'FF0D6EFD';
        const WHITE  = 'FFFFFFFF';
        const GRAY   = 'FFF5F7FA';
        const DGRAY  = 'FFD0D7E2';
        const BLACK  = 'FF1A1A2E';
        const ACCENT = 'FF00B4D8';

        const cell = (ws, addr) => ws.getCell(addr);
        const setFill = (c, argb) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }; };
        const setFont = (c, opts) => { c.font = { name: 'Calibri', ...opts }; };
        const setAlign = (c, h, v = 'middle') => { c.alignment = { horizontal: h, vertical: v, wrapText: true }; };
        const setBorder = (c, style = 'thin', color = DGRAY) => {
            const s = { style, color: { argb: color } };
            c.border = { top: s, left: s, bottom: s, right: s };
        };

        // ── CAPA ────────────────────────────────────────────────────────────────
        sheetCapa.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
        sheetCapa.views = [{ showGridLines: false }];

        // Definir larguras das colunas (A..L)
        [4, 18, 18, 14, 14, 14, 14, 14, 14, 14, 14, 10].forEach((w, i) => {
            sheetCapa.getColumn(i + 1).width = w;
        });

        // ── Banda de topo (empresa) — linhas 1-3 ────────────────────────────────
        sheetCapa.mergeCells('A1:L3');
        const titleCell = cell(sheetCapa, 'A1');
        titleCell.value = 'METALFISA INDÚSTRIA E COMÉRCIO LTDA';
        setFill(titleCell, NAVY);
        setFont(titleCell, { bold: true, size: 18, color: { argb: WHITE } });
        setAlign(titleCell, 'center', 'middle');
        sheetCapa.getRow(1).height = 20;
        sheetCapa.getRow(2).height = 20;
        sheetCapa.getRow(3).height = 20;

        // Sub-linha empresa
        sheetCapa.mergeCells('A4:L4');
        const subCell = cell(sheetCapa, 'A4');
        subCell.value = 'Planejamento Industrial — Relatório Técnico de Carga por Recurso';
        setFill(subCell, BLUE);
        setFont(subCell, { bold: false, size: 12, italic: true, color: { argb: WHITE } });
        setAlign(subCell, 'center', 'middle');
        sheetCapa.getRow(4).height = 24;

        // Linha separadora
        sheetCapa.mergeCells('A5:L5');
        setFill(cell(sheetCapa, 'A5'), ACCENT);
        sheetCapa.getRow(5).height = 4;

        // ── Bloco de Dados do Relatório — linhas 7-15 ────────────────────────────
        sheetCapa.getRow(6).height = 12;  // espaço

        const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo',
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit' });

        const filtros = req.query;
        const totalPedidos = rows.length;
        const totalItens   = rows.reduce((s, o) => s + (o.itens || []).length, 0);
        const totalSaldo   = rows.reduce((s, o) => s + (o.itens || []).reduce((si, it) => si + (parseFloat(it.qtd_faturar) || 0), 0), 0);
        const clientes     = [...new Set(rows.map(o => (o.cliente || '').trim()))].filter(Boolean);

        const usuarioNome = req.user?.nome || req.user?.login || 'Sistema MetalFisa';
        const infoRows = [
            ['Gerado em:',       geradoEm],
            ['Gerado por:',      usuarioNome],
            ['Pedido filtrado:', filtros.order  || '(todos)'],
            ['Cliente filtrado:', filtros.client || '(todos)'],
            ['Período emissão:', filtros.emission_start && filtros.emission_end
                ? `${filtros.emission_start} a ${filtros.emission_end}`
                : filtros.emission_start || filtros.emission_end || '(sem filtro)'],
            ['Apenas pendentes:', filtros.active_only === 'true' ? 'Sim' : 'Não'],
        ];

        infoRows.forEach(([label, value], idx) => {
            const row = 7 + idx;
            sheetCapa.mergeCells(`B${row}:D${row}`);
            sheetCapa.mergeCells(`E${row}:L${row}`);
            const lc = cell(sheetCapa, `B${row}`);
            const vc = cell(sheetCapa, `E${row}`);
            lc.value = label;
            vc.value = value;
            setFont(lc, { bold: true, size: 10, color: { argb: NAVY } });
            setFont(vc, { bold: false, size: 10, color: { argb: BLACK } });
            setAlign(lc, 'left'); setAlign(vc, 'left');
            setFill(lc, idx % 2 === 0 ? GRAY : WHITE);
            setFill(vc, idx % 2 === 0 ? GRAY : WHITE);
            sheetCapa.getRow(row).height = 16;
        });

        // ── Bloco de Resumo — linha 14 ───────────────────────────────────────────
        sheetCapa.getRow(14).height = 16;
        sheetCapa.mergeCells('A14:L14');
        setFill(cell(sheetCapa, 'A14'), DGRAY);

        const resumoData = [
            ['Total de Pedidos', totalPedidos],
            ['Total de Itens',   totalItens],
            ['Saldo Total a Faturar', totalSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })],
            ['Clientes',         clientes.length],
        ];

        sheetCapa.getRow(15).height = 14;
        sheetCapa.getRow(16).height = 22;
        resumoData.forEach(([label, val], idx) => {
            const col    = idx * 2 + 2; // B, D, F, H
            const labelC = sheetCapa.getCell(15, col);
            const valC   = sheetCapa.getCell(16, col);
            sheetCapa.mergeCells(15, col, 15, col + 1);
            sheetCapa.mergeCells(16, col, 16, col + 1);
            labelC.value = label;
            valC.value   = val;
            setFill(labelC, NAVY); setFont(labelC, { bold: true, size: 9, color: { argb: WHITE } }); setAlign(labelC, 'center');
            setFill(valC,   BLUE); setFont(valC,   { bold: true, size: 14, color: { argb: WHITE } }); setAlign(valC, 'center');
            setBorder(labelC, 'thin', WHITE);
            setBorder(valC,   'thin', WHITE);
        });

        // ── Tabela de Pedidos na Capa ─────────────────────────────────────────────
        sheetCapa.getRow(18).height = 16;
        sheetCapa.mergeCells('A18:L18');
        const tblTitle = cell(sheetCapa, 'A18');
        tblTitle.value = 'LISTA DE PEDIDOS INCLUÍDOS NESTE RELATÓRIO';
        setFill(tblTitle, NAVY);
        setFont(tblTitle, { bold: true, size: 11, color: { argb: WHITE } });
        setAlign(tblTitle, 'center');

        // Cabeçalho tabela — Cliente mescla colunas D+E (cols 4-5) para nome completo
        const tblHeaders = ['Pedido', 'Emissão', 'Cliente',   'Status', 'Qtd Itens', 'Qtd Vendida', 'Qtd Faturada', '% Evolução', 'Saldo Total', 'Próx. Entrega'];
        const tblCols    = [2,        3,           4,          6,        7,           8,             9,              10,           11,            12];
        sheetCapa.getRow(19).height = 16;
        tblHeaders.forEach((h, i) => {
            const c = sheetCapa.getCell(19, tblCols[i]);
            // Cliente: mescla D19:E19 para ter espaço suficiente
            if (i === 2) sheetCapa.mergeCells(19, 4, 19, 5);
            c.value = h;
            setFill(c, BLUE);
            setFont(c, { bold: true, size: 9, color: { argb: WHITE } });
            setAlign(c, 'center');
            setBorder(c, 'thin', WHITE);
        });

        // Linhas de dados da tabela
        rows.forEach((order, idx) => {
            const rowNum = 20 + idx;
            sheetCapa.getRow(rowNum).height = 14;
            const bg = idx % 2 === 0 ? GRAY : WHITE;
            
            let qtdVendida = 0;
            let qtdEntregue = 0;
            let saldoOrdem = 0;
            (order.itens || []).forEach(it => {
                qtdVendida += parseFloat(it.qtd) || 0;
                qtdEntregue += parseFloat(it.qtd_entreg) || 0;
                saldoOrdem += parseFloat(it.qtd_faturar) || 0;
            });
            
            const percEvolucao = qtdVendida > 0 ? ((qtdEntregue / qtdVendida) * 100) : 0;
            
            const rowData = [
                order.pedido,
                order.emissao ? order.emissao.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1') : '',
                order.cliente,
                order.status || '',
                (order.itens || []).length,
                qtdVendida,
                qtdEntregue,
                percEvolucao.toFixed(1) + '%',
                saldoOrdem.toFixed(2),
                order.proxima_entrega
                    ? order.proxima_entrega.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1')
                    : ''
            ];
            rowData.forEach((val, i) => {
                const c = sheetCapa.getCell(rowNum, tblCols[i]);
                // Cliente: mescla D:E para alinhar com o cabeçalho
                if (i === 2) sheetCapa.mergeCells(rowNum, 4, rowNum, 5);
                c.value = val;
                setFill(c, bg);
                setFont(c, { size: 9, color: { argb: BLACK } });
                setAlign(c, i === 2 ? 'left' : 'center');
                setBorder(c, 'hair', DGRAY);
            });
        });

        // ── Rodapé ──────────────────────────────────────────────────────────────
        const footerRow = 21 + rows.length;
        sheetCapa.getRow(footerRow).height = 12;
        sheetCapa.mergeCells(`A${footerRow}:L${footerRow}`);
        const footerCell = cell(sheetCapa, `A${footerRow}`);
        footerCell.value = `Documento gerado automaticamente pelo Sistema MetalFisa  |  ${geradoEm}  |  CONFIDENCIAL — USO INTERNO`;
        setFill(footerCell, NAVY);
        setFont(footerCell, { size: 8, italic: true, color: { argb: ACCENT } });
        setAlign(footerCell, 'center');

        // ── ABA: ENTENDENDO A PLANILHA ──────────────────────────────────────────
        sheetDocs.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
        sheetDocs.views = [{ showGridLines: false }];
        sheetDocs.getColumn(1).width = 4;
        sheetDocs.getColumn(2).width = 25;
        sheetDocs.getColumn(3).width = 90;

        const docTitle = cell(sheetDocs, 'B2');
        sheetDocs.mergeCells('B2:C3');
        docTitle.value = 'GUIA DO RELATÓRIO: COMO LER A PLANILHA';
        setFill(docTitle, NAVY);
        setFont(docTitle, { bold: true, size: 16, color: { argb: WHITE } });
        setAlign(docTitle, 'center', 'middle');

        const writeDocBlock = (startRow, title, items) => {
            const titleCell = cell(sheetDocs, `B${startRow}`);
            sheetDocs.mergeCells(`B${startRow}:C${startRow}`);
            titleCell.value = title;
            setFill(titleCell, BLUE);
            setFont(titleCell, { bold: true, size: 12, color: { argb: WHITE } });
            setAlign(titleCell, 'left');
            sheetDocs.getRow(startRow).height = 20;

            let currRow = startRow + 1;
            items.forEach((item, idx) => {
                const labelCell = cell(sheetDocs, `B${currRow}`);
                const descCell  = cell(sheetDocs, `C${currRow}`);
                labelCell.value = item.label;
                descCell.value  = item.desc;
                
                const bg = idx % 2 === 0 ? GRAY : WHITE;
                setFill(labelCell, bg); setFill(descCell, bg);
                setFont(labelCell, { bold: true, size: 10, color: { argb: NAVY } });
                setFont(descCell, { bold: false, size: 10, color: { argb: BLACK } });
                
                setAlign(labelCell, 'left', 'top');
                setAlign(descCell, 'left', 'top');
                setBorder(labelCell, 'hair', DGRAY);
                setBorder(descCell, 'hair', DGRAY);
                
                // Estima a altura baseado no tamanho do texto (muito simples)
                const lines = Math.ceil((item.desc.length) / 80);
                sheetDocs.getRow(currRow).height = lines > 1 ? lines * 15 : 20;
                currRow++;
            });
            return currRow;
        };

        let nextDocRow = 5;

        nextDocRow = writeDocBlock(nextDocRow, 'RESUMO DAS ABAS', [
            { label: 'Capa', desc: 'Resumo executivo do relatório. Contém os filtros utilizados na extração, totais de pedidos, itens, saldo a faturar e a lista de pedidos consolidados neste documento.' },
            { label: 'Entendendo a Planilha', desc: 'Esta aba. Contém o manual de leitura dos dados, destacando unidades de medida e dicas de uso.' },
            { label: 'Pedidos', desc: 'Visão macro. Mostra uma linha por pedido. As colunas de recursos (ex: MO0001 - GUILHOTINA) exibem o somatório da carga de todos os itens daquele pedido para aquele recurso específico.' },
            { label: 'Itens Detalhados', desc: 'Dados brutos. Relação de todos os itens e produtos dos pedidos, com informações como quantidades, datas PCP, e saldo a faturar. Não contém cálculos de carga.' },
            { label: 'Carga por Recurso', desc: 'Visão micro. Expande a carga de cada item pendente individualmente, separando os tempos alocados para cada máquina/recurso.' },
            { label: 'Execução OP', desc: 'Detalhamento da carga prevista x apontada para cada OP componente da estrutura do produto. Os tempos são exibidos em MINUTOS.' },
            { label: 'Prog. Entregas', desc: 'Matriz de entregas projetadas para os próximos 14 dias com base na Data PCP dos itens.' }
        ]) + 2;

        nextDocRow = writeDocBlock(nextDocRow, 'UNIDADES DE MEDIDA E REGRAS DE TEMPO', [
            { label: 'Minutos (Aba Carga)', desc: 'Na aba "Carga por Recurso", os valores de tempo nas colunas de máquinas/recursos estão estritamente em MINUTOS.' },
            { label: 'Horas (Aba Pedidos)', desc: 'Na aba "Pedidos", os valores de tempo foram convertidos para HORAS PRODUTIVAS para facilitar a visualização de prazos e cargas macro.' },
            { label: 'Regra de 50 Minutos', desc: 'ATENÇÃO: Para a conversão de horas na aba Pedidos, é utilizada a métrica padrão da MetalFisa de eficiência. Sendo assim, 1 HORA PRODUTIVA = 50 MINUTOS de trabalho líquido. Exemplo: 100 minutos de carga aparecerá como 2.00 horas.' },
            { label: 'Explosão da Estrutura (BOM)', desc: 'O tempo total alocado considera não apenas a operação direta do produto principal, mas SOMA AUTOMATICAMENTE o tempo de TODOS os componentes filhos necessários para a fabricação, percorrendo recursivamente a Engenharia (nível 0, nível 1, etc).' },
            { label: 'Soma de Tempo Nível 0', desc: 'O tempo gasto na montagem ou operação do próprio produto pai (nível 0) também é somado aos tempos dos componentes filhos para compor a carga total.' }
        ]) + 2;

        nextDocRow = writeDocBlock(nextDocRow, 'DICAS DE LEITURA', [
            { label: 'Auto-filtro (Setinhas)', desc: 'Todas as abas de dados (Pedidos, Itens, Carga) possuem auto-filtros na linha 1. Você pode clicar nas setinhas do cabeçalho para filtrar clientes específicos, pedidos ou faixas de data.' },
            { label: 'Primeira e Última Data PCP', desc: 'Na aba Pedidos, as datas de Início e Fim PCP são calculadas analisando automaticamente todos os itens daquele pedido, extraindo a data mais antiga e a mais recente informada.' },
            { label: 'Cores do Cabeçalho', desc: 'Colunas em Azul Marinho (Escuro) são informações fixas do pedido/produto. Colunas em Azul Claro (no final à direita) representam as cargas dinâmicas dos recursos/máquinas.' }
        ]);

        // ── FIM DA ABA ENTENDENDO A PLANILHA ────────────────────────────────────

        // Sheet 1: Pedidos — colunas fixas + tempo total por recurso
        const ordersFixedCols = [
            { header: 'Pedido',            key: 'pedido',          width: 12 },
            { header: 'Emissão',           key: 'emissao',         width: 12 },
            { header: 'Cliente',           key: 'cliente',         width: 40 },
            { header: 'Status',            key: 'status',          width: 20 },
            { header: 'Qtd Itens',         key: 'itens_count',     width: 10 },
            { header: 'Soma QTD',          key: 'soma_qtd',        width: 12 },
            { header: 'Próx. Entrega',     key: 'proxima_entrega', width: 14 },
            { header: 'Primeira Data PCP', key: 'pcp_inicio',      width: 16 },
            { header: 'Última Data PCP',   key: 'pcp_fim',         width: 16 },
        ];
        // 1 hora produtiva = 50 minutos (exclui pausas/setup)
        const MIN_POR_HORA = 50;

        const ordersRecursoCols = allRecursos.map(r => ({
            header: `${recursoNomeMap[r] || r} (h)`,  // indica que o valor é em horas
            key:    `rec_${r}`,
            width:  22
        }));
        sheetOrders.columns = [...ordersFixedCols, ...ordersRecursoCols];

        // Sheet 1.5: Resumo
        const resumoFixedCols = [
            { header: 'Produto',          key: 'produto',      width: 15 },
            { header: 'Descrição',        key: 'descricao',    width: 60 },
            { header: 'UM',               key: 'um',           width: 8 },
            { header: 'Qtd Total',        key: 'qtd_total',    width: 18 },
        ];
        const resumoRecursoCols = allRecursos.map(r => ({
            header: `${recursoNomeMap[r] || r} (min)`,
            key:    `rec_${r}`,
            width:  22
        }));
        sheetResumo.columns = [...resumoFixedCols, ...resumoRecursoCols];

        // Sheet 2: Items
        sheetItems.columns = [
            { header: 'Pedido',           key: 'pedido',       width: 12 },
            { header: 'Emissão',          key: 'emissao',      width: 12 },
            { header: 'Cliente',          key: 'cliente',      width: 30 },
            { header: 'Item',             key: 'item',         width: 8  },
            { header: 'Produto',          key: 'produto',      width: 15 },
            { header: 'Tipo',             key: 'tipo',         width: 10 },
            { header: 'Descrição',        key: 'descricao',    width: 40 },
            { header: 'UM',               key: 'um',           width: 6  },
            { header: 'Qtd Total',        key: 'qtd',          width: 10 },
            { header: 'Qtd Faturada',     key: 'qtd_entreg',   width: 12 },
            { header: 'Saldo a Faturar',  key: 'qtd_faturar',  width: 15 },
            { header: 'Data PCP',         key: 'data_pcp',     width: 12 },
            { header: 'Nova Data PCP',    key: 'nova_data_pcp',width: 15 },
            { header: 'Qtde PCP',         key: 'qtde_pcp',     width: 10 },
            { header: 'Entrega',          key: 'entrega',      width: 12 },
            { header: 'OP',               key: 'op',           width: 12 },
            { header: 'Ped. Cliente',     key: 'ped_cli',      width: 15 }
        ];

        // Sheet 3: Carga por Recurso — PIVOT (fixed cols + one col per resource)
        const fixedCols = [
            { header: 'Pedido',          key: 'pedido',       width: 12 },
            { header: 'Emissão',         key: 'emissao',      width: 12 },
            { header: 'Cliente',         key: 'cliente',      width: 30 },
            { header: 'Item',            key: 'item',         width: 8  },
            { header: 'Produto',         key: 'produto',      width: 15 },
            { header: 'Descrição',       key: 'descricao',    width: 40 },
            { header: 'Saldo a Faturar', key: 'qtd_faturar',  width: 15 },
            { header: 'Entrega',         key: 'entrega',      width: 12 },
            { header: 'Data PCP',        key: 'data_pcp',     width: 12 },
            { header: 'Nova Data PCP',   key: 'nova_data_pcp',width: 15 },
            { header: 'Qtde PCP',        key: 'qtde_pcp',     width: 12 },
        ];
        const recursoCols = allRecursos.map(r => ({
            header: recursoNomeMap[r] || r,   // "MO0001 - GUILHOTINA" ou só o código
            key:    `rec_${r}`,
            width:  22
        }));
        sheetCarga.columns = [...fixedCols, ...recursoCols];

        // Sheet 4: Execução OP
        const execFixedCols = [
            { header: 'Pedido',        key: 'pedido',       width: 12 },
            { header: 'Item Pedido',   key: 'item_pedido',  width: 12 },
            { header: 'Cliente',       key: 'cliente',      width: 30 },
            { header: 'OP',            key: 'op',           width: 18 },
            { header: 'Produto (OP)',  key: 'produto',      width: 15 },
            { header: 'Qtd OP',        key: 'qtd_planejada',width: 12 }
        ];
        const execRecursoCols = [];
        allRecursos.forEach(r => {
            const resName = recursoNomeMap[r] || r;
            execRecursoCols.push({ header: `${resName} (Executado)`, key: `rec_${r}_exec`, width: 22 });
            execRecursoCols.push({ header: `${resName} (Previsto)`,  key: `rec_${r}_prev`, width: 22 });
        });
        sheetExecucao.columns = [...execFixedCols, ...execRecursoCols];

        // Header styling: fixed=navy, resource=blue
        const hdrRow = sheetCarga.getRow(1);
        hdrRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        fixedCols.forEach((_, i) => {
            hdrRow.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
        });
        recursoCols.forEach((_, i) => {
            hdrRow.getCell(fixedCols.length + i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D6EFD' } };
        });

        // Header styling: sheetResumo
        const resHdrRow = sheetResumo.getRow(1);
        resHdrRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        resumoFixedCols.forEach((_, i) => {
            resHdrRow.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
        });
        resumoRecursoCols.forEach((_, i) => {
            resHdrRow.getCell(resumoFixedCols.length + i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D6EFD' } };
        });

        // Utilitário: cede o controle ao event loop entre lotes
        const yieldToEventLoop = () => new Promise(resolve => setImmediate(resolve));
        const BATCH_SIZE = 50;
        
        // Mapa para agregar totais por produto na aba Resumo
        const resumoMap = new Map();

        // Processa pedidos em lotes para não travar o event loop
        const totalOrders = rows.length;
        for (let batchStart = 0; batchStart < totalOrders; batchStart += BATCH_SIZE) {
            const batch = rows.slice(batchStart, Math.min(batchStart + BATCH_SIZE, totalOrders));
            console.log(`[Excel] Lote ${Math.floor(batchStart/BATCH_SIZE)+1}/${Math.ceil(totalOrders/BATCH_SIZE)}: processando pedidos ${batchStart+1}-${batchStart+batch.length}/${totalOrders}...`);

            for (const order of batch) {
            // Soma minutos por recurso de todos os itens, converte para horas produtivas (÷50)
            const orderCarga = {};
            (order.itens || []).forEach(item => {
                const qtdFaturar = parseFloat(item.qtd_faturar) || 0;
                
                // Agrega saldo para a aba Resumo
                const prod = item.produto ? item.produto.trim() : '';
                if (prod) {
                    if (!resumoMap.has(prod)) {
                        resumoMap.set(prod, { produto: prod, descricao: item.descricao, um: item.um, qtd_total: 0 });
                    }
                    resumoMap.get(prod).qtd_total += qtdFaturar;
                }

                const minByRec   = calcCargaRecurso(
                    item.produto.trim(), qtdFaturar, routingMap, bomMap, capacidadeMap
                );
                allRecursos.forEach(r => {
                    const k = `rec_${r}`;
                    orderCarga[k] = (orderCarga[k] || 0) + (minByRec[k] || 0);
                    
                    if (prod) {
                        const recObj = resumoMap.get(prod);
                        recObj[k] = (recObj[k] || 0) + (minByRec[k] || 0);
                    }
                });
            });
            // Converte minutos → horas produtivas (1h = 50min)
            allRecursos.forEach(r => {
                const k = `rec_${r}`;
                if (orderCarga[k]) orderCarga[k] = parseFloat((orderCarga[k] / MIN_POR_HORA).toFixed(4));
            });

            // Calcula primeira e última data PCP dos itens do pedido
            let pcpDates = (order.itens || [])
                .map(it => it.data_pcp)          // ex: '20260118' ou null
                .filter(Boolean)
                .map(d => {
                    // data_pcp pode vir como YYYYMMDD (string) ou Date
                    if (d instanceof Date) return d;
                    const s = String(d);
                    if (s.length === 8) return new Date(
                        parseInt(s.slice(0,4)), parseInt(s.slice(4,6))-1, parseInt(s.slice(6,8))
                    );
                    return new Date(s);
                })
                .filter(d => !isNaN(d.getTime()));

            const pcpInicio = pcpDates.length ? new Date(Math.min(...pcpDates)) : null;
            const pcpFim    = pcpDates.length ? new Date(Math.max(...pcpDates)) : null;

            sheetOrders.addRow({
                pedido:          order.pedido,
                emissao:         parseDate(order.emissao),
                cliente:         order.cliente,
                status:          order.status,
                itens_count:     order.itens_count,
                soma_qtd:        order.soma_qtd,
                proxima_entrega: parseDate(order.proxima_entrega),
                pcp_inicio:      pcpInicio,
                pcp_fim:         pcpFim,
                ...orderCarga   // colunas rec_MO0001, rec_MO0013, etc.
            });

            if (order.itens) {
                order.itens.forEach(item => {
                    const qtdFaturar = parseFloat(item.qtd_faturar) || 0;

                    // Sheet 2
                    sheetItems.addRow({
                        pedido:      order.pedido,
                        emissao:     parseDate(order.emissao),
                        cliente:     order.cliente,
                        item:        item.item,
                        produto:     item.produto,
                        tipo:        item.tipo || '',
                        descricao:   item.descricao,
                        um:          item.um,
                        qtd:         parseFloat(item.qtd),
                        qtd_entreg:  parseFloat(item.qtd_entreg) || 0,
                        qtd_faturar: qtdFaturar,
                        data_pcp:    item.data_pcp ? parseDate(item.data_pcp) : null,
                        nova_data_pcp: item.nova_data_pcp ? parseDate(item.nova_data_pcp) : null,
                        qtde_pcp:    item.qtde_pcp != null ? parseFloat(item.qtde_pcp) : null,
                        entrega:     parseDate(item.entrega),
                        op:          item.op,
                        ped_cli:     item.ped_cli
                    });

                    // Sheet 3: PIVOT — carga por recurso (todos os níveis via calcCargaRecurso)
                    const minByRecurso = calcCargaRecurso(
                        item.produto.trim(),
                        qtdFaturar,
                        routingMap,
                        bomMap,
                        capacidadeMap
                    );

                    const pivotRow = {
                        pedido:      order.pedido,
                        emissao:     parseDate(order.emissao),
                        cliente:     order.cliente,
                        item:        item.item,
                        produto:     item.produto,
                        descricao:   item.descricao,
                        qtd_faturar: qtdFaturar,
                        entrega:     parseDate(item.entrega),
                        data_pcp:    item.data_pcp ? parseDate(item.data_pcp) : null,
                        nova_data_pcp: item.nova_data_pcp ? parseDate(item.nova_data_pcp) : null,
                        qtde_pcp:    item.qtde_pcp != null ? parseFloat(item.qtde_pcp) : null,
                    };
                    allRecursos.forEach(r => { pivotRow[`rec_${r}`] = minByRecurso[`rec_${r}`] || 0; });
                    sheetCarga.addRow(pivotRow);
                });
            } // end if order.itens
            } // end order (for...of batch)

            // ── Busca OPs e apontamentos do lote para a aba Execução OP ──
            const pedidosIds = batch.map(o => o.pedido).filter(Boolean);
            if (pedidosIds.length > 0) {
                const opQuery = `
                    SELECT TRIM(c2_num) AS num, TRIM(c2_item) AS item, TRIM(c2_sequen) AS sequen,
                           TRIM(c2_pedido) AS pedido, TRIM(c2_itempv) AS pedido_item,
                           TRIM(c2_produto) AS produto, c2_quant::numeric AS qtd_planejada
                    FROM sc2010
                    WHERE c2_pedido = ANY($1::text[]) AND COALESCE(d_e_l_e_t_, '') = ''
                `;
                const sc2Ops = await db.query(opQuery, [pedidosIds]);
                
                const uniqueOpNums = [...new Set(sc2Ops.rows.map(op => op.num))];
                let appointments = [];
                if (uniqueOpNums.length > 0) {
                    const [appRows] = await mysqlPool.query(
                        `SELECT op_numero, op_item, op_sequencia, operacao_codigo, SUM(quantidade) as qtd_apontada 
                         FROM app_production_appointments 
                         WHERE op_numero IN (?) 
                         GROUP BY op_numero, op_item, op_sequencia, operacao_codigo`,
                        [uniqueOpNums]
                    );
                    appointments = appRows;
                }
                
                sc2Ops.rows.forEach(opRow => {
                    const opApps = appointments.filter(a => {
                        const normNumA = String(a.op_numero).trim();
                        const normNumB = String(opRow.num).trim();
                        const normItemA = String(a.op_item).trim();
                        const normItemB = String(opRow.item).trim();
                        const normSeqA = String(a.op_sequencia).trim();
                        const normSeqB = String(opRow.sequen).trim();

                        const matchNum = normNumA === normNumB;
                        const matchItem = (normItemA === normItemB) || (!isNaN(parseInt(normItemA)) && parseInt(normItemA, 10) === parseInt(normItemB, 10));
                        const matchSeq = (normSeqA === normSeqB) || (!isNaN(parseInt(normSeqA)) && parseInt(normSeqA, 10) === parseInt(normSeqB, 10));

                        return matchNum && matchItem && matchSeq;
                    });
                    
                    const orderInfo = batch.find(o => o.pedido === opRow.pedido) || {};
                    const execRow = {
                        pedido: opRow.pedido,
                        item_pedido: opRow.pedido_item,
                        cliente: orderInfo.cliente,
                        op: `${opRow.num}${opRow.item}${opRow.sequen}`,
                        produto: opRow.produto,
                        qtd_planejada: parseFloat(opRow.qtd_planejada) || 0
                    };
                    
                    let hasLoad = false;
                    const minByRecUnit = calcCargaRecurso(opRow.produto, 1, routingMap, bomMap, capacidadeMap);
                    
                    allRecursos.forEach(r => {
                        const tPecaUnit = minByRecUnit[`rec_${r}`] || 0;
                        const previsto = tPecaUnit * execRow.qtd_planejada;
                        
                        const app = opApps.find(a => {
                            const recCodigo = operacaoToRecurso[`${opRow.produto}_${String(a.operacao_codigo).trim()}`];
                            return recCodigo === String(r).trim();
                        });
                        const qtdApontada = app ? Number(app.qtd_apontada) : 0;
                        const executado = tPecaUnit * qtdApontada;
                        
                        // Valores em minutos
                        const previstoMins = previsto > 0 ? previsto : 0;
                        const executadoMins = executado > 0 ? executado : 0;
                        
                        if (previstoMins > 0 || executadoMins > 0) {
                            execRow[`rec_${r}_exec`] = executadoMins;
                            execRow[`rec_${r}_prev`] = previstoMins;
                            hasLoad = true;
                        } else {
                            execRow[`rec_${r}_exec`] = null;
                            execRow[`rec_${r}_prev`] = null;
                        }
                    });
                    
                    if (hasLoad) {
                        sheetExecucao.addRow(execRow);
                    }
                });
            }

            await yieldToEventLoop(); // libera o event loop entre lotes
        } // end batch loop (for batchStart)
        console.log('[Excel] Todos os dados processados. Montando aba Resumo...');

        // Escreve aba Resumo
        const resumoArray = Array.from(resumoMap.values()).sort((a, b) => a.produto.localeCompare(b.produto));
        resumoArray.forEach(row => {
            // Converter minutos -> horas para aba Resumo
            allRecursos.forEach(r => {
                const k = `rec_${r}`;
                if (row[k]) row[k] = parseFloat((row[k] / MIN_POR_HORA).toFixed(4));
            });
            sheetResumo.addRow(row);
        });

        console.log('[Excel] Aplicando formatação...');

        // Number formats: recursos em #,##0.00
        allRecursos.forEach(r => {
            sheetCarga.getColumn(`rec_${r}`).numFmt  = '#,##0.00';
            sheetOrders.getColumn(`rec_${r}`).numFmt = '#,##0.00';
            sheetExecucao.getColumn(`rec_${r}_exec`).numFmt = '#,##0.00';
            sheetExecucao.getColumn(`rec_${r}_prev`).numFmt = '#,##0.00';
            sheetResumo.getColumn(`rec_${r}`).numFmt = '#,##0.00';
        });
        sheetResumo.getColumn('qtd_total').numFmt = '#,##0.00';

        // Date formats
        sheetOrders.getColumn('emissao').numFmt         = 'dd/mm/yyyy';
        sheetOrders.getColumn('proxima_entrega').numFmt = 'dd/mm/yyyy';
        sheetOrders.getColumn('pcp_inicio').numFmt      = 'dd/mm/yyyy';
        sheetOrders.getColumn('pcp_fim').numFmt         = 'dd/mm/yyyy';
        sheetItems.getColumn('emissao').numFmt          = 'dd/mm/yyyy';
        sheetItems.getColumn('entrega').numFmt          = 'dd/mm/yyyy';
        sheetItems.getColumn('data_pcp').numFmt         = 'dd/mm/yyyy';
        sheetCarga.getColumn('emissao').numFmt          = 'dd/mm/yyyy';
        sheetCarga.getColumn('entrega').numFmt          = 'dd/mm/yyyy';
        sheetCarga.getColumn('data_pcp').numFmt         = 'dd/mm/yyyy';

        // ── Programação de Entregas ──────────────────────────────────────────────
        const formatDateKey = (dateObj) => {
            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const d = String(dateObj.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        const normalizeDate = (rawStr) => {
            if (!rawStr) return null;
            const s = String(rawStr).trim();
            if (!s) return null;
            if (/^\d{8}$/.test(s)) return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
            if (s.includes('T')) return s.split('T')[0];
            return s;
        };

        const startDate = new Date();
        startDate.setHours(0,0,0,0);
        const days = [];
        for (let i = 0; i < 14; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            days.push({
                date: d,
                key: formatDateKey(d),
                label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
                weekday: d.toLocaleDateString('pt-BR', { weekday: 'short' })
            });
        }

        const groupMap = {};
        allItems.forEach(item => {
            const ped = item.pedido || (item.order && item.order.pedido) || '';
            const prod = item.produto || '';
            const desc = item.descricao_produto || item.descricao || '';
            const cliente = item.nome_cliente || (item.order && item.order.cliente) || '';
            const key = `${ped}-${prod}`;

            if (!groupMap[key]) {
                groupMap[key] = { pedido: ped, codigo: prod, descricao: desc, cliente: cliente, totalOpQtd: 0, totalSaldoProd: 0, opNumbers: new Set(), deliveries: {} };
            }

            if (item.op_num || item.op_protheus) {
                const opNum = (item.op_num || item.op_protheus).trim();
                if (opNum && opNum !== '-') {
                    groupMap[key].opNumbers.add(opNum);
                    groupMap[key].totalOpQtd += parseFloat(item.op_qtd || 0);
                    groupMap[key].totalSaldoProd += parseFloat(item.saldo_produzido || 0);
                }
            }

            const targetDate = normalizeDate(item.data_pcp || item.pcp_delivery_forecast_date || item.entrega);
            if (targetDate) {
                const qtd = parseFloat(item.saldo_fat || item.qtd_faturar || item.qtd || 0);
                if (qtd > 0) {
                    if (!groupMap[key].deliveries[targetDate]) groupMap[key].deliveries[targetDate] = [];
                    groupMap[key].deliveries[targetDate].push(item);
                }
            }
        });

        const entregasCols = [
            { header: 'Pedido', key: 'pedido', width: 12 },
            { header: 'Cliente', key: 'cliente', width: 30 },
            { header: 'Código Produto', key: 'codigo', width: 18 },
            { header: 'Descrição Produto', key: 'descricao', width: 35 },
            { header: 'OPs', key: 'ops', width: 20 },
            { header: 'Qtd Total OP', key: 'totalOpQtd', width: 14 },
            { header: 'Total Saldo Prod', key: 'totalSaldoProd', width: 16 }
        ];

        days.forEach(day => {
            const dayName = day.weekday.replace('.', '');
            entregasCols.push({ header: `${dayName} - ${day.label}`, key: day.key, width: 15 });
        });

        sheetEntregas.columns = entregasCols;

        Object.values(groupMap).forEach(row => {
            const rowData = {
                pedido: row.pedido,
                cliente: row.cliente,
                codigo: row.codigo,
                descricao: row.descricao,
                ops: Array.from(row.opNumbers).join(', ') || '-',
                totalOpQtd: row.totalOpQtd || 0,
                totalSaldoProd: row.totalSaldoProd || 0
            };
            days.forEach(day => {
                const dayItems = row.deliveries[day.key] || [];
                const qty = dayItems.reduce((acc, it) => acc + parseFloat(it.saldo_fat || it.qtd_faturar || it.qtd || 0), 0);
                rowData[day.key] = qty || '';
            });
            sheetEntregas.addRow(rowData);
        });

        // ── Aplicar estilo MetalFisa em todas as abas de dados ─────────────────
        /**
         * applyMetalFisaSheet — formatação padrão para abas de dados.
         * @param {ExcelJS.Worksheet} sheet
         * @param {number} numFixedCols  - qtd de colunas fixas (navy);
         *                                 colunas adicionais ficam azul
         */
        const applyMetalFisaSheet = async (sheet, numFixedCols = sheet.columnCount) => {
            const totalCols = sheet.columnCount;
            const lastRow   = sheet.rowCount;

            // 1. Cabeçalho (linha 1)
            const hdr = sheet.getRow(1);
            hdr.height = 20;
            for (let c = 1; c <= totalCols; c++) {
                const cell = hdr.getCell(c);
                const isFixed = c <= numFixedCols;
                cell.fill  = { type: 'pattern', pattern: 'solid',
                               fgColor: { argb: isFixed ? NAVY : BLUE } };
                cell.font  = { bold: true, size: 9, color: { argb: WHITE },
                               name: 'Calibri' };
                cell.alignment = { vertical: 'middle', horizontal: 'center',
                                   wrapText: false };
                cell.border = {
                    top:    { style: 'thin', color: { argb: WHITE } },
                    bottom: { style: 'thin', color: { argb: WHITE } },
                    left:   { style: 'thin', color: { argb: WHITE } },
                    right:  { style: 'thin', color: { argb: WHITE } }
                };
            }

            // 2. Linhas de dados — alternadas GRAY/WHITE + bordas (em lotes)
            for (let r = 2; r <= lastRow; r++) {
                const row    = sheet.getRow(r);
                const bg     = (r % 2 === 0) ? GRAY : WHITE;
                row.height   = 15;
                for (let c = 1; c <= totalCols; c++) {
                    const cell = row.getCell(c);
                    cell.fill  = { type: 'pattern', pattern: 'solid',
                                   fgColor: { argb: bg } };
                    cell.font  = { size: 9, name: 'Calibri',
                                   color: { argb: BLACK } };
                    cell.alignment = { vertical: 'middle',
                                       horizontal: c <= numFixedCols ? 'left' : 'center' };
                    cell.border = {
                        top:    { style: 'hair', color: { argb: DGRAY } },
                        bottom: { style: 'hair', color: { argb: DGRAY } },
                        left:   { style: 'hair', color: { argb: DGRAY } },
                        right:  { style: 'hair', color: { argb: DGRAY } }
                    };
                }
                // Cede o event loop a cada 200 linhas
                if (r % 200 === 0) await yieldToEventLoop();
            }

            // 3. Congelar painel no cabeçalho
            sheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];

            // 4. Auto-filtro na linha de cabeçalho
            sheet.autoFilter = {
                from: { row: 1, column: 1 },
                to:   { row: 1, column: totalCols }
            };

            // 5. Cor da aba
            sheet.properties.tabColor = { argb: NAVY };
        };

        // Aplicar nas abas de dados
        await applyMetalFisaSheet(sheetOrders, ordersFixedCols.length);
        await applyMetalFisaSheet(sheetResumo, 1);
        await applyMetalFisaSheet(sheetItems);
        await applyMetalFisaSheet(sheetCarga, fixedCols.length);
        await applyMetalFisaSheet(sheetExecucao, execFixedCols.length);
        await applyMetalFisaSheet(sheetEntregas, 7);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=planejamento_vendas.xlsx');
        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});


// Helpers
function formatDate(str) {
    if (!str) return '-';
    // Protheus YYYYMMDD
    if (str.length === 8) {
        return `${str.substr(6, 2)}/${str.substr(4, 2)}/${str.substr(0, 4)}`;
    }
    return str;
}

function parseDate(str) {
    if (!str || str.length !== 8) return null;
    return new Date(parseInt(str.substr(0, 4)), parseInt(str.substr(4, 2)) - 1, parseInt(str.substr(6, 2)));
}

function styleHeader(sheet) {
    const row = sheet.getRow(1);
    row.font = { bold: true };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
}

// --- USER REPORT LOGIC ---

/**
 * Fetch Users Report Data
 */
async function fetchUsersReportData() {
    const [rows] = await mysqlPool.query(
        'SELECT NomeCompleto, Login, TipoUsuario, Setor, Funcao, Observacoes, TemPC FROM usuario ORDER BY NomeCompleto ASC'
    );
    return rows;
}

// GET /api/reports/users/xlsx
router.get(['/users/excel', '/users/xlsx'], async (req, res) => {
    try {
        const rows = await fetchUsersReportData();

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Usuários do Sistema');

        sheet.columns = [
            { header: 'Nome Completo', key: 'NomeCompleto', width: 35 },
            { header: 'Login', key: 'Login', width: 20 },
            { header: 'Permissão', key: 'TipoUsuario', width: 15 },
            { header: 'Setor', key: 'Setor', width: 20 },
            { header: 'Função', key: 'Funcao', width: 25 },
            { header: 'Tem PC?', key: 'TemPC', width: 10 },
            { header: 'Observações', key: 'Observacoes', width: 40 }
        ];

        styleHeader(sheet);

        rows.forEach(u => {
            sheet.addRow({
                NomeCompleto: u.NomeCompleto,
                Login: u.Login,
                TipoUsuario: u.TipoUsuario === 'SA' ? 'SuperAdmin' : u.TipoUsuario === 'A' ? 'Administrador' : u.TipoUsuario === 'C' ? 'Conferente' : u.TipoUsuario === 'AP' ? 'Apontador' : u.TipoUsuario === 'CLI' ? 'Cliente Externo' : u.TipoUsuario || 'Usuário',
                Setor: u.Setor || '-',
                Funcao: u.Funcao || '-',
                TemPC: u.TemPC === 1 ? 'Sim' : 'Não',
                Observacoes: u.Observacoes || '-'
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=relatorio_usuarios.xlsx');
        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao gerar Excel de usuários: ' + err.message });
    }
});

// --- RESOURCE EVOLUTION REPORT LOGIC ---

router.get('/resource-evolution', async (req, res) => {
    try {
        const { date_start, date_end, client, pedido, op, product, groupBy = 'pedido' } = req.query;

        // 1. Fetch OPs from Postgres
        const getInactiveFilter = await getInactiveOrdersFilter();
        let whereClause = `WHERE COALESCE(c2.d_e_l_e_t_, '') = ''` + getInactiveFilter('c2.c2_pedido');
        const params = [];

        if (op) {
            whereClause += ` AND TRIM(c2.c2_num) = $${params.length + 1}`;
            params.push(op);
        }
        if (client) {
            whereClause += ` AND (UPPER(a1.a1_nome) LIKE UPPER($${params.length + 1}) OR UPPER(a1.a1_nreduz) LIKE UPPER($${params.length + 1}))`;
            params.push(`%${client}%`);
        }
        if (date_start) {
            whereClause += ` AND c2.c2_datpri >= $${params.length + 1}`;
            params.push(date_start.replace(/-/g, ''));
        }
        if (date_end) {
            whereClause += ` AND c2.c2_datpri <= $${params.length + 1}`;
            params.push(date_end.replace(/-/g, ''));
        }
        if (pedido) {
            whereClause += ` AND TRIM(c2.c2_pedido) LIKE $${params.length + 1}`;
            params.push(`%${pedido}%`);
        }
        if (product) {
            whereClause += ` AND (UPPER(c2.c2_produto) LIKE UPPER($${params.length + 1}) OR UPPER(sb1.b1_desc) LIKE UPPER($${params.length + 1}))`;
            params.push(`%${product}%`);
        }

        const opsSql = `
            SELECT
                btrim(c2.c2_num) as op,
                btrim(c2.c2_item) as item,
                btrim(c2.c2_sequen) as sequen,
                btrim(c2.c2_pedido) as pedido,
                btrim(c2.c2_produto) as produto,
                c2.c2_quant as qtd_plan,
                btrim(a1.a1_nome) as cliente,
                btrim(sb1.b1_desc) as descricao,
                c2.c2_datpri as data_ini_plan
            FROM sc2010 c2
            LEFT JOIN sc5010 c5 ON c5.c5_num = c2.c2_pedido AND COALESCE(c5.d_e_l_e_t_, '') = ''
            LEFT JOIN sa1010 a1 ON a1.a1_cod = c5.c5_cliente AND COALESCE(a1.d_e_l_e_t_, '') = ''
            LEFT JOIN sb1010 sb1 ON sb1.b1_cod = c2.c2_produto AND COALESCE(sb1.d_e_l_e_t_, '') = ''
            ${whereClause}
        `;
        const opsRes = await db.query(opsSql, params);
        
        if (opsRes.rows.length === 0) {
            return res.json({ rows: [], columns: [] });
        }

        const opNumbers = [...new Set(opsRes.rows.map(r => r.op))];
        const productCodes = [...new Set(opsRes.rows.map(r => r.produto))];

        // 2. Fetch Appointments from MySQL
        const placeholders = opNumbers.map(() => '?').join(',');
        const [apptsRows] = await mysqlPool.query(`
            SELECT 
                op_numero,
                op_item,
                op_sequencia,
                operacao_codigo,
                SUM(quantidade) as total_produzido,
                MIN(data_inicio) as primeiro_apontamento
            FROM app_production_appointments
            WHERE op_numero IN (${placeholders})
            GROUP BY op_numero, op_item, op_sequencia, operacao_codigo
        `, opNumbers);

        // 3. Fetch Resource Mapping from Postgres (sg2010 + sh1010)
        let resourceMapping = {}; // { produto_operacaoCodigo: { codigo, descri } }
        let productResources = {}; // { produto: { recurso_codigo: count } }

        if (productCodes.length > 0) {
            const pgPlaceholders = productCodes.map((_, i) => `$${i + 1}`).join(',');
            const mapSql = `
                SELECT 
                    btrim(g2.g2_produto) as produto, 
                    btrim(g2.g2_operac) as operacao_codigo, 
                    btrim(g2.g2_recurso) as h1_codigo, 
                    btrim(h1.h1_descri) as h1_descri
                FROM sg2010 g2
                LEFT JOIN sh1010 h1 ON btrim(h1.h1_codigo) = btrim(g2.g2_recurso) AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
                WHERE btrim(g2.g2_produto) IN (${pgPlaceholders}) AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
            `;
            const mapRes = await db.query(mapSql, productCodes);
            mapRes.rows.forEach(r => {
                const isDesconhecido = !r.h1_descri || r.h1_descri === 'Desconhecido';
                resourceMapping[`${r.produto}_${r.operacao_codigo}`] = {
                    codigo: r.h1_codigo || r.operacao_codigo,
                    descri: isDesconhecido ? 'Desconhecido' : r.h1_descri
                };
                
                if (!isDesconhecido && r.h1_codigo) {
                    if (!productResources[r.produto]) productResources[r.produto] = {};
                    if (!productResources[r.produto][r.h1_codigo]) productResources[r.produto][r.h1_codigo] = 0;
                    productResources[r.produto][r.h1_codigo]++;
                }
            });
        }

        // 4. Group Data
        const grouped = {};
        const allResources = new Map(); // Keep track of unique resources for columns: Map<codigo, descri>

        opsRes.rows.forEach(opRow => {
            let groupId;
            let groupLabel;
            let extraLabel;

            if (groupBy === 'pedido') {
                // Skip OPs that have no sales order (orphan OPs)
                if (!opRow.pedido || opRow.pedido.trim() === '') return;
                groupId = opRow.pedido.trim();
                groupLabel = groupId;
                extraLabel = opRow.cliente || 'Sem Cliente';
            } else if (groupBy === 'produto') {
                groupId = opRow.produto;
                groupLabel = opRow.produto;
                extraLabel = opRow.descricao || 'Sem Descrição';
            } else { // op
                groupId = `${opRow.op}-${opRow.item}-${opRow.sequen}`;
                groupLabel = groupId;
                extraLabel = opRow.produto + (opRow.pedido ? ` (Ped: ${opRow.pedido})` : '');
            }

            if (!grouped[groupId]) {
                grouped[groupId] = {
                    id: groupId,
                    label: groupLabel,
                    extra: extraLabel,
                    qtd_plan: 0,
                    resources: {} // { resourceCodigo: { produzido, primeiro_apontamento } }
                };
            }
            
            // Add to total planned quantity for the group
            const opQtd = parseFloat(opRow.qtd_plan) || 0;
            grouped[groupId].qtd_plan += opQtd;

            // Increment the planned quantity PER RESOURCE and track min/max plan dates
            const opResources = productResources[opRow.produto] || {};
            const opPlanDate = opRow.data_ini_plan
                ? (() => {
                    const s = String(opRow.data_ini_plan).trim();
                    if (s.length === 8 && s !== '00000000') return new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`);
                    return null;
                  })()
                : null;
            Object.entries(opResources).forEach(([resKey, count]) => {
                if (!grouped[groupId].resources[resKey]) {
                    grouped[groupId].resources[resKey] = { produzido: 0, primeiro_apontamento: null, qtd_plan: 0, plan_date_min: null, plan_date_max: null };
                }
                grouped[groupId].resources[resKey].qtd_plan += (opQtd * count);
                if (opPlanDate) {
                    const r = grouped[groupId].resources[resKey];
                    if (!r.plan_date_min || opPlanDate < r.plan_date_min) r.plan_date_min = opPlanDate;
                    if (!r.plan_date_max || opPlanDate > r.plan_date_max) r.plan_date_max = opPlanDate;
                }
            });

            // Find appointments for this OP (matching exact OP, item and sequence if available)
            const opAppts = apptsRows.filter(a => 
                a.op_numero === opRow.op && 
                (!a.op_item || a.op_item === opRow.item) && 
                (!a.op_sequencia || a.op_sequencia === opRow.sequen)
            );
            opAppts.forEach(appt => {
                const mapKey = `${opRow.produto}_${appt.operacao_codigo}`;
                const resInfo = resourceMapping[mapKey] || { codigo: appt.operacao_codigo, descri: 'Desconhecido' };
                
                // Ignorar apontamentos onde a descrição do recurso é desconhecida
                if (resInfo.descri === 'Desconhecido') return;

                const resKey = resInfo.codigo; // Use h1_codigo as key

                if (!allResources.has(resKey)) {
                    allResources.set(resKey, `${resInfo.codigo} - ${resInfo.descri}`);
                }

                if (!grouped[groupId].resources[resKey]) {
                    grouped[groupId].resources[resKey] = { produzido: 0, primeiro_apontamento: null, qtd_plan: 0, plan_date_min: null, plan_date_max: null };
                }

                grouped[groupId].resources[resKey].produzido += parseFloat(appt.total_produzido) || 0;
                
                // Propagate plan_date via appointments path too (catches products without full SG2 routing)
                if (opPlanDate) {
                    const r = grouped[groupId].resources[resKey];
                    if (!r.plan_date_min || opPlanDate < r.plan_date_min) r.plan_date_min = opPlanDate;
                    if (!r.plan_date_max || opPlanDate > r.plan_date_max) r.plan_date_max = opPlanDate;
                }
                
                const apptDate = new Date(appt.primeiro_apontamento);
                const currentMinDate = grouped[groupId].resources[resKey].primeiro_apontamento;
                if (!currentMinDate || apptDate < currentMinDate) {
                    grouped[groupId].resources[resKey].primeiro_apontamento = apptDate;
                }
            });
        });

        // 5. Format Output
        const columns = Array.from(allResources.keys()).map(k => ({
            key: k,
            label: allResources.get(k)
        })).sort((a, b) => a.key.localeCompare(b.key)); // Sort by code

        const rows = Object.values(grouped).map(g => {
            const rowData = {
                id: g.id,
                label: g.label,
                extra: g.extra,
                qtd_plan: g.qtd_plan
            };
            
            // Calculate progress per resource
            columns.forEach(col => {
                const resData = g.resources[col.key];
                if (resData) {
                    const resQtdPlan = resData.qtd_plan > 0 ? resData.qtd_plan : g.qtd_plan; // fallback
                    const progress = resQtdPlan > 0 ? (resData.produzido / resQtdPlan) * 100 : 0;
                    rowData[col.key] = {
                        progress: Math.min(100, progress),
                        date: resData.primeiro_apontamento,
                        plan_date_min: resData.plan_date_min,
                        plan_date_max: resData.plan_date_max
                    };
                } else {
                    rowData[col.key] = null; // No appointments
                }
            });
            return rowData;
        });

        res.json({ rows, columns });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao gerar evolução por recurso: ' + err.message });
    }
});

// GET /api/reports/sales-planning/master-sheet
router.get('/sales-planning/master-sheet', async (req, res) => {
    try {
        const { rows } = await fetchSalesPlanningData(req.query, { page: 1, limit: 5000 });
        const data0 = req.query.data_0 || null;

        let capacidadeMap = {};
        try {
            const [capRows] = await mysqlPool.query('SELECT recurso_codigo, tempo_padrao_minutos FROM app_recursos_capacidade');
            capRows.forEach(r => { capacidadeMap[r.recurso_codigo] = parseFloat(r.tempo_padrao_minutos) || 0; });
        } catch (e) {
            console.warn('[MasterSheet] Could not load app_recursos_capacidade:', e.message);
        }

        let recursoNomeMap = {};
        try {
            const sh1 = await db.query(
                "SELECT TRIM(h1_codigo) as cod, TRIM(h1_descri) as nome FROM sh1010 WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ') AND TRIM(h1_codigo) <> ''"
            );
            sh1.rows.forEach(r => { recursoNomeMap[r.cod] = r.nome ? `${r.cod} - ${r.nome}` : r.cod; });
        } catch (e) {}

        const allItems = rows.flatMap(o => (o.itens || []).map(it => ({ ...it, order: o })));
        const uniqueProducts = [...new Set(allItems.map(it => it.produto.trim()))];

        let bomMap = {};
        if (uniqueProducts.length > 0) {
            const bomRows = await db.query(
                `WITH RECURSIVE bom AS (
                    SELECT TRIM(g1_cod) AS raiz, TRIM(g1_comp) AS comp, g1_quant::numeric AS quant, 1 AS nivel
                    FROM sg1010
                    WHERE TRIM(g1_cod) = ANY($1::text[]) AND COALESCE(d_e_l_e_t_, '') = ''
                    UNION ALL
                    SELECT bom.raiz, TRIM(sg1.g1_comp), bom.quant * sg1.g1_quant::numeric, bom.nivel + 1
                    FROM sg1010 sg1
                    JOIN bom ON TRIM(sg1.g1_cod) = bom.comp
                    WHERE COALESCE(sg1.d_e_l_e_t_, '') = '' AND bom.nivel < 15
                )
                SELECT raiz, comp, SUM(quant) AS quant_total FROM bom GROUP BY raiz, comp`,
                [uniqueProducts]
            );
            bomRows.rows.forEach(r => {
                if (!bomMap[r.raiz]) bomMap[r.raiz] = [];
                bomMap[r.raiz].push({ comp: r.comp, quant: parseFloat(r.quant_total) || 0 });
            });
        }

        const allCodesSet = new Set(uniqueProducts);
        Object.values(bomMap).forEach(comps => comps.forEach(c => allCodesSet.add(c.comp)));
        const allCodesArr = [...allCodesSet];

        let routingMap  = {};
        let routingSequenceMap = {};
        let operacaoToRecurso = {}; // { "PRODUTO_01": "MO0001" }
        let allRecursos = [];
        if (allCodesArr.length > 0) {
            const routingRows = await db.query(
                `SELECT TRIM(g2_produto) as produto, TRIM(g2_recurso) as recurso, TRIM(g2_operac) as operac,
                        g2_tempad::numeric as tempad, GREATEST(g2_lotepad::numeric, 1) as lotepad, g2_setup::numeric as setup
                 FROM sg2010
                 WHERE TRIM(g2_produto) = ANY($1::text[]) AND d_e_l_e_t_ = ''
                 ORDER BY g2_produto, g2_recurso, g2_operac`,
                [allCodesArr]
            );
            routingRows.rows.forEach(r => {
                const cod = r.produto, rec = r.recurso, operac = r.operac;
                const tempad = Number(r.tempad), lote = Math.max(Number(r.lotepad) || 1, 1), setup = Number(r.setup) || 0;
                const tPeca = Number.isFinite(tempad / lote) ? tempad / lote : 0;
                if (!routingMap[cod]) routingMap[cod] = {};
                if (!routingMap[cod][rec]) routingMap[cod][rec] = { tempo_peca: 0, setup: 0 };
                routingMap[cod][rec].tempo_peca += tPeca;
                routingMap[cod][rec].setup += setup;
                
                if (!routingSequenceMap[cod]) routingSequenceMap[cod] = [];
                routingSequenceMap[cod].push({ operac, recurso: rec, tempo_peca: tPeca, setup });
                
                if (cod && operac && rec) {
                    operacaoToRecurso[`${cod}_${operac}`] = rec;
                }
            });
            Object.values(routingSequenceMap).forEach(arr => arr.sort((a,b) => a.operac.localeCompare(b.operac)));
            const recursoSet = new Set();
            routingRows.rows.forEach(r => { if (r.recurso) recursoSet.add(r.recurso); });
            allRecursos = [...recursoSet].sort();
        }

        const masterSheet = {
            resumo: [],
            pedidos: [],
            itens: [],
            carga: [],
            execucao_op: [],
            recursos: allRecursos,
            recursoNomeMap: recursoNomeMap
        };

        const resumoMap = new Map();
        const yieldToEventLoop = () => new Promise(resolve => setImmediate(resolve));
        const BATCH_SIZE = 50;
        const totalOrders = rows.length;

        for (let batchStart = 0; batchStart < totalOrders; batchStart += BATCH_SIZE) {
            const batch = rows.slice(batchStart, Math.min(batchStart + BATCH_SIZE, totalOrders));

            for (const order of batch) {
                const orderCarga = {};
                let pcpInicio = null;
                let pcpFim = null;
                let itemCount = (order.itens || []).length;
                let somaQtd = 0;

                (order.itens || []).forEach(item => {
                    const qtdFaturar = parseFloat(item.qtd_faturar) || 0;
                    somaQtd += parseFloat(item.qtd) || 0;

                    if (item.data_pcp) {
                        let d;
                        if (item.data_pcp.length === 8 && !item.data_pcp.includes('-')) {
                            d = new Date(item.data_pcp.substring(0, 4) + '-' + item.data_pcp.substring(4, 6) + '-' + item.data_pcp.substring(6, 8) + 'T00:00:00');
                        } else {
                            d = new Date(item.data_pcp);
                        }
                        if (!isNaN(d.getTime())) {
                            if (!pcpInicio || d < pcpInicio) pcpInicio = d;
                            if (!pcpFim || d > pcpFim) pcpFim = d;
                        }
                    }

                    const prod = item.produto ? item.produto.trim() : '';
                    if (prod) {
                        if (!resumoMap.has(prod)) {
                            resumoMap.set(prod, { produto: prod, descricao: item.descricao, um: item.um, qtd_total: 0 });
                        }
                        resumoMap.get(prod).qtd_total += qtdFaturar;
                    }

                    masterSheet.itens.push({
                        pedido: order.pedido,
                        emissao: order.emissao,
                        cliente: order.cliente,
                        item: item.item,
                        produto: item.produto,
                        tipo: item.tipo,
                        descricao: item.descricao,
                        um: item.um,
                        qtd: item.qtd,
                        qtd_entreg: item.qtd_entreg,
                        qtd_faturar: qtdFaturar,
                        data_pcp: item.data_pcp,
                        qtde_pcp: item.qtde_pcp,
                        entrega: item.entrega,
                        op: item.op,
                        ped_cli: item.ped_cli
                    });

                    if (qtdFaturar > 0) {
                        const minByRec = calcCargaRecurso(item.produto.trim(), qtdFaturar, routingMap, bomMap, capacidadeMap);
                        const cargaRow = {
                            pedido: order.pedido,
                            emissao: order.emissao,
                            cliente: order.cliente,
                            item: item.item,
                            produto: item.produto,
                            descricao: item.descricao,
                            qtd_faturar: qtdFaturar,
                            entrega: item.entrega,
                            data_pcp: item.data_pcp,
                            qtde_pcp: item.qtde_pcp
                        };
                        allRecursos.forEach(r => {
                            cargaRow['rec_' + r] = minByRec['rec_' + r] || 0;
                            const k = 'rec_' + r;
                            orderCarga[k] = (orderCarga[k] || 0) + (minByRec[k] || 0);
                        });
                        masterSheet.carga.push(cargaRow);
                    }
                });

                const pedidoRow = {
                    pedido: order.pedido,
                    emissao: order.emissao,
                    cliente: order.cliente,
                    status: order.status,
                    itens_count: itemCount,
                    soma_qtd: somaQtd,
                    proxima_entrega: order.proxima_entrega,
                    pcp_inicio: pcpInicio ? pcpInicio.toISOString().split('T')[0] : null,
                    pcp_fim: pcpFim ? pcpFim.toISOString().split('T')[0] : null
                };
                
                allRecursos.forEach(r => {
                    const min = orderCarga['rec_' + r] || 0;
                    pedidoRow['rec_' + r] = min > 0 ? (min / 50) : 0;
                });
                masterSheet.pedidos.push(pedidoRow);
            }
            
            // Busca as OPs e apontamentos deste lote para a aba Execução OP
            const pedidosIds = batch.map(o => o.pedido).filter(Boolean);
            if (pedidosIds.length > 0) {
                // Monta mapa pedido+produto → { data_pcp, qtde_pcp } a partir dos itens já processados
                const pcpMap = {};
                batch.forEach(o => {
                    (o.itens || []).forEach(it => {
                        const key = `${o.pedido}|${String(it.produto || '').trim()}`;
                        if (!pcpMap[key] || (it.data_pcp && !pcpMap[key].data_pcp)) {
                            pcpMap[key] = { data_pcp: it.data_pcp || null, qtde_pcp: it.qtde_pcp || null };
                        }
                    });
                });
                const opQuery = `
                    SELECT TRIM(c2_num) AS num, TRIM(c2_item) AS item, TRIM(c2_sequen) AS sequen,
                           TRIM(c2_pedido) AS pedido, TRIM(c2_itempv) AS pedido_item,
                           TRIM(c2_produto) AS produto, c2_quant::numeric AS qtd_planejada
                    FROM sc2010
                    WHERE c2_pedido = ANY($1::text[]) AND COALESCE(d_e_l_e_t_, '') = ''
                `;
                const sc2Ops = await db.query(opQuery, [pedidosIds]);
                
                const uniqueOpNums = [...new Set(sc2Ops.rows.map(op => op.num))];
                let appointments = [];
                
                if (uniqueOpNums.length > 0) {
                    const [appRows] = await mysqlPool.query(
                        `SELECT op_numero, op_item, op_sequencia, operacao_codigo, SUM(quantidade) as qtd_apontada 
                         FROM app_production_appointments 
                         WHERE op_numero IN (?) 
                         GROUP BY op_numero, op_item, op_sequencia, operacao_codigo`,
                        [uniqueOpNums]
                    );
                    appointments = appRows;
                    console.log('--- TEST: uniqueOpNums ---', uniqueOpNums.slice(0, 5));
                    console.log('--- TEST: appointments ---', appointments.slice(0, 5));
                }
                
                sc2Ops.rows.forEach(opRow => {
                    const opApps = appointments.filter(a => {
                        const normNumA = String(a.op_numero).trim();
                        const normNumB = String(opRow.num).trim();
                        const normItemA = String(a.op_item).trim();
                        const normItemB = String(opRow.item).trim();
                        const normSeqA = String(a.op_sequencia).trim();
                        const normSeqB = String(opRow.sequen).trim();

                        const matchNum = normNumA === normNumB;
                        const matchItem = (normItemA === normItemB) || (!isNaN(parseInt(normItemA)) && parseInt(normItemA, 10) === parseInt(normItemB, 10));
                        const matchSeq = (normSeqA === normSeqB) || (!isNaN(parseInt(normSeqA)) && parseInt(normSeqA, 10) === parseInt(normSeqB, 10));

                        return matchNum && matchItem && matchSeq;
                    });
                    
                    const routing = routingMap[opRow.produto] || {};
                    const orderInfo = batch.find(o => o.pedido === opRow.pedido) || {};
                    
                    const pcpKey = `${opRow.pedido}|${String(opRow.produto || '').trim()}`;
                    const pcpInfo = pcpMap[pcpKey] || {};
                    const execRow = {
                        pedido: opRow.pedido,
                        item_pedido: opRow.pedido_item,
                        cliente: orderInfo.cliente,
                        op: `${opRow.num}${opRow.item}${opRow.sequen}`,
                        produto: opRow.produto,
                        qtd_planejada: parseFloat(opRow.qtd_planejada) || 0,
                        data_pcp: pcpInfo.data_pcp || null,
                        qtde_pcp: pcpInfo.qtde_pcp || null
                    };
                    
                    let hasLoad = false;
                    
                    // Calcula a carga para 1 unidade do produto desta OP considerando a estrutura (BOM) e fallbacks
                    const minByRecUnit = calcCargaRecurso(opRow.produto, 1, routingMap, bomMap, capacidadeMap);
                    
                    allRecursos.forEach(r => {
                        // Tempo unitário (inclui componentes e fallbacks) para este recurso
                        const tPecaUnit = minByRecUnit[`rec_${r}`] || 0;
                        
                        // Previsto = tempo unitário * quantidade planejada da OP
                        const previsto = tPecaUnit * execRow.qtd_planejada;
                        
                        // Mapeia o operacao_codigo (ex: "01") do apontamento para o recurso_codigo (ex: "MO0001")
                        const app = opApps.find(a => {
                            const recCodigo = operacaoToRecurso[`${opRow.produto}_${String(a.operacao_codigo).trim()}`];
                            return recCodigo === String(r).trim();
                        });
                        const qtdApontada = app ? Number(app.qtd_apontada) : 0;
                        
                        // Executado = tempo unitário * quantidade apontada (usando a mesma regra de cálculo)
                        const apontado = qtdApontada > 0 ? (qtdApontada * tPecaUnit) : 0;
                        
                        // Sempre mostrar a coluna se o recurso for apontado, mesmo se tempoUnit for 0
                        // (neste caso mostrará 0 min, mas exibirá na tabela se quisermos)
                        if (previsto > 0 || apontado > 0 || qtdApontada > 0) hasLoad = true;
                        
                        execRow[`previsto_${r}`] = parseFloat(previsto.toFixed(2));
                        execRow[`apontado_${r}`] = parseFloat(apontado.toFixed(2));
                    });
                    
                    // Apenas adiciona OP se ela tiver carga prevista ou apontada em algum recurso conhecido
                    if (hasLoad) {
                        masterSheet.execucao_op.push(execRow);
                    }
                });
            }

            await yieldToEventLoop();
        }

        masterSheet.resumo = Array.from(resumoMap.values()).sort((a, b) => a.produto.localeCompare(b.produto));

        if (data0) {
            const { simulateForwardScheduling } = require('../utils/simulateFCS');
            masterSheet.itens = simulateForwardScheduling(masterSheet.itens, data0, routingSequenceMap, bomMap);
        }

        res.json(masterSheet);
    } catch (error) {
        console.error('[MasterSheet] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
