const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const db = require('../db');
const { analisarRelatorioFCS } = require('../services/geminiPcpService');
const { runFcsSequencing } = require('../services/fcsEngine');
const { rebuildDailyOccupancyCache } = require('../services/occupancyCacheService');
const { getInactiveOrdersFilter } = require('../util/pedidoFilterHelper');

// ── Forecast cache (módulo) — TTL 60s, evita fetch MySQL por requisição ────
let _fcCache = { map: new Map(), expiresAt: 0 };
async function getForecastMapCached() {
    if (Date.now() < _fcCache.expiresAt) return _fcCache.map;
    const map = new Map();
    try {
        const [rows] = await mysqlPool.query(`
            SELECT TRIM(pedido) as pedido, TRIM(item) as item,
                   MAX(data_entrega_pcp) as data_entrega_pcp,
                   MAX(data_prevista_faturamento) as data_prevista_faturamento
            FROM app_pcp_delivery_forecasts
            WHERE pedido IS NOT NULL AND item IS NOT NULL
            GROUP BY TRIM(pedido), TRIM(item)
        `);
        for (const row of rows) {
            map.set(`${row.pedido}|${row.item}`, {
                data_entrega_pcp: row.data_entrega_pcp || null,
                data_prevista_faturamento: row.data_prevista_faturamento || null
            });
        }
    } catch (err) {
        console.error('getForecastMapCached error:', err.message);
    }
    _fcCache = { map, expiresAt: Date.now() + 60_000 };
    return map;
}

// GET /api/pcp-refinado/recursos - Fetch all resources from Protheus and their capacities from MySQL
router.get('/recursos', async (req, res) => {
    let pgClient;
    try {
        // 1. Fetch from PostgreSQL (Protheus)
        pgClient = await db.connect();
        const pgQuery = `
            SELECT DISTINCT 
                TRIM(h1.h1_codigo) AS cod_recurso,
                TRIM(h1.h1_descri) AS desc_recurso
            FROM public.sh1010 h1
            WHERE COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
            AND TRIM(h1.h1_codigo) <> ''
            ORDER BY TRIM(h1.h1_codigo)
        `;
        const pgResult = await pgClient.query(pgQuery);
        const protheusRecursos = pgResult.rows;

        // 2. Fetch from MySQL (Local Capacities)
        const [mysqlResult] = await mysqlPool.query('SELECT recurso_codigo, tempo_padrao_minutos, capacidade_diaria_minutos, ordem_exibicao FROM app_recursos_capacidade');
        
        const configMap = {};
        mysqlResult.forEach(row => {
            configMap[row.recurso_codigo] = row;
        });

        // 3. Merge
        const merged = protheusRecursos.map(r => {
            const conf = configMap[r.cod_recurso] || {};
            return {
                cod_recurso: r.cod_recurso,
                desc_recurso: r.desc_recurso,
                tempo_padrao_minutos: conf.tempo_padrao_minutos || 0,
                capacidade_diaria_minutos: conf.capacidade_diaria_minutos || 0,
                ordem_exibicao: conf.ordem_exibicao || 0
            };
        });

        res.json(merged);
    } catch (error) {
        console.error('❌ [PCP REFINADO] Error fetching recursos:', error);
        res.status(500).json({ error: 'Erro ao buscar recursos: ' + error.message });
    } finally {
        if (pgClient) pgClient.release();
    }
});

// POST /api/pcp-refinado/recursos - Upsert capacity for a resource
router.post('/recursos', async (req, res) => {
    try {
        const { recurso_codigo, tempo_padrao_minutos, capacidade_diaria_minutos, ordem_exibicao } = req.body;
        
        if (!recurso_codigo) {
            return res.status(400).json({ error: 'O código do recurso é obrigatório' });
        }

        const query = `
            INSERT INTO app_recursos_capacidade (recurso_codigo, tempo_padrao_minutos, capacidade_diaria_minutos, ordem_exibicao)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                tempo_padrao_minutos = VALUES(tempo_padrao_minutos),
                capacidade_diaria_minutos = VALUES(capacidade_diaria_minutos),
                ordem_exibicao = VALUES(ordem_exibicao)
        `;

        await mysqlPool.query(query, [recurso_codigo, tempo_padrao_minutos || 0, capacidade_diaria_minutos || 0, ordem_exibicao || 0]);
        
        res.json({ message: 'Capacidade atualizada com sucesso' });
    } catch (error) {
        console.error('❌ [PCP REFINADO] Error saving recurso:', error);
        res.status(500).json({ error: 'Erro ao salvar capacidade: ' + error.message });
    }
});

// GET /api/pcp-refinado/taxa-ocupacao - Calculate daily occupation rate (using cached table)
router.get('/taxa-ocupacao', async (req, res) => {
    try {
        const { data_inicio, data_fim, recurso } = req.query;
        let query = `
            SELECT DATE_FORMAT(data, '%Y-%m-%d') AS data, recurso_codigo, recurso_descri, minutos_consumidos, minutos_totais, minutos_executados, minutos_pendentes, capacidade_diaria, taxa_ocupacao, percentual_executado
            FROM app_recursos_ocupacao_diaria
            WHERE 1=1
        `;
        const params = [];
        if (data_inicio) {
            query += ` AND data >= ?`;
            params.push(data_inicio);
        }
        if (data_fim) {
            query += ` AND data <= ?`;
            params.push(data_fim);
        }
        if (recurso) {
            query += ` AND (recurso_codigo LIKE ? OR recurso_descri LIKE ?)`;
            params.push(`%${recurso.trim()}%`, `%${recurso.trim()}%`);
        }
        query += ` ORDER BY data ASC, taxa_ocupacao DESC`;
        const [rows] = await mysqlPool.query(query, params);

        // Fetch cache build metadata timestamp
        try {
            const [meta] = await mysqlPool.query('SELECT MAX(ultima_atualizacao) AS last_update FROM app_recursos_ocupacao_diaria');
            if (meta && meta[0] && meta[0].last_update) {
                const ts = new Date(meta[0].last_update).toISOString();
                res.setHeader('Access-Control-Expose-Headers', 'X-Cache-Updated-At');
                res.setHeader('X-Cache-Updated-At', ts);
            }
        } catch (metaErr) {
            console.error('Error fetching cache timestamp metadata:', metaErr.message);
        }

        res.json(rows);
    } catch (err) {
        console.error('Error fetching occupancy cache:', err);
        res.status(500).json({ error: 'Erro ao buscar taxas de ocupação do cache: ' + err.message });
    }
});

