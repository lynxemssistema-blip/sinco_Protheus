const express = require('express');
const router = express.Router();
const db = require('../db');
const mysqlPool = require('../services/mysqlService');
const XLSX = require('xlsx');
const { validate, rules } = require('../middlewares/validate');
const archiver = require('archiver');
const fs = require('fs');
const nodePath = require('path');
const { hasFinancialAccess } = require('../util/permissionHelper');

function decodeProtheusMemo(val) {
    if (typeof val === 'string' && val.startsWith('\\x')) {
        return Buffer.from(val.slice(2), 'hex').toString('utf8').replace(/\0/g, '');
    }
    return val || '';
}

function decodeMemosInRow(row) {
    if (!row) return row;
    const fields = ['observacoes_gerais', 'observacoes', 'c5_zobs', 'c5_zobsorc'];
    fields.forEach(f => {
        if (row[f]) row[f] = decodeProtheusMemo(row[f]);
    });
    return row;
}

const ExcelJS = require('exceljs');
const multer = require('multer');
const { getInactiveOrdersFilter } = require('../util/pedidoFilterHelper');

const uploadDirClassificacao = nodePath.join(__dirname, '../uploads/classificacao');
if (!fs.existsSync(uploadDirClassificacao)) {
    fs.mkdirSync(uploadDirClassificacao, { recursive: true });
}
const storageClassificacao = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDirClassificacao);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + nodePath.extname(file.originalname));
    }
});
const uploadClassificacao = multer({ storage: storageClassificacao });
const { getVisaoGerencial } = require('../util/visaoGerencialHelper');

// Helper to get authorized orders for external users
async function getAuthorizedOrders(req) {
    if (!req.user || !req.user.id) return { isExternal: false, allowedOrders: [] };

    try {
        const [userRows] = await mysqlPool.query(
            'SELECT TipoUsuario, pedidos_autorizados, tipoExterno, idCliente, lojaCliente, idFornecedor, lojaFornecedor FROM usuario WHERE idUsuario = ?',
            [req.user.id]
        );

        if (userRows.length === 0) return { isExternal: false, allowedOrders: [] };

        const user = userRows[0];
        
        // Check if role is CLI or profile is configured as external in company settings
        let isExternal = (user.TipoUsuario === 'CLI');
        
        const [configRows] = await mysqlPool.query('SELECT general_config FROM app_company_settings WHERE id = 1');
        if (configRows.length > 0 && configRows[0].general_config) {
            try {
                const config = typeof configRows[0].general_config === 'string' 
                    ? JSON.parse(configRows[0].general_config) 
                    : configRows[0].general_config;
                const profiles = config.custom_profiles || [];
                const userProfile = profiles.find(p => p.code === user.TipoUsuario);
                if (userProfile && userProfile.tipoPerfil === 'externo') {
                    isExternal = true;
                }
            } catch (e) {
                console.error('Error parsing general_config:', e);
            }
        }

        if (!isExternal) {
            return { isExternal: false, allowedOrders: [] };
        }

        const allowedOrders = (user.pedidos_autorizados || '')
            .split(',')
            .map(p => p.trim())
            .filter(p => p.length > 0);

        return { 
            isExternal: true, 
            allowedOrders,
            tipoExterno: user.tipoExterno,
            idCliente: user.idCliente,
            lojaCliente: user.lojaCliente,
            idFornecedor: user.idFornecedor,
            lojaFornecedor: user.lojaFornecedor
        };
    } catch (err) {
        console.error('Error checking external user permissions:', err);
        return { isExternal: false, allowedOrders: [] };
    }
}

// Middleware to restrict single order endpoints
async function checkOrderAccess(req, res, next) {
    const pedido = req.params.id || req.params.pedido;
    if (!pedido) return next();

    const auth = await getAuthorizedOrders(req);
    if (auth.isExternal) {
        const cleanPedido = pedido.trim();
        if (auth.allowedOrders.includes(cleanPedido)) {
            return next();
        }
        
        if (auth.tipoExterno === 'cliente' && auth.idCliente) {
            const pgClient = await db.connect();
            try {
                const resTemp = await pgClient.query(
                    `SELECT c5_cliente, c5_lojacli FROM public.sc5010 WHERE c5_num = $1 AND COALESCE(d_e_l_e_t_, '') = ''`,
                    [cleanPedido.padStart(6, '0')]
                );
                if (resTemp.rows.length > 0) {
                    const orderClient = resTemp.rows[0].c5_cliente.trim();
                    const orderLoja = resTemp.rows[0].c5_lojacli.trim();
                    if (orderClient === auth.idCliente.trim() && (!auth.lojaCliente || orderLoja === auth.lojaCliente.trim())) {
                        return next();
                    }
                }
            } catch (err) {
                console.error('Error in checkOrderAccess client verification:', err);
            } finally {
                pgClient.release();
            }
        }
        
        return res.status(403).json({ error: 'Acesso Negado: Você não tem permissão para visualizar este pedido.' });
    }
    next();
}

// ── Forecast cache (módulo) — TTL 60s, evita fetch MySQL por requisição ────
let _fcCache = { map: new Map(), expiresAt: 0 };
async function getForecastMapCached() {
    if (Date.now() < _fcCache.expiresAt) return _fcCache.map;
    const map = new Map();
    try {
        const [rows] = await mysqlPool.query(`
            SELECT TRIM(pedido) as pedido, TRIM(item) as item,
                   data_entrega_pcp,
                   data_prevista_faturamento,
                   quantidade_pcp,
                   TRIM(op_protheus) as op_protheus
            FROM app_pcp_delivery_forecasts
            WHERE pedido IS NOT NULL AND item IS NOT NULL
        `);
        for (const row of rows) {
            const baseKey = `${row.pedido}|${row.item}`;
            
            // 1. Mapeamento específico por OP se houver
            if (row.op_protheus && row.op_protheus !== '-') {
                const opPrefix = String(row.op_protheus).trim().substring(0, 6);
                if (opPrefix) {
                    const opKey = `${baseKey}|${opPrefix}`;
                    map.set(opKey, {
                        data_entrega_pcp: row.data_entrega_pcp || null,
                        data_prevista_faturamento: row.data_prevista_faturamento || null,
                        quantidade_pcp: row.quantidade_pcp || null,
                        op_protheus: row.op_protheus
                    });
                }
            }
            
            // 2. Mapeamento geral/fallback por Pedido|Item (compatibilidade com telas que não usam OPs)
            if (!map.has(baseKey)) {
                map.set(baseKey, {
                    data_entrega_pcp: row.data_entrega_pcp || null,
                    data_prevista_faturamento: row.data_prevista_faturamento || null,
                    quantidade_pcp: row.quantidade_pcp || null
                });
            } else {
                const current = map.get(baseKey);
                const currentVal = current.data_entrega_pcp ? new Date(current.data_entrega_pcp) : null;
                const rowVal = row.data_entrega_pcp ? new Date(row.data_entrega_pcp) : null;
                if (rowVal && (!currentVal || rowVal > currentVal)) {
                    current.data_entrega_pcp = row.data_entrega_pcp;
                }
                const currentPrev = current.data_prevista_faturamento ? new Date(current.data_prevista_faturamento) : null;
                const rowPrev = row.data_prevista_faturamento ? new Date(row.data_prevista_faturamento) : null;
                if (rowPrev && (!currentPrev || rowPrev > currentPrev)) {
                    current.data_prevista_faturamento = row.data_prevista_faturamento;
                }
                current.quantidade_pcp = (parseFloat(current.quantidade_pcp) || 0) + (parseFloat(row.quantidade_pcp) || 0);
            }
        }
    } catch (err) {
        console.error('getForecastMapCached error:', err.message);
    }
    _fcCache = { map, expiresAt: Date.now() + 60_000 };
    return map;
}

