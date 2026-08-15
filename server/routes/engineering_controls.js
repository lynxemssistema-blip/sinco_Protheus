const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const db = require('../db'); // Postgres Connection
const { getInactiveOrdersFilter } = require('../util/pedidoFilterHelper');

router.get('/', async (req, res) => {
    try {
        const getInactiveFilter = await getInactiveOrdersFilter();
        const { 
            limit = 50, 
            page = 1, 
            pedido, 
            projetista,
            cliente,
            project_type,
            dateType,
            startDate,
            endDate,
            release_status = 'unreleased'
        } = req.query;

        const pageParsed = parseInt(page, 10) || 1;
        const limitParsed = parseInt(limit, 10) || 50;
        const offset = (pageParsed - 1) * limitParsed;

        // Check if hide_inactive_orders is enabled
        const [settings] = await mysqlPool.query(
            "SELECT setting_value FROM app_settings WHERE setting_key = 'hide_inactive_orders'"
        );
        let hideInactive = true;
        if (settings && settings.length > 0) {
            hideInactive = settings[0].setting_value === 'true';
        }

        // 1. Query Protheus (Postgres) FIRST to get base active items
        let pgClientQuery = `
            SELECT DISTINCT 
                TRIM(c6.c6_num) as pedido, 
                TRIM(c6.c6_item) as item,
                TRIM(c6.c6_produto) as codigo,
                TRIM(sb1.b1_msblql) as b1_msblql,
                TRIM(c6.c6_xrevm) as rev_codigo,
                TRIM(c6.c6_xrevc) as c6_rev_cliente
            FROM public.sc6010 c6
            JOIN public.sc5010 c5 ON c5.c5_num = c6.c6_num AND c5.c5_filial = c6.c6_filial AND COALESCE(c5.d_e_l_e_t_, '') = ''
            LEFT JOIN public.sa1010 sa1 ON sa1.a1_cod = c5.c5_cliente AND sa1.a1_loja = c5.c5_lojacli AND COALESCE(sa1.d_e_l_e_t_, '') = ''
            LEFT JOIN public.sb1010 sb1 ON sb1.b1_cod = c6.c6_produto AND COALESCE(sb1.d_e_l_e_t_, '') = ''
            WHERE COALESCE(c6.d_e_l_e_t_, '') = ''
            AND (c6.c6_qtdven - c6.c6_qtdent) > 0
            ${getInactiveFilter('c5.c5_num')}
        `;
        const pgParams = [];
        let pgParamIndex = 1;

        if (pedido) {
            const pedidoList = String(pedido).split(',').map(p => p.trim()).filter(Boolean);
            if (pedidoList.length > 0) {
                const conditions = pedidoList.map((p) => {
                    pgParams.push(`%${p}%`);
                    return `c5.c5_num ILIKE $${pgParamIndex++}`;
                }).join(' OR ');
                pgClientQuery += ` AND (${conditions})`;
            }
        }

        if (cliente && cliente.trim()) {
            pgClientQuery += ` AND sa1.a1_nome ILIKE $${pgParamIndex++}`;
            pgParams.push(`%${cliente.trim()}%`);
        }

        let matchedRows = [];
        try {
            const pgRes = await db.query(pgClientQuery, pgParams);
            matchedRows = pgRes.rows;
        } catch (pgErr) {
            console.error("Error executing Postgres filter for candidates:", pgErr);
        }

        if (matchedRows.length === 0) {
            return res.json({
                data: [],
                meta: { total: 0, page: pageParsed, limit: limitParsed }
            });
        }

        // 2. Fetch MySQL data to apply MySQL-specific filters
        const allowedDateFields = new Set([
            'engineering_start_date',
            'designer_production_release_date',
            'designer_start_forecast',
            'designer_end_forecast',
            'designer_start_real',
            'designer_end_real'
        ]);
        const selectedDateField = allowedDateFields.has(dateType) ? dateType : 'engineering_start_date';

        let candidateQuery = `
            SELECT n.pedido, n.item
            FROM app_sales_order_item_notes n
            WHERE 1=1
        `;
        const candidateParams = [];

        if (projetista) {
            candidateQuery += ' AND n.designer_name LIKE ?';
            candidateParams.push(`%${projetista}%`);
        }
        if (startDate) {
            candidateQuery += ` AND n.${selectedDateField} >= ?`;
            candidateParams.push(startDate);
        }
        if (endDate) {
            candidateQuery += ` AND n.${selectedDateField} <= ?`;
            candidateParams.push(`${endDate} 23:59:59`);
        }
        if (hideInactive) {
            candidateQuery += ' AND n.pedido NOT IN (SELECT pedido_numero FROM app_pedidos_inativos)';
        }

        const [mysqlRows] = await mysqlPool.query(candidateQuery, candidateParams);
        const mysqlSet = new Set(mysqlRows.map(r => `${String(r.pedido).trim()}-${String(r.item).trim()}`));
        const hasMySqlSpecificFilters = !!(projetista || startDate || endDate);

        const [allReleasedRows] = await mysqlPool.query(`SELECT pedido, item FROM app_sales_order_item_notes WHERE designer_production_release_date IS NOT NULL AND designer_production_release_date <> ""`);
        const allReleasedSet = new Set(allReleasedRows.map(r => `${String(r.pedido).trim()}-${String(r.item).trim()}`));

        // 3. Intersect Postgres universe with MySQL filters
        matchedRows = matchedRows.filter(r => {
            const key = `${r.pedido.trim()}-${r.item.trim()}`;
            
            if (release_status === 'released') {
                if (!allReleasedSet.has(key)) return false;
            } else if (release_status === 'unreleased') {
                if (allReleasedSet.has(key)) return false;
            }

            if (hasMySqlSpecificFilters) {
                if (!mysqlSet.has(key)) return false;
            }
            
            return true;
        });

        // 4. Apply project_type calculations
        if (project_type && matchedRows.length > 0) {
                const productCodes = [...new Set(matchedRows.map(r => (r.codigo || '').trim()).filter(Boolean))];
                const sg1Set = new Set();
                const sg2Set = new Set();
                const sz0Set = new Set();
                let globalReleaseSet = new Set();

                if (productCodes.length > 0) {
                    const pgStatusResult = await db.query(`
                        SELECT 'sg1' AS type, TRIM(g1_cod) AS cod
                          FROM public.sg1010
                         WHERE TRIM(g1_cod) = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') <> '*'
                        UNION ALL
                        SELECT 'sg2' AS type, TRIM(g2_produto) AS cod
                          FROM public.sg2010
                         WHERE TRIM(g2_produto) = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') <> '*'
                        UNION ALL
                        SELECT 'sz0' AS type, TRIM(z0_produto) AS cod
                          FROM public.sz0010
                         WHERE TRIM(z0_produto) = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') <> '*' AND z0_status = 'P'
                    `, [productCodes]);

                    pgStatusResult.rows.forEach(r => {
                        if (r.type === 'sg1') sg1Set.add(r.cod);
                        if (r.type === 'sg2') sg2Set.add(r.cod);
                        if (r.type === 'sz0') sz0Set.add(r.cod);
                    });

                    const qPlaceholders = productCodes.map(() => '?').join(',');
                    const [releasesRows] = await mysqlPool.query(
                        `SELECT DISTINCT UPPER(TRIM(codigo_produto)) AS cod FROM app_engineering_releases WHERE codigo_produto IN (${qPlaceholders})`,
                        productCodes
                    );
                    globalReleaseSet = new Set(releasesRows.map(r => r.cod));
                }

                matchedRows = matchedRows.filter(pInfo => {
                    let calcType = 'PCP';
                    const cod = String(pInfo.codigo || '').trim();
                    const isBlocked     = ['1', 'S', 'T', 'Y'].includes(pInfo.b1_msblql?.trim());
                    const hasRestriction = sz0Set.has(cod);
                    const revDiff       = (pInfo.rev_codigo || '') !== (pInfo.c6_rev_cliente || '');
                    const isNew         = !sg1Set.has(cod) && !sg2Set.has(cod);
                    const hasGlobalRelease = globalReleaseSet.has(cod.toUpperCase());

                    if (hasGlobalRelease) {
                        calcType = 'PCP';
                    } else if (isBlocked || hasRestriction) {
                        calcType = 'Restrição';
                    } else if (revDiff) {
                        calcType = 'Revisão';
                    } else if (isNew) {
                        calcType = 'Novo';
                    }
                    
                    return calcType === project_type;
                });
            }

        let filteredPairs = matchedRows.map(r => ({ pedido: r.pedido.trim(), item: r.item.trim() }));

        // Sort by pedido and item
        filteredPairs.sort((a, b) => {
            if (a.pedido !== b.pedido) {
                return a.pedido.localeCompare(b.pedido);
            }
            return a.item.localeCompare(b.item);
        });

        const totalFiltered = filteredPairs.length;
        if (totalFiltered === 0) {
            return res.json({
                data: [],
                meta: { total: 0, page: pageParsed, limit: limitParsed }
            });
        }

        // 3. Paginate the filtered pairs in memory
        const pagePairs = filteredPairs.slice(offset, offset + limitParsed);
        if (pagePairs.length === 0) {
            return res.json({
                data: [],
                meta: { total: totalFiltered, page: pageParsed, limit: limitParsed }
            });
        }

        // 4. Query MySQL for notes and timesheets for the current page
        const pagePairsSql = pagePairs.map(r => `('${r.pedido}', '${r.item}')`).join(',');
        const finalQuery = `
            SELECT n.*, ts.total_seconds 
            FROM app_sales_order_item_notes n
            LEFT JOIN (
                SELECT pedido, item, SUM(duration_seconds) as total_seconds 
                FROM app_engineering_timesheets 
                GROUP BY pedido, item
            ) ts ON ts.pedido = n.pedido AND ts.item = n.item
            WHERE (TRIM(n.pedido), TRIM(n.item)) IN (${pagePairsSql})
            ORDER BY n.updated_at DESC
        `;

        const [rows] = await mysqlPool.query(finalQuery);

        // 5. Enrich rows with Postgres data
        const pairs = pagePairs.map(r => `('${r.pedido.trim()}', '${r.item.trim()}')`);
        
        let pgRows = [];
        if (pairs.length > 0) {
            const pgQuery = `
                SELECT 
                    TRIM(c5.c5_num) AS pedido,
                    TRIM(c6.c6_item) AS item,
                    TRIM(sa1.a1_nome) AS nome_cliente,
                    TRIM(c6.c6_produto) AS codigo,
                    TRIM(sb1.b1_desc) AS descricao,
                    TRIM(c6.c6_xrevm) AS rev_codigo,
                    TRIM(c6.c6_xrevc) AS c6_rev_cliente,
                    TRIM(sb1.b1_msblql) AS b1_msblql,
                    (
                        SELECT STRING_AGG(DISTINCT TRIM(z1.z1_codcli), ' / ')
                        FROM public.sz1010 z1
                        WHERE z1.z1_cliente = c5.c5_cliente
                          AND z1.z1_loja = c5.c5_lojacli
                          AND TRIM(z1.z1_produto) = TRIM(c6.c6_produto)
                          AND COALESCE(z1.d_e_l_e_t_, '') = ''
                    ) AS ref_cliente
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

        // Get status and structures info for dynamic calculation
        const productCodes = [...new Set(pgRows.map(r => (r.codigo || '').trim()).filter(Boolean))];
        const sg1Set = new Set();
        const sg2Set = new Set();
        const sz0Set = new Set();
        let globalReleaseSet = new Set();

        if (productCodes.length > 0) {
            try {
                const pgStatusResult = await db.query(`
                    SELECT 'sg1' AS type, TRIM(g1_cod) AS cod
                      FROM public.sg1010
                     WHERE TRIM(g1_cod) = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') <> '*'
                    UNION ALL
                    SELECT 'sg2' AS type, TRIM(g2_produto) AS cod
                      FROM public.sg2010
                     WHERE TRIM(g2_produto) = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') <> '*'
                    UNION ALL
                    SELECT 'sz0' AS type, TRIM(z0_produto) AS cod
                      FROM public.sz0010
                     WHERE TRIM(z0_produto) = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') <> '*' AND z0_status = 'P'
                `, [productCodes]);

                pgStatusResult.rows.forEach(r => {
                    if (r.type === 'sg1') sg1Set.add(r.cod);
                    if (r.type === 'sg2') sg2Set.add(r.cod);
                    if (r.type === 'sz0') sz0Set.add(r.cod);
                });

                const qPlaceholders = productCodes.map(() => '?').join(',');
                const [releasesRows] = await mysqlPool.query(
                    `SELECT DISTINCT UPPER(TRIM(codigo_produto)) AS cod FROM app_engineering_releases WHERE codigo_produto IN (${qPlaceholders})`,
                    productCodes
                );
                globalReleaseSet = new Set(releasesRows.map(r => r.cod));
            } catch (statusErr) {
                console.error("Error fetching product status info for controls:", statusErr);
            }
        }

        const mysqlMap = {};
        rows.forEach(r => {
            mysqlMap[`${String(r.pedido).trim()}-${String(r.item).trim()}`] = r;
        });

        const enrichedData = pagePairs.map(pair => {
            const key = `${pair.pedido.trim()}-${pair.item.trim()}`;
            const row = mysqlMap[key] || { pedido: pair.pedido, item: pair.item };
            const pInfo = pgMap[key];
            let calcType = 'PCP';
            
            if (pInfo) {
                const cod = String(pInfo.codigo || '').trim();
                const isBlocked     = ['1', 'S', 'T', 'Y'].includes(pInfo.b1_msblql?.trim());
                const hasRestriction = sz0Set.has(cod);
                const revDiff       = (pInfo.rev_codigo || '') !== (pInfo.c6_rev_cliente || '');
                const isNew         = !sg1Set.has(cod) && !sg2Set.has(cod);
                const hasGlobalRelease = globalReleaseSet.has(cod.toUpperCase());

                if (hasGlobalRelease) {
                    calcType = 'PCP';
                } else if (isBlocked || hasRestriction) {
                    calcType = 'Restrição';
                } else if (revDiff) {
                    calcType = 'Revisão';
                } else if (isNew) {
                    calcType = 'Novo';
                }
            }

            return {
                ...row,
                nome_cliente: pInfo ? pInfo.nome_cliente : '',
                codigo_produto: pInfo ? pInfo.codigo : '',
                descricao_produto: pInfo ? pInfo.descricao : '',
                ref_cliente: pInfo ? pInfo.ref_cliente : '-',
                project_type: calcType // Overridden dynamically
            };
        });

        // 6. Fetch Docs from MySQL for the enriched items
        const prodCodes = [...new Set(enrichedData.map(r => r.codigo_produto).filter(Boolean))];
        let docsMap = {};
        if (prodCodes.length > 0) {
            try {
                const placeholders = prodCodes.map(() => '?').join(',');
                const [docsRows] = await mysqlPool.query(
                    `SELECT DISTINCT TRIM(produto_codigo) as produto_codigo, url_arquivo, tipo FROM produtos_docs WHERE produto_codigo IN (${placeholders})`,
                    prodCodes
                );
                docsRows.forEach(row => {
                    const code = row.produto_codigo.trim();
                    if (!docsMap[code]) docsMap[code] = [];
                    docsMap[code].push(row);
                });
            } catch (docsErr) {
                console.error("Error fetching product docs for engineering controls:", docsErr);
            }
        }

        // Attach docs info to enrichedData
        const finalEnrichedData = enrichedData.map(row => {
            const docs = docsMap[row.codigo_produto] || [];
            const drawing = docs.find(d => String(d.tipo).toLowerCase().includes('desenho'));
            return {
                ...row,
                has_docs: docs.length > 0,
                docs_count: docs.length,
                has_drawing: !!drawing,
                drawing_url: drawing ? drawing.url_arquivo : null,
                first_doc: docs.length > 0 ? docs[0].url_arquivo : null
            };
        });

        res.json({
            data: finalEnrichedData,
            meta: {
                total: totalFiltered,
                page: pageParsed,
                limit: limitParsed
            }
        });

    } catch (err) {
        console.error('Error fetching engineering controls report:', err);
        res.status(500).json({ error: 'Erro ao buscar controles de engenharia', message: err.message, stack: err.stack });
    }
});
module.exports = router;