// GET /api/pcp-refinado/taxa-ocupacao/ops - Fetch OPs dynamically for a single day & resource
router.get('/taxa-ocupacao/ops', async (req, res) => {
    let pgClient;
    try {
        const { data, recurso, only_active = 'false' } = req.query;
        if (!data || !recurso) {
            return res.status(400).json({ error: 'Parâmetros data e recurso são obrigatórios.' });
        }

        const targetDateStr = data.replace(/-/g, ''); // YYYYMMDD
        
        pgClient = await db.connect();

        // 1. Fetch planning rows for this resource covering targetDate
        const planQuery = `
            SELECT op_numero, op_item, op_sequencia, operacao_codigo, data_planejada_inicio, data_planejada_fim 
            FROM app_production_planning 
            WHERE recurso_codigo = ? 
              AND data_planejada_inicio <= ? 
              AND data_planejada_fim >= ?
              AND op_numero != '000000' AND op_numero != '-'
        `;
        const targetDayStart = `${data} 00:00:00`;
        const targetDayEnd = `${data} 23:59:59`;
        const [planRows] = await mysqlPool.query(planQuery, [recurso, targetDayEnd, targetDayStart]);

        if (planRows.length === 0) {
            return res.json([]);
        }

        // 2. Fetch OP details from Postgres
        const opNums = [...new Set(planRows.map(r => r.op_numero).filter(Boolean))];
        let pgWhere = `
            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
              AND c2.c2_quje < c2.c2_quant
              AND c2.c2_num = ANY($1)
        `;
        if (only_active === 'true') {
            pgWhere += ` AND (COALESCE(c5.c5_nota,'')='' OR EXISTS (
                SELECT 1 FROM public.sc6010 c6
                WHERE c6.c6_num=c5.c5_num AND c6.c6_filial=c5.c5_filial
                AND COALESCE(c6.d_e_l_e_t_,'')=''
                AND ((c6.c6_qtdven-c6.c6_qtdent)>0 OR c6.c6_qtdlib>0)))`;
        }

        const pgResult = await pgClient.query(`
            SELECT TRIM(c2.c2_num) AS op_num, TRIM(c2.c2_item) AS item_op,
                   TRIM(c2.c2_produto) AS produto, TRIM(c2.c2_pedido) AS pedido,
                   TRIM(c2.c2_itempv) AS item_pedido, c2.c2_quant AS qtde, c2.c2_quje AS qtde_feita,
                   TRIM(a1.a1_nome) AS cliente_nome
            FROM public.sc2010 c2
            LEFT JOIN public.sc5010 c5 ON TRIM(c5.c5_num)=TRIM(c2.c2_pedido) AND COALESCE(c5.d_e_l_e_t_,'') IN ('',' ')
            LEFT JOIN public.sa1010 a1 ON TRIM(a1.a1_cod)=TRIM(c5.c5_cliente) AND COALESCE(a1.d_e_l_e_t_,'') IN ('',' ')
            ${pgWhere}
        `, [opNums]);
        
        const opRows = pgResult.rows;
        const opMap = {};
        opRows.forEach(r => {
            opMap[`${r.op_num}|${r.item_op}`] = r;
        });

        // 3. Fetch routing for matching products
        const distinctProds = [...new Set(opRows.map(r => r.produto).filter(Boolean))];
        let routingRows = [];
        if (distinctProds.length > 0) {
            const pgRouting = await pgClient.query(`
                SELECT TRIM(g2.g2_produto) prod, TRIM(g2.g2_operac) operac,
                       TRIM(g2.g2_recurso) recurso, g2.g2_tempad tempo,
                       TRIM(h1.h1_descri) recurso_descri
                FROM public.sg2010 g2
                LEFT JOIN public.sh1010 h1 ON TRIM(h1.h1_codigo)=TRIM(g2.g2_recurso) AND COALESCE(h1.d_e_l_e_t_,'') IN ('',' ')
                WHERE TRIM(g2.g2_produto) = ANY($1)
                  AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
            `, [distinctProds]);
            routingRows = pgRouting.rows;
        }

        const routingMap = {};
        routingRows.forEach(r => {
            if (!routingMap[r.prod]) routingMap[r.prod] = {};
            // g2_tempad é armazenado em minutos no Protheus
            routingMap[r.prod][r.operac] = { recurso_codigo: r.recurso, recurso_descri: r.recurso_descri || r.recurso, tempo: Math.round((parseFloat(r.tempo) || 0) * 1000) / 1000 };
        });

        // Fetch appointments (MySQL)
        const [appts] = await mysqlPool.query(`
            SELECT op_numero, op_item, op_sequencia, operacao_codigo, SUM(quantidade) AS total
            FROM app_production_appointments
            WHERE op_numero IN (?)
            GROUP BY op_numero, op_item, op_sequencia, operacao_codigo
        `, [opNums]);
        const apptsMap = {};
        appts.forEach(a => {
            apptsMap[`${(a.op_numero||'').trim()}|${(a.op_item||'').trim()}|${(a.op_sequencia||'').trim()}|${(a.operacao_codigo||'').trim()}`] = parseFloat(a.total) || 0;
        });

        // Fetch config (MySQL)
        const [configs] = await mysqlPool.query('SELECT recurso_codigo, tempo_padrao_minutos, capacidade_diaria_minutos FROM app_recursos_capacidade');
        const configMap = {};
        configs.forEach(c => {
            configMap[c.recurso_codigo] = c;
        });

        // Fetch sales orders status (exclude faturados if only_active is true)
        const [inativosResult] = await mysqlPool.query('SELECT pedido_numero FROM app_pedidos_inativos');
        const inativosSet = new Set(inativosResult.map(r => r.pedido_numero.trim()));

        const getBusinessDaysBetween = (startStr, endStr) => {
            if (!startStr) return [];
            if (!endStr || endStr < startStr) return [startStr];
            const y1 = parseInt(startStr.substring(0,4));
            const m1 = parseInt(startStr.substring(4,6)) - 1;
            const d1 = parseInt(startStr.substring(6,8));
            const y2 = parseInt(endStr.substring(0,4));
            const m2 = parseInt(endStr.substring(4,6)) - 1;
            const d2 = parseInt(endStr.substring(6,8));
            let current = new Date(y1, m1, d1, 12, 0, 0);
            const end = new Date(y2, m2, d2, 12, 0, 0);
            if (isNaN(current.getTime()) || isNaN(end.getTime())) return [startStr];
            const dates = [];
            while (current <= end) {
                const day = current.getDay();
                if (day !== 0 && day !== 6) { // Skip weekends
                    dates.push(`${current.getFullYear()}${String(current.getMonth() + 1).padStart(2, '0')}${String(current.getDate()).padStart(2, '0')}`);
                }
                current.setDate(current.getDate() + 1);
            }
            return dates.length > 0 ? dates : [startStr];
        };

        const opsList = [];

        const fmtDate = (val) => {
            if (!val) return '';
            if (typeof val === 'string') return val.replace(/-/g,'').substring(0,8);
            if (val instanceof Date) {
                return `${val.getFullYear()}${String(val.getMonth()+1).padStart(2,'0')}${String(val.getDate()).padStart(2,'0')}`;
            }
            return '';
        };

        for (const plan of planRows) {
            const opn = (plan.op_numero || '').trim();
            const itn = (plan.op_item || '').trim();
            const opcn = (plan.operacao_codigo || '').trim();

            const opRow = opMap[`${opn}|${itn}`];
            if (!opRow) continue;
            if (opRow.pedido && inativosSet.has(opRow.pedido)) continue;

            const prodRouting = routingMap[opRow.produto] || {};
            const routeEntry  = prodRouting[opcn];
            if (!routeEntry) continue;

            const pIni = fmtDate(plan.data_planejada_inicio);
            const pFim = fmtDate(plan.data_planejada_fim);
            if (!pIni || !pFim) continue;

            const conf = configMap[recurso] || {};
            const g2_minutos = parseFloat(routeEntry.tempo) || 0;
            const unitTimeMin = g2_minutos > 0 ? g2_minutos : (parseFloat(conf.tempo_padrao_minutos) || 0);

            const apptKey = `${opn}|${itn}|${(plan.op_sequencia||'').trim()}|${opcn}`;
            const qtde_apontada = apptsMap[apptKey] || 0;
            const qtde_total    = Number(opRow.qtde) || 0;
            const qtde_feita    = qtde_apontada > 0 ? qtde_apontada : (Number(opRow.qtde_feita) || 0);
            const qtde_pendente = Math.max(0, qtde_total - qtde_feita);

            const min_totais = qtde_total * unitTimeMin;
            const min_exec   = Math.min(qtde_feita, qtde_total) * unitTimeMin;
            const min_pend   = qtde_pendente * unitTimeMin;
            const capacity   = conf.capacidade_diaria_minutos || 480;

            const bDays = getBusinessDaysBetween(pIni, pFim);
            if (!bDays.includes(targetDateStr)) continue;

            let remaining_totais = min_totais;
            let target_alloc_totais = 0;
            let target_alloc_exec = 0;
            let target_alloc_pend = 0;

            for (let i = 0; i < bDays.length; i++) {
                const d = bDays[i];
                let alloc_totais = (i === bDays.length - 1) ? remaining_totais : Math.min(remaining_totais, capacity);
                let alloc_exec = (min_totais > 0) ? (alloc_totais / min_totais) * min_exec : 0;
                let alloc_pend = (min_totais > 0) ? (alloc_totais / min_totais) * min_pend : 0;

                remaining_totais -= alloc_totais;

                if (d === targetDateStr) {
                    target_alloc_totais = alloc_totais;
                    target_alloc_exec = alloc_exec;
                    target_alloc_pend = alloc_pend;
                    break;
                }
            }

            opsList.push({
                op: opn,
                operacao: opcn,
                item_op: itn,
                sequen: (plan.op_sequencia||'').trim(),
                recurso: recurso,
                produto: opRow.produto,
                pedido: opRow.pedido || '',
                item_pedido: opRow.item_pedido || '',
                cliente: opRow.cliente_nome || '',
                data_planejada: pIni,
                data_planejada_final: pFim,
                qtde_total,
                qtde_feita,
                qtde_pendente,
                tempo_unitario_min: unitTimeMin,
                minutos_totais_op: target_alloc_totais,
                minutos_executados_op: target_alloc_exec,
                minutos_pendentes_op: target_alloc_pend,
                minutos_estimados: target_alloc_pend
            });
        }

        res.json(opsList);
    } catch (err) {
        console.error('Error in dynamic ops endpoint:', err);
        res.status(500).json({ error: 'Erro ao buscar detalhamento de OPs: ' + err.message });
    } finally {
        if (pgClient) pgClient.release();
    }
});