// GET /api/pedidos
router.get('/', async (req, res) => {
    try {
        const { cliente, pedido, produto, pedcli, dataInicial, dataFinal, dateType = 'pedido', page = 1, limit = 50, only_active = 'false', somente_prioridades = 'false', op_status = '', sortBy = 'emissao', sortOrder = 'DESC' } = req.query;

        // Paginação
        const limitParsed = parseInt(limit, 10) || 50;
        const pageParsed = parseInt(page, 10) || 1;
        const offset = (pageParsed - 1) * limitParsed;

        // Fetch forecasts from MySQL first
        let valuesList = "(CAST('DUMMY' AS varchar), CAST('DUMMY' AS varchar), CAST(NULL AS varchar), CAST(NULL AS varchar))";
        try {
            const [forecastRows] = await mysqlPool.query(`
                SELECT TRIM(pedido) as pedido, TRIM(item) as item, data_entrega_pcp, data_prevista_faturamento 
                FROM app_pcp_delivery_forecasts
                WHERE pedido IS NOT NULL AND item IS NOT NULL
            `);
            if (forecastRows.length > 0) {
                const formatDateForPg = (d) => {
                    if (!d) return 'NULL';
                    const dateObj = new Date(d);
                    if (isNaN(dateObj.getTime())) return 'NULL';
                    return `'${dateObj.toISOString().slice(0, 19).replace('T', ' ')}'`;
                };
                valuesList = forecastRows.map(row => {
                    const entregaPcpStr = formatDateForPg(row.data_entrega_pcp);
                    const prevFatStr = formatDateForPg(row.data_prevista_faturamento);
                    return `(CAST('${row.pedido}' AS varchar), CAST('${row.item}' AS varchar), CAST(${entregaPcpStr} AS varchar), CAST(${prevFatStr} AS varchar))`;
                }).join(', ');
            }
        } catch (err) {
            console.error('Error fetching forecasts for virtual join:', err);
        }

        // Parâmetros para query
        const params = [];
        let paramCount = 1;

        const getInactiveFilter = await getInactiveOrdersFilter();

        // Construção dinâmica de filtros
        let whereClause = "WHERE COALESCE(c5.d_e_l_e_t_, '') = '' AND c5.c5_tipo <> 'B'" + getInactiveFilter('c5.c5_num');

        // Restringir visibilidade de pedidos para usuários externos
        const auth = await getAuthorizedOrders(req);
        if (auth.isExternal) {
            let externalConditions = [];
            
            const sanitized = auth.allowedOrders.filter(o => /^[a-zA-Z0-9]+$/.test(o));
            if (sanitized.length > 0) {
                const numConditions = sanitized.map(o => `c5.c5_num LIKE '${o}%'`).join(' OR ');
                externalConditions.push(`(${numConditions})`);
            }
            
            if (auth.tipoExterno === 'cliente' && auth.idCliente) {
                let clientCond = `c5.c5_cliente LIKE '${auth.idCliente.trim()}%'`;
                if (auth.lojaCliente) {
                    clientCond += ` AND c5.c5_lojacli LIKE '${auth.lojaCliente.trim()}%'`;
                }
                externalConditions.push(`(${clientCond})`);
            }
            
            if (externalConditions.length === 0) {
                whereClause += ' AND 1=0';
            } else {
                whereClause += ` AND (${externalConditions.join(' OR ')})`;
            }
        }

        // Filtra fora os "Vermelhos" (Faturados) - Optional now for Performance
        if (only_active === 'true') {
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

        if (somente_prioridades && somente_prioridades !== 'false') {
            try {
                let prioQuery = 'SELECT DISTINCT op_numero FROM app_op_priorities WHERE prioridade > 0';
                const prioMysqlParams = [];
                if (['1', '2', '3', '4'].includes(String(somente_prioridades))) {
                    prioQuery = 'SELECT DISTINCT op_numero FROM app_op_priorities WHERE prioridade = ?';
                    prioMysqlParams.push(parseInt(somente_prioridades, 10));
                }
                const [priOpsRows] = await mysqlPool.execute(prioQuery, prioMysqlParams);

                if (priOpsRows.length === 0) {
                    return res.json({ data: [], meta: { total: 0, page: 1, pages: 1 } });
                }

                // op_numero in MySQL = TRIM(c2_num) || TRIM(c2_item) || TRIM(c2_sequen)
                // Match the full key in PostgreSQL for exact OP identification
                const opFullKeys = [...new Set(
                    priOpsRows.map(r => String(r.op_numero).trim()).filter(Boolean)
                )];

                if (opFullKeys.length > 0) {
                    // Use parameterized query via literal embedding with sanitization
                    const sanitized = opFullKeys.filter(o => /^[a-zA-Z0-9]+$/.test(o));
                    if (sanitized.length > 0) {
                        const opInList = sanitized.map(o => `'${o}'`).join(', ');
                        whereClause += ` AND EXISTS (
                            SELECT 1 FROM public.sc6010 c6_pri
                            JOIN public.sc2010 c2_pri ON TRIM(c2_pri.c2_pedido) = TRIM(c6_pri.c6_num)
                                AND TRIM(c2_pri.c2_itempv) = TRIM(c6_pri.c6_item)
                                AND (TRIM(c2_pri.c2_num) || TRIM(c2_pri.c2_item) || TRIM(c2_pri.c2_sequen)) IN (${opInList})
                                AND COALESCE(c2_pri.d_e_l_e_t_, '') = ''
                            WHERE c6_pri.c6_num = c5.c5_num
                            AND c6_pri.c6_filial = c5.c5_filial
                            AND COALESCE(c6_pri.d_e_l_e_t_, '') = ''
                        )`;
                    }
                }
            } catch (prioErr) {
                console.error('[GET /] Erro no filtro somente_prioridades:', prioErr.message);
            }
        }

        if (cliente) {
            const pgClient = await db.connect();
            let clienteMatches = [];
            try {
                const resTemp = await pgClient.query(
                    `SELECT a1_cod, a1_loja FROM public.sa1010 WHERE COALESCE(d_e_l_e_t_, '') = '' AND a1_nome ILIKE $1 LIMIT 5000`, 
                    [`%${cliente}%`]
                );
                clienteMatches = resTemp.rows;
            } finally {
                pgClient.release();
            }

            if (clienteMatches.length === 0) {
                return res.json({ data: [], meta: { hasNextPage: false, total: 0 } });
            }

            const inValues = clienteMatches.map(m => `('${m.a1_cod}', '${m.a1_loja}')`).join(', ');
            whereClause += ` AND (c5.c5_cliente, c5.c5_lojacli) IN (${inValues})`;
        }

        if (pedido) {
            const pedidoList = String(pedido).split(',')
                .map(p => p.trim())
                .filter(p => p.length > 0)
                .map(p => p.padStart(6, '0'));

            if (pedidoList.length === 1) {
                whereClause += ` AND TRIM(c5.c5_num) = $${paramCount}`;
                params.push(pedidoList[0]);
                paramCount++;
            } else if (pedidoList.length > 1) {
                const placeholders = pedidoList.map((_, i) => `$${paramCount + i}`).join(', ');
                whereClause += ` AND TRIM(c5.c5_num) IN (${placeholders})`;
                params.push(...pedidoList);
                paramCount += pedidoList.length;
            }
        }

        if (produto) {
            whereClause += ` AND EXISTS (
                SELECT 1 FROM public.sc6010 c6_filter 
                WHERE c6_filter.c6_num = c5.c5_num 
                AND c6_filter.c6_filial = c5.c5_filial 
                AND c6_filter.c6_produto ILIKE '%' || $${paramCount} || '%'
                AND COALESCE(c6_filter.d_e_l_e_t_, '') = ''
            )`;
            params.push(produto);
            paramCount++;
        }

        if (pedcli) {
            whereClause += ` AND EXISTS (
                SELECT 1 FROM public.sc6010 c6_filter 
                WHERE c6_filter.c6_num = c5.c5_num 
                AND c6_filter.c6_filial = c5.c5_filial 
                AND c6_filter.c6_pedcli ILIKE '%' || $${paramCount} || '%'
                AND COALESCE(c6_filter.d_e_l_e_t_, '') = ''
            )`;
            params.push(pedcli);
            paramCount++;
        }

        if (op_status === 'com_op') {
            whereClause += ` AND EXISTS (
                SELECT 1 FROM public.sc6010 c6_op_filter
                WHERE c6_op_filter.c6_num = c5.c5_num
                AND c6_op_filter.c6_filial = c5.c5_filial
                AND COALESCE(c6_op_filter.d_e_l_e_t_, '') = ''
                AND EXISTS (
                     SELECT 1 FROM public.sc2010 c2_op
                     WHERE (c2_op.c2_pedido = c6_op_filter.c6_num)
                     AND c2_op.c2_itempv = c6_op_filter.c6_item
                     AND COALESCE(c2_op.d_e_l_e_t_, '') = ''
                )
            )`;
        } else if (op_status === 'sem_op') {
            whereClause += ` AND EXISTS (
                SELECT 1 FROM public.sc6010 c6_sem_op_filter
                WHERE c6_sem_op_filter.c6_num = c5.c5_num
                AND c6_sem_op_filter.c6_filial = c5.c5_filial
                AND COALESCE(c6_sem_op_filter.d_e_l_e_t_, '') = ''
                AND NOT EXISTS (
                     SELECT 1 FROM public.sc2010 c2_op
                     WHERE (c2_op.c2_pedido = c5.c5_num)
                     AND c2_op.c2_itempv = c6_sem_op_filter.c6_item
                     AND COALESCE(c2_op.d_e_l_e_t_, '') = ''
                )
            )`;
        }

        // Filtro por data
        if (dataInicial || dataFinal) {
            if (dateType === 'nf') {
                let nfFilter = `EXISTS (
                    SELECT 1 FROM public.sd2010 d2_ex
                    JOIN public.sf2010 f2_ex 
                        ON f2_ex.f2_doc = d2_ex.d2_doc 
                        AND f2_ex.f2_serie = d2_ex.d2_serie 
                        AND COALESCE(f2_ex.d_e_l_e_t_, '') = ''
                    WHERE d2_ex.d2_pedido = c5.c5_num 
                      AND COALESCE(d2_ex.d_e_l_e_t_, '') = ''
                `;
                if (dataInicial) {
                    nfFilter += ` AND f2_ex.f2_emissao >= $${paramCount}`;
                    params.push(dataInicial.replace(/-/g, ''));
                    paramCount++;
                }
                if (dataFinal) {
                    nfFilter += ` AND f2_ex.f2_emissao <= $${paramCount}`;
                    params.push(dataFinal.replace(/-/g, ''));
                    paramCount++;
                }
                nfFilter += `)`;
                whereClause += ` AND ${nfFilter}`;
            } else if (dateType === 'entrega') {
                let entregaFilter = `EXISTS (
                    SELECT 1 FROM public.sc6010 c6_ent 
                    WHERE c6_ent.c6_num = c5.c5_num 
                    AND c6_ent.c6_filial = c5.c5_filial 
                    AND COALESCE(c6_ent.d_e_l_e_t_, '') = ''
                `;
                if (dataInicial) {
                    entregaFilter += ` AND c6_ent.c6_entreg >= $${paramCount}`;
                    params.push(dataInicial.replace(/-/g, ''));
                    paramCount++;
                }
                if (dataFinal) {
                    entregaFilter += ` AND c6_ent.c6_entreg <= $${paramCount}`;
                    params.push(dataFinal.replace(/-/g, ''));
                    paramCount++;
                }
                entregaFilter += `)`;
                whereClause += ` AND ${entregaFilter}`;
            } else if (dateType === 'entrega_pcp') {
                if (dataInicial) {
                    whereClause += ` AND fc_agg.min_entrega_pcp IS NOT NULL AND CAST(fc_agg.min_entrega_pcp AS timestamp) >= $${paramCount}::timestamp`;
                    params.push(new Date(dataInicial));
                    paramCount++;
                }
                if (dataFinal) {
                    whereClause += ` AND fc_agg.min_entrega_pcp IS NOT NULL AND CAST(fc_agg.min_entrega_pcp AS timestamp) <= $${paramCount}::timestamp`;
                    params.push(new Date(dataFinal + 'T23:59:59'));
                    paramCount++;
                }
            } else {
                if (dataInicial) {
                    whereClause += ` AND c5.c5_emissao >= $${paramCount}`;
                    params.push(dataInicial.replace(/-/g, ''));
                    paramCount++;
                }
                if (dataFinal) {
                    whereClause += ` AND c5.c5_emissao <= $${paramCount}`;
                    params.push(dataFinal.replace(/-/g, ''));
                    paramCount++;
                }
            }
        }

        const query = `
      SELECT
        c5.c5_num AS pedido,
        sa1.a1_nome AS nome_cliente,
        NULLIF(TRIM(COALESCE(c5.c5_mennota, '') || ' ' || COALESCE(c5.c5_zobs, '') || ' ' || COALESCE(c5.c5_zobsorc, '')), '') AS observacoes_gerais,
        TRIM(c5.c5_emissao) AS emissao_raw,
        COALESCE(c6_agg.itens_count, 0)     AS itens_count,
        COALESCE(c6_op_agg.itens_com_op, 0) AS itens_com_op,
        c6_agg.entrega_raw,
        CASE
            WHEN COALESCE(c6_agg.itens_count, 0) = 0
                THEN 'red'
            WHEN c6_agg.itens_distintos > COALESCE(c2_agg.op_count, 0)
                 AND COALESCE(c2_agg.op_count, 0) > 0
                THEN 'orange'
            WHEN COALESCE(c2_agg.op_count, 0) = 0
                THEN 'red'
            WHEN c5.c5_liberok = '' AND COALESCE(c5.c5_nota, '') = ''
                THEN 'green'
            WHEN c5.c5_liberok = 'S'
                THEN 'yellow'
            ELSE 'default'
        END AS status_cor,
        COUNT(*) OVER() AS full_count
      FROM public.sc5010 c5
      LEFT JOIN public.sa1010 sa1
        ON sa1.a1_cod = c5.c5_cliente
        AND COALESCE(sa1.d_e_l_e_t_, '') = ''
      LEFT JOIN (
          SELECT c6.c6_num, c6.c6_filial,
              MIN(fc.data_entrega_pcp) AS min_entrega_pcp,
              MAX(fc.data_prevista_faturamento) AS max_prev_fat
          FROM public.sc6010 c6
          LEFT JOIN (
              VALUES ${valuesList}
          ) AS fc(pedido, item, data_entrega_pcp, data_prevista_faturamento)
              ON fc.pedido = TRIM(c6.c6_num) AND fc.item = TRIM(c6.c6_item)
          WHERE COALESCE(c6.d_e_l_e_t_, '') = ''
          GROUP BY c6.c6_num, c6.c6_filial
      ) fc_agg ON fc_agg.c6_num = c5.c5_num AND fc_agg.c6_filial = c5.c5_filial
      LEFT JOIN (
          SELECT c6_num, c6_filial,
              COUNT(*)                AS itens_count,
              COUNT(DISTINCT c6_item) AS itens_distintos,
              TRIM(MAX(c6_entreg))    AS entrega_raw
          FROM public.sc6010
          WHERE COALESCE(d_e_l_e_t_, '') = ''
          GROUP BY c6_num, c6_filial
      ) c6_agg ON c6_agg.c6_num = c5.c5_num AND c6_agg.c6_filial = c5.c5_filial
      LEFT JOIN (
          SELECT c6_x.c6_num, c6_x.c6_filial,
              COUNT(DISTINCT c6_x.c6_item) AS itens_com_op
          FROM public.sc6010 c6_x
          WHERE COALESCE(c6_x.d_e_l_e_t_, '') = ''
          AND EXISTS (
              SELECT 1 FROM public.sc2010 c2_x
              WHERE c2_x.c2_pedido = c6_x.c6_num
                AND c2_x.c2_itempv = c6_x.c6_item
                AND COALESCE(c2_x.d_e_l_e_t_, '') = ''
          )
          GROUP BY c6_x.c6_num, c6_x.c6_filial
      ) c6_op_agg ON c6_op_agg.c6_num = c5.c5_num AND c6_op_agg.c6_filial = c5.c5_filial
      LEFT JOIN (
          SELECT c2_pedido,
              COUNT(DISTINCT c2_itempv) AS op_count
          FROM public.sc2010
          WHERE COALESCE(d_e_l_e_t_, '') = ''
          GROUP BY c2_pedido
      ) c2_agg ON c2_agg.c2_pedido = c5.c5_num
      ${whereClause}
      ${sortBy === 'entrega' 
          ? `ORDER BY NULLIF(TRIM(c6_agg.entrega_raw), '') ${sortOrder === 'ASC' ? 'ASC' : 'DESC'} NULLS LAST, c5.c5_num DESC` 
          : sortBy === 'emissao'
          ? `ORDER BY c5.c5_emissao ${sortOrder === 'ASC' ? 'ASC' : 'DESC'}, c5.c5_num DESC`
          : sortBy === 'entrega_pcp'
          ? `ORDER BY CASE WHEN fc_agg.min_entrega_pcp IS NULL THEN 1 ELSE 0 END ASC, fc_agg.min_entrega_pcp ${sortOrder === 'ASC' ? 'ASC' : 'DESC'}, c5.c5_num DESC`
          : sortBy === 'prev_fat'
          ? `ORDER BY CASE WHEN fc_agg.max_prev_fat IS NULL THEN 1 ELSE 0 END ASC, fc_agg.max_prev_fat ${sortOrder === 'ASC' ? 'ASC' : 'DESC'}, c5.c5_num DESC`
          : sortBy === 'pedido'
          ? `ORDER BY c5.c5_num ${sortOrder === 'ASC' ? 'ASC' : 'DESC'}`
          : `ORDER BY c5.c5_num DESC`}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

        params.push(limitParsed, offset);

        const result = await db.query(query, params);

        const data = result.rows.map(row => {
            const parseDateStr = (dStr) => {
                if (!dStr || dStr.trim() === '' || dStr.length < 8) return '';
                return `${dStr.substring(6, 8)}/${dStr.substring(4, 6)}/${dStr.substring(2, 4)}`;
            };
            return {
                ...decodeMemosInRow(row),
                emissao: parseDateStr(row.emissao_raw),
                entrega: parseDateStr(row.entrega_raw)
            };
        });

        res.json({
            data: data,
            meta: {
                total: result.rows.length > 0 ? parseInt(result.rows[0].full_count, 10) : 0,
                page: parseInt(page),
                limit: limitParsed
            }
        });

    } catch (err) {
        console.error('Erro detalhado consulta pedidos:', err);
        res.status(500).json({ error: 'Erro interno ao processar consulta.', details: err.message });
    }
});

// GET /api/pedidos/flat - Listagem Plana (Item a Item)
router.get('/flat', async (req, res) => {
    let query = '';
    let countQuery = '';
    let params = [];
    let countParams = [];
    let errorStep = '';
    try {
        const canViewFinancials = await hasFinancialAccess(req);
        const { cliente, pedido, produto, pedcli, refCliente, dataInicial, dataFinal, dateType = 'pedido', page = 1, limit = 50, only_active = 'false', somente_prioridades = 'false', tipo_item = '', classificacao_item = '', pcpDataInicial = '', pcpDataFinal = '', pcpDateFilter = 'false', op_status = '', sortBy = 'emissao', sortOrder = 'DESC' } = req.query;
        const limitParsed = parseInt(limit, 10) || 50;
        const pageParsed = parseInt(page, 10) || 1;
        const offset = (pageParsed - 1) * limitParsed;

        params = [];
        let paramCount = 1;
        let countParamCount = 1;

        const [forecastMap, getInactiveFilter] = await Promise.all([
            getForecastMapCached(),
            getInactiveOrdersFilter()
        ]);
        const inactiveFilterSql = getInactiveFilter('c5.c5_num');
        let whereClause = "WHERE COALESCE(c5.d_e_l_e_t_, '') = '' AND c5.c5_tipo <> 'B' AND COALESCE(c6.d_e_l_e_t_, '') = ''" + inactiveFilterSql;
        let countWhereClause = "WHERE COALESCE(c5.d_e_l_e_t_, '') = '' AND c5.c5_tipo <> 'B' AND COALESCE(c6.d_e_l_e_t_, '') = ''" + inactiveFilterSql;

        const { isExternal, allowedOrders } = await getAuthorizedOrders(req);
        if (isExternal) {
            if (allowedOrders.length === 0) {
                whereClause += ' AND 1=0';
                countWhereClause += ' AND 1=0';
            } else {
                const sanitized = allowedOrders.filter(o => /^[a-zA-Z0-9]+$/.test(o));
                if (sanitized.length === 0) {
                    whereClause += ' AND 1=0';
                    countWhereClause += ' AND 1=0';
                } else {
                    const orderFilter = ` AND TRIM(c5.c5_num) IN (${sanitized.map(o => `'${o}'`).join(',')})`;
                    whereClause += orderFilter;
                    countWhereClause += orderFilter;
                }
            }
        }

        if (only_active === 'true') {
            const activeItemFilter = ` AND ((c6.c6_qtdven - c6.c6_qtdent) > 0 OR c6.c6_qtdlib > 0)`;
            whereClause += activeItemFilter;
            countWhereClause += activeItemFilter;
        }

        if (somente_prioridades && somente_prioridades !== 'false') {
            try {
                // Build MySQL query: 'true' = any priority, '1'/'2'/'3'/'4' = specific group
                let prioQuery = 'SELECT DISTINCT op_numero FROM app_op_priorities WHERE prioridade > 0';
                const prioMysqlParams = [];
                if (['1', '2', '3', '4'].includes(String(somente_prioridades))) {
                    prioQuery = 'SELECT DISTINCT op_numero FROM app_op_priorities WHERE prioridade = ?';
                    prioMysqlParams.push(parseInt(somente_prioridades, 10));
                }
                const [priOpsRows] = await mysqlPool.execute(prioQuery, prioMysqlParams);

                if (priOpsRows.length === 0) {
                    return res.json({ data: [], meta: { hasNextPage: false, total: 0 } });
                }

                // op_numero in MySQL = TRIM(c2_num) || TRIM(c2_item) || TRIM(c2_sequen)
                // We match the full concatenated key in PostgreSQL for exact OP identification
                const opFullKeys = [...new Set(
                    priOpsRows.map(r => String(r.op_numero).trim()).filter(Boolean)
                )];

                if (opFullKeys.length === 0) {
                    return res.json({ data: [], meta: { hasNextPage: false, total: 0 } });
                }

                // OTIMIZAÇÃO: Pré-buscar os pedidos/itens no PostgreSQL em vez de usar EXISTS na CTE principal
                // O PostgreSQL sofre para otimizar EXISTS com ANY dentro de uma CTE complexa com ordenação.
                const { rows: prioRows } = await db.query(`
                    SELECT DISTINCT TRIM(c2_pedido) as pedido, TRIM(c2_itempv) as item 
                    FROM public.sc2010 
                    WHERE (TRIM(c2_num) || TRIM(c2_item) || TRIM(c2_sequen)) = ANY($1::text[])
                    AND COALESCE(d_e_l_e_t_, '') = ''
                `, [opFullKeys]);

                if (prioRows.length === 0) {
                    return res.json({ data: [], meta: { hasNextPage: false, total: 0 } });
                }

                const tuplePlaceholders = [];
                const tuplePlaceholdersCount = [];
                
                prioRows.forEach(r => {
                    tuplePlaceholders.push(`($${paramCount}, $${paramCount + 1})`);
                    params.push(r.pedido, r.item);
                    paramCount += 2;

                    tuplePlaceholdersCount.push(`($${countParamCount}, $${countParamCount + 1})`);
                    countParams.push(r.pedido, r.item);
                    countParamCount += 2;
                });

                const priFilter = ` AND (TRIM(c6.c6_num), TRIM(c6.c6_item)) IN (${tuplePlaceholders.join(', ')}) `;
                whereClause += priFilter;
                
                const priFilterCount = ` AND (TRIM(c6.c6_num), TRIM(c6.c6_item)) IN (${tuplePlaceholdersCount.join(', ')}) `;
                countWhereClause += priFilterCount;
            } catch (prioErr) {
                console.error('[GET /flat] Erro no filtro somente_prioridades:', prioErr.message);
            }
        }

        if (cliente) {
            const pgClient = await db.connect();
            let clienteMatches = [];
            try {
                const resTemp = await pgClient.query(
                    `SELECT a1_cod, a1_loja FROM public.sa1010 WHERE COALESCE(d_e_l_e_t_, '') = '' AND a1_nome ILIKE $1 LIMIT 5000`, 
                    [`%${cliente}%`]
                );
                clienteMatches = resTemp.rows;
            } finally {
                pgClient.release();
            }

            if (clienteMatches.length === 0) {
                return res.json({ data: [], meta: { hasNextPage: false, total: 0 } });
            }

            const inValues = clienteMatches.map(m => `('${m.a1_cod}', '${m.a1_loja}')`).join(', ');
            whereClause += ` AND (c5.c5_cliente, c5.c5_lojacli) IN (${inValues})`;
            countWhereClause += ` AND (c5.c5_cliente, c5.c5_lojacli) IN (${inValues})`;
        }

        if (pedido) {
            const pedidoList = String(pedido).split(',')
                .map(p => p.trim())
                .filter(p => p.length > 0)
                .map(p => p.padStart(6, '0'));

            if (pedidoList.length === 1) {
                whereClause += ` AND TRIM(c5.c5_num) = $${paramCount}`;
                params.push(pedidoList[0]);
                paramCount++;
                countWhereClause += ` AND TRIM(c5.c5_num) = $${countParamCount}`;
                countParams.push(pedidoList[0]);
                countParamCount++;
            } else {
                const placeholders = pedidoList.map((_, i) => `$${paramCount + i}`).join(', ');
                whereClause += ` AND TRIM(c5.c5_num) IN (${placeholders})`;
                params.push(...pedidoList);
                paramCount += pedidoList.length;

                const countPlaceholders = pedidoList.map((_, i) => `$${countParamCount + i}`).join(', ');
                countWhereClause += ` AND TRIM(c5.c5_num) IN (${countPlaceholders})`;
                countParams.push(...pedidoList);
                countParamCount += pedidoList.length;
            }
        }

        if (produto) {
            whereClause += ` AND c6.c6_produto ILIKE '%' || $${paramCount} || '%'`;
            params.push(produto);
            paramCount++;
            countWhereClause += ` AND c6.c6_produto ILIKE '%' || $${countParamCount} || '%'`;
            countParams.push(produto);
            countParamCount++;
        }

        if (pedcli) {
            whereClause += ` AND c6.c6_pedcli ILIKE '%' || $${paramCount} || '%'`;
            params.push(pedcli);
            paramCount++;
            countWhereClause += ` AND c6.c6_pedcli ILIKE '%' || $${countParamCount} || '%'`;
            countParams.push(pedcli);
            countParamCount++;
        }

        if (refCliente) {
            const refFilter = ` AND EXISTS (SELECT 1 FROM public.sz1010 z1_f WHERE z1_f.z1_cliente = c5.c5_cliente AND z1_f.z1_loja = c5.c5_lojacli AND TRIM(z1_f.z1_produto) = TRIM(c6.c6_produto) AND COALESCE(z1_f.d_e_l_e_t_, '') = '' AND z1_f.z1_codcli ILIKE '%' || $${paramCount} || '%')`;
            whereClause += refFilter;
            params.push(refCliente);
            paramCount++;
            
            const countRefFilter = ` AND EXISTS (SELECT 1 FROM public.sz1010 z1_f WHERE z1_f.z1_cliente = c5.c5_cliente AND z1_f.z1_loja = c5.c5_lojacli AND TRIM(z1_f.z1_produto) = TRIM(c6.c6_produto) AND COALESCE(z1_f.d_e_l_e_t_, '') = '' AND z1_f.z1_codcli ILIKE '%' || $${countParamCount} || '%')`;
            countWhereClause += countRefFilter;
            countParams.push(refCliente);
            countParamCount++;
        }

        if (classificacao_item) {
            const classificacoes = classificacao_item.split(',').filter(Boolean);
            if (classificacoes.length > 0) {
                const hasNenhum = classificacoes.includes('Nenhum');
                const positiveClassifs = classificacoes.filter(c => c !== 'Nenhum');

                if (positiveClassifs.length > 0 && !hasNenhum) {
                    const placeholdersClassif = positiveClassifs.map(() => '?').join(',');
                    const [classRows] = await mysqlPool.query(
                        `SELECT DISTINCT TRIM(pedido) as pedido FROM app_pedido_itens_classificacao WHERE classificacao IN (${placeholdersClassif})`,
                        positiveClassifs
                    );
                    if (classRows.length > 0) {
                        const matchedPedidos = classRows.map(r => r.pedido);
                        const placeholdersMatched = matchedPedidos.map((_, i) => `$${paramCount + i}`).join(',');
                        whereClause += ` AND TRIM(c5.c5_num) IN (${placeholdersMatched})`;
                        params.push(...matchedPedidos);
                        paramCount += matchedPedidos.length;

                        const countPlaceholdersMatched = matchedPedidos.map((_, i) => `$${countParamCount + i}`).join(',');
                        countWhereClause += ` AND TRIM(c5.c5_num) IN (${countPlaceholdersMatched})`;
                        countParams.push(...matchedPedidos);
                        countParamCount += matchedPedidos.length;
                    } else {
                        return res.json({ data: [], meta: { hasNextPage: false, total: 0 } });
                    }
                }
            }
        }

        if (tipo_item) {
            const tipos = tipo_item.split(',').filter(Boolean);
            if (tipos.length > 0) {
                const tipoConditions = [];
                
                if (tipos.includes('Restrição')) {
                    tipoConditions.push(`(
                        EXISTS (
                            SELECT 1 FROM public.sb1010 filter_sb
                            WHERE TRIM(filter_sb.b1_cod) = TRIM(c6.c6_produto)
                            AND COALESCE(filter_sb.d_e_l_e_t_, '') <> '*'
                            AND filter_sb.b1_msblql IN ('1','S','T','Y')
                        ) OR EXISTS (
                            SELECT 1 FROM public.sz0010 filter_sz
                            WHERE TRIM(filter_sz.z0_produto) = TRIM(c6.c6_produto)
                            AND COALESCE(filter_sz.d_e_l_e_t_, '') <> '*'
                            AND filter_sz.z0_status = 'P'
                        )
                    )`);
                }
                if (tipos.includes('Revisão')) {
                    tipoConditions.push(`(COALESCE(c6.c6_xrevm, '') <> COALESCE(c6.c6_xrevc, ''))`);
                }
                if (tipos.includes('Novo')) {
                    tipoConditions.push(`(NOT EXISTS (
                        SELECT 1 FROM public.sg1010 sg1
                        WHERE TRIM(sg1.g1_cod) = TRIM(c6.c6_produto)
                        AND COALESCE(sg1.d_e_l_e_t_, '') <> '*'
                    ) AND NOT EXISTS (
                        SELECT 1 FROM public.sg2010 sg2
                        WHERE TRIM(sg2.g2_produto) = TRIM(c6.c6_produto)
                        AND COALESCE(sg2.d_e_l_e_t_, '') <> '*'
                    ))`);
                }
                if (tipos.includes('PCP')) {
                    tipoConditions.push(`(NOT (
                        EXISTS (
                            SELECT 1 FROM public.sb1010 filter_sb
                            WHERE TRIM(filter_sb.b1_cod) = TRIM(c6.c6_produto)
                            AND COALESCE(filter_sb.d_e_l_e_t_, '') <> '*'
                            AND filter_sb.b1_msblql IN ('1','S','T','Y')
                        ) OR EXISTS (
                            SELECT 1 FROM public.sz0010 filter_sz
                            WHERE TRIM(filter_sz.z0_produto) = TRIM(c6.c6_produto)
                            AND COALESCE(filter_sz.d_e_l_e_t_, '') <> '*'
                            AND filter_sz.z0_status = 'P'
                        )
                    ) AND COALESCE(c6.c6_xrevm, '') = COALESCE(c6.c6_xrevc, '') 
                      AND (
                        EXISTS (
                            SELECT 1 FROM public.sg1010 sg1
                            WHERE TRIM(sg1.g1_cod) = TRIM(c6.c6_produto)
                            AND COALESCE(sg1.d_e_l_e_t_, '') <> '*'
                        ) OR EXISTS (
                            SELECT 1 FROM public.sg2010 sg2
                            WHERE TRIM(sg2.g2_produto) = TRIM(c6.c6_produto)
                            AND COALESCE(sg2.d_e_l_e_t_, '') <> '*'
                        )
                    ))`);
                }
                
                if (tipoConditions.length > 0) {
                    const tipoFilter = ` AND (${tipoConditions.join(' OR ')})`;
                    whereClause += tipoFilter;
                    countWhereClause += tipoFilter;
                }
            }
        }

        if (op_status === 'com_op') {
            const opFilter = ` AND EXISTS (SELECT 1 FROM public.sc2010 c2_status WHERE (c2_status.c2_pedido = c5.c5_num) AND c2_status.c2_itempv = c6.c6_item AND COALESCE(c2_status.d_e_l_e_t_, '') = '')`;
            whereClause += opFilter;
            countWhereClause += opFilter;
        } else if (op_status === 'sem_op') {
            const opFilter = ` AND NOT EXISTS (SELECT 1 FROM public.sc2010 c2_status WHERE (c2_status.c2_pedido = c5.c5_num) AND c2_status.c2_itempv = c6.c6_item AND COALESCE(c2_status.d_e_l_e_t_, '') = '')`;
            whereClause += opFilter;
            countWhereClause += opFilter;
        }

        if (dataInicial || dataFinal) {
            if (dateType === 'nf') {
                const nfBase = `EXISTS (
                    SELECT 1 FROM public.sd2010 d2_ex
                    JOIN public.sf2010 f2_ex
                        ON f2_ex.f2_doc = d2_ex.d2_doc
                        AND f2_ex.f2_serie = d2_ex.d2_serie
                        AND COALESCE(f2_ex.d_e_l_e_t_, '') = ''
                    WHERE d2_ex.d2_pedido = c5.c5_num
                      AND d2_ex.d2_itempv = c6.c6_item
                      AND COALESCE(d2_ex.d_e_l_e_t_, '') = ''
                `;
                let nfFilter = nfBase;
                let countNfFilter = nfBase;

                if (dataInicial) {
                    const val = dataInicial.replace(/-/g, '');
                    nfFilter += ` AND f2_ex.f2_emissao >= $${paramCount}`;
                    params.push(val);
                    paramCount++;
                    countNfFilter += ` AND f2_ex.f2_emissao >= $${countParamCount}`;
                    countParams.push(val);
                    countParamCount++;
                }
                if (dataFinal) {
                    const val = dataFinal.replace(/-/g, '');
                    nfFilter += ` AND f2_ex.f2_emissao <= $${paramCount}`;
                    params.push(val);
                    paramCount++;
                    countNfFilter += ` AND f2_ex.f2_emissao <= $${countParamCount}`;
                    countParams.push(val);
                    countParamCount++;
                }

                nfFilter += `)`;
                countNfFilter += `)`;
                whereClause += ` AND ${nfFilter}`;
                countWhereClause += ` AND ${countNfFilter}`;

            } else if (dateType === 'entrega') {
                if (dataInicial) {
                    const val = dataInicial.replace(/-/g, '');
                    whereClause += ` AND c6.c6_entreg >= $${paramCount}`;
                    params.push(val);
                    paramCount++;
                    countWhereClause += ` AND c6.c6_entreg >= $${countParamCount}`;
                    countParams.push(val);
                    countParamCount++;
                }
                if (dataFinal) {
                    const val = dataFinal.replace(/-/g, '');
                    whereClause += ` AND c6.c6_entreg <= $${paramCount}`;
                    params.push(val);
                    paramCount++;
                    countWhereClause += ` AND c6.c6_entreg <= $${countParamCount}`;
                    countParams.push(val);
                    countParamCount++;
                }
            } else if (dateType === 'entrega_pcp') {
                // Do nothing here, it is handled below when fc is joined
            } else {
                if (dataInicial) {
                    const val = dataInicial.replace(/-/g, '');
                    whereClause += ` AND c5.c5_emissao >= $${paramCount}`;
                    params.push(val);
                    paramCount++;
                    countWhereClause += ` AND c5.c5_emissao >= $${countParamCount}`;
                    countParams.push(val);
                    countParamCount++;
                }
                if (dataFinal) {
                    const val = dataFinal.replace(/-/g, '');
                    whereClause += ` AND c5.c5_emissao <= $${paramCount}`;
                    params.push(val);
                    paramCount++;
                    countWhereClause += ` AND c5.c5_emissao <= $${countParamCount}`;
                    countParams.push(val);
                    countParamCount++;
                }
            }
        }

        const needsFcJoin = (sortBy === 'entrega_pcp' || sortBy === 'prev_fat') ||
                            (dateType === 'entrega_pcp' && (dataInicial || dataFinal)) ||
                            !!pcpDataInicial || !!pcpDataFinal;

        let fcJoin = '';
        let countFcJoin = '';

        if (needsFcJoin && forecastMap.size > 0) {
            const fcPedidos = [], fcItems = [], fcDatas = [], fcPrevFats = [];
            for (const [key, val] of forecastMap) {
                const [p, i] = key.split('|');
                fcPedidos.push(p);
                fcItems.push(i);
                fcDatas.push(val.data_entrega_pcp ? new Date(val.data_entrega_pcp) : null);
                fcPrevFats.push(val.data_prevista_faturamento ? new Date(val.data_prevista_faturamento) : null);
            }
            const fcBase = paramCount;
            params.push(fcPedidos, fcItems, fcDatas, fcPrevFats);
            countParams.push(fcPedidos, fcItems, fcDatas, fcPrevFats);
            paramCount += 4;
            countParamCount += 4;

            const fcJoinSql = `
                LEFT JOIN (
                    SELECT * FROM unnest(
                        $${fcBase}::text[], $${fcBase+1}::text[],
                        $${fcBase+2}::timestamp[], $${fcBase+3}::timestamp[]
                    ) AS t(fc_pedido, fc_item, data_entrega_pcp, data_prevista_faturamento)
                ) fc ON fc.fc_pedido = TRIM(c6.c6_num) AND fc.fc_item = TRIM(c6.c6_item)
            `;
            fcJoin = fcJoinSql;
            countFcJoin = fcJoinSql;

            if (dateType === 'entrega_pcp' && (dataInicial || dataFinal)) {
                if (dataInicial) {
                    whereClause += ` AND fc.data_entrega_pcp >= $${paramCount}::timestamp`;
                    countWhereClause += ` AND fc.data_entrega_pcp >= $${countParamCount}::timestamp`;
                    const v = new Date(dataInicial);
                    params.push(v); countParams.push(v); paramCount++; countParamCount++;
                }
                if (dataFinal) {
                    whereClause += ` AND fc.data_entrega_pcp <= $${paramCount}::timestamp`;
                    countWhereClause += ` AND fc.data_entrega_pcp <= $${countParamCount}::timestamp`;
                    const v = new Date(dataFinal + 'T23:59:59');
                    params.push(v); countParams.push(v); paramCount++; countParamCount++;
                }
            }

            if (pcpDataInicial) {
                whereClause += ` AND fc.data_entrega_pcp >= $${paramCount}::timestamp`;
                countWhereClause += ` AND fc.data_entrega_pcp >= $${countParamCount}::timestamp`;
                const v = new Date(pcpDataInicial);
                params.push(v); countParams.push(v); paramCount++; countParamCount++;
            }
            if (pcpDataFinal) {
                whereClause += ` AND fc.data_entrega_pcp <= $${paramCount}::timestamp`;
                countWhereClause += ` AND fc.data_entrega_pcp <= $${countParamCount}::timestamp`;
                const v = new Date(pcpDataFinal + 'T23:59:59');
                params.push(v); countParams.push(v); paramCount++; countParamCount++;
            }

        }

        const sortDir = sortOrder === 'ASC' ? 'ASC' : 'DESC';
        let orderClauseInner = '';
        if (sortBy === 'entrega') {
            orderClauseInner = `ORDER BY NULLIF(TRIM(COALESCE(c6.c6_entreg, '')), '') ${sortDir} NULLS LAST, c5.c5_num DESC, c6.c6_item ASC`;
        } else if (sortBy === 'emissao') {
            orderClauseInner = `ORDER BY c5.c5_emissao ${sortDir}, c5.c5_num DESC, c6.c6_item ASC`;
        } else if (sortBy === 'entrega_pcp') {
            orderClauseInner = fcJoin
                ? `ORDER BY CASE WHEN fc.data_entrega_pcp IS NULL THEN 1 ELSE 0 END ASC, fc.data_entrega_pcp ${sortDir} NULLS LAST, c5.c5_num DESC, c6.c6_item ASC`
                : `ORDER BY c5.c5_num DESC, c6.c6_item ASC`;
        } else if (sortBy === 'prev_fat') {
            orderClauseInner = fcJoin
                ? `ORDER BY CASE WHEN fc.data_prevista_faturamento IS NULL THEN 1 ELSE 0 END ASC, fc.data_prevista_faturamento ${sortDir} NULLS LAST, c5.c5_num DESC, c6.c6_item ASC`
                : `ORDER BY c5.c5_num DESC, c6.c6_item ASC`;
        } else if (sortBy === 'pedido') {
            orderClauseInner = `ORDER BY c5.c5_num ${sortDir}, c6.c6_item ASC`;
        } else {
            orderClauseInner = `ORDER BY c5.c5_num DESC, c6.c6_item ASC`;
        }

        let orderClauseOuter = '';
        if (sortBy === 'entrega') {
            orderClauseOuter = `ORDER BY NULLIF(TRIM(pi.entrega), '') ${sortDir} NULLS LAST, pi.pedido DESC, pi.item ASC, c2.c2_sequen ASC, c2.c2_num ASC`;
        } else if (sortBy === 'emissao') {
            orderClauseOuter = `ORDER BY pi.emissao ${sortDir}, pi.pedido DESC, pi.item ASC, c2.c2_sequen ASC, c2.c2_num ASC`;
        } else if (sortBy === 'entrega_pcp') {
            orderClauseOuter = `ORDER BY CASE WHEN pi.data_entrega_pcp IS NULL THEN 1 ELSE 0 END ASC, pi.data_entrega_pcp ${sortDir} NULLS LAST, pi.pedido DESC, pi.item ASC, c2.c2_sequen ASC, c2.c2_num ASC`;
        } else if (sortBy === 'prev_fat') {
            orderClauseOuter = `ORDER BY CASE WHEN pi.data_prevista_faturamento IS NULL THEN 1 ELSE 0 END ASC, pi.data_prevista_faturamento ${sortDir} NULLS LAST, pi.pedido DESC, pi.item ASC, c2.c2_sequen ASC, c2.c2_num ASC`;
        } else if (sortBy === 'pedido') {
            orderClauseOuter = `ORDER BY pi.pedido ${sortDir}, pi.item ASC, c2.c2_sequen ASC, c2.c2_num ASC`;
        } else {
            orderClauseOuter = `ORDER BY pi.pedido DESC, pi.item ASC, c2.c2_sequen ASC, c2.c2_num ASC`;
        }

        query = `
            WITH paged_base AS (
                SELECT
                    c5.c5_num,
                    c5.c5_cliente,
                    c5.c5_lojacli,
                    c5.c5_mennota,
                    c5.c5_zobs,
                    c5.c5_zobsorc,
                    c5.c5_emissao,
                    c5.c5_orcres,
                    c5.c5_liberok,
                    c6.c6_item,
                    c6.c6_produto,
                    c6.c6_xrevm,
                    c6.c6_xrevc,
                    c6.c6_um,
                    c6.c6_qtdven,
                    c6.c6_qtdent,
                    c6.c6_prcven,
                    c6.c6_valor,
                    c6.c6_entreg,
                    c6.c6_pedcli,
                    ${fcJoin ? 'fc.data_entrega_pcp, fc.data_prevista_faturamento' : 'NULL::timestamp as data_entrega_pcp, NULL::timestamp as data_prevista_faturamento'}
                FROM public.sc5010 c5
                JOIN public.sc6010 c6
                    ON COALESCE(c6.d_e_l_e_t_, '') = ''
                    AND c6.c6_filial = c5.c5_filial
                    AND c6.c6_num = c5.c5_num
                ${fcJoin}
                ${whereClause}
                ${orderClauseInner}
                LIMIT $${paramCount} OFFSET $${paramCount + 1}
            ),
            paged_items AS (
                SELECT
                    TRIM(pb.c5_num) as pedido,
                    TRIM(pb.c5_cliente) as cod_cliente,
                    TRIM(pb.c5_lojacli) as loja_cliente,
                    NULLIF(TRIM(COALESCE(pb.c5_mennota, '') || ' ' || COALESCE(pb.c5_zobs, '') || ' ' || COALESCE(pb.c5_zobsorc, '')), '') AS observacoes_gerais,
                    sa1.a1_nome as nome_cliente,
                    pb.c5_emissao as emissao,
                    pb.c5_orcres as orcamento,
                    TRIM(pb.c6_item) as item,
                    pb.c6_item as item_raw,
                    TRIM(pb.c6_produto) as codigo,
                    pb.c6_produto as codigo_raw,
                    TRIM(pb.c6_xrevm) as rev_codigo,
                    TRIM(pb.c6_xrevc) as c6_rev_cliente,
                    sb1.b1_desc as descricao,
                    TRIM(sb1.b1_msblql) as b1_msblql,
                    pb.c6_um as unidade,
                    COALESCE(pb.c6_qtdven, 0)::numeric(18,6) as quantidade,
                    COALESCE(pb.c6_qtdent, 0)::numeric(18,6) as qtd_entreg,
                    (COALESCE(pb.c6_qtdven, 0) - COALESCE(pb.c6_qtdent, 0))::numeric(18,6) as qtd_faturar,
                    pb.c6_prcven::numeric(18,2) as valor_unitario,
                    pb.c6_valor::numeric(18,2) as valor_total,
                    COALESCE(sb1.b1_prv1, 0)::numeric(18,2) as preco_cadastro,
                    TRIM(COALESCE(pb.c6_entreg, '')) as entrega,
                    pb.c6_pedcli as ped_cliente,
                    (
                        SELECT STRING_AGG(DISTINCT TRIM(z1.z1_codcli), ' / ')
                        FROM public.sz1010 z1
                        WHERE z1.z1_cliente = pb.c5_cliente
                          AND z1.z1_loja = pb.c5_lojacli
                          AND TRIM(z1.z1_produto) = TRIM(pb.c6_produto)
                          AND COALESCE(z1.d_e_l_e_t_, '') = ''
                    ) as ref_cliente,
                    pb.c5_liberok as status_cor,
                    pb.data_entrega_pcp,
                    pb.data_prevista_faturamento
                FROM paged_base pb
                LEFT JOIN public.sa1010 sa1
                    ON sa1.a1_cod = pb.c5_cliente
                    AND sa1.a1_loja = pb.c5_lojacli
                    AND COALESCE(sa1.d_e_l_e_t_, '') = ''
                LEFT JOIN public.sb1010 sb1
                    ON sb1.b1_cod = pb.c6_produto
                    AND COALESCE(sb1.d_e_l_e_t_, '') = ''
            )
            SELECT
                pi.*,
                NULL::varchar AS status_tipo_item,
                NULL::varchar AS status_tipo_detalhe,
                TRIM(c2.c2_num) AS op_num,
                TRIM(c2.c2_num) || TRIM(c2.c2_item) || TRIM(c2.c2_sequen) AS op_num_completa,
                TRIM(c2.c2_tpop) AS op_tipo,
                c2.c2_quant::numeric(18,6) AS op_qtd
            FROM paged_items pi
            LEFT JOIN public.sc2010 c2
                ON TRIM(c2.c2_pedido) = pi.pedido
                AND TRIM(c2.c2_itempv) = pi.item
                AND c2.c2_sequen = '001'
                AND COALESCE(c2.d_e_l_e_t_, '') = ''
            ${orderClauseOuter}
        `;

        params.push(limitParsed + 1, offset);

        const pgClient = await db.connect();
        let result;
        try {
            await pgClient.query("SET statement_timeout = '120000'; SET work_mem = '64MB';");
            result = await pgClient.query(query, params);
        } finally {
            pgClient?.release();
        }

        // Dado sensível não sai do servidor sem a permissão "valores_financeiros" —
        // esconder só na tela não é suficiente (fica visível na aba de rede do navegador).
        const stripFinancials = (row) => {
            if (canViewFinancials) return row;
            const { valor_unitario, valor_total, preco_cadastro, ...rest } = row;
            if (Array.isArray(row.notas_fiscais)) {
                rest.notas_fiscais = row.notas_fiscais.map(({ valor_unit, valor_total, ...nfRest }) => nfRest);
            }
            return rest;
        };

        if (req.query.minimal === 'true') {
            const hasNextPage = result.rows.length > limitParsed;
            const pageData = result.rows.slice(0, limitParsed);
            return res.json({
                data: pageData.map(decodeMemosInRow).map(stripFinancials),
                meta: {
                    hasNextPage,
                    page: pageParsed,
                    limit: limitParsed
                }
            });
        }

        for (const row of result.rows) {
            const baseKey = `${String(row.pedido).trim()}|${String(row.item).trim()}`;
            const opPrefix = row.op_num ? String(row.op_num).trim().substring(0, 6) : '';
            const opKey = opPrefix ? `${baseKey}|${opPrefix}` : '';
            
            const fc = (opKey && forecastMap.get(opKey)) || forecastMap.get(baseKey);
            if (fc) {
                if (!fcJoin) {
                    row.data_entrega_pcp = fc.data_entrega_pcp;
                    row.data_prevista_faturamento = fc.data_prevista_faturamento;
                }
                row.pcp_delivery_forecast_date = fc.data_entrega_pcp;
                row.pcp_delivery_forecast_qtd = fc.quantidade_pcp;
            }
        }

        if (result.rows.length > 0) {
            // --- INÍCIO BUSCA DE NOTAS FISCAIS ---
            const uniquePedidos = [...new Set(result.rows.map(r => String(r.pedido).trim()))].filter(Boolean);
            if (uniquePedidos.length > 0) {
                const { rows: d2Rows } = await db.query(`
                    SELECT
                        TRIM(d2.d2_pedido) as pedido,
                        TRIM(d2.d2_itempv) as item,
                        TRIM(d2.d2_doc)    as nota,
                        TRIM(d2.d2_serie)  as serie,
                        TRIM(d2.d2_cf)     as cfop,
                        d2.d2_quant::numeric(18,2)  as qtd,
                        d2.d2_prunit::numeric(18,2) as valor_unit,
                        d2.d2_total::numeric(18,2)  as valor_total
                    FROM public.sd2010 d2
                    WHERE d2.d2_pedido = ANY($1::varchar[])
                      AND COALESCE(d2.d_e_l_e_t_, '') = ''
                      AND TRIM(d2.d2_doc) != ''
                `, [uniquePedidos]);

                if (d2Rows.length > 0) {
                    const uniqueNotas = [...new Set(d2Rows.map(r => r.nota).filter(Boolean))];
                    const emissaoMap = {};
                    const serieMap = {};
                    const clienteMap = {};
                    if (uniqueNotas.length > 0) {
                        try {
                            const { rows: f2Rows } = await db.query(`
                                SELECT 
                                    TRIM(f2.f2_doc) as nota, 
                                    TRIM(f2.f2_emissao) as emissao_raw, 
                                    TRIM(f2.f2_serie) as serie,
                                    TRIM(a1.a1_nome) as nome_cliente
                                FROM public.sf2010 f2
                                LEFT JOIN public.sa1010 a1 
                                    ON a1.a1_cod = f2.f2_cliente 
                                    AND a1.a1_loja = f2.f2_loja 
                                    AND COALESCE(a1.d_e_l_e_t_, '') = ''
                                WHERE TRIM(f2.f2_doc) = ANY($1::varchar[])
                                  AND COALESCE(f2.d_e_l_e_t_, '') = ''
                            `, [uniqueNotas]);
                            f2Rows.forEach(r => {
                                if (!emissaoMap[r.nota]) emissaoMap[r.nota] = r.emissao_raw;
                                if (!serieMap[r.nota]) serieMap[r.nota] = r.serie;
                                if (!clienteMap[r.nota]) clienteMap[r.nota] = r.nome_cliente;
                            });
                        } catch (e) {
                            console.warn('[FAT NF] Erro sf2010:', e.message);
                        }
                    }

                    const fmtEmissao = (raw) => {
                        if (!raw) return null;
                        const s = raw.trim();
                        if (s.length !== 8 || s === '00000000' || !/^\d{8}$/.test(s)) return null;
                        return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
                    };
                    const normItem = (s) => { const n = parseInt(String(s).trim(), 10); return isNaN(n) ? String(s).trim() : String(n); };

                    const nfMap = {};
                    d2Rows.forEach(nf => {
                        const pedido   = nf.pedido;
                        const itemOrig = nf.item;
                        const itemNorm = normItem(itemOrig);
                        const emissao  = fmtEmissao(emissaoMap[nf.nota]);

                        [pedido + '-' + itemOrig, pedido + '-' + itemNorm].forEach(key => {
                            if (!nfMap[key]) nfMap[key] = [];
                            if (nf.nota && !nfMap[key].some(n => n.nota === nf.nota)) {
                                nfMap[key].push({
                                    nota:        nf.nota,
                                    serie:       serieMap[nf.nota] || nf.serie || '',
                                    emissao,
                                    cfop:        nf.cfop || '',
                                    qtd:         parseFloat(nf.qtd) || 0,
                                    valor_unit:  parseFloat(nf.valor_unit) || 0,
                                    valor_total: parseFloat(nf.valor_total) || 0,
                                    nome_cliente: clienteMap[nf.nota] || ''
                                });
                            }
                        });
                    });

                    result.rows.forEach(row => {
                        const pedTrim = String(row.pedido).trim();
                        const itemTrim = String(row.item).trim();
                        const itemNormStr = normItem(itemTrim);
                        const nfs = nfMap[pedTrim + '-' + itemTrim] || nfMap[pedTrim + '-' + itemNormStr] || [];
                        row.notas_fiscais = nfs.length > 0 ? nfs : [];
                    });
                } else {
                    result.rows.forEach(row => { row.notas_fiscais = []; });
                }
            } else {
                result.rows.forEach(row => { row.notas_fiscais = []; });
            }
            // --- FIM BUSCA DE NOTAS FISCAIS ---

            // --- INÍCIO BUSCA DE PRIORIDADES DE OP ---
            try {
                const opNumerosUnicos = [...new Set(result.rows.map(r => r.op_num_completa).filter(Boolean))];
                const opPrefixosUnicos = [...new Set(opNumerosUnicos.map(op => op.substring(0, 8)))];
                
                const opsToCheck = [...new Set([...opNumerosUnicos, ...opPrefixosUnicos])];

                if (opsToCheck.length > 0) {
                    const placeholders = opsToCheck.map(() => '?').join(',');
                    const [opPrioritiesRows] = await mysqlPool.execute(
                        `SELECT op_numero, prioridade FROM app_op_priorities WHERE op_numero IN (${placeholders})`,
                        opsToCheck
                    );
                    const priorityMap = {};
                    opPrioritiesRows.forEach(r => { priorityMap[r.op_numero] = r.prioridade; });
                    result.rows.forEach(r => {
                        const op = r.op_num_completa;
                        if (!op) {
                            r.op_prioridade = 0;
                            return;
                        }
                        const prefix = op.substring(0, 8);
                        // A OP exata ou o prefixo de 8 digitos pode ter prioridade
                        r.op_prioridade = priorityMap[op] || priorityMap[prefix] || 0;
                    });
                } else {
                    result.rows.forEach(r => { r.op_prioridade = 0; });
                }
            } catch (err) {
                console.error('[OP PRIORITY FETCH ERROR]', err);
                result.rows.forEach(r => { r.op_prioridade = 0; });
            }
            // --- FIM BUSCA DE PRIORIDADES DE OP ---

            // --- INÍCIO BUSCA DE TIPO DE STATUS (PCP/RESTRIÇÃO/REVISÃO/NOVO) ---
            try {
                const productCodes = [...new Set(result.rows.map(r => (r.codigo || '').trim()).filter(Boolean))];
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

                result.rows.forEach(row => {
                    const cod = String(row.codigo || '').trim();
                    const isBlocked     = ['1', 'S', 'T', 'Y'].includes(row.b1_msblql?.trim());
                    const hasRestriction = sz0Set.has(cod);
                    const revDiff       = (row.rev_codigo || '') !== (row.c6_rev_cliente || '');
                    const isNew         = !sg1Set.has(cod) && !sg2Set.has(cod);
                    const hasGlobalRelease = globalReleaseSet.has(cod.toUpperCase());

                    if (hasGlobalRelease) {
                        row.status_tipo_item   = 'PCP';
                        row.status_tipo_detalhe = 'Produto liberado manualmente pela Engenharia.';
                    } else if (isBlocked || hasRestriction) {
                        row.status_tipo_item   = 'Restrição';
                        row.status_tipo_detalhe = 'Produto possui bloqueio no Protheus ou Restrição ativa.';
                    } else if (revDiff) {
                        row.status_tipo_item   = 'Revisão';
                        row.status_tipo_detalhe = 'Revisão do Pedido difere da Revisão da Engenharia.';
                    } else if (isNew) {
                        row.status_tipo_item   = 'Novo';
                        row.status_tipo_detalhe = 'Produto sem Engenharia cadastrada (SG1/SG2).';
                    } else {
                        row.status_tipo_item   = 'PCP';
                        row.status_tipo_detalhe = 'Liberado para PCP.';
                    }
                });
            } catch (err) {
                console.error('[STATUS/RELEASES FETCH ERROR in flat]', err);
            }
            // --- FIM BUSCA DE TIPO DE STATUS ---

            // --- INÍCIO BUSCA DE CLASSIFICAÇÃO (JITS/PPAP) ---
            try {
                if (uniquePedidos.length > 0) {
                    const placeholders = uniquePedidos.map(() => '?').join(',');
                    const [classifRows] = await mysqlPool.query(
                        `SELECT TRIM(pedido) as pedido, TRIM(item) as item, classificacao, ppap_numero FROM app_pedido_itens_classificacao WHERE TRIM(pedido) IN (${placeholders})`,
                        uniquePedidos
                    );
                    const classifMap = {};
                    classifRows.forEach(r => { classifMap[`${r.pedido}|${r.item}`] = r; });
                    result.rows.forEach(r => {
                        const key = `${String(r.pedido).trim()}|${String(r.item).trim()}`;
                        const c = classifMap[key];
                        r.classificacao = c ? c.classificacao : 'Nenhum';
                        r.ppap_numero = c ? c.ppap_numero : null;
                    });
                } else {
                    result.rows.forEach(r => { r.classificacao = 'Nenhum'; r.ppap_numero = null; });
                }
            } catch (err) {
                console.error('[CLASSIFICACAO FETCH ERROR]', err);
                result.rows.forEach(r => { r.classificacao = 'Nenhum'; r.ppap_numero = null; });
            }
            // --- FIM BUSCA DE CLASSIFICAÇÃO ---

            const finalRows = result.rows.map(decodeMemosInRow);

            // Prioriza ordenação das OPs com prioridade
            finalRows.sort((a, b) => (b.op_prioridade || 0) - (a.op_prioridade || 0));

            const hasNextPage = finalRows.length > limitParsed;
            const pageData = finalRows.slice(0, limitParsed).map(stripFinancials);
            res.json({
                data: pageData,
                meta: {
                    hasNextPage,
                    page: pageParsed,
                    limit: limitParsed
                }
            });
        } else {
            res.json({ data: [], meta: { hasNextPage: false, page: pageParsed, limit: limitParsed } });
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar lista plana.', details: err.message });
    }
});

// GET /api/pedidos/kpi-faturar - Indicadores de Itens a Faturar
router.get('/kpi-faturar', async (req, res) => {
    try {
        const getInactiveFilter = await getInactiveOrdersFilter();
        const inactiveFilterSql = getInactiveFilter('c5.c5_num');

        // 1. Busca os itens ativos primeiro
        const queryActive = `
            SELECT
                TRIM(c5.c5_num) as pedido,
                TRIM(c6.c6_item) as item,
                TRIM(c6.c6_produto) as codigo,
                TRIM(c6.c6_xrevm) as revm,
                TRIM(c6.c6_xrevc) as revc
            FROM public.sc5010 c5
            JOIN public.sc6010 c6
                ON c6.c6_filial = c5.c5_filial
                AND c6.c6_num   = c5.c5_num
                AND COALESCE(c6.d_e_l_e_t_, '') = ''
            WHERE COALESCE(c5.d_e_l_e_t_, '') = ''
              AND c5.c5_tipo <> 'B'
              AND ((c6.c6_qtdven - c6.c6_qtdent) > 0 OR c6.c6_qtdlib > 0)
              ${inactiveFilterSql}
        `;
        const activeRes = await db.query(queryActive);
        
        if (activeRes.rows.length === 0) {
            return res.json({ data: [] });
        }

        const productCodes = [...new Set(activeRes.rows.map(r => r.codigo).filter(Boolean))];
        const pedidosList = [...new Set(activeRes.rows.map(r => r.pedido).filter(Boolean))];

        // 2. Busca flags de restrição e PCP em batch
        const [sb1Res, sz0Res, sg1Res, sg2Res, sc2Res] = await Promise.all([
            db.query(`SELECT TRIM(b1_cod) as cod, TRIM(b1_msblql) as msblql FROM public.sb1010 WHERE b1_cod = ANY($1) AND COALESCE(d_e_l_e_t_, '') = ''`, [productCodes]),
            db.query(`SELECT DISTINCT TRIM(z0_produto) as cod FROM public.sz0010 WHERE TRIM(z0_produto) = ANY($1) AND COALESCE(d_e_l_e_t_, '') <> '*' AND z0_status = 'P'`, [productCodes]),
            db.query(`SELECT DISTINCT TRIM(g1_cod) as cod FROM public.sg1010 WHERE TRIM(g1_cod) = ANY($1) AND COALESCE(d_e_l_e_t_, '') <> '*'`, [productCodes]),
            db.query(`SELECT DISTINCT TRIM(g2_produto) as cod FROM public.sg2010 WHERE TRIM(g2_produto) = ANY($1) AND COALESCE(d_e_l_e_t_, '') <> '*'`, [productCodes]),
            db.query(`SELECT DISTINCT TRIM(c2_pedido) as pedido, TRIM(c2_itempv) as item FROM public.sc2010 WHERE TRIM(c2_pedido) = ANY($1) AND COALESCE(c2.d_e_l_e_t_, '') = ''`, [pedidosList])
        ]);

        const sb1Map = {}; sb1Res.rows.forEach(r => sb1Map[r.cod] = r.msblql);
        const sz0Set = new Set(sz0Res.rows.map(r => r.cod));
        const sg1Set = new Set(sg1Res.rows.map(r => r.cod));
        const sg2Set = new Set(sg2Res.rows.map(r => r.cod));
        const sc2Set = new Set(sc2Res.rows.map(r => `${r.pedido}-${r.item}`));

        const counts = {
            'Restrição': 0,
            'Revisão': 0,
            'Novo': 0,
            'PCP (Com OP)': 0,
            'PCP (Sem OP) - Urgente Liberação': 0
        };

        // 3. Processamento em memória
        for (const row of activeRes.rows) {
            const b1 = sb1Map[row.codigo] || '';
            const inSz0 = sz0Set.has(row.codigo);
            const inSg1 = sg1Set.has(row.codigo);
            const inSg2 = sg2Set.has(row.codigo);
            const inSc2 = sc2Set.has(`${row.pedido}-${row.item}`);
            const revm = row.revm || '';
            const revc = row.revc || '';

            if (['1', 'S', 'T', 'Y'].includes(b1) || inSz0) {
                counts['Restrição']++;
            } else if (revm !== revc) {
                counts['Revisão']++;
            } else if (!inSg1 && !inSg2) {
                counts['Novo']++;
            } else if (inSc2) {
                counts['PCP (Com OP)']++;
            } else {
                counts['PCP (Sem OP) - Urgente Liberação']++;
            }
        }

        const dataOut = Object.keys(counts).map(key => ({
            status_tipo_item: key,
            total: counts[key]
        }));

        res.json({ data: dataOut.map(decodeMemosInRow) });
    } catch (err) {
        console.error('Erro na rota kpi-faturar:', err);
        res.status(500).json({ error: 'Erro interno.', details: err.message });
    }
});

// GET /api/pedidos/visao-gerencial-atrasos - Dashboard Diretor (Só Atrasados)
router.get('/visao-gerencial-atrasos', async (req, res) => {
    return getVisaoGerencial(req, res, true);
});

// GET /api/pedidos/visao-gerencial-fabrica - Dashboard Diretor (Toda a Fábrica - Atrasados + Futuros)
router.get('/visao-gerencial-fabrica', async (req, res) => {
    return getVisaoGerencial(req, res, false);
});

// POST /api/pedidos/snapshot-fabrica - Salvar snapshot diário
router.post('/snapshot-fabrica', async (req, res) => {
    try {
        const { snapshot_date, total_pedidos, total_produtos, total_atraso_qtd, total_futuro_qtd, total_atraso_brl, total_futuro_brl } = req.body;
        
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_pcp_snapshots (
                id INT AUTO_INCREMENT PRIMARY KEY,
                snapshot_date DATE NOT NULL,
                total_pedidos INT DEFAULT 0,
                total_produtos INT DEFAULT 0,
                total_atraso_qtd DECIMAL(15,2) DEFAULT 0,
                total_futuro_qtd DECIMAL(15,2) DEFAULT 0,
                total_atraso_brl DECIMAL(15,2) DEFAULT 0,
                total_futuro_brl DECIMAL(15,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uk_snap_date (snapshot_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        const query = `
            INSERT INTO app_pcp_snapshots (
                snapshot_date, total_pedidos, total_produtos, 
                total_atraso_qtd, total_futuro_qtd, 
                total_atraso_brl, total_futuro_brl
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                total_pedidos = VALUES(total_pedidos),
                total_produtos = VALUES(total_produtos),
                total_atraso_qtd = VALUES(total_atraso_qtd),
                total_futuro_qtd = VALUES(total_futuro_qtd),
                total_atraso_brl = VALUES(total_atraso_brl),
                total_futuro_brl = VALUES(total_futuro_brl)
        `;
        
        await mysqlPool.query(query, [
            snapshot_date, total_pedidos, total_produtos, 
            total_atraso_qtd, total_futuro_qtd, 
            total_atraso_brl, total_futuro_brl
        ]);

        res.json({ message: 'Snapshot salvo com sucesso!' });
    } catch (err) {
        console.error('Erro ao salvar snapshot da fábrica:', err);
        res.status(500).json({ error: 'Erro interno ao salvar snapshot.', details: err.message });
    }
});

// GET /api/pedidos/:id/item-status
router.get('/:id/item-status', checkOrderAccess, async (req, res) => {
    try {
        const pedido = String(req.params.id || '').trim();
        if (!pedido) {
            return res.status(400).json({ error: 'Parâmetro pedido inválido ou ausente.' });
        }

        const itemsResult = await db.query(`
            SELECT
                TRIM(c6.c6_item)    AS item,
                TRIM(c6.c6_produto) AS codigo,
                TRIM(c6.c6_xrevm)   AS rev_codigo,
                TRIM(c6.c6_xrevc)   AS c6_rev_cliente,
                COALESCE(sb1.b1_msblql, '') AS b1_msblql
            FROM public.sc5010 c5
            JOIN public.sc6010 c6
                ON COALESCE(c6.d_e_l_e_t_, '') = ''
                AND c6.c6_filial = c5.c5_filial
                AND c6.c6_num = c5.c5_num
            LEFT JOIN public.sb1010 sb1
                ON COALESCE(sb1.d_e_l_e_t_, '') = ''
                AND TRIM(sb1.b1_cod) = TRIM(c6.c6_produto)
            WHERE c5.c5_num = $1
              AND COALESCE(c5.d_e_l_e_t_, '') = ''
              AND c5.c5_tipo <> 'B'
            ORDER BY c6.c6_item ASC
        `, [pedido]);

        const items = itemsResult.rows;
        if (items.length === 0) {
            return res.json({ pedido, items: [] });
        }

        const productCodes = [...new Set(items.map(i => i.codigo).filter(Boolean))];

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

        const [releasesRows] = await mysqlPool.query(`SELECT DISTINCT UPPER(TRIM(codigo_produto)) AS cod FROM app_engineering_releases`);
        const globalReleaseSet = new Set(releasesRows.map(r => r.cod));

        const sg1Set = new Set();
        const sg2Set = new Set();
        const sz0Set = new Set();
        pgStatusResult.rows.forEach(r => {
            if (r.type === 'sg1') sg1Set.add(r.cod);
            if (r.type === 'sg2') sg2Set.add(r.cod);
            if (r.type === 'sz0') sz0Set.add(r.cod);
        });

        const classified = items.map(item => {
            const cod = String(item.codigo || '').trim();
            const isBlocked     = ['1', 'S', 'T', 'Y'].includes(item.b1_msblql);
            const hasRestriction = sz0Set.has(cod);
            const revDiff       = (item.rev_codigo || '') !== (item.c6_rev_cliente || '');
            const isNew         = !sg1Set.has(cod) && !sg2Set.has(cod);
            const hasGlobalRelease = globalReleaseSet.has(cod.toUpperCase());

            let status_tipo_item, status_tipo_detalhe;

            if (hasGlobalRelease) {
                status_tipo_item   = 'PCP';
                status_tipo_detalhe = 'Produto liberado manualmente pela Engenharia.';
            } else if (isBlocked || hasRestriction) {
                status_tipo_item   = 'Restrição';
                const reason = isBlocked
                    ? 'Produto bloqueado no cadastro SB1 (b1_msblql).'
                    : 'Restrição pendente no cadastro SZ0 (status=P).';
                status_tipo_detalhe = `${reason} Rev. MF: ${item.rev_codigo || '-'} / Rev. Cli: ${item.c6_rev_cliente || '-'}`;
            } else if (revDiff) {
                status_tipo_item   = 'Revisão';
                status_tipo_detalhe = `Diferença de revisão. Rev. MF: ${item.rev_codigo || '-'} / Rev. Cli: ${item.c6_rev_cliente || '-'}`;
            } else if (isNew) {
                status_tipo_item   = 'Novo';
                status_tipo_detalhe = 'Produto novo — sem estrutura (BOM) cadastrada no Protheus.';
            } else {
                status_tipo_item   = 'Engenharia';
                status_tipo_detalhe = 'Aguardando liberação manual da Engenharia.';
            }

            return {
                item: item.item,
                codigo: item.codigo,
                rev_codigo: item.rev_codigo,
                c6_rev_cliente: item.c6_rev_cliente,
                b1_msblql: item.b1_msblql,
                has_sg1: sg1Set.has(item.codigo),
                has_sg2: sg2Set.has(item.codigo),
                has_sz0: sz0Set.has(item.codigo),
                status_tipo_item,
                status_tipo_detalhe,
            };
        });

        return res.json({ pedido, items: classified });
    } catch (err) {
        console.error(`[item-status] ❌ Erro:`, err.message);
        return res.status(500).json({ error: 'Erro ao calcular status dos itens.', details: err.message });
    }
});

// GET /api/pedidos/:id/pdf-data
router.get('/:id/pdf-data', checkOrderAccess, async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        if (!id) return res.status(400).json({ error: 'Parâmetro pedido inválido.' });

        // ── STEP 1: Core order + items ─────────────────────────────────────────
        // Avoids LEFT JOIN sb1010 ON TRIM()=TRIM() which causes a 31M-row cross-scan (~6s timeout).
        // SB1 is fetched separately by code list (ANY) in the batch below (~111ms).
        const pgResult = await db.query(`
            SELECT
                TRIM(c5.c5_num)                                         AS pedido,
                TRIM(c5.c5_cliente)                                      AS cod_cliente,
                TRIM(c5.c5_lojacli)                                      AS loja_cliente,
                TRIM(sa1.a1_nome)                                        AS nome_cliente,
                c5.c5_emissao                                            AS emissao,
                TRIM(c6.c6_item)                                         AS item,
                TRIM(c6.c6_produto)                                      AS codigo,
                TRIM(c6.c6_xrevm)                                        AS rev_codigo,
                TRIM(c6.c6_xrevc)                                        AS c6_rev_cliente,
                c6.c6_um                                                 AS unidade,
                COALESCE(c6.c6_qtdven, 0)::numeric(18,2)                AS qtd,
                COALESCE(c6.c6_qtdent, 0)::numeric(18,2)                AS qtd_entreg,
                (COALESCE(c6.c6_qtdven,0) - COALESCE(c6.c6_qtdent,0))::numeric(18,2) AS qtd_faturar,
                TRIM(COALESCE(c6.c6_entreg, ''))                        AS entrega,
                TRIM(COALESCE(c6.c6_entreg, ''))                        AS c6_entreg,
                TRIM(c6.c6_pedcli)                                       AS ped_cliente,
                TRIM(c2.c2_num)                                          AS op_num,
                TRIM(c2.c2_tpop)                                         AS op_tipo,
                c2.c2_quant::numeric(18,2)                               AS op_qtd,
                COALESCE(c5.c5_mennota, '')                              AS c5_mennota,
                c5.c5_zobs                                               AS c5_zobs,
                c5.c5_zobsorc                                            AS c5_zobsorc
            FROM public.sc5010 c5
            JOIN public.sc6010 c6
                ON COALESCE(c6.d_e_l_e_t_, '') = ''
                AND c6.c6_filial = c5.c5_filial
                AND c6.c6_num = c5.c5_num
            LEFT JOIN public.sa1010 sa1
                ON sa1.a1_cod = c5.c5_cliente
                AND sa1.a1_loja = c5.c5_lojacli
                AND COALESCE(sa1.d_e_l_e_t_, '') = ''
            LEFT JOIN public.sc2010 c2
                ON TRIM(c2.c2_pedido) = TRIM(c5.c5_num)
                AND c2.c2_itempv = c6.c6_item
                AND c2.c2_sequen = '001'
                AND COALESCE(c2.d_e_l_e_t_, '') = ''
            WHERE c5.c5_num = $1
              AND COALESCE(c5.d_e_l_e_t_, '') = ''
              AND c5.c5_tipo <> 'B'
            ORDER BY c6.c6_item ASC
        `, [id]);

        if (pgResult.rows.length === 0) {
            return res.status(404).json({ error: 'Pedido não encontrado.' });
        }

        // ── Derived lists needed for the batch ─────────────────────────────────
        const productCodes = [...new Set(pgResult.rows.map(r => (r.codigo || '').trim()).filter(Boolean))];
        const codCliente   = pgResult.rows[0]?.cod_cliente  || '';
        const lojaCliente  = pgResult.rows[0]?.loja_cliente || '';
        const paddedCodes  = productCodes.map(c => c.padEnd(15, ' '));
        const idSemZeros   = id.replace(/^0+/, '');

        // ── STEP 2: Batch all independent lookups in parallel ──────────────────
        const [
            sb1Result,
            notesResult,
            sz1Result,
            pgStatusResult,
            releasesResult,
        ] = await Promise.allSettled([
            // 2a. SB1 product descriptions (PG, by code list — fast ANY lookup)
            productCodes.length > 0
                ? db.query(`
                    SELECT TRIM(b1_cod) AS cod, b1_desc AS descricao, b1_msblql
                    FROM public.sb1010
                    WHERE TRIM(b1_cod) = ANY($1::varchar[])
                      AND COALESCE(d_e_l_e_t_, '') = ''
                  `, [productCodes])
                : Promise.resolve({ rows: [] }),
            // 2b. PCP / Designer notes (MySQL)
            mysqlPool.execute(
                `SELECT TRIM(pedido) AS pedido, TRIM(item) AS item_number,
                         pcp_notes, designer_notes
                  FROM app_sales_order_item_notes
                  WHERE TRIM(pedido) = ?`,
                [idSemZeros]
            ),
            // 2c. Ref / Rev cliente — SZ1 (PG)
            codCliente && productCodes.length > 0
                ? db.query(`
                    SELECT TRIM(z1.z1_produto) AS produto,
                           STRING_AGG(DISTINCT TRIM(z1.z1_codcli), ' / ')  AS ref_cliente,
                           STRING_AGG(DISTINCT TRIM(z1.z1_revisao), ' / ') AS rev_cliente
                    FROM public.sz1010 z1
                    WHERE z1.z1_cliente = $1
                      AND z1.z1_loja = $2
                      AND TRIM(z1.z1_produto) = ANY($3::varchar[])
                      AND COALESCE(z1.d_e_l_e_t_, '') = ''
                    GROUP BY TRIM(z1.z1_produto)
                  `, [codCliente, lojaCliente, productCodes])
                : Promise.resolve({ rows: [] }),
            // 2d. SG1 / SG2 / SZ0 status (PG — single UNION query)
            productCodes.length > 0
                ? db.query(`
                    SELECT 'sg1' AS type, TRIM(g1_cod) AS cod
                    FROM public.sg1010
                    WHERE g1_cod = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') <> '*'
                    UNION ALL
                    SELECT 'sg2', TRIM(g2_produto)
                    FROM public.sg2010
                    WHERE g2_produto = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') <> '*'
                    UNION ALL
                    SELECT 'sz0', TRIM(z0_produto)
                    FROM public.sz0010
                    WHERE z0_produto = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') <> '*' AND z0_status = 'P'
                  `, [paddedCodes])
                : Promise.resolve({ rows: [] }),
            // 2e. Engineering releases (MySQL)
            mysqlPool.query(`SELECT DISTINCT UPPER(TRIM(codigo_produto)) AS cod FROM app_engineering_releases`),
        ]);

        // ── Unpack batch results (allSettled — one failure never breaks the rest) ─
        const sb1Map = {};
        if (sb1Result.status === 'fulfilled') {
            sb1Result.value.rows.forEach(r => { sb1Map[r.cod] = r; });
        } else {
            console.warn(`[pdf-data/${id}] SB1 unavailable:`, sb1Result.reason?.message);
        }

        const notes = notesResult.status === 'fulfilled' ? (notesResult.value[0] || []) : [];
        if (notesResult.status === 'rejected') console.warn(`[pdf-data/${id}] MySQL notes unavailable:`, notesResult.reason?.message);

        const sz1Map = {};
        if (sz1Result.status === 'fulfilled') {
            sz1Result.value.rows.forEach(r => { sz1Map[r.produto] = r; });
        } else {
            console.warn(`[pdf-data/${id}] SZ1 unavailable:`, sz1Result.reason?.message);
        }

        const sg1Set = new Set(), sg2Set = new Set(), sz0Set = new Set();
        if (pgStatusResult.status === 'fulfilled') {
            pgStatusResult.value.rows.forEach(r => {
                if (r.type === 'sg1') sg1Set.add(r.cod);
                if (r.type === 'sg2') sg2Set.add(r.cod);
                if (r.type === 'sz0') sz0Set.add(r.cod);
            });
        } else {
            console.warn(`[pdf-data/${id}] SG1/SG2/SZ0 unavailable:`, pgStatusResult.reason?.message);
        }

        const globalReleaseSet = new Set();
        if (releasesResult.status === 'fulfilled') {
            releasesResult.value[0].forEach(r => globalReleaseSet.add(r.cod));
        } else {
            console.warn(`[pdf-data/${id}] Releases unavailable:`, releasesResult.reason?.message);
        }

        // ── STEP 3: Merge + decode and build response ──────────────────────────
        const notesMap = {};
        notes.forEach(n => { notesMap[n.item_number] = n; });

        const itens = pgResult.rows.map(row => {
            // Decode bytea memo fields (Protheus stores observations as raw binary)
            const decodeMemo = v =>
                Buffer.isBuffer(v) ? v.toString('latin1').replace(/[\0\r]/g, '') :
                typeof v === 'string' ? v.replace(/[\0\r]/g, '') : '';

            const obsParts = [];
            if (row.c5_mennota && row.c5_mennota.trim()) obsParts.push(`Nota: ${row.c5_mennota.trim()}`);
            const zobs = decodeMemo(row.c5_zobs).trim();
            if (zobs) obsParts.push(`Obs. Adic Nf:\n${zobs}`);
            const zobsorc = decodeMemo(row.c5_zobsorc).trim();
            if (zobsorc) obsParts.push(`Obs Orçament:\n${zobsorc}`);
            const obsRaw = obsParts.join('\n\n').trim();

            // Merge SB1
            const sb1 = sb1Map[(row.codigo || '').trim()] || {};

            // Status classification
            const cod = String(row.codigo || '').trim();
            const isBlocked       = ['1', 'S', 'T', 'Y'].includes(sb1.b1_msblql);
            const hasRestriction  = sz0Set.has(cod);
            const revDiff         = (row.rev_codigo || '') !== (row.c6_rev_cliente || '');
            const isNew           = !sg1Set.has(cod) && !sg2Set.has(cod);
            const hasGlobalRelease = globalReleaseSet.has(cod.toUpperCase());

            let status_tipo_item;
            if      (hasGlobalRelease)          status_tipo_item = 'PCP';
            else if (isBlocked || hasRestriction) status_tipo_item = 'Restrição';
            else if (revDiff)                   status_tipo_item = 'Revisão';
            else if (isNew)                     status_tipo_item = 'Novo';
            else                                status_tipo_item = 'PCP';

            return {
                pedido:           row.pedido,
                cod_cliente:      row.cod_cliente,
                loja_cliente:     row.loja_cliente,
                nome_cliente:     row.nome_cliente,
                emissao:          row.emissao,
                item:             row.item,
                codigo:           row.codigo,
                rev_codigo:       row.rev_codigo,
                c6_rev_cliente:   row.c6_rev_cliente,
                descricao:        sb1.descricao || '',
                b1_msblql:        sb1.b1_msblql || '',
                unidade:          row.unidade,
                qtd:              row.qtd,
                qtd_entreg:       row.qtd_entreg,
                qtd_faturar:      row.qtd_faturar,
                entrega:          row.entrega,
                c6_entreg:        row.c6_entreg,
                ped_cliente:      row.ped_cliente,
                op_num:           row.op_num,
                op_tipo:          row.op_tipo,
                op_qtd:           row.op_qtd,
                observacoes_gerais: obsRaw || null,
                pcp_notes:        notesMap[String(Number(row.item) || row.item)]?.pcp_notes || '',
                ref_cliente:      sz1Map[row.codigo]?.ref_cliente || null,
                rev_cliente:      sz1Map[row.codigo]?.rev_cliente || null,
                status_tipo_item,
            };
        });

        const first = pgResult.rows[0];
        const decodeMemo = v =>
            Buffer.isBuffer(v) ? v.toString('latin1').replace(/[\0\r]/g, '') :
            typeof v === 'string' ? v.replace(/[\0\r]/g, '') : '';
        const obsParts = [];
        if (first.c5_mennota && first.c5_mennota.trim()) obsParts.push(`Nota: ${first.c5_mennota.trim()}`);
        const zobs = decodeMemo(first.c5_zobs).trim();
        if (zobs) obsParts.push(`Obs. Adic Nf:\n${zobs}`);
        const zobsorc = decodeMemo(first.c5_zobsorc).trim();
        if (zobsorc) obsParts.push(`Obs Orçament:\n${zobsorc}`);
        const obsCapaRaw = obsParts.join('\n\n').trim();

        const capa = {
            pedido:             first.pedido,
            cod_cliente:        first.cod_cliente,
            nome_cliente:       first.nome_cliente || '',
            emissao:            first.emissao || '',
            pedido_cliente:     first.ped_cliente || '',
            entrega:            first.entrega || '',
            observacoes_gerais: obsCapaRaw || '',
        };

        return res.json({ capa, itens });

    } catch (err) {
        console.error(`[pdf-data] ❌`, err.message);
        return res.status(500).json({ error: 'Erro ao gerar dados do PDF.', details: err.message });
    }
});

// GET /api/pedidos/:id/itens
router.get('/:id/itens', checkOrderAccess, async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        if (!id) return res.status(400).json({ error: 'Parâmetro pedido inválido ou ausente.' });

        const query = `
            SELECT
                TRIM(c5.c5_num)     AS pedido,
                TRIM(c5.c5_cliente) AS cod_cliente,
                TRIM(c5.c5_lojacli) AS loja_cliente,
                TRIM(c6.c6_item)    AS item,
                TRIM(c6.c6_produto) AS codigo,
                TRIM(c6.c6_xrevm) AS rev_codigo,
                TRIM(c6.c6_xrevc) AS c6_rev_cliente,
                sb1.b1_desc   AS descricao,
                c6.c6_um      AS unidade,
                COALESCE(c6.c6_qtdven, 0)::numeric(18,6)  AS quantidade,
                TRIM(c6.c6_entreg) AS entrega_raw,
                TRIM(c6.c6_pedcli) AS ped_cliente,
                TRIM(c2.c2_num) AS op_num,
                TRIM(c2.c2_num) || TRIM(c2.c2_item) || TRIM(c2.c2_sequen) AS op_num_completa,
                TRIM(c2.c2_tpop) AS op_tipo,
                c2.c2_quant   AS op_qtd,
                COALESCE(c6.c6_qtdent, 0)::numeric(18,6) AS qtd_entreg,
                (COALESCE(c6.c6_qtdven, 0) - COALESCE(c6.c6_qtdent, 0))::numeric(18,6) AS qtd_faturar,
                sb1.b1_msblql,
                NULLIF(TRIM(COALESCE(c5.c5_mennota,'') || ' ' || COALESCE(c5.c5_zobs,'') || ' ' || COALESCE(c5.c5_zobsorc,'')), '') AS observacoes_gerais
            FROM public.sc5010 c5
            JOIN public.sc6010 c6
                ON COALESCE(c6.d_e_l_e_t_, '') = ''
                AND c6.c6_filial = c5.c5_filial
                AND c6.c6_num = c5.c5_num
            LEFT JOIN public.sb1010 sb1
                ON COALESCE(sb1.d_e_l_e_t_, '') = ''
                AND TRIM(sb1.b1_cod) = TRIM(c6.c6_produto)
            LEFT JOIN public.sc2010 c2
                ON (c2.c2_pedido = c5.c5_num )
                AND c2.c2_itempv = c6.c6_item
                AND COALESCE(c2.d_e_l_e_t_, '') = ''

            WHERE c5.c5_num = $1
            AND COALESCE(c5.d_e_l_e_t_, '') = ''
            AND c5.c5_tipo <> 'B'
            ORDER BY c6.c6_item ASC
        `;

        const result = await db.query(query, [id]);
        const items = result.rows.map(decodeMemosInRow);

        if (items.length > 0) {
            const productCodes = [...new Set(items.map(i => i.codigo).filter(c => c))];
            const paddedCodes = productCodes.map(c => c.padEnd(15, ' '));
            const codCliente = items[0]?.cod_cliente;
            const lojaCliente = items[0]?.loja_cliente;
            const opBaseList = [...new Set(items.map(r => String(r.op_num || '').trim()).filter(Boolean))];

            const opEnrichmentPromise = (async () => {
                let treeOpsResult = { rows: [] };
                if (opBaseList.length > 0) {
                    try {
                        treeOpsResult = await db.query(`
                            SELECT TRIM(c2_num) as op_num, TRIM(c2_item) as op_item, TRIM(c2_sequen) as op_sequencia, TRIM(c2_produto) as produto, c2_quant::numeric as op_qtd
                            FROM public.sc2010
                            WHERE c2_num = ANY($1::varchar[])
                            AND COALESCE(d_e_l_e_t_, '') = ''
                        `, [opBaseList]);
                    } catch (treeErr) {
                        console.error('Error fetching tree OPs in itens:', treeErr);
                    }
                }
                const childProductCodes = treeOpsResult.rows.map(r => r.produto);
                const allProductCodes = [...new Set([...productCodes, ...childProductCodes])];
                
                let lastOpMap = {};
                if (allProductCodes.length > 0) {
                    try {
                        const CHUNK_SIZE = 500;
                        const allRows = [];
                        for (let i = 0; i < allProductCodes.length; i += CHUNK_SIZE) {
                            const chunk = allProductCodes.slice(i, i + CHUNK_SIZE);
                            const res = await db.query(`
                                SELECT
                                    TRIM(g2.g2_produto) as produto,
                                    COUNT(g2.g2_operac) as total_operacoes,
                                    MAX(TRIM(g2.g2_operac)) as operacao_final
                                FROM public.sg2010 g2
                                WHERE TRIM(g2.g2_produto) = ANY($1::varchar[])
                                AND COALESCE(g2.d_e_l_e_t_, '') = ''
                                GROUP BY TRIM(g2.g2_produto)
                            `, [chunk]);
                            allRows.push(...res.rows);
                        }
                        allRows.forEach(r => {
                            lastOpMap[r.produto] = {
                                last: r.operacao_final,
                                count: parseInt(r.total_operacoes, 10) || 1
                            };
                        });
                    } catch (lastOpErr) {
                        console.error('Error fetching last ops in itens:', lastOpErr);
                    }
                }
                return { treeOpsResult, lastOpMap };
            })();

            const saldoProdPromise = (async () => {
                const saldoProdMap = {};
                if (opBaseList.length > 0) {
                    try {
                        const CHUNK_SIZE = 500;
                        for (let i = 0; i < opBaseList.length; i += CHUNK_SIZE) {
                            const chunk = opBaseList.slice(i, i + CHUNK_SIZE);
                            const placeholders = chunk.map(() => '?').join(',');
                            const [rows] = await mysqlPool.query(`
                                SELECT CONCAT(op_numero, op_item, op_sequencia) as op_full, operacao_codigo, SUM(quantidade) as produzido
                                FROM app_production_appointments
                                WHERE op_numero IN (${placeholders})
                                AND conferencia_status NOT IN ('CANCELADO', 'DIVERGENTE')
                                GROUP BY op_full, operacao_codigo
                            `, chunk);
                            rows.forEach(r => {
                                const key = `${r.op_full}-${r.operacao_codigo}`;
                                if (!saldoProdMap[key]) saldoProdMap[key] = 0;
                                saldoProdMap[key] += parseFloat(r.produzido) || 0;
                            });
                        }
                    } catch (saldoProdErr) {
                        console.error('Error fetching saldo produzido in itens:', saldoProdErr);
                    }
                }
                return saldoProdMap;
            })();

            const [notesResult, docsResult, nfResult, sz1Result, pgStatusResult, opEnrichmentResult, saldoProdResult] = await Promise.allSettled([
                mysqlPool.query('SELECT * FROM app_sales_order_item_notes WHERE pedido = ?', [id]),
                (async () => {
                    if (productCodes.length === 0) return {};
                    const placeholders = productCodes.map(() => '?').join(',');
                    const [docsRows] = await mysqlPool.execute(
                        `SELECT TRIM(produto_codigo) as produto_codigo, url_arquivo, tipo FROM produtos_docs WHERE produto_codigo IN (${placeholders})`,
                        productCodes
                    );
                    const docsMap = {};
                    docsRows.forEach(row => {
                        if (!docsMap[row.produto_codigo]) docsMap[row.produto_codigo] = [];
                        docsMap[row.produto_codigo].push(row);
                    });
                    return docsMap;
                })(),
                db.query(`
                    SELECT d2.d2_itempv as item,
                        TRIM(d2.d2_doc) as nota, TRIM(d2.d2_serie) as serie,
                        TRIM(f2.f2_emissao) as emissao_raw,
                        '' as natureza, TRIM(d2.d2_cf) as cfop,
                        d2.d2_quant::numeric(18,2) as qtd, d2.d2_prunit::numeric(18,2) as valor_unit,
                        d2.d2_total::numeric(18,2) as valor_total, d2.d2_valicm::numeric(18,2) as valor_icms,
                        d2.d2_valipi::numeric(18,2) as valor_ipi, d2.d2_valfre::numeric(18,2) as valor_frete,
                        f2.f2_pbruto::numeric(18,2) as peso_bruto, f2.f2_pliqui::numeric(18,2) as peso_liquido,
                        TRIM(f2.f2_transp) as transporte
                    FROM public.sd2010 d2
                    JOIN public.sf2010 f2 ON f2.f2_doc = d2.d2_doc AND f2.f2_serie = d2.d2_serie AND COALESCE(f2.d_e_l_e_t_, '') = ''
                    WHERE d2.d2_pedido = $1 AND COALESCE(d2.d_e_l_e_t_, '') = ''
                `, [id]),
                codCliente ? db.query(`
                    SELECT TRIM(z1.z1_produto) as produto,
                        STRING_AGG(DISTINCT TRIM(z1.z1_codcli), ' / ') as ref_cliente,
                        STRING_AGG(DISTINCT TRIM(z1.z1_revisao), ' / ') as rev_cliente
                    FROM public.sz1010 z1
                    WHERE z1.z1_cliente = $1 AND z1.z1_loja = $2
                    AND TRIM(z1.z1_produto) = ANY($3::varchar[])
                    AND COALESCE(z1.d_e_l_e_t_, '') = ''
                    GROUP BY TRIM(z1.z1_produto)
                `, [codCliente, lojaCliente, productCodes]) : Promise.resolve({ rows: [] }),
                productCodes.length > 0 ? db.query(`
                    SELECT 'sg1' as type, TRIM(g1_cod) as cod FROM public.sg1010 WHERE g1_cod = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') <> '*'
                    UNION ALL
                    SELECT 'sg2' as type, TRIM(g2_produto) as cod FROM public.sg2010 WHERE g2_produto = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') <> '*'
                    UNION ALL
                    SELECT 'sz0' as type, TRIM(z0_produto) as cod FROM public.sz0010 WHERE z0_produto = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') <> '*' AND z0_status = 'P'
                `, [paddedCodes]) : Promise.resolve({ rows: [] }),
                opEnrichmentPromise,
                saldoProdPromise
            ]);

            // ... (rest of logic processing result promises)
            res.json(items);
        } else {
            res.json(items);
        }
    } catch (err) {
        console.error(`Erro SQL ao buscar itens pedido ${req.params.id}: `, err.message);
        res.status(500).json({ error: 'Erro ao buscar itens do pedido.', details: err.message });
    }
});

// Sales Order Item Notes Routes
(async () => {
    try {
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_sales_order_item_notes(
            id INT AUTO_INCREMENT PRIMARY KEY,
            pedido VARCHAR(20) NOT NULL,
            item VARCHAR(10) NOT NULL,
            nota TEXT,
            status ENUM('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO') DEFAULT 'PENDENTE',
            created_by VARCHAR(100),
            updated_by VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_pedido_item(pedido, item),
            INDEX idx_pedido(pedido)
        ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4
            `);
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN project_type VARCHAR(50) DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN engineering_start_date DATE DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN bom_prepared_by VARCHAR(100) DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN bom_prepared_at DATE DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN bom_released_at DATE DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN bom_notes TEXT DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN designer_name VARCHAR(100) DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN designer_start_forecast DATE DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN designer_end_forecast DATE DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN designer_start_real DATE DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN designer_end_real DATE DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN designer_production_release_date DATE DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN designer_notes TEXT DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN pcp_mat_req_date DATE DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN pcp_mat_req_user VARCHAR(100) DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN pcp_mech_start_date DATE DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN pcp_mech_start_user VARCHAR(100) DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN pcp_cut_rel_date DATE DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN pcp_cut_rel_user VARCHAR(100) DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN pcp_notes TEXT DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN pcp_planned_eng_date DATE DEFAULT NULL`); } catch (e) { }
        try { await mysqlPool.query(`ALTER TABLE app_sales_order_item_notes ADD COLUMN pcp_planned_eng_obs TEXT DEFAULT NULL`); } catch (e) { }

        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_sales_order_item_notes_history(
                id INT AUTO_INCREMENT PRIMARY KEY,
                pedido VARCHAR(20) NOT NULL,
                item VARCHAR(10) NOT NULL,
                action_type ENUM('CREATED', 'UPDATED', 'STATUS_CHANGED', 'DELETED') NOT NULL,
                field_changed VARCHAR(50),
                old_value TEXT,
                new_value TEXT,
                user_name VARCHAR(100) NOT NULL,
                user_email VARCHAR(100),
                action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_pedido_item(pedido, item),
                INDEX idx_timestamp(action_timestamp DESC)
            ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4
        `);

        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_pcp_delivery_forecasts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                pedido VARCHAR(20) NOT NULL,
                item VARCHAR(10) NOT NULL,
                data_entrega_pcp DATE NOT NULL,
                quantidade_pcp DECIMAL(18,6) NOT NULL,
                usuario VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_pedido_item (pedido, item)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
    } catch (err) {
        console.error('Error notes tables:', err.message);
    }
})();

