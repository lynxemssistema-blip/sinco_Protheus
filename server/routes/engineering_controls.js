const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const db = require('../db'); // Postgres Connection
const { getInactiveOrdersFilter } = require('../util/pedidoFilterHelper');

router.get('/', async (req, res) => {
    try {
        const getInactiveFilter = await getInactiveOrdersFilter();
        const { limit = 50, page = 1, pedido, projetista } = req.query;
        const pageParsed = parseInt(page, 10) || 1;
        const limitParsed = parseInt(limit, 10) || 50;
        const offset = (pageParsed - 1) * limitParsed;

        let query = `
            SELECT n.*, ts.total_seconds 
            FROM app_sales_order_item_notes n
            LEFT JOIN (
                SELECT pedido, item, SUM(duration_seconds) as total_seconds 
                FROM app_engineering_timesheets 
                GROUP BY pedido, item
            ) ts ON ts.pedido = n.pedido AND ts.item = n.item
            WHERE 1=1
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM app_sales_order_item_notes n WHERE 1=1';
        const params = [];

        if (pedido) {
            query += ' AND n.pedido LIKE ?';
            countQuery += ' AND n.pedido LIKE ?';
            params.push(`%${pedido}%`);
        }

        if (projetista) {
            query += ' AND n.designer_name LIKE ?';
            countQuery += ' AND n.designer_name LIKE ?';
            params.push(`%${projetista}%`);
        }

        query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
        const queryParams = [...params, limitParsed, offset];

        // Fetching from MySQL
        const [rows] = await mysqlPool.query(query, queryParams);
        const [countResult] = await mysqlPool.query(countQuery, params);

        if (rows.length === 0) {
            return res.json({
                data: [],
                meta: { total: 0, page: pageParsed, limit: limitParsed }
            });
        }

        // Enriching with Postgres data
        const pairs = rows.map(r => `('${r.pedido.trim()}', '${r.item.trim()}')`);
        
        let pgRows = [];
        if (pairs.length > 0) {
            const pgQuery = `
                SELECT 
                    TRIM(c5.c5_num) AS pedido,
                    TRIM(c6.c6_item) AS item,
                    TRIM(sa1.a1_nome) AS nome_cliente,
                    TRIM(c6.c6_produto) AS codigo,
                    TRIM(sb1.b1_desc) AS descricao
                FROM public.sc6010 c6
                JOIN public.sc5010 c5 ON c5.c5_num = c6.c6_num AND c5.c5_filial = c6.c6_filial AND COALESCE(c5.d_e_l_e_t_, '') = ''
                LEFT JOIN public.sa1010 sa1 ON sa1.a1_cod = c5.c5_cliente AND sa1.a1_loja = c5.c5_lojacli AND COALESCE(sa1.d_e_l_e_t_, '') = ''
                LEFT JOIN public.sb1010 sb1 ON sb1.b1_cod = c6.c6_produto AND COALESCE(sb1.d_e_l_e_t_, '') = ''
                WHERE (TRIM(c6.c6_num), TRIM(c6.c6_item)) IN (${pairs.join(',')})
                AND COALESCE(c6.d_e_l_e_t_, '') = ''
                ${getInactiveFilter('c5.c5_num')}
            `;

            try {
                const pgRes = await db.query(pgQuery);
                pgRows = pgRes.rows;
            } catch (pgErr) {
                console.error("Error fetching protheus data for engineering controls:", pgErr);
            }
        }

        const pgMap = {};
        pgRows.forEach(row => {
            pgMap[`${row.pedido}-${row.item}`] = row;
        });

        const enrichedData = rows.map(row => {
            const pInfo = pgMap[`${row.pedido.trim()}-${row.item.trim()}`];
            return {
                ...row,
                nome_cliente: pInfo ? pInfo.nome_cliente : '',
                codigo_produto: pInfo ? pInfo.codigo : '',
                descricao_produto: pInfo ? pInfo.descricao : '',
            };
        });

        res.json({
            data: enrichedData,
            meta: {
                total: parseInt(countResult[0].total, 10),
                page: pageParsed,
                limit: limitParsed
            }
        });

    } catch (err) {
        console.error('Error fetching engineering controls report:', err);
        res.status(500).json({ error: 'Erro ao buscar controles de engenharia' });
    }
});

module.exports = router;