// Atualizar Datas Planejadas da OP
router.put('/op/:op/dates', async (req, res) => {
    const { op } = req.params;
    const { data_inicio, data_fim, operacao_codigo, item_op, sequen, pedido, item_pedido, produto } = req.body;
    let pgClient = null;

    try {
        if (!op || (!data_inicio && !data_fim)) {
            return res.status(400).json({ error: 'OP e pelo menos uma data sao obrigatorios.' });
        }
        pgClient = await db.connect();

        let pgQuery = `
            SELECT 
                TRIM(c2.c2_num)     AS op_num,
                TRIM(c2.c2_item)    AS item_op,
                TRIM(c2.c2_sequen)  AS sequen,
                TRIM(g2.g2_operac)  AS operacao,
                TRIM(g2.g2_recurso) AS recurso,
                TRIM(c2.c2_produto) AS produto
            FROM public.sc2010 c2
            JOIN public.sg2010 g2 ON TRIM(g2.g2_produto) = TRIM(c2.c2_produto)
                                 AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
            WHERE TRIM(c2.c2_num) = $1
              AND COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
        `;
        const queryParams = [op];
        if (item_op)         { queryParams.push(item_op.trim());         pgQuery += ` AND TRIM(c2.c2_item)   = $${queryParams.length}`; }
        if (sequen)          { queryParams.push(sequen.trim());          pgQuery += ` AND TRIM(c2.c2_sequen) = $${queryParams.length}`; }
        if (operacao_codigo) { 
            const opcs = operacao_codigo.split(',').map(s => s.trim()).filter(Boolean);
            if (opcs.length > 1) {
                queryParams.push(opcs);
                pgQuery += ` AND TRIM(g2.g2_operac) = ANY($${queryParams.length})`;
            } else {
                queryParams.push(operacao_codigo.trim()); 
                pgQuery += ` AND TRIM(g2.g2_operac) = $${queryParams.length}`;
            }
        }
        if (pedido)          { queryParams.push(pedido.trim());          pgQuery += ` AND TRIM(c2.c2_pedido) = $${queryParams.length}`; }
        if (item_pedido)     { queryParams.push(item_pedido.trim());     pgQuery += ` AND TRIM(c2.c2_itempv) = $${queryParams.length}`; }
        if (produto)         { queryParams.push(produto.trim());         pgQuery += ` AND TRIM(c2.c2_produto) = $${queryParams.length}`; }

        const pgResult = await pgClient.query(pgQuery, queryParams);
        if (pgResult.rows.length === 0) {
            return res.status(404).json({ error: 'OP nao encontrada ou sem operacoes no roteiro.' });
        }

        const fmtISO = (yyyymmdd) => yyyymmdd ? `${yyyymmdd.substring(0,4)}-${yyyymmdd.substring(4,6)}-${yyyymmdd.substring(6,8)}` : null;
        const formattedStart = fmtISO(data_inicio);
        const formattedEnd   = fmtISO(data_fim);
        const usuario = req.user?.login || req.user?.username || 'pcp_refinado';

        const [existingRows] = await mysqlPool.query(`SELECT op_numero, op_item, op_sequencia, operacao_codigo, data_planejada_inicio, data_planejada_fim FROM app_production_planning WHERE op_numero = ?`, [op]);
        const existingMap = {};
        existingRows.forEach(r => { existingMap[`${(r.op_numero||'').trim()}_${(r.op_item||'').trim()}_${(r.op_sequencia||'').trim()}_${(r.operacao_codigo||'').trim()}`] = r; });

        const mysqlValues = [], historicoValues = [];
        const hoje = new Date();
        const formatOld = (d) => {
            if (!d) return null;
            if (typeof d === 'string') return d.substring(0,10);
            if (d instanceof Date) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            return null;
        };

        pgResult.rows.forEach(row => {
            const myOp   = row.op_num;
            const myItem = row.item_op  || '01';
            const mySeq  = row.sequen   || '001';
            const myOpc  = row.operacao || '01';
            mysqlValues.push([myOp, myItem, mySeq, myOpc, row.recurso || null, row.produto || null, formattedStart, formattedEnd, usuario, 'Atualizacao via Taxa de Ocupacao']);
            const existing = existingMap[`${myOp}_${myItem}_${mySeq}_${myOpc}`];
            const fOldS = formatOld(existing?.data_planejada_inicio);
            const fOldE = formatOld(existing?.data_planejada_fim);
            if (fOldS !== formattedStart || fOldE !== formattedEnd) {
                historicoValues.push([myOp, myOpc, usuario, hoje, `Inicio: ${fOldS||'N/A'} | Fim: ${fOldE||'N/A'}`, `Inicio: ${formattedStart||'N/A'} | Fim: ${formattedEnd||'N/A'}`, 'Painel Taxa de Ocupacao']);
            }
        });

        await mysqlPool.query(`
            INSERT INTO app_production_planning
                (op_numero, op_item, op_sequencia, operacao_codigo, recurso_codigo, produto_codigo,
                 data_planejada_inicio, data_planejada_fim, usuario_planejador, observacao_lote)
            VALUES ?
            ON DUPLICATE KEY UPDATE
                recurso_codigo        = COALESCE(VALUES(recurso_codigo),        recurso_codigo),
                produto_codigo        = COALESCE(VALUES(produto_codigo),        produto_codigo),
                data_planejada_inicio = IF(VALUES(data_planejada_inicio) IS NOT NULL, VALUES(data_planejada_inicio), data_planejada_inicio),
                data_planejada_fim    = IF(VALUES(data_planejada_fim)    IS NOT NULL, VALUES(data_planejada_fim),    data_planejada_fim),
                usuario_planejador    = VALUES(usuario_planejador),
                observacao_lote       = VALUES(observacao_lote)
        `, [mysqlValues]);

        await mysqlPool.query(`CREATE TABLE IF NOT EXISTS app_pcp_historico_revisao (id INT AUTO_INCREMENT PRIMARY KEY, op_numero VARCHAR(50), operacao_codigo VARCHAR(50), usuario VARCHAR(100), data_alteracao DATETIME, mudou_de TEXT, mudou_para TEXT, origem VARCHAR(100))`);
        if (historicoValues.length > 0) {
            await mysqlPool.query(`INSERT INTO app_pcp_historico_revisao (op_numero, operacao_codigo, usuario, data_alteracao, mudou_de, mudou_para, origem) VALUES ?`, [historicoValues]);
        }

        // Rebuild occupancy cache in background to update the daily rate dashboard instantly
        rebuildDailyOccupancyCache().catch(err => {
            console.error('❌ [UPDATE OP DATES] Error triggering background cache rebuild:', err);
        });

        res.json({ message: 'Datas atualizadas com sucesso.', op });
    } catch (error) {
        console.error('ERROR [UPDATE OP DATES]:', error);
        res.status(500).json({ error: 'Erro ao atualizar datas: ' + error.message });
    } finally {
        if (pgClient) pgClient.release();
    }
});

// Obter Historico de Revisao
router.get('/historico', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(`SELECT id, op_numero, operacao_codigo, usuario, data_alteracao, mudou_de, mudou_para, origem FROM app_pcp_historico_revisao ORDER BY data_alteracao DESC LIMIT 200`);
        res.json(rows);
    } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE') return res.json([]);
        res.status(500).json({ error: 'Erro ao buscar historico: ' + error.message });
    }
});

