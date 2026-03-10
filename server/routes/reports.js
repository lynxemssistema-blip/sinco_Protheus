const express = require('express');
const router = express.Router();
const db = require('../db'); // Postgres (Protheus)
const mysqlPool = require('../services/mysqlService'); // MySQL (App)
// const PdfPrinter = require('pdfmake/src/printer'); // Temporarily disabled due to module issues
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

// Fonts for pdfmake
// const fonts = {
//     Roboto: {
//         normal: 'Helvetica',
//         bold: 'Helvetica-Bold',
//         italics: 'Helvetica-Oblique',
//         bolditalics: 'Helvetica-BoldOblique'
//     }
// };
// const printer = new PdfPrinter(fonts);

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
    let whereClause = `WHERE c2.d_e_l_e_t_ = ''`;
    const params = [];

    if (op) {
        whereClause += ` AND TRIM(c2.c2_num) = $${params.length + 1}`;
        params.push(op);
    }
    if (client) {
        whereClause += ` AND (UPPER(a1.a1_nome) LIKE UPPER($${params.length + 1}) OR UPPER(a1.a1_nreduz) LIKE UPPER($${params.length + 1}))`;
        params.push(`%${client}%`);
    }

    // PROTHEUS Query (Simplified for Reports)
    // Grouping by OP (aggregated items)
    // FIXED: Joined via SC5 (Sales Order) because C2 (OP) usually lacks C2_CLIENTE directly
    const sql = `
        SELECT
            c2.c2_num as op,
            MAX(c5.c5_cliente) as cod_cliente,
            MAX(a1.a1_nome) as cliente_nome,
            MAX(c2.c2_pedido) as raw_pedido,
            MAX(c2.c2_obs) as obs_venda,
            MAX(c2.c2_datpri) as data_entrega_prevista,
            SUM(c2.c2_quant::numeric) as qtd_total_planejada,
            SUM(c2.c2_quje::numeric) as qtd_total_apontada_erp
        FROM sc2010 c2
        LEFT JOIN sc5010 c5 ON c5.c5_num = c2.c2_pedido AND c5.d_e_l_e_t_ = ''
        LEFT JOIN sa1010 a1 ON a1.a1_cod = c5.c5_cliente AND a1.d_e_l_e_t_ = ''
        ${whereClause}
        GROUP BY c2.c2_num
        ORDER BY c2.c2_num DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    // Execute Main Query
    const results = await db.query(sql, [...params, limit, offset]);

    // Execute Count Query (for pagination)
    const countSql = `
        SELECT COUNT(DISTINCT c2.c2_num) as total
        FROM sc2010 c2
        LEFT JOIN sc5010 c5 ON c5.c5_num = c2.c2_pedido AND c5.d_e_l_e_t_ = ''
        LEFT JOIN sa1010 a1 ON a1.a1_cod = c5.c5_cliente AND a1.d_e_l_e_t_ = ''
        ${whereClause}
    `;
    const countRes = await db.query(countSql, params);
    const totalRecords = parseInt(countRes.rows[0].total);

    // 2. Enhance with MySQL Data (Status & Progress)
    // Fetch aggregated progress from MySQL for these OPs
    const opNumbers = results.rows.map(r => r.op);
    let mysqlMap = {};

    if (opNumbers.length > 0) {
        const placeholders = opNumbers.map(() => '?').join(',');
        const [mysqlRows] = await mysqlPool.query(`
            SELECT 
                op_numero,
                MIN(data_planejada_inicio) as plan_inicio,
                MAX(data_planejada_fim) as plan_fim,
                SUM(qtd_produzida_real) as total_produzido
            FROM app_production_planning p
            LEFT JOIN (
                SELECT 
                    op_numero as op_stats, op_item, op_sequencia, operacao_codigo,
                    SUM(quantidade) as qtd_produzida_real
                FROM app_production_appointments
                GROUP BY op_numero, op_item, op_sequencia, operacao_codigo
            ) stats ON 
                stats.op_stats = p.op_numero AND 
                stats.op_item = p.op_item AND 
                stats.op_sequencia = p.op_sequencia AND 
                stats.operacao_codigo = p.operacao_codigo
            WHERE op_numero IN (${placeholders})
            GROUP BY op_numero
        `, opNumbers);

        mysqlRows.forEach(row => {
            mysqlMap[row.op_numero] = row;
        });
    }

    // Merge Data
    const rows = results.rows.map(pgRow => {
        const myData = mysqlMap[pgRow.op] || {};
        const qtdPlan = parseFloat(pgRow.qtd_total_planejada) || 0;
        const qtdProd = parseFloat(myData.total_produzido) || parseFloat(pgRow.qtd_total_apontada_erp) || 0; // Fallback to ERP
        const percent = qtdPlan > 0 ? (qtdProd / qtdPlan) * 100 : 0;

        // Determine Status based on dates and progress
        let status = 'PENDENTE';
        if (date_start && date_end) {
            // Filter logic if needed later
        }

        if (percent >= 100) status = 'CONCLUIDO';
        else if (percent > 0) status = 'EM_ANDAMENTO';

        const rawP = (pgRow.raw_pedido || '').trim();
        const rawO = (pgRow.obs_venda || '').trim();

        return {
            op: pgRow.op.trim(),
            cliente: pgRow.cliente_nome?.trim() || 'N/A',
            pedido: rawP || (rawO.match(/^\d+/)?.[0] || 'N/A'),
            data_entrega: pgRow.data_entrega_prevista,
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
            { header: 'OP', key: 'op', width: 15 },
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
                op: r.op,
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
    let whereClause = `WHERE c5.c5_tipo <> 'B' AND COALESCE(c5.d_e_l_e_t_, '') = ''`;

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
            SUM(c6.c6_qtdven) as soma_qtd,
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
                sb1.b1_desc as descricao,
                c6.c6_um as um,
                c6.c6_qtdven as qtd,
                COALESCE(c6.c6_qtdent, 0) as qtd_entreg,
                (COALESCE(c6.c6_qtdven, 0) - COALESCE(c6.c6_qtdent, 0)) as qtd_faturar,
                c6.c6_entreg as entrega,
                c6.c6_pedcli as ped_cli,
                c2.c2_num as op
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
                pedido: item.pedido.trim(),
                produto: item.produto.trim(),
                descricao: item.descricao?.trim(),
                op: item.op?.trim(),
                ped_cli: item.ped_cli?.trim()
            });
        });
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

// GET /api/reports/sales-planning/pdf
// Temporarily disabled due to pdfmake module issues
router.get('/sales-planning/pdf', async (req, res) => {
    res.status(503).json({ error: 'PDF generation temporarily unavailable - Excel export is available' });
});

// GET /api/reports/sales-planning/excel OR xlsx
router.get(['/sales-planning/excel', '/sales-planning/xlsx'], async (req, res) => {
    try {
        const { rows } = await fetchSalesPlanningData(req.query, { page: 1, limit: 5000 });

        const workbook = new ExcelJS.Workbook();
        const sheetOrders = workbook.addWorksheet('Pedidos');
        const sheetItems = workbook.addWorksheet('Itens Detalhados');

        // Sheet 1: Orders
        sheetOrders.columns = [
            { header: 'Pedido', key: 'pedido', width: 12 },
            { header: 'Emissão', key: 'emissao', width: 12 },
            { header: 'Cliente', key: 'cliente', width: 40 },
            { header: 'Status', key: 'status', width: 20 },
            { header: 'Qtd Itens', key: 'itens_count', width: 10 },
            { header: 'Soma QTD', key: 'soma_qtd', width: 12 },
            { header: 'Próx. Entrega', key: 'proxima_entrega', width: 12 }
        ];

        // Sheet 2: Items
        sheetItems.columns = [
            { header: 'Pedido', key: 'pedido', width: 12 },
            { header: 'Emissão', key: 'emissao', width: 12 },
            { header: 'Cliente', key: 'cliente', width: 30 },
            { header: 'Item', key: 'item', width: 8 },
            { header: 'Produto', key: 'produto', width: 15 },
            { header: 'Descrição', key: 'descricao', width: 40 },
            { header: 'UM', key: 'um', width: 6 },
            { header: 'Qtd Total', key: 'qtd', width: 10 },
            { header: 'Qtd Entregue', key: 'qtd_entreg', width: 12 },
            { header: 'Saldo a Faturar', key: 'qtd_faturar', width: 15 },
            { header: 'Entrega', key: 'entrega', width: 12 },
            { header: 'OP', key: 'op', width: 12 },
            { header: 'Ped. Cliente', key: 'ped_cli', width: 15 }
        ];

        styleHeader(sheetOrders);
        styleHeader(sheetItems);

        rows.forEach(order => {
            // Add Order Row
            sheetOrders.addRow({
                pedido: order.pedido,
                emissao: parseDate(order.emissao),
                cliente: order.cliente,
                status: order.status,
                itens_count: order.itens_count,
                soma_qtd: order.soma_qtd,
                proxima_entrega: parseDate(order.proxima_entrega)
            });

            // Add Item Rows
            if (order.itens) {
                order.itens.forEach(item => {
                    sheetItems.addRow({
                        pedido: order.pedido,
                        emissao: parseDate(order.emissao),
                        cliente: order.cliente,
                        item: item.item,
                        produto: item.produto,
                        descricao: item.descricao,
                        um: item.um,
                        qtd: parseFloat(item.qtd),
                        qtd_entreg: parseFloat(item.qtd_entreg),
                        qtd_faturar: parseFloat(item.qtd_faturar),
                        entrega: parseDate(item.entrega),
                        op: item.op,
                        ped_cli: item.ped_cli
                    });
                });
            }
        });

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
                TipoUsuario: u.TipoUsuario === 'A' ? 'Administrador' : 'Usuário',
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

// EXPORTAR ROUTER NO FINAL
module.exports = router;