async function logHistory(pedido, item, actionType, fieldChanged, oldValue, newValue, userName, userEmail) {
    try {
        await mysqlPool.query(
            `INSERT INTO app_sales_order_item_notes_history
            (pedido, item, action_type, field_changed, old_value, new_value, user_name, user_email)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
            [pedido, item, actionType, fieldChanged, oldValue, newValue, userName, userEmail]
        );
    } catch (err) {
        console.error('Error logging history:', err);
    }
}

router.post('/classificacao', async (req, res) => {
    try {
        const { pedido, item, classificacao, ppap_numero, data_atualizacao } = req.body;
        if (!pedido || !item || !classificacao) {
            return res.status(400).json({ error: 'Pedido, item e classificacao são obrigatórios.' });
        }

        const [existing] = await mysqlPool.query(
            'SELECT * FROM app_pedido_itens_classificacao WHERE pedido = ? AND item = ?',
            [String(pedido).trim(), String(item).trim()]
        );

        if (existing.length > 0) {
            await mysqlPool.query(
                'UPDATE app_pedido_itens_classificacao SET classificacao = ?, ppap_numero = ?, data_atualizacao = ? WHERE pedido = ? AND item = ?',
                [classificacao, ppap_numero || null, data_atualizacao || null, String(pedido).trim(), String(item).trim()]
            );
        } else {
            await mysqlPool.query(
                'INSERT INTO app_pedido_itens_classificacao (pedido, item, classificacao, ppap_numero, data_atualizacao) VALUES (?, ?, ?, ?, ?)',
                [String(pedido).trim(), String(item).trim(), classificacao, ppap_numero || null, data_atualizacao || null]
            );
        }

        res.json({ success: true, message: 'Classificação atualizada com sucesso.' });
    } catch (err) {
        console.error('Error updating classificacao:', err);
        res.status(500).json({ error: 'Failed to update classificacao' });
    }
});

router.post('/classificacao/upload', uploadClassificacao.single('file'), async (req, res) => {
    try {
        const { pedido, item } = req.body;
        if (!pedido || !item || !req.file) {
            return res.status(400).json({ error: 'Pedido, item e arquivo são obrigatórios.' });
        }

        const fileUrl = `/uploads/classificacao/${req.file.filename}`;
        await mysqlPool.query(
            'INSERT INTO app_pedido_itens_classificacao_anexos (pedido, item, filename, original_name, url) VALUES (?, ?, ?, ?, ?)',
            [String(pedido).trim(), String(item).trim(), req.file.filename, req.file.originalname, fileUrl]
        );

        res.json({ success: true, message: 'Arquivo anexado com sucesso.', fileUrl });
    } catch (err) {
        console.error('Error uploading file:', err);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

router.get('/classificacao/anexos/:pedido/:item', async (req, res) => {
    try {
        const { pedido, item } = req.params;
        const [rows] = await mysqlPool.query(
            'SELECT * FROM app_pedido_itens_classificacao_anexos WHERE pedido = ? AND item = ? ORDER BY created_at DESC',
            [String(pedido).trim(), String(item).trim()]
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching anexos:', err);
        res.status(500).json({ error: 'Failed to fetch anexos' });
    }
});

router.delete('/classificacao/anexos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await mysqlPool.query('SELECT filename FROM app_pedido_itens_classificacao_anexos WHERE id = ?', [id]);
        
        if (rows.length > 0) {
            const filename = rows[0].filename;
            const filePath = nodePath.join(__dirname, '../uploads/classificacao', filename);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            await mysqlPool.query('DELETE FROM app_pedido_itens_classificacao_anexos WHERE id = ?', [id]);
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting anexo:', err);
        res.status(500).json({ error: 'Failed to delete anexo' });
    }
});

router.post('/batch/items/notes', async (req, res) => {
    const { items, formData } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Lista de itens é obrigatória.' });
    }
    if (!formData || Object.keys(formData).length === 0) {
        return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
    }

    const userName = req.user?.name || req.user?.username || 'Sistema';
    const userEmail = req.user?.email || '';

    const trackedFields = [
        'project_type', 'engineering_start_date',
        'bom_prepared_by', 'bom_prepared_at', 'bom_released_at', 'bom_notes',
        'designer_name', 'designer_start_forecast', 'designer_end_forecast',
        'designer_start_real', 'designer_end_real', 'designer_production_release_date', 'designer_notes',
        'pcp_mat_req_date', 'pcp_mat_req_user', 'pcp_mech_start_date', 'pcp_mech_start_user',
        'pcp_cut_rel_date', 'pcp_cut_rel_user', 'pcp_notes',
        'pcp_planned_eng_date', 'pcp_planned_eng_obs'
    ];

    const dateFields = new Set([
        'engineering_start_date', 'bom_prepared_at', 'bom_released_at',
        'designer_start_forecast', 'designer_end_forecast',
        'designer_start_real', 'designer_end_real', 'designer_production_release_date',
        'pcp_mat_req_date', 'pcp_mech_start_date', 'pcp_cut_rel_date', 'pcp_planned_eng_date'
    ]);

    const isValidDate = (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v);
    const sanitize = (field, val) => {
        if (val === '' || val === undefined || val === null) return null;
        if (dateFields.has(field) && !isValidDate(val)) return null;
        return val;
    };

    const results = [];
    const errors = [];

    const conn = await mysqlPool.getConnection();
    try {
        await conn.beginTransaction();

        for (const { pedido, item } of items) {
            try {
                const [existing] = await conn.query(
                    'SELECT * FROM app_sales_order_item_notes WHERE pedido = ? AND item = ?',
                    [pedido, item]
                );

                if (existing.length > 0) {
                    const oldNote = existing[0];
                    const updates = [];
                    const values = [];

                    for (const field of trackedFields) {
                        if (formData[field] === undefined) continue;
                        const newVal = sanitize(field, formData[field]);
                        const oldVal = oldNote[field] ?? null;
                        const normOld = oldVal instanceof Date ? oldVal.toISOString().split('T')[0] : (oldVal === '' ? null : oldVal);
                        const normNew = newVal === '' ? null : newVal;
                        if (normNew !== normOld) {
                            updates.push(`${field} = ?`);
                            values.push(newVal);
                            await logHistory(pedido, item, 'UPDATED', field, normOld, normNew, `${userName} [lote]`, userEmail);
                        }
                    }

                    if (updates.length > 0) {
                        updates.push('updated_by = ?');
                        values.push(userName);
                        await conn.query(
                            `UPDATE app_sales_order_item_notes SET ${updates.join(', ')} WHERE pedido = ? AND item = ?`,
                            [...values, pedido, item]
                        );
                    }
                    results.push({ pedido, item, action: 'updated' });
                } else {
                    const fields = ['pedido', 'item', 'nota', 'status', 'created_by', 'updated_by', ...trackedFields];
                    const placeholders = fields.map(() => '?').join(', ');
                    const values = [
                        pedido, item, '', 'PENDENTE', userName, userName,
                        ...trackedFields.map(f => sanitize(f, formData[f] ?? null))
                    ];
                    await conn.query(
                        `INSERT INTO app_sales_order_item_notes(${fields.join(', ')}) VALUES(${placeholders})`,
                        values
                    );
                    await logHistory(pedido, item, 'CREATED', null, null, 'Lançamento em lote', `${userName} [lote]`, userEmail);
                    results.push({ pedido, item, action: 'created' });
                }
            } catch (itemErr) {
                errors.push({ pedido, item, error: itemErr.message });
            }
        }

        await conn.commit();
        res.json({ success: true, results, errors });
    } catch (err) {
        await conn.rollback();
        console.error('❌ [BATCH NOTES]', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

router.get('/:pedido/items/notes', checkOrderAccess, async (req, res) => {
    try {
        const { pedido } = req.params;
        const [rows] = await mysqlPool.query(
            'SELECT * FROM app_sales_order_item_notes WHERE pedido = ? ORDER BY item',
            [pedido]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/:pedido/items/:item/notes', async (req, res) => {
    try {
        const { pedido, item } = req.params;
        const body = req.body;
        const { nota, status } = body;
        const userName = req.user?.name || req.user?.username || 'Sistema';
        const userEmail = req.user?.email || '';

        const trackedFields = [
            'project_type', 'engineering_start_date',
            'bom_prepared_by', 'bom_prepared_at', 'bom_released_at', 'bom_notes',
            'designer_name', 'designer_start_forecast', 'designer_end_forecast',
            'designer_start_real', 'designer_end_real', 'designer_production_release_date', 'designer_notes',
            'pcp_mat_req_date', 'pcp_mat_req_user',
            'pcp_mech_start_date', 'pcp_mech_start_user',
            'pcp_cut_rel_date', 'pcp_cut_rel_user',
            'pcp_notes',
            'pcp_planned_eng_date', 'pcp_planned_eng_obs'
        ];

        const dateFields = new Set([
            'engineering_start_date', 'bom_prepared_at', 'bom_released_at',
            'designer_start_forecast', 'designer_end_forecast',
            'designer_start_real', 'designer_end_real', 'designer_production_release_date',
            'pcp_mat_req_date', 'pcp_mech_start_date', 'pcp_cut_rel_date',
            'pcp_planned_eng_date'
        ]);

        const sanitize = (field, val) => {
            if (val === '' || val === undefined) return null;
            return val;
        };

        const [existing] = await mysqlPool.query(
            'SELECT * FROM app_sales_order_item_notes WHERE pedido = ? AND item = ?',
            [pedido, item]
        );

        if (existing.length > 0) {
            const oldNote = existing[0];
            const updates = [];
            const values = [];

            if (nota !== undefined && nota !== oldNote.nota) {
                updates.push('nota = ?');
                values.push(nota);
                await logHistory(pedido, item, 'UPDATED', 'nota', oldNote.nota, nota, userName, userEmail);
            }

            if (status && status !== oldNote.status) {
                updates.push('status = ?');
                values.push(status);
                await logHistory(pedido, item, 'STATUS_CHANGED', 'status', oldNote.status, status, userName, userEmail);
            }

            for (const field of trackedFields) {
                const newVal = dateFields.has(field) ? sanitize(field, body[field]) : body[field];
                const oldVal = oldNote[field] || null;
                const normalizedOld = (oldVal === '' || oldVal === undefined) ? null : (oldVal instanceof Date ? oldVal.toISOString().split('T')[0] : oldVal);
                const normalizedNew = (newVal === '' || newVal === undefined) ? null : newVal;

                if (body[field] !== undefined && normalizedNew !== normalizedOld) {
                    updates.push(`${field} = ?`);
                    values.push(newVal);
                    await logHistory(pedido, item, 'UPDATED', field, normalizedOld, normalizedNew, userName, userEmail);
                }
            }

            if (updates.length > 0) {
                updates.push('updated_by = ?');
                values.push(userName);
                await mysqlPool.query(
                    `UPDATE app_sales_order_item_notes SET ${updates.join(', ')} WHERE pedido = ? AND item = ? `,
                    [...values, pedido, item]
                );
            }
            res.json({ success: true, action: 'updated' });
        } else {
            const fields = ['pedido', 'item', 'nota', 'status', 'created_by', 'updated_by', ...trackedFields];
            const placeholders = fields.map(() => '?').join(', ');

            const values = [
                pedido, item, nota || '', status || 'PENDENTE', userName, userName,
                ...trackedFields.map(f => body[f] || null)
            ];

            await mysqlPool.query(
                `INSERT INTO app_sales_order_item_notes(${fields.join(', ')}) VALUES(${placeholders})`,
                values
            );
            await logHistory(pedido, item, 'CREATED', null, null, nota, userName, userEmail);
            res.json({ success: true, action: 'created' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:pedido/items/:item/notes', async (req, res) => {
    try {
        const { pedido, item } = req.params;
        const userName = req.user?.name || req.user?.username || 'Sistema';
        const userEmail = req.user?.email || '';

        const [existing] = await mysqlPool.query(
            'SELECT nota FROM app_sales_order_item_notes WHERE pedido = ? AND item = ?',
            [pedido, item]
        );

        if (existing.length > 0) {
            await mysqlPool.query(
                'DELETE FROM app_sales_order_item_notes WHERE pedido = ? AND item = ?',
                [pedido, item]
            );
            await logHistory(pedido, item, 'DELETED', null, existing[0].nota, null, userName, userEmail);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Note not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:pedido/items/:item/notes/history', checkOrderAccess, async (req, res) => {
    try {
        const { pedido, item } = req.params;
        const [rows] = await mysqlPool.query(
            `SELECT * FROM app_sales_order_item_notes_history 
            WHERE pedido = ? AND item = ?
            ORDER BY action_timestamp DESC`,
            [pedido, item]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:pedido/checklist-print', checkOrderAccess, async (req, res) => {
    try {
        const { pedido } = req.params;

        const orderResult = await db.query(
            `SELECT c5.c5_num as pedido, sa1.a1_nome as cliente, c5.c5_emissao as emissao
            FROM sc5010 c5
            LEFT JOIN sa1010 sa1 ON sa1.a1_cod = c5.c5_cliente AND COALESCE(sa1.d_e_l_e_t_, '') = ''
            WHERE c5.c5_num = $1 AND COALESCE(c5.d_e_l_e_t_, '') = ''`,
            [pedido]
        );

        const itemsResult = await db.query(
            `SELECT c6.c6_item as item, c6.c6_produto as codigo, sb1.b1_desc as descricao
            FROM sc6010 c6
            LEFT JOIN sb1010 sb1 ON sb1.b1_cod = c6.c6_produto AND COALESCE(sb1.d_e_l_e_t_, '') = ''
            WHERE c6.c6_num = $1 AND COALESCE(c6.d_e_l_e_t_, '') = ''
            ORDER BY c6.c6_item`,
            [pedido]
        );

        const [notes] = await mysqlPool.query(
            'SELECT * FROM app_sales_order_item_notes WHERE pedido = ?',
            [pedido]
        );

        const notesMap = {};
        notes.forEach(n => notesMap[n.item] = n);

        const items = itemsResult.rows.map(item => ({
            ...item,
            nota: notesMap[item.item]?.nota || '',
            status: notesMap[item.item]?.status || 'PENDENTE',
            project_type: notesMap[item.item]?.project_type || null,
            engineering_start_date: notesMap[item.item]?.engineering_start_date || null
        }));

        res.json({
            order: orderResult.rows[0],
            items
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:pedido/items/:item/history', checkOrderAccess, async (req, res) => {
    try {
        const { pedido, item } = req.params;
        const [rows] = await mysqlPool.query(
            `SELECT field_changed, user_name, action_timestamp 
             FROM app_sales_order_item_notes_history 
             WHERE pedido = ? AND item = ?
            ORDER BY action_timestamp DESC`,
            [pedido, item]
        );

        const history = {};
        rows.forEach(row => {
            if (row.field_changed && !history[row.field_changed]) {
                history[row.field_changed] = {
                    user: row.user_name,
                    date: row.action_timestamp
                };
            }
        });

        res.json(history);
    } catch (err) {
        console.error('Error fetching history:', err);
        res.status(500).json({ error: 'Error fetching history' });
    }
});

router.post('/pcp-forecasts/batch', validate(rules.pcpForecastBatch), async (req, res) => {
    try {
        const { items, data_entrega_pcp, usuario, observacao, numero_serie, serie_cliente, serie_metalfisa, lote, numero_lote } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0 || !data_entrega_pcp || !usuario) {
            return res.status(400).json({ error: 'Dados incompletos para o planejamento Lote PCP.' });
        }

        const connection = await mysqlPool.getConnection();
        await connection.beginTransaction();

        try {
            const savedItems = [];

            for (const it of items) {
                let { pedido, item, quantidade_pcp, qtd_total_item } = it;

                if (!pedido || !item || quantidade_pcp === undefined) continue;
                
                if (it.op_protheus) {
                    const opClean = String(it.op_protheus).trim();
                    if (opClean && opClean !== '-' && opClean !== '') {
                        const [opCheck] = await connection.query(
                            "SELECT data_entrega_pcp FROM app_pcp_delivery_forecasts WHERE TRIM(op_protheus) = ? LIMIT 1",
                            [opClean]
                        );
                        if (opCheck.length > 0) {
                            const existingDate = new Date(opCheck[0].data_entrega_pcp).toISOString().split('T')[0];
                            const newDate = new Date(data_entrega_pcp).toISOString().split('T')[0];
                            if (existingDate !== newDate) {
                                throw new Error(`A OP ${opClean} já está vinculada à data de entrega ${existingDate.split('-').reverse().join('/')} e não pode ter outra data.`);
                            }
                        }
                    }
                }

                let queryDup = `SELECT id FROM app_pcp_delivery_forecasts WHERE TRIM(pedido) = ? AND TRIM(item) = ? AND data_entrega_pcp = ? LIMIT 1`;
                let paramsDup = [String(pedido).trim(), String(item).trim(), data_entrega_pcp];
                const [dupCheck] = await connection.query(queryDup, paramsDup);
                if (dupCheck.length > 0) {
                    continue;
                }

                if (qtd_total_item !== undefined) {
                    const [existing] = await connection.query(
                        'SELECT COALESCE(SUM(quantidade_pcp), 0) as total FROM app_pcp_delivery_forecasts WHERE TRIM(pedido) = ? AND TRIM(item) = ?',
                        [String(pedido).trim(), String(item).trim()]
                    );
                    const totalAtual = parseFloat(existing[0].total) || 0;
                    const novaQtd = parseFloat(quantidade_pcp);
                    const limite = parseFloat(qtd_total_item);

                    if (totalAtual + novaQtd > limite + 0.01) {
                        const restante = Math.max(0, limite - totalAtual);
                        if (restante <= 0.01) continue;
                        quantidade_pcp = parseFloat(restante.toFixed(2));
                    }
                }

                const [result] = await connection.query(
                    'INSERT INTO app_pcp_delivery_forecasts (pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao, numero_serie, serie_cliente, serie_metalfisa, lote, numero_lote, op_protheus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao || null, numero_serie || null, serie_cliente || null, serie_metalfisa || null, lote || null, numero_lote || null, it.op_protheus || null]
                );

                savedItems.push({ id: result.insertId, pedido: String(pedido).trim(), item: String(item).trim(), quantidade_pcp });
            }
            await connection.commit();
            res.json({ success: true, message: 'Lote programado com sucesso', savedItems });
        } catch (txnErr) {
            await connection.rollback();
            throw txnErr;
        } finally {
            connection.release();
        }

    } catch (err) {
        console.error('Error saving PCP forecast batch:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/pcp-forecasts', validate(rules.pcpForecast), async (req, res) => {
    try {
        const { pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao, numero_serie, serie_cliente, serie_metalfisa, lote, numero_lote, qtd_total_item, data_prevista_faturamento } = req.body;

        if (!pedido || !item || !data_entrega_pcp || quantidade_pcp === undefined || !usuario) {
            return res.status(400).json({ error: 'Dados incompletos para o planejamento PCP.' });
        }
        if (req.body.op_protheus) {
            const opClean = String(req.body.op_protheus).trim();
            if (opClean && opClean !== '-' && opClean !== '') {
                const [opCheck] = await mysqlPool.query(
                    "SELECT data_entrega_pcp FROM app_pcp_delivery_forecasts WHERE TRIM(op_protheus) = ? LIMIT 1",
                    [opClean]
                );
                if (opCheck.length > 0) {
                    const existingDate = new Date(opCheck[0].data_entrega_pcp).toISOString().split('T')[0];
                    const newDate = new Date(data_entrega_pcp).toISOString().split('T')[0];
                    if (existingDate !== newDate) {
                        return res.status(400).json({ error: `A OP ${opClean} já está vinculada à data de entrega ${existingDate.split('-').reverse().join('/')} e não pode ter outra data.` });
                    }
                }
            }
        }

        let queryDup = `SELECT id FROM app_pcp_delivery_forecasts WHERE TRIM(pedido) = ? AND TRIM(item) = ? AND data_entrega_pcp = ? LIMIT 1`;
        let paramsDup = [String(pedido).trim(), String(item).trim(), data_entrega_pcp];
        
        const [dupCheck] = await mysqlPool.query(queryDup, paramsDup);
        if (dupCheck.length > 0) {
             return res.status(400).json({ error: 'Já existe um registro de Data PCP para este pedido/item nesta data.' });
        }

        if (qtd_total_item !== undefined) {
            const [existing] = await mysqlPool.query(
                'SELECT COALESCE(SUM(quantidade_pcp), 0) as total FROM app_pcp_delivery_forecasts WHERE TRIM(pedido) = ? AND TRIM(item) = ?',
                [String(pedido).trim(), String(item).trim()]
            );
            const totalAtual = parseFloat(existing[0].total) || 0;
            const novaQtd = parseFloat(quantidade_pcp);
            const limite = parseFloat(qtd_total_item);
            if (totalAtual + novaQtd > limite + 0.01) {
                return res.status(400).json({
                    error: `Quantidade excede o total do item. Já programado: ${totalAtual}, disponível: ${Math.max(0, limite - totalAtual).toFixed(2)}.`
                });
            }
        }

        const [result] = await mysqlPool.query(
            'INSERT INTO app_pcp_delivery_forecasts (pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao, numero_serie, serie_cliente, serie_metalfisa, lote, numero_lote, op_protheus, data_prevista_faturamento) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao || null, numero_serie || null, serie_cliente || null, serie_metalfisa || null, lote || null, numero_lote || null, req.body.op_protheus || null, data_prevista_faturamento || null]
        );

        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error('Error saving PCP forecast:', err);
        res.status(500).json({ error: err.message });
    }
});

router.put('/pcp-forecasts/:id', validate(rules.pcpForecastUpdate), async (req, res) => {
    try {
        const { id } = req.params;
        const { data_entrega_pcp, quantidade_pcp, observacao, numero_serie, serie_cliente, serie_metalfisa, lote, numero_lote, usuario, qtd_total_item, data_prevista_faturamento } = req.body;

        if (!data_entrega_pcp || quantidade_pcp === undefined) {
            return res.status(400).json({ error: 'Data e quantidade são obrigatórios.' });
        }

        let queryDup = `SELECT id FROM app_pcp_delivery_forecasts WHERE id != ? AND TRIM(pedido) = (SELECT TRIM(pedido) FROM app_pcp_delivery_forecasts WHERE id = ?) AND TRIM(item) = (SELECT TRIM(item) FROM app_pcp_delivery_forecasts WHERE id = ?) AND data_entrega_pcp = ? LIMIT 1`;
        let paramsDup = [id, id, id, data_entrega_pcp];
        
        const [dupCheck] = await mysqlPool.query(queryDup, paramsDup);
        if (dupCheck.length > 0) {
             return res.status(400).json({ error: 'Já existe um outro registro de Data PCP para este pedido/item nesta data.' });
        }

        if (qtd_total_item !== undefined) {
            const [existing] = await mysqlPool.query(
                'SELECT COALESCE(SUM(quantidade_pcp), 0) as total FROM app_pcp_delivery_forecasts WHERE id != ? AND TRIM(pedido) = (SELECT TRIM(pedido) FROM app_pcp_delivery_forecasts WHERE id = ?) AND TRIM(item) = (SELECT TRIM(item) FROM app_pcp_delivery_forecasts WHERE id = ?)',
                [id, id, id]
            );
            const totalOutros = parseFloat(existing[0].total) || 0;
            const novaQtd = parseFloat(quantidade_pcp);
            const limite = parseFloat(qtd_total_item);
            if (totalOutros + novaQtd > limite) {
                return res.status(400).json({
                    error: `Quantidade excede o total do item. Já programado (outros): ${totalOutros}, disponível: ${(limite - totalOutros).toFixed(2)}.`
                });
            }
        }

        const [current] = await mysqlPool.query("SELECT op_protheus FROM app_pcp_delivery_forecasts WHERE id = ?", [id]);
        const opClean = current[0]?.op_protheus ? String(current[0].op_protheus).trim() : null;
        if (opClean && opClean !== '-' && opClean !== '') {
            // Sincroniza a data de entrega de todos os registros da mesma OP no PCP
            await mysqlPool.query(
                "UPDATE app_pcp_delivery_forecasts SET data_entrega_pcp = ? WHERE TRIM(op_protheus) = ?",
                [data_entrega_pcp, opClean]
            );
        }

        await mysqlPool.query(
            'UPDATE app_pcp_delivery_forecasts SET data_entrega_pcp = ?, quantidade_pcp = ?, observacao = ?, numero_serie = ?, serie_cliente = ?, serie_metalfisa = ?, lote = ?, numero_lote = ?, data_prevista_faturamento = ? WHERE id = ?',
            [data_entrega_pcp, parseFloat(quantidade_pcp), observacao || null, numero_serie || null, serie_cliente || null, serie_metalfisa || null, lote || null, numero_lote || null, data_prevista_faturamento || null, id]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Error updating PCP forecast:', err);
        res.status(500).json({ error: err.message });
    }
});

router.patch('/pcp-forecasts/faturamento', async (req, res) => {
    try {
        const { id, pedido, item, data_prevista_faturamento, data_entrega_pcp, quantidade_pcp, usuario } = req.body;

        if (id) {
            await mysqlPool.query(
                'UPDATE app_pcp_delivery_forecasts SET data_prevista_faturamento = ? WHERE id = ?',
                [data_prevista_faturamento || null, id]
            );
            return res.json({ success: true, id });
        } else {
            if (!pedido || !item || !usuario) {
                return res.status(400).json({ error: 'Pedido, item e usuário são obrigatórios para inicializar a previsão de faturamento.' });
            }
            if (!data_entrega_pcp || quantidade_pcp === undefined) {
                return res.status(400).json({ error: 'Data de entrega e quantidade do item são necessárias para inicializar a previsão de faturamento.' });
            }

            const [result] = await mysqlPool.query(
                'INSERT INTO app_pcp_delivery_forecasts (pedido, item, data_entrega_pcp, quantidade_pcp, usuario, data_prevista_faturamento) VALUES (?, ?, ?, ?, ?, ?)',
                [pedido, item, data_entrega_pcp, parseFloat(quantidade_pcp), usuario, data_prevista_faturamento || null]
            );
            return res.json({ success: true, id: result.insertId });
        }
    } catch (err) {
        console.error('Error patching billing forecast:', err);
        res.status(500).json({ error: err.message });
    }
});

router.patch('/pcp-forecasts/:id/op', async (req, res) => {
    try {
        const { id } = req.params;
        const { op_protheus } = req.body;
        const opClean = op_protheus ? String(op_protheus).trim() : null;
        if (opClean && opClean !== '-' && opClean !== '') {
            const [opCheck] = await mysqlPool.query(
                "SELECT data_entrega_pcp FROM app_pcp_delivery_forecasts WHERE TRIM(op_protheus) = ? AND id != ? LIMIT 1",
                [opClean, id]
            );
            if (opCheck.length > 0) {
                const [curr] = await mysqlPool.query("SELECT data_entrega_pcp FROM app_pcp_delivery_forecasts WHERE id = ?", [id]);
                const existingDate = new Date(opCheck[0].data_entrega_pcp).toISOString().split('T')[0];
                const currentDate = new Date(curr[0].data_entrega_pcp).toISOString().split('T')[0];
                if (existingDate !== currentDate) {
                    return res.status(400).json({ error: `A OP ${opClean} já possui a data de entrega ${existingDate.split('-').reverse().join('/')}. Altere a data desta programação para coincidir antes de vincular.` });
                }
            }
        }
        
        await mysqlPool.query(
            'UPDATE app_pcp_delivery_forecasts SET op_protheus = ? WHERE id = ?',
            [opClean, id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating PCP forecast OP:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/pcp-forecasts/:id', async (req, res) => {
    try {
        await mysqlPool.query('DELETE FROM app_pcp_delivery_forecasts WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting PCP forecast:', err);
        res.status(500).json({ error: err.message });
    }
});
router.post('/pcp-forecasts/balance', async (req, res) => {
    try {
        const { items, startDate, endDate, allowedDays, overwrite, usuario } = req.body;
        
        if (!items || items.length === 0) return res.status(400).json({ error: 'Nenhum item selecionado.' });
        if (!startDate || !endDate || !allowedDays || allowedDays.length === 0) return res.status(400).json({ error: 'Parâmetros de balanceamento incompletos.' });

        const validDays = [];
        let current = new Date(startDate + 'T12:00:00Z');
        const end = new Date(endDate + 'T12:00:00Z');
        while (current <= end) {
            if (allowedDays.includes(current.getUTCDay())) validDays.push(current.toISOString().split('T')[0]);
            current.setUTCDate(current.getUTCDate() + 1);
        }

        if (validDays.length === 0) return res.status(400).json({ error: 'Nenhum dia válido encontrado no período informado.' });
        const validItems = items.filter(i => parseFloat(i.qtd_faturar || 0) > 0);
        if (validItems.length === 0) return res.status(400).json({ error: 'Nenhum dos itens selecionados possui saldo a faturar.' });

        const connection = await mysqlPool.getConnection();
        try {
            await connection.beginTransaction();
            const operations = validItems.map(item => ({
                dateToAssign: item.data_pcp || validDays[0],
                saldo: parseFloat(item.qtd_faturar || 0),
                cleanPedido: String(item.pedido).trim(),
                cleanItem: String(item.item).trim()
            }));

            const BATCH_SIZE = 100;
            for (let i = 0; i < operations.length; i += BATCH_SIZE) {
                const chunk = operations.slice(i, i + BATCH_SIZE);
                const conditions = chunk.map(q => `(TRIM(pedido) = ${connection.escape(q.cleanPedido)} AND TRIM(item) = ${connection.escape(q.cleanItem)})`).join(' OR ');
                const [existingRows] = await connection.query(`SELECT id, TRIM(pedido) as pedido, TRIM(item) as item, data_entrega_pcp FROM app_pcp_delivery_forecasts WHERE (${conditions})`);
                const existingMap = {};
                for (const row of existingRows) {
                    const key = `${row.pedido}_${row.item}`;
                    if (!existingMap[key]) existingMap[key] = [];
                    existingMap[key].push({ id: row.id, date: row.data_entrega_pcp });
                }
                const inserts = [];
                const updates = [];
                for (const q of chunk) {
                    const existingRecords = existingMap[`${q.cleanPedido}_${q.cleanItem}`];
                    if (existingRecords && existingRecords.length > 0) {
                        for (const rec of existingRecords) {
                            if (overwrite || !rec.date) updates.push([q.dateToAssign, q.saldo, usuario || 'Balanceamento Automático', 'Modificado por Lote', rec.id]);
                        }
                    } else {
                        inserts.push([q.cleanPedido, q.cleanItem, q.dateToAssign, q.saldo, usuario || 'Balanceamento Automático', 'Criado por Lote']);
                    }
                }
                if (inserts.length > 0) await connection.query('INSERT INTO app_pcp_delivery_forecasts (pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao) VALUES ?', [inserts]);
                if (updates.length > 0) {
                    const ids = updates.map(u => u[4]);
                    const dateCase = updates.map(u => `WHEN ${connection.escape(u[4])} THEN ${connection.escape(u[0])}`).join(' ');
                    const qtdCase = updates.map(u => `WHEN ${connection.escape(u[4])} THEN ${connection.escape(u[1])}`).join(' ');
                    const usuCase = updates.map(u => `WHEN ${connection.escape(u[4])} THEN ${connection.escape(u[2])}`).join(' ');
                    const obsCase = updates.map(u => `WHEN ${connection.escape(u[4])} THEN ${connection.escape(u[3])}`).join(' ');
                    await connection.query(`UPDATE app_pcp_delivery_forecasts SET data_entrega_pcp = CASE id ${dateCase} END, quantidade_pcp = CASE id ${qtdCase} END, usuario = CASE id ${usuCase} END, observacao = CASE id ${obsCase} END WHERE id IN (${ids.map(id => connection.escape(id)).join(',')})`);
                }
            }
            await connection.commit();
            res.json({ success: true, processedCount: validItems.length });
        } catch (txnErr) {
            await connection.rollback();
            throw txnErr;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error in PCP balance:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/items/:pedido/:item/pcp-forecasts/history', checkOrderAccess, async (req, res) => {
    try {
        const { pedido, item } = req.params;
        const [rows] = await mysqlPool.query(
            'SELECT * FROM app_pcp_delivery_forecasts WHERE TRIM(pedido) = ? AND TRIM(item) = ? ORDER BY id ASC',
            [String(pedido).trim(), String(item).trim()]
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching PCP history:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/op-mirror/:id', checkOrderAccess, async (req, res) => {
    let client;
    try {
        client = await db.connect();
        const { id } = req.params;
        const { item: queryItem, pendingOnly } = req.query;
        if (!id || String(id).trim() === '') return res.status(400).json({ error: 'Parâmetro pedido (id) é obrigatório.' });
        if (queryItem !== undefined && String(queryItem).trim() === '') return res.status(400).json({ error: 'Parâmetro item não pode ser vazio.' });
        const isPendingOnly = pendingOnly === 'true' || pendingOnly === '1';
        await client.query("SET LOCAL statement_timeout = '300000'");

        const orderQuery = `
            SELECT
                TRIM(c5.c5_num) AS pedido,
                TO_CHAR(TO_DATE(NULLIF(TRIM(c5.c5_emissao), ''), 'YYYYMMDD'), 'DD/MM/YY') AS emissao,
                TRIM(sa1.a1_nome) AS nome_cliente,
                TRIM(sa1.a1_cgc) AS cgc_cliente,
                TRIM(sa1.a1_mun) AS municipio,
                TRIM(sa1.a1_est) AS estado,
                NULLIF(TRIM(COALESCE(c5.c5_mennota,'') || ' ' || COALESCE(c5.c5_zobs,'') || ' ' || COALESCE(c5.c5_zobsorc,'')), '') AS observacoes_gerais
            FROM sc5010 c5
            LEFT JOIN sa1010 sa1
                ON sa1.a1_cod = c5.c5_cliente
                AND COALESCE(sa1.d_e_l_e_t_, '') IN ('', ' ')
            WHERE TRIM(c5.c5_num) = $1
              AND COALESCE(c5.d_e_l_e_t_, '') IN ('', ' ')
        `;
        const orderResult = await client.query(orderQuery, [id]);
        const orderData = orderResult.rows.length > 0 ? decodeMemosInRow(orderResult.rows[0]) : null;

        const explosionParams = [id];
        let itemCondition = '';
        if (queryItem) {
            explosionParams.push(String(queryItem).trim());
            itemCondition = `AND TRIM(c6.c6_item) = $${explosionParams.length}`;
        }
        let qtdVendaExpression = `COALESCE(NULLIF(c6.c6_qtdven::numeric, 0), c2.c2_quant::numeric, 0)`;
        let pendingCondition = '';
        if (isPendingOnly) {
            pendingCondition = `AND (COALESCE(c6.c6_qtdven::numeric, 0) - COALESCE(c6.c6_qtdent::numeric, 0)) > 0`;
            qtdVendaExpression = `GREATEST(COALESCE(c6.c6_qtdven::numeric, 0) - COALESCE(c6.c6_qtdent::numeric, 0), 0)`;
        }

        const explosionQuery = `
            WITH RECURSIVE
            sc2_lookup AS (
                SELECT c2.c2_itempv, TRIM(c2.c2_produto) AS produto, TRIM(c2.c2_num) AS op_num, TRIM(c2.c2_tpop) AS op_tipo, ROW_NUMBER() OVER (PARTITION BY c2.c2_itempv, TRIM(c2.c2_produto) ORDER BY c2.c2_num) AS rn FROM sc2010 c2 WHERE TRIM(c2.c2_pedido) = $1 AND COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
            ),
            sc2_first AS ( SELECT c2_itempv, produto, op_num, op_tipo FROM sc2_lookup WHERE rn = 1 ),
            pv_itens AS (
                SELECT
                    TRIM(c6.c6_item) AS item_pedido,
                    TRIM(c6.c6_produto) AS produto_venda,
                    TRIM(sb1.b1_desc) AS desc_venda,
                    TRIM(sb1.b1_tipo) AS tipo_venda,
                    ${qtdVendaExpression} AS qtd_venda,
                    TRIM(c6.c6_um) AS unid_venda,
                    TRIM(c6.c6_xrevm) AS rev_metalfisa,
                    COALESCE(TRIM(c2.c2_num), SUBSTRING(TRIM(c6.c6_numop), 1, 6)) AS op_num,
                    TRIM(c2.c2_tpop) AS op_tipo
                FROM sc6010 c6
                LEFT JOIN sc2010 c2 ON c2.c2_filial = c6.c6_filial AND TRIM(c2.c2_pedido) = TRIM(c6.c6_num) AND c2.c2_itempv = c6.c6_item AND c2.c2_sequen = '001' AND COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
                LEFT JOIN sb1010 sb1 ON TRIM(sb1.b1_cod) = TRIM(c6.c6_produto) AND COALESCE(sb1.d_e_l_e_t_, '') IN ('', ' ')
                WHERE TRIM(c6.c6_num) = $1 AND COALESCE(c6.d_e_l_e_t_, '') IN ('', ' ') AND COALESCE(TRIM(c6.c6_numop), '') != '' ${itemCondition} ${pendingCondition}
            ),
            estrutura AS (
                SELECT pv.item_pedido, 0 AS nivel, pv.produto_venda AS produto_pai, pv.produto_venda AS componente, pv.desc_venda AS descricao, pv.tipo_venda AS tipo, pv.unid_venda AS unidade, pv.rev_metalfisa AS revisao, 1::numeric AS qtd_base, pv.qtd_venda AS qtd_necessaria, pv.op_num AS op_relacionada, pv.op_tipo AS op_tipo_relacionada FROM pv_itens pv
                UNION ALL
                SELECT e.item_pedido, e.nivel + 1, CAST(TRIM(e.componente) AS VARCHAR(30)), CAST(TRIM(g1.g1_comp) AS VARCHAR(30)), CAST(TRIM(sb1.b1_desc) AS VARCHAR(100)), CAST(TRIM(sb1.b1_tipo) AS VARCHAR(2)), CAST(TRIM(sb1.b1_um) AS VARCHAR(10)), CAST(TRIM(sb1.b1_urev) AS VARCHAR(10)), g1.g1_quant::numeric, (e.qtd_necessaria * g1.g1_quant::numeric)::numeric, COALESCE(sc2.op_num, e.op_relacionada), COALESCE(sc2.op_tipo, e.op_tipo_relacionada)
                FROM estrutura e JOIN sg1010 g1 ON TRIM(g1.g1_cod) = TRIM(e.componente) AND COALESCE(g1.d_e_l_e_t_, '') IN ('', ' ') LEFT JOIN sb1010 sb1 ON TRIM(sb1.b1_cod) = TRIM(g1.g1_comp) AND COALESCE(sb1.d_e_l_e_t_, '') IN ('', ' ') LEFT JOIN sc2_first sc2 ON sc2.c2_itempv = e.item_pedido AND sc2.produto = TRIM(g1.g1_comp) WHERE e.nivel < 15
            ),
            pecas_distintas AS ( SELECT DISTINCT componente FROM estrutura ),
            max_rev_por_produto AS ( SELECT TRIM(g2_produto) AS produto, MAX(TRIM(g2_codigo)) AS max_codigo FROM sg2010 WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ') AND TRIM(g2_produto) IN (SELECT componente FROM pecas_distintas) GROUP BY TRIM(g2_produto) ),
            roteiro_agregado AS ( SELECT TRIM(g2.g2_produto) AS g2_produto_limpo, json_agg(json_build_object('seq', TRIM(g2.g2_operac), 'recurso', TRIM(g2.g2_recurso), 'desc_operacao', TRIM(h1.h1_descri), 'setup', g2.g2_setup, 'tempo_padrao', ROUND(g2.g2_tempad::numeric, 3), 'ferramenta', TRIM(g2.g2_ferram)) ORDER BY TRIM(g2.g2_operac)) AS operacoes FROM sg2010 g2 JOIN max_rev_por_produto mr ON TRIM(g2.g2_produto) = mr.produto AND TRIM(g2.g2_codigo) = mr.max_codigo LEFT JOIN sh1010 h1 ON TRIM(h1.h1_codigo) = TRIM(g2.g2_recurso) AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ') WHERE COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ') GROUP BY TRIM(g2.g2_produto) )
            SELECT e.*, COALESCE(ra.operacoes, '[]'::json) AS operacoes FROM estrutura e LEFT JOIN roteiro_agregado ra ON ra.g2_produto_limpo = e.componente ORDER BY e.item_pedido ASC, e.nivel ASC, e.produto_pai ASC, e.componente ASC;
        `;

        const forecastMap = await getForecastMapCached();
        const explosionResult = await client.query(explosionQuery, explosionParams);
        const itemsMap = new Map();
        explosionResult.rows.forEach(row => {
            if (!itemsMap.has(row.item_pedido)) {
                const fcKey = `${String(id).trim()}|${String(row.item_pedido).trim()}`;
                const fc = forecastMap.get(fcKey);
                const dataPcp = fc && fc.data_entrega_pcp ? fc.data_entrega_pcp : null;
                itemsMap.set(row.item_pedido, {
                    item_pedido: row.item_pedido,
                    data_pcp: dataPcp,
                    produto_principal: null,
                    estrutura_linear: []
                });
            }
            const itemGroup = itemsMap.get(row.item_pedido);
            if (row.nivel === 0) {
                itemGroup.produto_principal = {
                    codigo: row.componente,
                    descricao: row.descricao,
                    tipo: row.tipo,
                    revisao: row.revisao,
                    unidade: row.unidade,
                    quantidade_venda: parseFloat(row.qtd_necessaria),
                    op_num: row.op_relacionada,
                    op_tipo: row.op_tipo_relacionada,
                    operacoes: row.operacoes,
                    data_pcp: itemGroup.data_pcp
                };
            }
            else itemGroup.estrutura_linear.push({ nivel: parseInt(row.nivel), pai: row.produto_pai, codigo: row.componente, descricao: row.descricao, tipo: row.tipo, unidade: row.unidade, quantidade_calculada: parseFloat(row.qtd_necessaria), op_num: row.op_relacionada, op_tipo: row.op_tipo_relacionada, operacoes: row.operacoes });
        });
        res.json({ pedido: orderData, itens: Array.from(itemsMap.values()) });
    } catch (err) {
        console.error('[OP Mirror Error]', err);
        res.status(500).json({ error: 'Erro interno ao gerar espelho de OP', details: err.message });
    } finally {
        if (client) client.release();
    }
});

router.get('/op-mirror/:id/export-laser', checkOrderAccess, async (req, res) => {
    try {
        const { id } = req.params;
        const orderResult = await db.query(`SELECT TRIM(c5.c5_num) AS pedido, TRIM(sa1.a1_nome) AS nome_cliente FROM sc5010 c5 LEFT JOIN sa1010 sa1 ON sa1.a1_cod = c5.c5_cliente AND sa1.a1_loja = c5.c5_lojacli AND COALESCE(sa1.d_e_l_e_t_, '') = '' WHERE TRIM(c5.c5_num) = $1 AND COALESCE(c5.d_e_l_e_t_, '') = ''`, [id]);
        if (orderResult.rows.length === 0) return res.status(404).json({ error: 'Pedido não encontrado.' });

        const laserQuery = `
            WITH RECURSIVE
            pv_itens AS (
                SELECT TRIM(c6.c6_item) AS item_pedido, TRIM(c6.c6_produto) AS produto_venda, COALESCE(NULLIF(c6.c6_qtdven::numeric, 0), c2.c2_quant::numeric, 0) AS qtd_venda
                FROM sc6010 c6 LEFT JOIN sc2010 c2 ON c2.c2_filial = c6.c6_filial AND TRIM(c2.c2_pedido) = TRIM(c6.c6_num) AND c2.c2_itempv = c6.c6_item AND c2.c2_sequen = '001' AND COALESCE(c2.d_e_l_e_t_, '') = ''
                WHERE TRIM(c6.c6_num) = $1 AND COALESCE(c6.c6_d_e_l_e_t_, '') = '' AND COALESCE(TRIM(c6.c6_numop), '') != ''
            ),
            estrutura AS (
                SELECT pv.item_pedido, 0 AS nivel, pv.produto_venda AS componente, pv.qtd_venda AS qtd_necessaria FROM pv_itens pv
                UNION ALL
                SELECT e.item_pedido, e.nivel + 1, CAST(TRIM(g1.g1_comp) AS VARCHAR(30)), (e.qtd_necessaria * g1.g1_quant::numeric)::numeric FROM estrutura e JOIN sg1010 g1 ON TRIM(g1.g1_cod) = TRIM(e.componente) AND COALESCE(g1.d_e_l_e_t_, '') = '' WHERE e.nivel < 15
            ),
            laser_agg AS (
                SELECT TRIM(e.componente) AS cod_componente, MIN(TRIM(sb1.b1_desc)) AS descricao, SUM(e.qtd_necessaria)::numeric AS qtd_requerida
                FROM estrutura e LEFT JOIN sb1010 sb1 ON TRIM(sb1.b1_cod) = TRIM(e.componente) AND COALESCE(sb1.d_e_l_e_t_, '') = ''
                WHERE e.nivel > 0 AND EXISTS ( SELECT 1 FROM sg2010 g2 WHERE TRIM(g2.g2_produto) = TRIM(e.componente) AND TRIM(g2.g2_recurso) = 'MO0013' AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ') AND TRIM(g2.g2_codigo) = (SELECT MAX(TRIM(g2_sub.g2_codigo)) FROM sg2010 g2_sub WHERE TRIM(g2_sub.g2_produto) = TRIM(e.componente) AND COALESCE(g2_sub.d_e_l_e_t_, '') IN ('', ' ')) )
                GROUP BY TRIM(e.componente)
            )
            SELECT lc.*, (SELECT TRIM(g1_mtc.g1_comp) FROM sg1010 g1_mtc WHERE TRIM(g1_mtc.g1_cod) = lc.cod_componente AND TRIM(g1_mtc.g1_comp) LIKE 'MTC%' AND COALESCE(g1_mtc.d_e_l_e_t_, '') = '' LIMIT 1) AS material_chapa FROM laser_agg lc ORDER BY lc.cod_componente;
        `;
        const laserResult = await db.query(laserQuery, [id]);
        const components = laserResult.rows;
        if (components.length === 0) return res.status(404).json({ error: 'Nenhum componente com operação MO0013 encontrado para este pedido.' });

        const componentCodes = components.map(c => c.cod_componente);
        const placeholders = componentCodes.map(() => '?').join(',');
        const [docsRows] = await mysqlPool.execute(`SELECT TRIM(produto_codigo) AS produto_codigo, url_arquivo, tipo FROM produtos_docs WHERE produto_codigo IN (${placeholders})`, componentCodes);
        const docsMap = {};
        docsRows.forEach(row => {
            if (!docsMap[row.produto_codigo]) docsMap[row.produto_codigo] = [];
            docsMap[row.produto_codigo].push(row);
        });
        components.forEach(comp => {
            const docs = docsMap[comp.cod_componente] || [];
            const drawing = docs.find(d => String(d.tipo || '').toLowerCase().includes('desenho'));
            comp.pdf_path = drawing ? drawing.url_arquivo : (docs.length > 0 ? docs[0].url_arquivo : '');
        });

        const templatePath = process.env.LASER_TEMPLATE_PATH || '\\\\192.168.1.253\\Estrutura Lynx\\023-SGQ\\023-001-FORMULARIOS\\Espelho OS-Corte.xls';
        let templateBuffer = fs.readFileSync(templatePath);
        const workbook = XLSX.read(templateBuffer, { type: 'buffer' });
        const sheet = workbook.Sheets['Import XLS'];
        components.forEach((comp, idx) => {
            const row = 7 + idx;
            sheet[`A${row}`] = { v: comp.cod_componente, t: 's' };
            sheet[`B${row}`] = { v: parseFloat(comp.qtd_requerida), t: 'n' };
            sheet[`H${row}`] = { v: comp.material_chapa || '', t: 's' };
            sheet[`K${row}`] = { v: comp.pdf_path || '', t: 's' };
        });
        const templateFilled = XLSX.write(workbook, { type: 'buffer', bookType: 'xls' });

        const summaryWb = new ExcelJS.Workbook();
        const ws = summaryWb.addWorksheet('Componentes MO0013');
        ws.columns = [ { header: 'Cód Componente', key: 'cod', width: 20 }, { header: 'Descrição', key: 'desc', width: 40 }, { header: 'Qtde Requerida', key: 'qtd', width: 15 }, { header: 'Material Chapa MTC', key: 'chapa', width: 22 }, { header: 'Endereço PDF', key: 'pdf', width: 55 } ];
        components.forEach(comp => ws.addRow({ cod: comp.cod_componente, desc: comp.descricao || '', qtd: parseFloat(comp.qtd_requerida), chapa: comp.material_chapa || '', pdf: comp.pdf_path || '' }));
        const summaryBuffer = await summaryWb.xlsx.writeBuffer();

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="Corte-Laser_${id.trim()}.zip"`);
        const archive = archiver('zip', { zlib: { level: 6 } });
        archive.pipe(res);
        archive.append(Buffer.from(templateFilled), { name: `Espelho-OS-Corte_${id.trim()}.xls` });
        archive.append(Buffer.from(summaryBuffer), { name: `Componentes-MO0013_${id.trim()}.xlsx` });
        await archive.finalize();
    } catch (err) {
        console.error('[Export Laser Error]', err);
        if (!res.headersSent) res.status(500).json({ error: 'Erro ao gerar exportação laser', details: err.message });
    }
});