// ==========================================
// ROTA: Rastreabilidade (Super Query)
router.get('/rastreabilidade', async (req, res) => {
    let pgClient;
    try {
        pgClient = await db.connect();
        
        const { pedido, cliente, produto, dataInicial, dataFinal, dateType, only_active } = req.query;
        let whereClauses = ["COALESCE(c6.d_e_l_e_t_, '') IN ('', ' ')"];
        
        if (only_active !== 'false') {
             whereClauses.push("(c6.c6_qtdven - c6.c6_qtdent) > 0");
        }
        
        if (pedido) {
            const pedidoList = String(pedido).split(',')
                .map(p => p.trim().replace(/[^a-zA-Z0-9]/g, ''))
                .filter(p => p.length > 0)
                .map(p => p.padStart(6, '0'));

            if (pedidoList.length === 1) {
                whereClauses.push(`TRIM(c5.c5_num) = '${pedidoList[0]}'`);
            } else if (pedidoList.length > 1) {
                const values = pedidoList.map(p => `'${p}'`).join(',');
                whereClauses.push(`TRIM(c5.c5_num) IN (${values})`);
            }
        }
        if (cliente) whereClauses.push(`TRIM(a1.a1_nome) ILIKE '%${cliente.trim()}%'`);
        if (produto) whereClauses.push(`TRIM(c6.c6_produto) ILIKE '%${produto.trim()}%'`);
        
        if (dataInicial && dataFinal) {
            const di = dataInicial.replace(/-/g, '');
            const df = dataFinal.replace(/-/g, '');
            if (dateType === 'entrega') {
                whereClauses.push(`c6.c6_entreg BETWEEN '${di}' AND '${df}'`);
            } else {
                whereClauses.push(`c5.c5_emissao BETWEEN '${di}' AND '${df}'`);
            }
        }
        
        const whereSql = whereClauses.join(' AND ');

        const pedidosQuery = `
            SELECT 
                TRIM(c5.c5_num) AS pedido, 
                TRIM(a1.a1_nome) AS cliente, 
                TRIM(c6.c6_entreg) AS data_entrega,
                TRIM(c6.c6_item) AS item,
                TRIM(c6.c6_produto) AS produto,
                TRIM(c6.c6_descri) AS descricao,
                c6.c6_qtdven AS qtd_vendida,
                c6.c6_qtdent AS qtd_entregue
            FROM public.sc6010 c6
            JOIN public.sc5010 c5 ON TRIM(c5.c5_num) = TRIM(c6.c6_num) AND COALESCE(c5.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sa1010 a1 ON TRIM(a1.a1_cod) = TRIM(c5.c5_cliente) AND COALESCE(a1.d_e_l_e_t_, '') IN ('', ' ')
            WHERE ${whereSql}
            ORDER BY c6.c6_entreg ASC
            LIMIT 50
        `;
        const pedidosResult = await pgClient.query(pedidosQuery);
        
        if (pedidosResult.rows.length === 0) {
            return res.json([]);
        }

        const produtosSet = new Set();
        const pedidosMap = {}; 
        
        for (const row of pedidosResult.rows) {
            produtosSet.add(row.produto);
            if (!pedidosMap[row.pedido]) {
                const ano = row.data_entrega.substring(0,4);
                const mes = row.data_entrega.substring(4,6);
                const dia = row.data_entrega.substring(6,8);
                
                pedidosMap[row.pedido] = {
                    pedido: row.pedido,
                    cliente: row.cliente,
                    data_entrega: dia && mes && ano ? `${dia}/${mes}/${ano}` : row.data_entrega,
                    itens: []
                };
            }
            const qtdVendida = Number(row.qtd_vendida) || 0;
            const qtdFaturada = Number(row.qtd_entregue) || 0;
            pedidosMap[row.pedido].itens.push({
                item: row.item,
                produto: row.produto,
                descricao: row.descricao,
                qtd_vendida: qtdVendida,
                qtd_faturada: qtdFaturada,
                qtd_a_faturar: Math.max(0, qtdVendida - qtdFaturada),
                percentual_evolucao: qtdVendida > 0 ? ((qtdFaturada / qtdVendida) * 100).toFixed(1) : 0,
                qtd_estoque: 0,
                status_global: 'warning',
                mensagem: 'Calculando...',
                ops: []
            });
        }

        const arrayProdutos = Array.from(produtosSet);
        
        if (arrayProdutos.length > 0) {
            const placeholders = arrayProdutos.map((_, i) => `$${i+1}`).join(',');
            const estoqueQuery = `
                SELECT TRIM(b2_cod) as produto, SUM(b2_qatu) as qtd_estoque
                FROM public.sb2010
                WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')
                  AND TRIM(b2_cod) IN (${placeholders})
                GROUP BY TRIM(b2_cod)
            `;
            const estoqueResult = await pgClient.query(estoqueQuery, arrayProdutos);
            const estoqueMap = {};
            for (const row of estoqueResult.rows) {
                estoqueMap[row.produto] = Number(row.qtd_estoque) || 0;
            }
            
            for (const key in pedidosMap) {
                for (const item of pedidosMap[key].itens) {
                    const est = estoqueMap[item.produto] || 0;
                    item.qtd_estoque = est;
                    if (est >= (item.qtd_vendida - item.qtd_entregue)) {
                        item.status_global = 'success';
                        item.mensagem = 'Pronto para Faturar (Saldo em Estoque)';
                    } else {
                        item.status_global = 'warning';
                        item.mensagem = 'Em Processamento / Produção';
                    }
                }
            }
        }

        const pFilter = Object.keys(pedidosMap).map(p => `'${p}'`).join(',');
        const opsQuery = `
            SELECT 
                TRIM(c2.c2_num) AS op_num,
                TRIM(c2.c2_item) AS op_item,
                TRIM(c2.c2_sequen) AS op_seq,
                TRIM(c2.c2_produto) AS produto,
                c2.c2_quant AS qtd_op,
                c2.c2_quje AS qtd_feita,
                TRIM(c2.c2_pedido) AS original_pedido,
                COALESCE(NULLIF(TRIM(c2.c2_pedido),''), NULLIF(TRIM(root_op.c2_pedido),'')) AS pedido,
                COALESCE(NULLIF(TRIM(c2.c2_itempv),''), NULLIF(TRIM(root_op.c2_itempv),'')) AS itempv
            FROM public.sc2010 c2
            LEFT JOIN (
                SELECT c2_num, MAX(c2_pedido) as c2_pedido, MAX(c2_itempv) as c2_itempv
                FROM public.sc2010
                WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ') AND TRIM(c2_pedido) != ''
                GROUP BY c2_num
            ) root_op ON root_op.c2_num = c2.c2_num
            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
              AND COALESCE(NULLIF(TRIM(c2.c2_pedido),''), NULLIF(TRIM(root_op.c2_pedido),'')) IN (${pFilter})
            ORDER BY op_num, op_item, op_seq
        `;
        const opsResult = await pgClient.query(opsQuery);
        
        const opsPorItemPedido = {}; 
        const allOpProdutos = new Set();
        
        for (const op of opsResult.rows) {
            allOpProdutos.add(op.produto);
            const k = `${op.pedido}_${op.itempv}`;
            if (!opsPorItemPedido[k]) opsPorItemPedido[k] = [];
            
            let statusOp = 'Não Iniciado';
            if (op.qtd_feita >= op.qtd_op) statusOp = 'Concluído';
            else if (op.qtd_feita > 0) statusOp = 'Em Andamento';

            const formattedOp = {
                op: op.op_num + op.op_item + op.op_seq,
                op_raw: op.op_num,
                produto: op.produto,
                qtd_op: op.qtd_op,
                qtd_feita: op.qtd_feita,
                tipo: op.op_seq === '001' ? 'PAI' : 'FILHA', 
                status_op: statusOp,
                operacoes: [],
                ops_filhas: []
            };

            if (op.original_pedido) {
                // This is a TRUE parent OP (it has the sales order explicitly linked)
                opsPorItemPedido[k].push(formattedOp);
            } else {
                // This is a sub-assembly (child OP). We must find its parent by op_num.
                const parentOp = opsPorItemPedido[k].find(p => p.op_raw === op.op_num);
                if (parentOp) {
                    parentOp.ops_filhas.push(formattedOp);
                } else {
                    // Fallback if parent isn't found for some reason, just push it to the main array
                    opsPorItemPedido[k].push(formattedOp);
                }
            }
        }
        
        for (const key in pedidosMap) {
            for (const item of pedidosMap[key].itens) {
                const opKey = `${item.pedido || pedidosMap[key].pedido}_${item.item}`;
                if (opsPorItemPedido[opKey]) {
                    item.ops = opsPorItemPedido[opKey];
                }
            }
        }

        const arrayOpProdutos = Array.from(allOpProdutos);
        if (arrayOpProdutos.length > 0) {
            const placeholders = arrayOpProdutos.map((_, i) => `$${i+1}`).join(',');
            const roteiroQuery = `
                SELECT 
                    TRIM(g2_produto) AS produto,
                    TRIM(g2_operac) AS op_seq,
                    TRIM(g2_recurso) AS recurso,
                    TRIM(g2_descri) AS desc,
                    g2_tempad,
                    g2_setup
                FROM public.sg2010
                WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')
                  AND TRIM(g2_produto) IN (${placeholders})
                ORDER BY g2_operac
            `;
            const roteiroResult = await pgClient.query(roteiroQuery, arrayOpProdutos);
            
            // BUSCAR CAPACIDADES PADRÃO (FALLBACK)
            const [mysqlResult] = await mysqlPool.query('SELECT recurso_codigo, tempo_padrao_minutos FROM app_recursos_capacidade');
            const fallbackCapacidade = {};
            mysqlResult.forEach(row => {
                fallbackCapacidade[row.recurso_codigo] = Number(row.tempo_padrao_minutos) || 0;
            });

            const roteiroMap = {}; 
            for (const rot of roteiroResult.rows) {
                if (!roteiroMap[rot.produto]) roteiroMap[rot.produto] = [];
                
                let tempad = Math.round((Number(rot.g2_tempad) || 0) * 1000) / 1000;
                // Fallback para o valor configurado na tela de Capacidades se o roteiro vier zerado
                // Tanto a tabela MySQL quanto o roteiro usam minutos
                if (tempad === 0 && fallbackCapacidade[rot.recurso]) {
                    tempad = fallbackCapacidade[rot.recurso];
                }

                roteiroMap[rot.produto].push({
                    op_seq: rot.op_seq,
                    recurso: rot.recurso,
                    desc: rot.desc || 'OPERACAO',
                    tempo_padrao: tempad,
                    tempo_setup: Number(rot.g2_setup) || 0,
                    qtd_apontada: 0,
                    qtd_total: 0,
                    status: 'pendente'
                });
            }
            
            const mysqlPool = require('../services/mysqlService');
            
            // Get opCodes and opCodOperacoes to fetch from MySQL
            const opCodes = [];
            const opCodOperacoes = [];
            for (const key in pedidosMap) {
                for (const item of pedidosMap[key].itens) {
                    for (const op of item.ops) {
                        opCodes.push(op.op_raw); // op.op_raw contains just c2_num
                        if (roteiroMap[op.produto]) {
                            for (const r of roteiroMap[op.produto]) {
                                opCodOperacoes.push(r.op_seq);
                            }
                        }
                    }
                }
            }

            const uniqueOpCodes = [...new Set(opCodes)];
            const uniqueOpCodOperacoes = [...new Set(opCodOperacoes)];
            
            let appointments = [];
            let plans = [];

            if (uniqueOpCodes.length > 0 && uniqueOpCodOperacoes.length > 0) {
                const opPlaceholders = uniqueOpCodes.map(() => '?').join(',');
                const opOperacPlaceholders = uniqueOpCodOperacoes.map(() => '?').join(',');

                const [aRows] = await mysqlPool.query(`
                    SELECT op_numero, op_item, op_sequencia, operacao_codigo,
                           SUM(quantidade) as total_produzido
                    FROM app_production_appointments
                    WHERE op_numero IN (${opPlaceholders}) AND operacao_codigo IN (${opOperacPlaceholders})
                    GROUP BY op_numero, op_item, op_sequencia, operacao_codigo
                `, [...uniqueOpCodes, ...uniqueOpCodOperacoes]);
                appointments = aRows;

                const [pRows] = await mysqlPool.query(`
                    SELECT op_numero, op_item, op_sequencia, operacao_codigo,
                           data_planejada_inicio, data_planejada_fim, dias_espera
                    FROM app_production_planning
                    WHERE op_numero IN (${opPlaceholders}) AND operacao_codigo IN (${opOperacPlaceholders})
                `, [...uniqueOpCodes, ...uniqueOpCodOperacoes]);
                plans = pRows;
            }

            for (const key in pedidosMap) {
                for (const item of pedidosMap[key].itens) {
                    for (const op of item.ops) {
                        const processOp = (currentOp) => {
                            const o_num = currentOp.op.substring(0, 6);
                            const o_item = currentOp.op.substring(6, 8);
                            const o_seq = currentOp.op.substring(8, 11);

                            if (roteiroMap[currentOp.produto]) {
                                currentOp.operacoes = roteiroMap[currentOp.produto].map(r => {
                                    const a = appointments.find(appt =>
                                        appt.op_numero === o_num &&
                                        appt.op_item === o_item &&
                                        appt.op_sequencia === o_seq &&
                                        appt.operacao_codigo === r.op_seq
                                    );
                                    const p = plans.find(plan =>
                                        plan.op_numero === o_num &&
                                        plan.op_item === o_item &&
                                        plan.op_sequencia === o_seq &&
                                        plan.operacao_codigo === r.op_seq
                                    );
                                    
                                    const qtd_total = currentOp.qtd_op;
                                    const qtd_apontada = a ? (parseFloat(a.total_produzido) || 0) : 0;
                                    let status = 'pendente';
                                    if (qtd_apontada >= qtd_total && qtd_total > 0) {
                                        status = 'concluido';
                                    } else if (qtd_apontada > 0) {
                                        status = 'andamento';
                                    }

                                    return {
                                        ...r,
                                        qtd_total,
                                        qtd_apontada,
                                        tempo_previsto: (r.tempo_padrao * qtd_total) + r.tempo_setup,
                                        status,
                                        planejamento_inicio: p ? p.data_planejada_inicio : null,
                                        planejamento_fim: p ? p.data_planejada_fim : null,
                                        dias_espera: p ? p.dias_espera : 0
                                    };
                                });
                            }
                        };

                        processOp(op);
                        
                        if (op.ops_filhas) {
                            for (const filha of op.ops_filhas) {
                                processOp(filha);
                            }
                        }
                    }
                }
            }

            // Fetch PDF Documents for all products
            const allProductCodes = new Set(arrayProdutos);
            for (const op of arrayOpProdutos) {
                allProductCodes.add(op);
            }
            
            const arrayAllProducts = Array.from(allProductCodes);
            if (arrayAllProducts.length > 0) {
                try {
                    const placeholdersDocs = arrayAllProducts.map(() => '?').join(',');
                    const [docsResult] = await mysqlPool.execute(
                        `SELECT produto_codigo, url_arquivo FROM produtos_docs WHERE produto_codigo IN (${placeholdersDocs})`,
                        arrayAllProducts
                    );
                    
                    const docsMap = {};
                    docsResult.forEach(d => {
                        if (!docsMap[d.produto_codigo]) docsMap[d.produto_codigo] = [];
                        docsMap[d.produto_codigo].push(d);
                    });

                    for (const key in pedidosMap) {
                        for (const item of pedidosMap[key].itens) {
                            const pDocs = docsMap[item.produto] || [];
                            item.primeiro_arquivo = pDocs.length > 0 ? pDocs[0].url_arquivo : null;
                            
                            for (const op of item.ops) {
                                const opDocs = docsMap[op.produto] || [];
                                op.primeiro_arquivo = opDocs.length > 0 ? opDocs[0].url_arquivo : null;
                                
                                if (op.ops_filhas) {
                                    for (const filha of op.ops_filhas) {
                                        const fDocs = docsMap[filha.produto] || [];
                                        filha.primeiro_arquivo = fDocs.length > 0 ? fDocs[0].url_arquivo : null;
                                    }
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('⚠️ Erro ao buscar documentos no MySQL para rastreabilidade:', err.message);
                }
            }
        }

        res.json(Object.values(pedidosMap));

    } finally {
        if (pgClient) pgClient.release();
    }
});

// GET /api/pcp-refinado/cronograma
router.get('/cronograma', async (req, res) => {
    let pgClient;
    try {
        const { 
            pedido, cliente, produto, pedcli, dataInicial, dataFinal, 
            dateType = 'entrega', only_active = 'true', tipo_item = '', 
            op_status = '', sortBy = 'emissao', sortOrder = 'DESC' 
        } = req.query;

        pgClient = await db.connect();
        await pgClient.query("SET LOCAL statement_timeout = '55000'");

        const params = [];
        let paramCount = 1;

        const inactiveFilter = await getInactiveOrdersFilter();
        const inactiveFilterSql = inactiveFilter('c5.c5_num');

        let whereSql = "COALESCE(c6.d_e_l_e_t_, '') IN ('', ' ') AND COALESCE(c5.d_e_l_e_t_, '') IN ('', ' ') AND COALESCE(sb1.b1_msblql, '') NOT IN ('1','S','T','Y')" + inactiveFilterSql;

        if (only_active === 'true') {
            whereSql += " AND ((c6.c6_qtdven - c6.c6_qtdent) > 0 OR c6.c6_qtdlib > 0)";
        }

        if (pedido) {
            const pedidoList = String(pedido).split(',')
                .map(p => p.trim())
                .filter(p => p.length > 0)
                .map(p => p.padStart(6, '0'));

            if (pedidoList.length === 1) {
                whereSql += ` AND TRIM(c5.c5_num) = $${paramCount}`;
                params.push(pedidoList[0]);
                paramCount++;
            } else if (pedidoList.length > 1) {
                const placeholders = pedidoList.map((_, i) => `$${paramCount + i}`).join(', ');
                whereSql += ` AND TRIM(c5.c5_num) IN (${placeholders})`;
                params.push(...pedidoList);
                paramCount += pedidoList.length;
            }
        }

        if (cliente) {
            const resTemp = await pgClient.query(
                `SELECT a1_cod, a1_loja FROM public.sa1010 WHERE COALESCE(d_e_l_e_t_, '') = '' AND a1_nome ILIKE $1 LIMIT 5000`, 
                [`%${cliente}%`]
            );
            const clienteMatches = resTemp.rows;
            if (clienteMatches.length === 0) {
                return res.json([]);
            }
            const inValues = clienteMatches.map(m => `('${m.a1_cod}', '${m.a1_loja}')`).join(', ');
            whereSql += ` AND (c5.c5_cliente, c5.c5_lojacli) IN (${inValues})`;
        }

        if (produto) {
            whereSql += ` AND c6.c6_produto ILIKE '%' || $${paramCount} || '%'`;
            params.push(produto);
            paramCount++;
        }

        if (pedcli) {
            whereSql += ` AND c6.c6_pedcli ILIKE '%' || $${paramCount} || '%'`;
            params.push(pedcli);
            paramCount++;
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
                    whereSql += ` AND (${tipoConditions.join(' OR ')})`;
                }
            }
        }

        if (op_status === 'com_op') {
            whereSql += ` AND EXISTS (SELECT 1 FROM public.sc2010 c2_status WHERE (c2_status.c2_pedido = c5.c5_num) AND c2_status.c2_itempv = c6.c6_item AND COALESCE(c2_status.d_e_l_e_t_, '') = '')`;
        } else if (op_status === 'sem_op') {
            whereSql += ` AND NOT EXISTS (SELECT 1 FROM public.sc2010 c2_status WHERE (c2_status.c2_pedido = c5.c5_num) AND c2_status.c2_itempv = c6.c6_item AND COALESCE(c2_status.d_e_l_e_t_, '') = '')`;
        }

        if (dataInicial || dataFinal) {
            if (dateType === 'nf') {
                whereSql += ` AND EXISTS (
                    SELECT 1 FROM public.sd2010 d2_ex
                    JOIN public.sf2010 f2_ex 
                        ON f2_ex.f2_doc = d2_ex.d2_doc 
                        AND f2_ex.f2_serie = d2_ex.d2_serie 
                        AND COALESCE(f2_ex.d_e_l_e_t_, '') = ''
                    WHERE d2_ex.d2_pedido = c5.c5_num 
                      AND d2_ex.d2_itempv = c6.c6_item
                      AND COALESCE(d2_ex.d_e_l_e_t_, '') = ''
                `;
                if (dataInicial) {
                    whereSql += ` AND f2_ex.f2_emissao >= $${paramCount}`;
                    params.push(dataInicial.replace(/-/g, ''));
                    paramCount++;
                }
                if (dataFinal) {
                    whereSql += ` AND f2_ex.f2_emissao <= $${paramCount}`;
                    params.push(dataFinal.replace(/-/g, ''));
                    paramCount++;
                }
                whereSql += `)`;
            } else if (dateType === 'entrega') {
                if (dataInicial) {
                    whereSql += ` AND c6.c6_entreg >= $${paramCount}`;
                    params.push(dataInicial.replace(/-/g, ''));
                    paramCount++;
                }
                if (dataFinal) {
                    whereSql += ` AND c6.c6_entreg <= $${paramCount}`;
                    params.push(dataFinal.replace(/-/g, ''));
                    paramCount++;
                }
            } else if (dateType === 'entrega_pcp') {
                // Handled in fcJoin below
            } else {
                // Default: emissao
                if (dataInicial) {
                    whereSql += ` AND c5.c5_emissao >= $${paramCount}`;
                    params.push(dataInicial.replace(/-/g, ''));
                    paramCount++;
                }
                if (dataFinal) {
                    whereSql += ` AND c5.c5_emissao <= $${paramCount}`;
                    params.push(dataFinal.replace(/-/g, ''));
                    paramCount++;
                }
            }
        }

        const forecastMap = await getForecastMapCached();

        if (dateType === 'entrega_pcp' && (dataInicial || dataFinal)) {
            const dateS = dataInicial ? new Date(dataInicial) : new Date('2000-01-01');
            const dateE = dataFinal ? new Date(dataFinal + 'T23:59:59') : new Date('2100-01-01');
            const matchingKeys = [];
            for (const [key, val] of forecastMap) {
                if (val.data_entrega_pcp) {
                    const dt = new Date(val.data_entrega_pcp);
                    if (dt >= dateS && dt <= dateE) {
                        matchingKeys.push(key);
                    }
                }
            }
            if (matchingKeys.length === 0) {
                return res.json([]);
            }
            
            const limitKeys = matchingKeys.slice(0, 10000);
            const inList = limitKeys.map(k => {
                const [p, i] = k.split('|');
                return `('${p}', '${i}')`;
            }).join(', ');
            
            whereSql += ` AND (TRIM(c6.c6_num), TRIM(c6.c6_item)) IN (${inList})`;
        }

        const sortDir = sortOrder === 'ASC' ? 'ASC' : 'DESC';
        let orderClause = '';
        if (sortBy === 'entrega') {
            orderClause = `ORDER BY NULLIF(TRIM(c6.c6_entreg), '') ${sortDir} NULLS LAST, c5.c5_num DESC, c6.c6_item ASC`;
        } else if (sortBy === 'emissao') {
            orderClause = `ORDER BY c5.c5_emissao ${sortDir}, c5.c5_num DESC, c6.c6_item ASC`;
        } else if (sortBy === 'pedido') {
            orderClause = `ORDER BY c5.c5_num ${sortDir}, c6.c6_item ASC`;
        } else if (sortBy === 'cliente') {
            orderClause = `ORDER BY a1.a1_nome ${sortDir}, c5.c5_num DESC, c6.c6_item ASC`;
        } else {
            orderClause = `ORDER BY c5.c5_num DESC, c6.c6_item ASC`;
        }

        const pgQuery = `
            SELECT 
                TRIM(c5.c5_num) AS pedido,
                TRIM(a1.a1_nome) AS cliente,
                TRIM(COALESCE(a1.a1_email, '')) AS cliente_email,
                TRIM(c5.c5_emissao) AS data_emissao,
                TRIM(c6.c6_entreg) AS data_entrega,
                TRIM(c6.c6_item) AS item,
                TRIM(c6.c6_produto) AS produto,
                TRIM(c6.c6_descri) AS descricao,
                c6.c6_qtdven AS qtd_vendida,
                c6.c6_qtdent AS qtd_entregue,
                TRIM(c6.c6_pedcli) AS pedido_cliente,
                '' AS cod_prod_cliente
            FROM public.sc6010 c6
            JOIN public.sc5010 c5 
                ON COALESCE(c5.d_e_l_e_t_, '') IN ('', ' ')
                AND TRIM(c5.c5_num) = TRIM(c6.c6_num)
            LEFT JOIN public.sa1010 a1 
                ON COALESCE(a1.d_e_l_e_t_, '') IN ('', ' ')
                AND TRIM(a1.a1_cod) = TRIM(c5.c5_cliente)
                AND TRIM(a1.a1_loja) = TRIM(c5.c5_lojacli)
            LEFT JOIN public.sb1010 sb1
                ON COALESCE(sb1.d_e_l_e_t_, '') IN ('', ' ')
                AND TRIM(sb1.b1_cod) = TRIM(c6.c6_produto)
            WHERE ${whereSql}
            ${orderClause}
        `;

        const pgResult = await pgClient.query(pgQuery, params);
        let rows = pgResult.rows;

        if (rows.length === 0) {
            return res.json([]);
        }

        if (sortBy === 'entrega_pcp' || sortBy === 'prev_fat') {
            rows.forEach(r => {
                const mapVal = forecastMap.get(`${r.pedido}|${r.item}`);
                r._sort_val = null;
                if (mapVal) {
                    r._sort_val = sortBy === 'entrega_pcp' ? mapVal.data_entrega_pcp : mapVal.data_prevista_faturamento;
                }
            });
            rows.sort((a, b) => {
                if (!a._sort_val && !b._sort_val) {
                    if (a.pedido === b.pedido) return a.item.localeCompare(b.item);
                    return b.pedido.localeCompare(a.pedido); // DESC
                }
                if (!a._sort_val) return 1;
                if (!b._sort_val) return -1;
                const da = new Date(a._sort_val).getTime();
                const db = new Date(b._sort_val).getTime();
                if (da === db) {
                    if (a.pedido === b.pedido) return a.item.localeCompare(b.item);
                    return b.pedido.localeCompare(a.pedido);
                }
                return sortOrder === 'ASC' ? da - db : db - da;
            });
        }

        // Build pedidos Map and preserve order from SQL query
        const orderedPedidos = [];
        const pedidosMap = {};
        const allPedidoNums = [];
        rows.forEach(row => {
            const num = row.pedido;
            allPedidoNums.push(num);
            if (!pedidosMap[num]) {
                pedidosMap[num] = {
                    pedido: num,
                    cliente: row.cliente,
                    cliente_email: row.cliente_email,
                    data_emissao: row.data_emissao,
                    data_entrega: row.data_entrega,
                    itens: []
                };
                orderedPedidos.push(pedidosMap[num]);
            }
            pedidosMap[num].itens.push({
                item: row.item,
                produto: row.produto,
                descricao: row.descricao,
                qtd_vendida: parseFloat(row.qtd_vendida) || 0,
                qtd_faturada: parseFloat(row.qtd_entregue) || 0,
                data_entrega: row.data_entrega,
                data_emissao: row.data_emissao,
                data_entrega_pcp: null,
                data_prevista_faturamento: null,
                pedido_cliente: row.pedido_cliente,
                cod_prod_cliente: row.cod_prod_cliente,
                progresso_granular: 0,
                progresso_agregado: 0,
                ops: []
            });
        });

        // Map forecasts back to items from cached forecastMap
        orderedPedidos.forEach(p => {
            p.itens.forEach(item => {
                const key = `${p.pedido}|${item.item}`;
                const f = forecastMap.get(key);
                if (f) {
                    item.data_entrega_pcp = f.data_entrega_pcp;
                    item.data_prevista_faturamento = f.data_prevista_faturamento;
                }
            });
        });

        // 2. Fetch OPs — direct filter on c2_pedido for speed
        const uniquePedidosPG = [...new Set(allPedidoNums)];
        const opsQuery = `
            SELECT 
                TRIM(c2_num) AS op_num,
                TRIM(c2_item) AS op_item,
                TRIM(c2_sequen) AS op_seq,
                TRIM(c2_produto) AS produto,
                c2_quant AS qtd_op,
                c2_quje AS qtd_feita,
                TRIM(c2_pedido) AS pedido,
                TRIM(c2_itempv) AS itempv
            FROM public.sc2010
            WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')
              AND TRIM(c2_pedido) = ANY($1::varchar[])
            ORDER BY c2_num, c2_item, c2_sequen
        `;

        const opsResult = await pgClient.query(opsQuery, [uniquePedidosPG]);
        const dbOps = opsResult.rows;

        // Group ops by original pedido & itempv
        const opsPorPedidoItem = {};
        dbOps.forEach(op => {
            const k = `${op.pedido}_${op.itempv}`;
            if (!opsPorPedidoItem[k]) opsPorPedidoItem[k] = [];
            opsPorPedidoItem[k].push({
                op: `${op.op_num}${op.op_item}${op.op_seq}`,
                op_raw: op.op_num,
                produto: op.produto,
                qtd_op: parseFloat(op.qtd_op) || 0,
                qtd_feita: parseFloat(op.qtd_feita) || 0,
                ops_filhas: [],
                operacoes: []
            });
        });

        // Nest child ops under parent ops (same logic as /rastreabilidade)
        for (const k in opsPorPedidoItem) {
            const list = opsPorPedidoItem[k];
            const parentOps = list.filter(o => o.op.endsWith('001'));
            const childOps = list.filter(o => !o.op.endsWith('001'));
            childOps.forEach(child => {
                const parent = parentOps.find(p => p.op_raw === child.op_raw);
                if (parent) {
                    parent.ops_filhas.push(child);
                } else {
                    parentOps.push(child);
                }
            });
            opsPorPedidoItem[k] = parentOps;
        }

        // Fetch routing (sg2) and appointments (same logic)
        const opCodes = [];
        const opCodOperacoes = [];
        const sb1Codes = [...new Set(dbOps.map(op => op.produto))];

        const roteiroMap = {};
        if (sb1Codes.length > 0) {
            const routingQuery = `
                SELECT 
                    TRIM(g2.g2_produto) AS produto,
                    TRIM(g2.g2_operac) AS op_seq,
                    TRIM(g2.g2_recurso) AS recurso_codigo,
                    TRIM(h1.h1_descri) AS recurso_descricao
                FROM public.sg2010 g2
                LEFT JOIN public.sh1010 h1 
                    ON TRIM(h1.h1_codigo) = TRIM(g2.g2_recurso)
                    AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
                WHERE COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
                  AND TRIM(g2.g2_produto) = ANY($1::varchar[])
                ORDER BY g2.g2_produto, g2.g2_operac
            `;
            const rResult = await pgClient.query(routingQuery, [sb1Codes]);
            rResult.rows.forEach(r => {
                if (!roteiroMap[r.produto]) roteiroMap[r.produto] = [];
                roteiroMap[r.produto].push({
                    op_seq: r.op_seq,
                    recurso_codigo: r.recurso_codigo,
                    recurso_descricao: r.recurso_descricao || r.recurso_codigo
                });
            });
        }

        for (const k in opsPorPedidoItem) {
            opsPorPedidoItem[k].forEach(op => {
                opCodes.push(op.op_raw);
                if (roteiroMap[op.produto]) {
                    roteiroMap[op.produto].forEach(r => opCodOperacoes.push(r.op_seq));
                }
                op.ops_filhas.forEach(child => {
                    opCodes.push(child.op_raw);
                    if (roteiroMap[child.produto]) {
                        roteiroMap[child.produto].forEach(r => opCodOperacoes.push(r.op_seq));
                    }
                });
            });
        }

        const uniqueOpCodes = [...new Set(opCodes)];
        const uniqueOpCodOperacoes = [...new Set(opCodOperacoes)];
        
        let appointments = [];
        let plans = [];

        if (uniqueOpCodes.length > 0 && uniqueOpCodOperacoes.length > 0) {
            const opPlaceholders = uniqueOpCodes.map(() => '?').join(',');
            const opOperacPlaceholders = uniqueOpCodOperacoes.map(() => '?').join(',');
            const args = [...uniqueOpCodes, ...uniqueOpCodOperacoes];

            const [[aRows], [pRows]] = await Promise.all([
                mysqlPool.query(`
                    SELECT op_numero, op_item, op_sequencia, operacao_codigo,
                           SUM(quantidade) as total_produzido
                    FROM app_production_appointments
                    WHERE op_numero IN (${opPlaceholders}) AND operacao_codigo IN (${opOperacPlaceholders})
                    GROUP BY op_numero, op_item, op_sequencia, operacao_codigo
                `, args),
                mysqlPool.query(`
                    SELECT op_numero, op_item, op_sequencia, operacao_codigo,
                           data_planejada_inicio, data_planejada_fim, dias_espera
                    FROM app_production_planning
                    WHERE op_numero IN (${opPlaceholders}) AND operacao_codigo IN (${opOperacPlaceholders})
                `, args)
            ]);
            appointments = aRows;
            plans = pRows;
        }

        // Attach operations and calculate progress
        orderedPedidos.forEach(p => {
            p.itens.forEach(item => {
                const k = `${p.pedido}_${item.item}`;
                const itemOps = opsPorPedidoItem[k] || [];
                item.ops = itemOps;

                // Process operations recursively to compute progress
                let totalOpUnits = 0;
                let totalDoneUnits = 0;
                let totalOpQty = 0;
                let totalDoneQty = 0;

                const processOp = (currentOp) => {
                    const o_num = currentOp.op.substring(0, 6);
                    const o_item = currentOp.op.substring(6, 8);
                    const o_seq = currentOp.op.substring(8, 11);

                    totalOpQty += currentOp.qtd_op;
                    totalDoneQty += currentOp.qtd_feita;

                    if (roteiroMap[currentOp.produto]) {
                        currentOp.operacoes = roteiroMap[currentOp.produto].map(r => {
                            const a = appointments.find(appt =>
                                appt.op_numero === o_num &&
                                appt.op_item === o_item &&
                                appt.op_sequencia === o_seq &&
                                appt.operacao_codigo === r.op_seq
                            );
                            const p = plans.find(plan =>
                                plan.op_numero === o_num &&
                                plan.op_item === o_item &&
                                plan.op_sequencia === o_seq &&
                                plan.operacao_codigo === r.op_seq
                            );
                            
                            const qtd_total = currentOp.qtd_op;
                            const qtd_apontada = a ? (parseFloat(a.total_produzido) || 0) : 0;
                            
                            totalOpUnits += qtd_total;
                            totalDoneUnits += qtd_apontada;

                            let status = 'pendente';
                            if (qtd_apontada >= qtd_total && qtd_total > 0) {
                                status = 'concluido';
                            } else if (qtd_apontada > 0) {
                                status = 'andamento';
                            }

                            return {
                                ...r,
                                qtd_total,
                                qtd_apontada,
                                status,
                                planejamento_inicio: p ? p.data_planejada_inicio : null,
                                planejamento_fim: p ? p.data_planejada_fim : null,
                                dias_espera: p ? p.dias_espera : 0
                            };
                        });
                    }
                    currentOp.ops_filhas.forEach(processOp);
                };

                itemOps.forEach(processOp);

                item.progresso_granular = totalOpUnits > 0 ? Math.round(Math.min(100, (totalDoneUnits / totalOpUnits) * 100)) : 0;
                item.progresso_agregado = totalOpQty > 0 ? Math.round(Math.min(100, (totalDoneQty / totalOpQty) * 100)) : 0;
            });
        });

        res.json(orderedPedidos);
    } catch (err) {
        console.error('⚠️ Erro no endpoint /cronograma:', err);
        require('fs').writeFileSync('error_log.txt', 'ERRO NO CRONOGRAMA:\n' + err.stack);
        res.status(500).json({ error: 'Erro interno ao processar o cronograma.', details: err.message });
    } finally {
        if (pgClient) pgClient.release();
    }
});

// ============// ROTA: Planejamento Inteligente (Smart Planner FCS)
router.post('/smart-plan', async (req, res) => {
    try {
        const { ops, data_inicio, include_saturday, preload_existing } = req.body;
        const usuario = req.user?.login || req.user?.username || 'planejamento_inteligente';

        const result = await runFcsSequencing({ ops, data_inicio, usuario, include_saturday: !!include_saturday, preload_existing: !!preload_existing });
        if (!result.success) {
            if (result.missing_times) {
                return res.status(400).json({
                    error: result.error,
                    missing_times: result.missing_times,
                    agent_logs: result.agent_logs
                });
            }
            return res.status(500).json({ error: result.error, agent_logs: result.agent_logs });
        }

        // Rebuild occupancy cache in background to update the daily rate dashboard instantly
        rebuildDailyOccupancyCache().catch(err => {
            console.error('❌ [SMART PLAN] Error triggering background cache rebuild:', err);
        });

        res.json({
            message: 'Planejamento inteligente concluído com sucesso.',
            plans: result.plans,
            agent_logs: result.agent_logs,
            report: result.report
        });
    } catch (error) {
        console.error('❌ Erro em /smart-plan:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/pcp-refinado/ops-abertas
 * Retorna OPs abertas paginadas via ?limit=N&offset=M.
 * O frontend consome página por página e processa cada uma como um lote FCS,
 * evitando carregar todos os registros de uma só vez.
 *
 * Resposta: { ops: string[], total: number, has_more: boolean }
 */
router.get('/ops-abertas', async (req, res) => {
    try {
        const limit  = Math.min(500, Math.max(1, parseInt(req.query.limit)  || 100));
        const offset = Math.max(0,              parseInt(req.query.offset) || 0);

        // Conta total de OPs abertas (rápido, usa índice)
        const countRes = await db.query(`
            SELECT COUNT(DISTINCT TRIM(c2_num)) AS total
            FROM public.sc2010
            WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')
              AND (c2_quant - COALESCE(c2_quje, 0)) > 0.001
        `);
        const total = parseInt(countRes.rows[0]?.total || 0);

        // Página de OPs
        const pgRes = await db.query(`
            SELECT DISTINCT TRIM(c2_num) AS op_num
            FROM public.sc2010
            WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')
              AND (c2_quant - COALESCE(c2_quje, 0)) > 0.001
            ORDER BY op_num
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const ops = pgRes.rows.map(r => r.op_num).filter(Boolean);
        res.json({ ops, total, has_more: offset + ops.length < total });
    } catch (error) {
        console.error('❌ Erro em /ops-abertas:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/pcp-refinado/smart-plan/global
 * Planejamento automático de TODAS as OPs abertas em lotes sequenciais.
 * Cada lote pré-carrega alocações dos lotes anteriores para evitar sobreposição de capacidade.
 */
router.post('/smart-plan/global', async (req, res) => {
    try {
        const { data_inicio, include_saturday, batch_size } = req.body;
        const usuario = req.user?.login || req.user?.username || 'planejamento_global';

        if (!data_inicio) {
            return res.status(400).json({ error: 'Data de início obrigatória.' });
        }

        // 1. Buscar todas as OPs abertas com saldo a produzir no Protheus
        const pgRes = await db.query(`
            SELECT DISTINCT TRIM(c2_num) AS op_num
            FROM public.sc2010
            WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')
              AND (c2_quant - COALESCE(c2_quje, 0)) > 0.001
            ORDER BY op_num
        `);
        const allOpNums = pgRes.rows.map(r => r.op_num).filter(Boolean);

        if (allOpNums.length === 0) {
            return res.json({
                message: 'Nenhuma OP aberta com saldo encontrada.',
                total_ops: 0, plans: 0, daily_slices: 0,
                agent_logs: ['Nenhuma OP qualificada encontrada no Protheus.']
            });
        }

        // 2. Dividir em lotes
        const BS = Math.max(10, Math.min(500, parseInt(batch_size) || 100));
        const batches = [];
        for (let i = 0; i < allOpNums.length; i += BS) {
            batches.push(allOpNums.slice(i, i + BS));
        }

        const allLogs = [
            `🚀 Planejamento Global iniciado: ${allOpNums.length} OPs abertas | ${batches.length} lote(s) de até ${BS} OPs | Data base: ${data_inicio}`
        ];
        let totalPlans = 0;
        let totalSlices = 0;
        let batchErrors = 0;

        // 3. Processar cada lote sequencialmente (cada lote lê o que o anterior salvou)
        for (let b = 0; b < batches.length; b++) {
            const batch = batches[b];
            allLogs.push(`\n📦 ===== LOTE ${b + 1}/${batches.length} (${batch.length} OPs) =====`);

            try {
                const result = await runFcsSequencing({
                    ops: batch,
                    data_inicio,
                    usuario,
                    include_saturday: !!include_saturday,
                    preload_existing: true,
                });

                if (result.success) {
                    totalPlans  += result.plans        || 0;
                    totalSlices += result.daily_slices || 0;
                    allLogs.push(...(result.agent_logs || []));
                    allLogs.push(`✅ Lote ${b + 1} OK: ${result.plans || 0} plano(s) | ${result.daily_slices || 0} fatia(s).`);
                } else {
                    batchErrors++;
                    allLogs.push(`⚠️ Lote ${b + 1} encerrado com alerta: ${result.error || 'Erro desconhecido'}`);
                    if (result.agent_logs) allLogs.push(...result.agent_logs);
                }
            } catch (batchErr) {
                batchErrors++;
                allLogs.push(`❌ Lote ${b + 1} falhou: ${batchErr.message}`);
                console.error(`❌ Erro no lote ${b + 1}:`, batchErr);
            }
        }

        allLogs.push(
            `\n🏁 Planejamento Global finalizado: ${totalPlans} planos | ${totalSlices} fatias diárias | ${batchErrors > 0 ? batchErrors + ' lote(s) com erro' : 'sem erros'}`
        );

        rebuildDailyOccupancyCache().catch(err =>
            console.error('❌ Erro no rebuild do cache pós-global:', err)
        );

        res.json({
            message: `Planejamento global concluído. ${allOpNums.length} OPs em ${batches.length} lote(s).`,
            total_ops:    allOpNums.length,
            batches:      batches.length,
            plans:        totalPlans,
            daily_slices: totalSlices,
            batch_errors: batchErrors,
            agent_logs:   allLogs,
        });
    } catch (error) {
        console.error('❌ Erro em /smart-plan/global:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/pcp-refinado/smart-plan/analyze
 * Envia o relatório FCS ao Gemini com contexto histórico rico para análise inteligente.
 * Fase 2: LLM como consultor, FCS como motor de decisão.
 */
router.post('/smart-plan/analyze', async (req, res) => {
    let pgClient;
    try {
        const { report } = req.body;
        if (!report) return res.status(400).json({ error: 'Relatório FCS não fornecido.' });

        pgClient = await db.connect();

        // 1. Histórico de planejamento dos recursos envolvidos (últimos 90 dias)
        const recursosEnvolvidos = Object.keys(report.resumo_recursos || {});
        let historicoRecursos = [];
        if (recursosEnvolvidos.length > 0) {
            const [hist] = await mysqlPool.query(`
                SELECT 
                    recurso_codigo,
                    operacao_codigo,
                    COUNT(*) AS total_revisoes,
                    MAX(data_planejada_inicio) AS ultima_alocacao,
                    MIN(data_planejada_inicio) AS primeira_alocacao,
                    SUM(DATEDIFF(data_planejada_fim, data_planejada_inicio) + 1) AS total_dias_planejados
                FROM app_production_planning
                WHERE recurso_codigo IN (?)
                  AND data_planejada_inicio >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
                GROUP BY recurso_codigo, operacao_codigo
                ORDER BY total_dias_planejados DESC
                LIMIT 30
            `, [recursosEnvolvidos]);
            historicoRecursos = hist;
        }

        // 2. Histórico de revisões/alterações do PCP (padrões de mudança)
        let historicoAlteracoes = [];
        try {
            const [alt] = await mysqlPool.query(`
                SELECT 
                    op_numero,
                    operacao_codigo,
                    usuario,
                    origem,
                    COUNT(*) AS qtd_alteracoes,
                    MAX(data_alteracao) AS ultima_alteracao
                FROM app_pcp_historico_revisao
                WHERE data_alteracao >= DATE_SUB(NOW(), INTERVAL 60 DAY)
                GROUP BY op_numero, operacao_codigo, usuario, origem
                ORDER BY qtd_alteracoes DESC
                LIMIT 20
            `);
            historicoAlteracoes = alt;
        } catch { /* tabela pode não existir ainda */ }

        // 3. Carga atual dos recursos (ocupação já planejada próximos 30 dias)
        let cargaAtual = [];
        if (recursosEnvolvidos.length > 0) {
            const [carga] = await mysqlPool.query(`
                SELECT 
                    recurso_codigo,
                    COUNT(DISTINCT data_planejada_inicio) AS dias_com_producao,
                    COUNT(*) AS total_ops_planejadas,
                    MIN(data_planejada_inicio) AS proximo_inicio,
                    MAX(data_planejada_fim) AS ultimo_fim
                FROM app_production_planning
                WHERE recurso_codigo IN (?)
                  AND data_planejada_inicio >= CURDATE()
                  AND data_planejada_inicio <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                GROUP BY recurso_codigo
            `, [recursosEnvolvidos]);
            cargaAtual = carga;
        }

        // 4. Monta contexto enriquecido para o Gemini
        const reportEnriquecido = {
            ...report,
            contexto_historico: {
                utilizacao_recursos_90d: historicoRecursos,
                padroes_alteracao_60d: historicoAlteracoes,
                carga_futura_30d: cargaAtual
            }
        };

        // 5. Chama Gemini com contexto completo
        const analise = await analisarRelatorioFCS(reportEnriquecido);

        res.json({ analise });

    } catch (error) {
        console.error('\u274c Erro em /smart-plan/analyze:', error);
        res.status(500).json({ error: error.message });
    } finally {
        if (pgClient) pgClient.release();
    }
});

module.exports = router;