router.post('/pcp-lotes', async (req, res) => {
    try {
        const { itens, observacao, criador } = req.body;
        if (!itens || itens.length === 0) return res.status(400).json({ error: 'Nenhum item selecionado para o lote.' });
        const dateStr = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
        const loteRef = `LOTE-${dateStr}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const connection = await mysqlPool.getConnection();
        try {
            await connection.beginTransaction();
            const [loteResult] = await connection.query(`INSERT INTO app_pcp_lotes (lote_ref, created_by, observacao, status) VALUES (?, ?, ?, 'ABERTO')`, [loteRef, criador || 'PCP', observacao || '']);
            for (const item of itens) await connection.query(`INSERT INTO app_pcp_lote_itens (lote_id, pedido, item, codigo, qtd_liberada) VALUES (?, ?, ?, ?, ?)`, [loteResult.insertId, item.pedido, item.item, item.codigo, item.quantidade || 0]);
            await connection.commit();
            res.json({ success: true, lote_id: loteResult.insertId, lote_ref: loteRef });
        } catch (err) { await connection.rollback(); throw err; } finally { connection.release(); }
    } catch (error) { res.status(500).json({ error: 'Erro ao criar lote de produção', details: error.message }); }
});

router.get('/pcp-lotes', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(`SELECT l.*, COUNT(i.id) as total_itens FROM app_pcp_lotes l LEFT JOIN app_pcp_lote_itens i ON i.lote_id = l.id GROUP BY l.id ORDER BY l.created_at DESC LIMIT 50`);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: 'Erro ao buscar lotes', details: error.message }); }
});

router.put('/import-pcp-date', async (req, res) => {
    try {
        const { pedido, item, produto, dataPcp } = req.body;
        if (!pedido) return res.status(400).json({ error: 'Pedido é obrigatório.' });
        const formattedPedido = String(pedido).trim().padStart(6, '0');
        const formattedItem = item ? String(item).trim().padStart(2, '0') : null;
        const formattedDate = dataPcp ? String(dataPcp).trim() : null;
        if (!formattedDate) return res.json({ success: true, message: 'Sem data para atualizar' });
        let resolvedItem = formattedItem, saldo_fat = 0;
        const pgClient = await db.connect();
        try {
            let sql = `SELECT TRIM(c6_item) as item, (COALESCE(c6_qtdven::numeric, 0) - COALESCE(c6_qtdent::numeric, 0)) as saldo_fat FROM sc6010 WHERE c6_num = $1 AND COALESCE(d_e_l_e_t_, '') = ''`;
            let params = [formattedPedido];
            if (formattedItem) { sql += ` AND c6_item = $2`; params.push(formattedItem); } else if (produto) { sql += ` AND c6_produto = $2`; params.push(produto); }
            sql += ` LIMIT 1`;
            const result = await pgClient.query(sql, params);
            if (result.rows.length > 0) { resolvedItem = result.rows[0].item; saldo_fat = Math.max(0, result.rows[0].saldo_fat || 0); }
        } finally { pgClient.release(); }
        const finalItem = resolvedItem || '01';
        const [existing] = await mysqlPool.query('SELECT id FROM app_pcp_delivery_forecasts WHERE pedido = ? AND item = ? ORDER BY id DESC LIMIT 1', [formattedPedido, finalItem]);
        if (existing.length > 0) await mysqlPool.query('UPDATE app_pcp_delivery_forecasts SET data_entrega_pcp = ?, quantidade_pcp = ? WHERE id = ?', [formattedDate, saldo_fat, existing[0].id]);
        else await mysqlPool.query('INSERT INTO app_pcp_delivery_forecasts (pedido, item, data_entrega_pcp, quantidade_pcp, usuario) VALUES (?, ?, ?, ?, ?)', [formattedPedido, finalItem, formattedDate, saldo_fat, 'SISTEMA_PLANILHA']);
        res.json({ success: true, item: finalItem, quantidade_pcp: saldo_fat });
    } catch (error) { res.status(500).json({ error: 'Erro ao atualizar data', details: error.message }); }
});

router.get('/portal-cliente', async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = Math.min(parseInt(req.query.limit, 10) || 10000, 20000);
        const offset = (page - 1) * limit;

        const { cliente, pedido, produto, pedcli, refCliente, dataInicial, dataFinal, dateType = 'pedido', only_active = 'false', somente_prioridades = 'false' } = req.query;

        const auth = await getAuthorizedOrders(req);
        let extraFilters = '';

        // Filtrar pedidos inativos (app_pedidos_inativos)
        try {
            const getInactiveFilter = await getInactiveOrdersFilter();
            extraFilters += getInactiveFilter('c5.c5_num');
        } catch (inactiveErr) {
            console.error('[Portal Cliente] Erro ao obter filtro de inativos:', inactiveErr.message);
        }

        if (cliente) {
            const safe = cliente.replace(/'/g, "''");
            if (safe) extraFilters += ` AND (TRIM(sa1.a1_nome) ILIKE '%${safe}%' OR TRIM(c5.c5_cliente) ILIKE '%${safe}%')`;
        }

        if (pedido) {
            const terms = String(pedido)
                .split(',')
                .map(t => t.replace(/'/g, "''").trim())
                .filter(Boolean);

            if (terms.length > 0) {
                const clauses = terms.map(term => {
                    const clean = term.replace(/^0+/, '') || term;
                    const padded = clean.length <= 6 ? clean.padStart(6, '0') : clean;
                    return `(TRIM(c5.c5_num) ILIKE '%${term}%' OR TRIM(c5.c5_num) ILIKE '%${clean}%' OR TRIM(c5.c5_num) ILIKE '%${padded}%')`;
                });
                extraFilters += ` AND (${clauses.join(' OR ')})`;
            }
        }

        if (produto) {
            const safe = produto.replace(/[^a-zA-Z0-9-]/g, '');
            if (safe) extraFilters += ` AND c6.c6_produto LIKE '${safe}%'`;
        }

        if (pedcli) {
            const terms = String(pedcli)
                .split(',')
                .map(t => t.replace(/'/g, "''").trim())
                .filter(Boolean);

            if (terms.length > 0) {
                const clauses = terms.map(term => {
                    const clean = term.replace(/^0+/, '') || term;
                    const padded = clean.length <= 6 ? clean.padStart(6, '0') : clean;
                    return `(TRIM(c6.c6_pedcli) ILIKE '%${term}%' OR TRIM(c6.c6_pedcli) ILIKE '%${clean}%' OR TRIM(c6.c6_pedcli) ILIKE '%${padded}%')`;
                });
                extraFilters += ` AND (${clauses.join(' OR ')})`;
            }
        } else {
            // Por padrão, Ordem de Compra = "PRODUÇÃO" não deve ser mostrada no canal do cliente
            extraFilters += ` AND (TRIM(COALESCE(c6.c6_pedcli, '')) NOT ILIKE '%PRODUÇÃO%' AND TRIM(COALESCE(c6.c6_pedcli, '')) NOT ILIKE '%PRODUCAO%')`;
        }

        if (refCliente) {
            const rawTerms = String(refCliente).split(',').map(t => t.trim()).filter(Boolean);
            const clauses = [];
            for (const raw of rawTerms) {
                const clean = raw.replace(/[^a-zA-Z0-9]/g, '');
                if (clean) {
                    clauses.push(`REGEXP_REPLACE(TRIM(sz1.z1_codcli), '[^a-zA-Z0-9]', '', 'g') ILIKE '%${clean}%'`);
                }
            }
            if (clauses.length > 0) {
                extraFilters += ` AND EXISTS (
                    SELECT 1 FROM public.sz1010 sz1 
                    WHERE sz1.z1_produto = c6.c6_produto 
                      AND (${clauses.join(' OR ')})
                      AND COALESCE(sz1.d_e_l_e_t_, '') = ''
                )`;
            }
        }

        if (dataInicial || dataFinal) {
            if (dateType === 'pcp') {
                try {
                    let pcpSql = 'SELECT DISTINCT pedido, item FROM app_pcp_delivery_forecasts WHERE 1=1';
                    const pcpParams = [];
                    if (dataInicial) {
                        pcpSql += ' AND data_entrega_pcp >= ?';
                        pcpParams.push(dataInicial);
                    }
                    if (dataFinal) {
                        pcpSql += ' AND data_entrega_pcp <= ?';
                        pcpParams.push(dataFinal);
                    }
                    const [pcpRows] = await mysqlPool.execute(pcpSql, pcpParams);
                    if (pcpRows.length > 0) {
                        const pairs = pcpRows.map(r => `('${String(r.pedido).trim().padEnd(6, ' ')}', '${String(r.item).trim().padEnd(2, ' ')}')`).join(',');
                        extraFilters += ` AND (c5.c5_num, c6.c6_item) IN (${pairs})`;
                    } else {
                        extraFilters += ` AND 1=0`;
                    }
                } catch (pcpErr) {
                    console.warn('[Portal Cliente] Erro no filtro por Data PCP:', pcpErr.message);
                }
            } else if (dateType === 'nf') {
                const fmt = (d) => d ? d.replace(/-/g, '') : null;
                let nfSub = `EXISTS (
                    SELECT 1 FROM public.sd2010 d2 
                    JOIN public.sf2010 f2 ON f2.f2_doc = d2.d2_doc AND f2.f2_serie = d2.d2_serie AND COALESCE(f2.d_e_l_e_t_, '') = ''
                    WHERE d2.d2_pedido = c5.c5_num 
                      AND d2.d2_itempv = c6.c6_item 
                      AND COALESCE(d2.d_e_l_e_t_, '') = ''`;
                if (dataInicial) nfSub += ` AND f2.f2_emissao >= '${fmt(dataInicial)}'`;
                if (dataFinal)   nfSub += ` AND f2.f2_emissao <= '${fmt(dataFinal)}'`;
                nfSub += `)`;
                extraFilters += ` AND ${nfSub}`;
            } else {
                const colMap = { pedido: 'c5.c5_emissao', entrega: 'c6.c6_entreg' };
                const col = colMap[dateType] || 'c5.c5_emissao';
                const fmt = (d) => d ? d.replace(/-/g, '') : null;
                if (dataInicial) extraFilters += ` AND ${col} >= '${fmt(dataInicial)}'`;
                if (dataFinal)   extraFilters += ` AND ${col} <= '${fmt(dataFinal)}'`;
            }
        }

        if (only_active === 'true') {
            extraFilters += ` AND (COALESCE(c6.c6_qtdven,0) - COALESCE(c6.c6_qtdent,0)) > 0`;
        }

        if (somente_prioridades && somente_prioridades !== 'false') {
            try {
                let prioQuery = 'SELECT DISTINCT op_numero FROM app_op_priorities';
                const prioParams = [];
                if (['1', '2', '3', '4'].includes(somente_prioridades)) {
                    prioQuery += ' WHERE prioridade = ?';
                    prioParams.push(parseInt(somente_prioridades));
                }
                const [prioRows] = await mysqlPool.execute(prioQuery, prioParams);
                if (prioRows.length > 0) {
                    const opList = prioRows.map(r => `'${String(r.op_numero).trim()}'`).join(',');
                    // Note: OP is matched to C6 using SC2010. We need to filter orders where (c5_num, c6_item) is in the subquery.
                    extraFilters += ` AND EXISTS (
                        SELECT 1 FROM public.sc2010 sc2
                        WHERE sc2.c2_pedido = c5.c5_num AND sc2.c2_itempv = c6.c6_item
                          AND TRIM(sc2.c2_num) || TRIM(sc2.c2_item) || TRIM(sc2.c2_sequen) IN (${opList})
                          AND COALESCE(sc2.d_e_l_e_t_, '') = ''
                    )`;
                } else {
                    extraFilters += ` AND 1=0`;
                }
            } catch (err) {
                console.error('[Portal Cliente] Erro no filtro somente_prioridades:', err.message);
            }
        }

        let clientFilter = '';
        const params = [];

        if (auth.isExternal && auth.tipoExterno === 'cliente' && auth.idCliente) {
            const clienteIdPadded = auth.idCliente.trim().padEnd(6, ' ');
            params.push(clienteIdPadded);
            clientFilter += ` AND c5.c5_cliente = $${params.length}`;
            if (auth.lojaCliente) {
                const lojaPadded = auth.lojaCliente.trim().padEnd(4, ' ');
                params.push(lojaPadded);
                clientFilter += ` AND c5.c5_lojacli = $${params.length}`;
            }
        } else if (auth.isExternal && auth.allowedOrders.length > 0) {
            const sanitized = auth.allowedOrders.filter(o => /^[a-zA-Z0-9]+$/.test(o));
            if (sanitized.length > 0) {
                const inList = sanitized.map(o => `'${o.padEnd(6, ' ')}'`).join(',');
                clientFilter += ` AND c5.c5_num IN (${inList})`;
            }
        }

        const pgClient = await db.connect();
        let itemRows = [], nfRows = [];

        try {
            await pgClient.query("SET statement_timeout = '45000';");

            // Query Primary Items
            const itemsResult = await pgClient.query(`
                SELECT TRIM(c5.c5_num) AS pedido, TRIM(c6.c6_item) AS item, TRIM(c6.c6_produto) AS produto,
                    TRIM(COALESCE(c6.c6_um, '')) AS unidade,
                    TRIM(COALESCE(c6.c6_entreg, '')) AS entrega_raw,
                    TRIM(COALESCE(c5.c5_emissao, '')) AS emissao_raw,
                    TRIM(COALESCE(c5.c5_cliente, '')) AS cliente_cod,
                    TRIM(COALESCE(c5.c5_lojacli, '')) AS cliente_loja,
                    TRIM(COALESCE(sa1.a1_nome, '')) AS nome_cliente,
                    TRIM(COALESCE(c6.c6_pedcli, '')) AS ped_cliente,
                    TRIM(COALESCE(c6.c6_xrevm, '')) AS rev_produto,
                    TRIM(COALESCE(c6.c6_xrevc, '')) AS rev_cliente,
                    COALESCE(c6.c6_prcven, 0)::numeric(18,4) AS valor_unitario,
                    COALESCE(c6.c6_valor, 0)::numeric(18,4) AS valor_total,
                    NULLIF(TRIM(COALESCE(c5.c5_mennota,'') || ' ' || COALESCE(c5.c5_zobs,'') || ' ' || COALESCE(c5.c5_zobsorc,'')), '') AS observacoes,
                    COALESCE(c6.c6_qtdven, 0)::numeric(18,4) AS qtd_vendida,
                    COALESCE(c6.c6_qtdent, 0)::numeric(18,4) AS qtd_faturada,
                    (COALESCE(c6.c6_qtdven,0) - COALESCE(c6.c6_qtdent,0))::numeric(18,4) AS saldo_faturar
                FROM public.sc5010 c5
                JOIN public.sc6010 c6 ON c6.c6_num = c5.c5_num AND c6.c6_filial = c5.c5_filial AND COALESCE(c6.d_e_l_e_t_, '') = ''
                LEFT JOIN public.sa1010 sa1 ON sa1.a1_cod = c5.c5_cliente AND sa1.a1_loja = c5.c5_lojacli AND COALESCE(sa1.d_e_l_e_t_, '') = ''
                WHERE COALESCE(c5.d_e_l_e_t_, '') = '' AND c5.c5_tipo <> 'B' ${clientFilter} ${extraFilters}
                ORDER BY c5.c5_num DESC, c6.c6_item ASC
                LIMIT ${limit} OFFSET ${offset}
            `, params);

            itemRows = itemsResult.rows;

            if (itemRows.length > 0) {
                // Batch lookup 1: Product Descriptions (SB1010)
                const uniqueProds = [...new Set(itemRows.map(r => String(r.produto).trim()))].map(p => `'${p.padEnd(15, ' ')}'`);
                if (uniqueProds.length > 0) {
                    const sb1Res = await pgClient.query(`
                        SELECT TRIM(b1_cod) as cod, TRIM(b1_desc) as desc
                        FROM public.sb1010
                        WHERE b1_cod IN (${uniqueProds.join(',')}) AND COALESCE(d_e_l_e_t_, '') = ''
                    `);
                    const descMap = new Map();
                    sb1Res.rows.forEach(b => descMap.set(b.cod, b.desc));
                    itemRows.forEach(r => { r.desc_produto = descMap.get(r.produto) || ''; });
                }

                // Batch lookup 2: Ref. Cliente (SZ1010)
                if (uniqueProds.length > 0) {
                    let szSql = `
                        SELECT TRIM(z1_produto) as produto, TRIM(z1_codcli) as ref_cliente
                        FROM public.sz1010
                        WHERE z1_produto IN (${uniqueProds.join(',')}) AND COALESCE(d_e_l_e_t_, '') = ''
                    `;
                    const szParams = [];
                    if (auth.idCliente) {
                        const cliPadded = auth.idCliente.trim().padEnd(6, ' ');
                        szParams.push(cliPadded);
                        szSql += ` AND z1_cliente = $1`;
                    }
                    const szRes = await pgClient.query(szSql, szParams);
                    const refMap = new Map();
                    szRes.rows.forEach(z => refMap.set(z.produto, z.ref_cliente));
                    itemRows.forEach(r => { r.ref_cliente = refMap.get(r.produto) || ''; });
                }

                // Batch lookup 3: OPs (SC2010)
                const pagePedidos = [...new Set(itemRows.map(r => String(r.pedido).trim()))].map(p => `'${p.padEnd(6, ' ')}'`);
                if (pagePedidos.length > 0) {
                    const opResult = await pgClient.query(`
                        SELECT TRIM(c2_pedido) AS pedido, TRIM(c2_itempv) AS item,
                            SUM(COALESCE(c2_quant, 0))::numeric(18,4) AS total_planejado,
                            SUM(COALESCE(c2_quje, 0))::numeric(18,4) AS total_apontado,
                            true AS tem_op,
                            MIN(TRIM(c2_num)) AS op_num,
                            MIN(TRIM(c2_tpop)) AS op_tipo
                        FROM public.sc2010
                        WHERE COALESCE(d_e_l_e_t_, '') = '' AND c2_pedido IN (${pagePedidos.join(',')})
                        GROUP BY TRIM(c2_pedido), TRIM(c2_itempv)
                    `);
                    const opMap = new Map();
                    opResult.rows.forEach(r => opMap.set(`${r.pedido}|${r.item}`, r));
                    itemRows.forEach(r => {
                        const op = opMap.get(`${r.pedido}|${r.item}`);
                        r.op_num = op ? op.op_num : '';
                        r.op_tipo = op ? op.op_tipo : '';
                        r.op_planejado = op ? op.total_planejado : '0';
                        r.op_apontado = op ? op.total_apontado : '0';
                        r.tem_op = op ? true : false;
                    });
                }

                // Batch lookup 4: NFs (SD2010 + SF2010)
                const uniquePedidos = [...new Set(itemRows.map(r => String(r.pedido).trim()))];
                if (uniquePedidos.length > 0) {
                    let nfWhere = `WHERE d2.d2_pedido = ANY($1::varchar[]) AND COALESCE(d2.d_e_l_e_t_, '') = ''`;
                    if (dateType === 'nf') {
                        const fmt = (d) => d ? d.replace(/-/g, '') : null;
                        if (dataInicial) nfWhere += ` AND f2.f2_emissao >= '${fmt(dataInicial)}'`;
                        if (dataFinal)   nfWhere += ` AND f2.f2_emissao <= '${fmt(dataFinal)}'`;
                    }
                    const nfResult = await pgClient.query(`
                        SELECT TRIM(d2.d2_pedido) AS pedido, TRIM(d2.d2_itempv) AS item, TRIM(d2.d2_doc) AS nota, TRIM(d2.d2_serie) AS serie,
                            TO_CHAR(TO_DATE(NULLIF(TRIM(f2.f2_emissao),''),'YYYYMMDD'),'DD/MM/YY') AS emissao,
                            TO_CHAR(TO_DATE(NULLIF(TRIM(f2.f2_emissao),''),'YYYYMMDD'),'DD/MM/YYYY') AS emissao_nf,
                            TRIM(d2.d2_cod) AS produto, TRIM(COALESCE(sb1nf.b1_desc, '')) AS desc_produto,
                            d2.d2_quant::numeric(18,4) AS qtd_entregue, d2.d2_quant::numeric(18,4) AS qtd,
                            TRIM(COALESCE(d2.d2_um, '')) AS unidade, TRIM(COALESCE(d2.d2_cf, '')) AS cfop, '' AS natureza,
                            TRIM(COALESCE(f2.f2_transp, '')) AS transportadora
                        FROM public.sd2010 d2
                        JOIN public.sf2010 f2 ON f2.f2_doc = d2.d2_doc AND f2.f2_serie = d2.d2_serie AND COALESCE(f2.d_e_l_e_t_, '') = ''
                        LEFT JOIN public.sb1010 sb1nf ON sb1nf.b1_cod = d2.d2_cod AND COALESCE(sb1nf.d_e_l_e_t_, '') = ''
                        ${nfWhere}
                        ORDER BY f2.f2_emissao DESC, d2.d2_pedido DESC, d2.d2_itempv ASC
                    `, [uniquePedidos]);
                    nfRows = nfResult.rows;
                }
            }
        } finally {
            pgClient.release();
        }

        // Buscar solicitações de faturamento em aberto no MySQL
        const openBillingSet = new Set();
        try {
            const [openSols] = await mysqlPool.query(`
                SELECT DISTINCT TRIM(i.pedido) AS pedido, TRIM(i.item) AS item 
                FROM app_faturamento_solicitacao_itens i
                JOIN app_faturamento_solicitacoes s ON i.solicitacao_id = s.id
                WHERE s.status NOT IN ('Atendido', 'Cancelado')
            `);
            openSols.forEach(os => {
                openBillingSet.add(`${os.pedido}|${os.item}`);
            });
        } catch (mySqlErr) {
            console.error('[Portal Cliente] Erro ao buscar solicitacoes de faturamento em aberto:', mySqlErr);
        }

        // Batch lookup 5: Desenhos / Documentos do MySQL (produtos_docs)
        const docMap = new Map();
        if (itemRows.length > 0) {
            const uniqueProdsClean = [...new Set(itemRows.map(r => String(r.produto).trim()).filter(Boolean))];
            if (uniqueProdsClean.length > 0) {
                try {
                    const phs = uniqueProdsClean.map(() => '?').join(',');
                    const [docs] = await mysqlPool.execute(
                        `SELECT TRIM(produto_codigo) AS produto_codigo, url_arquivo, tipo FROM produtos_docs WHERE produto_codigo IN (${phs}) ORDER BY id ASC`,
                        uniqueProdsClean
                    );
                    docs.forEach(d => {
                        const code = String(d.produto_codigo).trim();
                        if (!docMap.has(code)) {
                            docMap.set(code, d.url_arquivo);
                        }
                        if (String(d.tipo || '').toLowerCase().includes('desenho')) {
                            docMap.set(code, d.url_arquivo);
                        }
                    });
                } catch (docErr) {
                    console.warn('[Portal Cliente] Erro ao buscar desenhos de produtos:', docErr.message);
                }
            }
        }

        const forecastMap = await getForecastMapCached();
        const parseERP = (dStr) => { if (!dStr || dStr.trim().length < 8) return null; const s = dStr.trim(); return `${s.substring(6,8)}/${s.substring(4,6)}/${s.substring(0,4)}`; };

        const formatPcpDate = (d) => {
            if (!d) return null;
            if (d instanceof Date) {
                if (isNaN(d.getTime())) return null;
                const day = String(d.getUTCDate()).padStart(2, '0');
                const month = String(d.getUTCMonth() + 1).padStart(2, '0');
                const year = d.getUTCFullYear();
                return `${day}/${month}/${year}`;
            }
            const s = String(d).trim();
            if (s.includes('-')) {
                const parts = s.substring(0, 10).split('-');
                if (parts.length === 3 && parts[0].length === 4) {
                    return `${parts[2]}/${parts[1]}/${parts[0]}`;
                }
            }
            if (s.length === 8 && /^\d{8}$/.test(s)) {
                return `${s.substring(6, 8)}/${s.substring(4, 6)}/${s.substring(0, 4)}`;
            }
            const parsed = new Date(s);
            if (!isNaN(parsed.getTime())) {
                const day = String(parsed.getUTCDate()).padStart(2, '0');
                const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
                const year = parsed.getUTCFullYear();
                if (year > 2000) return `${day}/${month}/${year}`;
            }
            return s || null;
        };

        const finalItems = itemRows.map(row => {
            const key = `${String(row.pedido).trim()}|${String(row.item).trim()}`;
            const fc = forecastMap.get(key);
            const planejado = parseFloat(row.op_planejado) || 0;
            const apontado = parseFloat(row.op_apontado) || 0;
            const percentual = planejado > 0 ? Math.min(100, Math.round((apontado / planejado) * 100)) : 0;
            const saldo = parseFloat(row.saldo_faturar) || 0;
            const qtdFaturada = parseFloat(row.qtd_faturada) || 0;
            const hasOpenBilling = openBillingSet.has(key);

            let status = 'AGUARDANDO';
            if (saldo <= 0 && qtdFaturada > 0) status = 'ENTREGUE';
            else if (hasOpenBilling) status = 'FATURAMENTO_SOLICITADO';
            else if (row.tem_op) status = percentual >= 100 ? 'PRODUCAO_CONCLUIDA' : apontado > 0 ? 'EM_PRODUCAO' : 'OP_ABERTA';
            else status = 'AGUARDANDO_OP';

            return {
                pedido: row.pedido,
                item: row.item,
                produto: row.produto,
                desenho_url: docMap.get(String(row.produto).trim()) || null,
                desc_produto: row.desc_produto || '',
                unidade: row.unidade,
                data_emissao: parseERP(row.emissao_raw),
                entrega: parseERP(row.entrega_raw),
                emissao_raw: row.emissao_raw,
                entrega_raw: row.entrega_raw,
                nome_cliente: row.nome_cliente,
                ped_cliente: row.ped_cliente,
                ref_cliente: row.ref_cliente || '',
                rev_produto: row.rev_produto,
                rev_cliente: row.rev_cliente,
                valor_unitario: parseFloat(row.valor_unitario),
                valor_total: parseFloat(row.valor_total),
                observacoes: row.observacoes,
                qtd_vendida: parseFloat(row.qtd_vendida),
                qtd_faturada: qtdFaturada,
                saldo_faturar: saldo,
                tem_op: row.tem_op,
                data_pcp: fc ? formatPcpDate(fc.data_entrega_pcp) : null,
                qtd_pcp: fc ? (parseFloat(fc.quantidade_pcp) || 0) : 0,
                status,
            };
        });

        const finalEntregas = (nfRows || []).map(nf => ({
            pedido: nf.pedido,
            item: nf.item,
            nota: nf.nota,
            serie: nf.serie,
            emissao: nf.emissao,
            emissao_nf: nf.emissao_nf,
            produto: nf.produto,
            desc_produto: nf.desc_produto,
            qtd_entregue: parseFloat(nf.qtd_entregue) || 0,
            qtd: parseFloat(nf.qtd) || 0,
            unidade: nf.unidade,
            cfop: nf.cfop,
            natureza: nf.natureza,
            transportadora: nf.transportadora,
        }));

        res.json({
            items: finalItems,
            entregas: finalEntregas,
            meta: { page, limit, hasNextPage: itemRows.length === limit },
        });
    } catch (err) {
        console.error('[Portal Cliente] Erro:', err);
        res.status(500).json({ error: 'Erro ao carregar dados do portal.', details: err.message });
    }
});

module.exports = router;
