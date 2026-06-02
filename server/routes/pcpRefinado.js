const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const db = require('../db');
const { analisarRelatorioFCS } = require('../services/geminiPcpService');

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

// GET /api/pcp-refinado/taxa-ocupacao - Calculate daily occupation rate
// ARQUITETURA CORRIGIDA: MetalFisa usa c2_sequen='001','002'... como sequencia de estrutura de OP,
// NAO como codigo de operacao. O JOIN antigo (c2_sequen=g2_operac) sempre retornava 0 rows.
// Nova logica: MySQL planning e a fonte primaria; sg2010 e buscado por produto+operacao_codigo.
router.get('/taxa-ocupacao', async (req, res) => {
    let pgClient;
    try {
        pgClient = await db.connect();
        const { data_inicio, data_fim, recurso, only_active = 'false' } = req.query;

        // PASSO 1: Buscar OPs do Protheus (sc2010) SEM JOIN de operacao
        let pgWhere = `
            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
              AND c2.c2_quje < c2.c2_quant
              AND TRIM(c2.c2_num) <> ''
              AND COALESCE(TRIM(c2.c2_pedido), '') <> ''
              AND TRIM(c2.c2_itempv) <> ''
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
            ORDER BY c2.c2_num, c2.c2_item LIMIT 10000
        `);
        const opRows = pgResult.rows;

        // Indice: op_num|item_op -> row
        const opMap = {};
        for (const r of opRows) opMap[`${r.op_num}|${r.item_op}`] = r;

        // PASSO 2: Buscar roteiro (sg2010) por produto+operacao
        const distinctProds = [...new Set(opRows.map(r => r.produto).filter(Boolean))];
        const routingMap = {}; // { produto: { operac: { recurso_codigo, recurso_descri, tempo } } }
        if (distinctProds.length > 0) {
            const routingParams = [distinctProds];
            let routingFilter = '';
            if (recurso) {
                routingParams.push(`%${recurso.toUpperCase().trim()}%`);
                routingFilter = ` AND (TRIM(g2.g2_recurso) LIKE $2 OR UPPER(TRIM(h1.h1_descri)) LIKE $2)`;
            }
            const pgRouting = await pgClient.query(`
                SELECT TRIM(g2.g2_produto) prod, TRIM(g2.g2_operac) operac,
                       TRIM(g2.g2_recurso) recurso, g2.g2_tempad tempo,
                       TRIM(h1.h1_descri) recurso_descri
                FROM public.sg2010 g2
                LEFT JOIN public.sh1010 h1 ON TRIM(h1.h1_codigo)=TRIM(g2.g2_recurso) AND COALESCE(h1.d_e_l_e_t_,'') IN ('',' ')
                WHERE TRIM(g2.g2_produto) = ANY($1)
                  AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
                  ${routingFilter}
            `, routingParams);
            for (const r of pgRouting.rows) {
                if (!routingMap[r.prod]) routingMap[r.prod] = {};
                routingMap[r.prod][r.operac] = { recurso_codigo: r.recurso, recurso_descri: r.recurso_descri || r.recurso, tempo: parseFloat(r.tempo) || 0 };
            }
        }

        // PASSO 3: Planejamento MySQL
        const opNums = [...new Set(opRows.map(r => r.op_num).filter(Boolean))];
        let planRows = [];
        if (opNums.length > 0) {
            for (let i = 0; i < opNums.length; i += 500) {
                const chunk = opNums.slice(i, i + 500);
                const [rows] = await mysqlPool.query(`SELECT op_numero, op_item, op_sequencia, operacao_codigo, data_planejada_inicio, data_planejada_fim FROM app_production_planning WHERE op_numero IN (?)`, [chunk]);
                planRows = planRows.concat(rows);
            }
        }

        // PASSO 4: Apontamentos MySQL
        const apptsMap = {};
        if (opNums.length > 0) {
            for (let i = 0; i < opNums.length; i += 500) {
                const chunk = opNums.slice(i, i + 500);
                const ph = chunk.map(() => '?').join(',');
                const [rows] = await mysqlPool.query(`SELECT op_numero, op_item, operacao_codigo, SUM(quantidade) AS total FROM app_production_appointments WHERE op_numero IN (${ph}) GROUP BY op_numero, op_item, operacao_codigo`, chunk);
                for (const a of rows) {
                    apptsMap[`${(a.op_numero||'').trim()}|${(a.op_item||'').trim()}|${(a.operacao_codigo||'').trim()}`] = Number(a.total) || 0;
                }
            }
        }

        // PASSO 5: Configs
        const [capRows] = await mysqlPool.query('SELECT recurso_codigo, tempo_padrao_minutos, capacidade_diaria_minutos FROM app_recursos_capacidade');
        const configMap = {};
        capRows.forEach(r => { configMap[r.recurso_codigo] = r; });
        const [inativosResult] = await mysqlPool.query('SELECT pedido_numero FROM app_pedidos_inativos');
        const inativosSet = new Set(inativosResult.map(r => r.pedido_numero.trim()));

        const fmtDate = (val) => {
            if (!val) return '';
            if (typeof val === 'string') return val.replace(/-/g,'').substring(0,8);
            if (val instanceof Date) {
                return `${val.getFullYear()}${String(val.getMonth()+1).padStart(2,'0')}${String(val.getDate()).padStart(2,'0')}`;
            }
            return '';
        };

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
                if (day !== 0 && day !== 6) {
                    dates.push(`${current.getFullYear()}${String(current.getMonth() + 1).padStart(2, '0')}${String(current.getDate()).padStart(2, '0')}`);
                }
                current.setDate(current.getDate() + 1);
            }
            return dates.length > 0 ? dates : [startStr];
        };

        // PASSO 6: Agregar via planning MySQL como fonte primaria
        const aggregated = {};
        
        // 6.0: Deduplicate planRows to prevent capacity inflation from database duplicates
        const uniquePlans = [];
        const seenPlans = new Set();
        for (const plan of planRows) {
            const key = `${(plan.op_numero||'').trim()}|${(plan.op_item||'').trim()}|${(plan.op_sequencia||'').trim()}|${(plan.operacao_codigo||'').trim()}`;
            if (!seenPlans.has(key)) {
                seenPlans.add(key);
                uniquePlans.push(plan);
            }
        }

        for (const plan of uniquePlans) {
            const opn  = (plan.op_numero       || '').trim();
            const itn  = (plan.op_item         || '').trim();
            const opcn = (plan.operacao_codigo || '').trim();
            const pIni = fmtDate(plan.data_planejada_inicio);
            const pFim = fmtDate(plan.data_planejada_fim);
            if (!pIni) continue;
            if (data_inicio && pIni < data_inicio.replace(/-/g,'')) continue;
            if (data_fim    && pIni > data_fim.replace(/-/g,''))    continue;

            const opRow = opMap[`${opn}|${itn}`];
            if (!opRow) continue; // OP nao existe no Protheus (deletada/concluida)
            if (opRow.pedido && inativosSet.has(opRow.pedido)) continue;

            const prodRouting = routingMap[opRow.produto] || {};
            const routeEntry  = prodRouting[opcn];
            if (!routeEntry && recurso) continue; // Filtro de recurso ativo mas sem routing
            if (!routeEntry) continue; // Sem routing configurado, nao ha recurso para calcular

            const resCode = routeEntry.recurso_codigo;
            if (!resCode) continue;
            if (recurso && !resCode.toUpperCase().includes(recurso.toUpperCase().trim())) continue;

            const conf = configMap[resCode] || {};

            // g2_tempad do Protheus da MetalFisa já está preenchido em MINUTOS
            const g2_minutos = parseFloat(routeEntry.tempo) || 0;
            let unitTimeMin; // SEMPRE em minutos
            if (g2_minutos > 0) {
                unitTimeMin = g2_minutos; // já está em minutos no Protheus
            } else {
                unitTimeMin = parseFloat(conf.tempo_padrao_minutos) || 0; // fallback MySQL
            }

            const apptKey = `${opn}|${itn}|${opcn}`;
            const qtde_apontada = apptsMap[apptKey] || 0;
            const qtde_total    = Number(opRow.qtde) || 0;
            // Prioriza apontamento específico da operação (MySQL); fallback: c2_quje do Protheus
            const qtde_feita    = qtde_apontada > 0 ? qtde_apontada : (Number(opRow.qtde_feita) || 0);
            const qtde_pendente = Math.max(0, qtde_total - qtde_feita);

            // Tudo em MINUTOS
            const min_totais = qtde_total                           * unitTimeMin;
            const min_exec   = Math.min(qtde_feita, qtde_total)    * unitTimeMin;
            const min_pend   = qtde_pendente                        * unitTimeMin;
            const capacity   = conf.capacidade_diaria_minutos || 480;

            const bDays = getBusinessDaysBetween(pIni, pFim);
            let remaining_totais = min_totais;
            let remaining_exec = min_exec;
            let remaining_pend = min_pend;

            for (let i = 0; i < bDays.length; i++) {
                const d = bDays[i];
                let alloc_totais = (i === bDays.length - 1) ? remaining_totais : Math.min(remaining_totais, capacity);
                let alloc_exec = (min_totais > 0) ? (alloc_totais / min_totais) * min_exec : 0;
                let alloc_pend = (min_totais > 0) ? (alloc_totais / min_totais) * min_pend : 0;

                remaining_totais -= alloc_totais;

                if (!aggregated[d]) aggregated[d] = {};
                if (!aggregated[d][resCode]) {
                    aggregated[d][resCode] = {
                        recurso_codigo: resCode, recurso_descri: routeEntry.recurso_descri,
                        minutos_consumidos: 0, minutos_totais: 0, minutos_executados: 0, minutos_pendentes: 0,
                        capacidade_diaria: capacity, taxa_ocupacao: 0, percentual_executado: 0, ops: []
                    };
                }
                const bucket = aggregated[d][resCode];
                bucket.minutos_consumidos += alloc_totais;
                bucket.minutos_totais     += alloc_totais;
                bucket.minutos_executados += alloc_exec;
                bucket.minutos_pendentes  += alloc_pend;
                
                const existingOp = bucket.ops.find(o => o.op === opn && o.item_op === itn && o.sequen === (plan.op_sequencia||'').trim());
                if (existingOp) {
                    existingOp.minutos_totais_op += alloc_totais;
                    existingOp.minutos_executados_op += alloc_exec;
                    existingOp.minutos_pendentes_op += alloc_pend;
                    existingOp.minutos_estimados += alloc_pend;
                    if (!existingOp.operacao.split(', ').includes(opcn)) {
                        existingOp.operacao += `, ${opcn}`;
                        existingOp.tempo_unitario_min += unitTimeMin;
                    }
                } else {
                    bucket.ops.push({
                        op: opn, operacao: opcn, item_op: itn, sequen: (plan.op_sequencia||'').trim(),
                        recurso: resCode, produto: opRow.produto, pedido: opRow.pedido || '',
                        item_pedido: opRow.item_pedido || '', cliente: opRow.cliente_nome || '',
                        data_planejada: pIni, data_planejada_final: pFim, 
                        qtde_total, qtde_feita, qtde_pendente,
                        tempo_unitario_min: unitTimeMin,
                        minutos_totais_op: alloc_totais, minutos_executados_op: alloc_exec,
                        minutos_pendentes_op: alloc_pend, minutos_estimados: alloc_pend
                    });
                }
            }
        }

        const reportList = [];
        Object.keys(aggregated).forEach(dateStr => {
            Object.keys(aggregated[dateStr]).forEach(resCode => {
                const data = aggregated[dateStr][resCode];
                data.taxa_ocupacao = data.capacidade_diaria > 0
                    ? (data.minutos_consumidos / data.capacidade_diaria) * 100
                    : (data.minutos_consumidos > 0 ? 999 : 0);
                if (data.minutos_totais > 0)
                    data.percentual_executado = (data.minutos_executados / data.minutos_totais) * 100;
                let formattedDate = dateStr;
                if (dateStr.length === 8 && !dateStr.includes('-'))
                    formattedDate = `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`;
                reportList.push({ data: formattedDate, ...data });
            });
        });
        reportList.sort((a, b) => a.data < b.data ? -1 : a.data > b.data ? 1 : b.taxa_ocupacao - a.taxa_ocupacao);
        res.json(reportList);
    } catch (error) {
        console.error('? [TAXA OCUPACAO] Error:', error);

        res.status(500).json({ error: 'Erro ao gerar taxa de ocupacao: ' + error.message });
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
        
        if (pedido) whereClauses.push(`TRIM(c5.c5_num) ILIKE '%${pedido.trim()}%'`);
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
                
                let tempad = Number(rot.g2_tempad) || 0;
                // Fallback para o valor configurado na tela de Capacidades se o roteiro vier zerado
                // A tabela MySQL guarda em minutos, mas o roteiro e o painel somam em horas
                if (tempad === 0 && fallbackCapacidade[rot.recurso]) {
                    tempad = fallbackCapacidade[rot.recurso] / 60.0;
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
                           data_planejada_inicio, data_planejada_fim
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
                                        planejamento_fim: p ? p.data_planejada_fim : null
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

    } catch (error) {
        console.error('❌ Erro em /rastreabilidade:', error);
        res.status(500).json({ error: error.message });
    } finally {
        if (pgClient) pgClient.release();
    }
});

// ============// ROTA: Planejamento Inteligente (Smart Planner FCS)
router.post('/smart-plan', async (req, res) => {
    let pgClient;
    try {
        const { ops, data_inicio } = req.body;
        if (!ops || !ops.length || !data_inicio) {
            return res.status(400).json({ error: 'Lista de OPs e data de início são obrigatórios.' });
        }

        pgClient = await db.connect();
        const agent_logs = [];
        agent_logs.push(`Iniciando análise de ${ops.length} ordens de produção.`);
        
        // Obter capacidades diárias do MySQL
        agent_logs.push('Obtendo matriz de capacidades diárias por recurso...');
        const [capRows] = await mysqlPool.query('SELECT recurso_codigo, tempo_padrao_minutos, capacidade_diaria_minutos FROM app_recursos_capacidade');
        const capacidades = {};       // cap. diária em minutos
        const fallbackCapacidade = {}; // tempo padrão unitário em minutos
        capRows.forEach(r => { 
            capacidades[r.recurso_codigo] = Number(r.capacidade_diaria_minutos) || 0;
            fallbackCapacidade[r.recurso_codigo] = Number(r.tempo_padrao_minutos) || 0;
        });

        // Buscar descrição dos recursos via roteiro sg2010 (g2_descri confirmado) — opcional
        const recursosCodigos = capRows.map(r => r.recurso_codigo).filter(Boolean);
        const descRecursoMap = {};
        if (recursosCodigos.length > 0) {
            try {
                const sg2Res = await pgClient.query(
                    `SELECT DISTINCT TRIM(g2_recurso) AS cod, TRIM(g2_descri) AS descri
                     FROM public.sg2010
                     WHERE COALESCE(d_e_l_e_t_,'') IN ('',' ')
                       AND TRIM(g2_recurso) = ANY($1)
                       AND g2_descri IS NOT NULL AND TRIM(g2_descri) <> ''`,
                    [recursosCodigos]
                );
                sg2Res.rows.forEach(r => { if (!descRecursoMap[r.cod]) descRecursoMap[r.cod] = r.descri; });
            } catch {
                // descrição é opcional — não impede o FCS
            }
        }



        // Log da matriz de capacidade carregada
        agent_logs.push(`--- MATRIZ DE CAPACIDADE DE PRODUÇÃO (${capRows.length} recursos) ---`);
        capRows.forEach(r => {
            const desc = descRecursoMap[r.recurso_codigo] || r.recurso_codigo;
            const cap = Number(r.capacidade_diaria_minutos) || 0;
            agent_logs.push(`  [${r.recurso_codigo}] ${desc}: ${cap} min/dia (${(cap/60).toFixed(1)}h/dia)`);
        });
        agent_logs.push(`------`);

        // Buscar detalhes das OPs selecionadas no Protheus
        const placeholders = ops.map((_, i) => `$${i+1}`).join(',');
        const pgOpsQuery = `
            SELECT 
                TRIM(c2.c2_num) AS op_num,
                TRIM(c2.c2_item) AS item_op,
                TRIM(c2.c2_sequen) AS sequen,
                TRIM(c2.c2_produto) AS produto,
                TRIM(c2.c2_pedido) AS pedido,
                TRIM(c2.c2_itempv) AS itempv,
                c2.c2_quant AS qtde,
                c2.c2_quje AS qtde_feita
            FROM public.sc2010 c2
            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
              AND TRIM(c2.c2_num) IN (${placeholders})
            ORDER BY c2.c2_num, c2.c2_item, c2.c2_sequen
        `;
        const opsResult = await pgClient.query(pgOpsQuery, ops);
        const opsEncontradas = opsResult.rows;

        // Buscar apontamentos específicos por operação no MySQL
        const opNumbers = opsEncontradas.map(op => op.op_num);
        let apontamentosMap = {};
        if (opNumbers.length > 0) {
            try {
                const [apptRows] = await mysqlPool.query(`
                    SELECT op_numero, operacao_codigo, SUM(qtde_produzida) as total_produzido
                    FROM app_producao_apontamentos
                    WHERE op_numero IN (?)
                    GROUP BY op_numero, operacao_codigo
                `, [opNumbers]);
                apptRows.forEach(r => {
                    const key = `${r.op_numero}-${r.operacao_codigo}`;
                    apontamentosMap[key] = Number(r.total_produzido) || 0;
                });
            } catch (e) {
                // Tabela pode não existir em alguns ambientes
                console.warn('⚠️ Não foi possível carregar apontamentos MySQL:', e.message);
            }
        }

        // Buscar o roteiro de todos os produtos envolvidos
        const produtosSet = new Set(opsEncontradas.map(op => op.produto).filter(Boolean));
        const arrayProdutos = Array.from(produtosSet);
        
        let roteiroMap = {};
        if (arrayProdutos.length > 0) {
            agent_logs.push(`Buscando roteiro de engenharia para ${arrayProdutos.length} produto(s)...`);
            const pPlaceholders = arrayProdutos.map((_, i) => `$${i+1}`).join(',');
            const pgRoutingQuery = `
                SELECT 
                    TRIM(g2.g2_produto) AS produto,
                    TRIM(g2.g2_operac) AS operac,
                    TRIM(g2.g2_recurso) AS recurso,
                    g2.g2_tempad AS tempo_horas
                FROM public.sg2010 g2
                WHERE COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
                  AND TRIM(g2.g2_produto) IN (${pPlaceholders})
                ORDER BY g2.g2_operac ASC
            `;
            const routingResult = await pgClient.query(pgRoutingQuery, arrayProdutos);
            
            for (const r of routingResult.rows) {
                if (!roteiroMap[r.produto]) roteiroMap[r.produto] = [];
                
                // Na MetalFisa o g2_tempad é cadastrado diretamente em MINUTOS!
                let tempoMinutos = Number(r.tempo_horas) || 0;
                
                // Fallback se o roteiro do ERP não tiver tempo configurado (0)
                if (tempoMinutos <= 0 && fallbackCapacidade[r.recurso]) {
                    tempoMinutos = fallbackCapacidade[r.recurso];
                }

                roteiroMap[r.produto].push({
                    operac: r.operac,
                    recurso: r.recurso,
                    tempoMinutos
                });
            }
        }

        // 1. VERIFICAR PRODUTOS SEM TEMPO DE OPERAÇÃO
        const missingTimes = [];
        for (const op of opsEncontradas) {
            const roteiros = roteiroMap[op.produto];
            if (roteiros) {
                for (const rot of roteiros) {
                    if (rot.tempoMinutos <= 0) {
                        missingTimes.push({
                            produto: op.produto,
                            recurso: rot.recurso,
                            operacao: rot.operac,
                            mensagem: `Produto ${op.produto} (OP ${op.op_num}) não possui tempo padrão para o recurso ${rot.recurso}`
                        });
                    }
                }
            }
        }

        if (missingTimes.length > 0) {
            return res.status(400).json({
                error: 'Faltam tempos de operação definidos. O preenchimento é obrigatório.',
                missing_times: missingTimes
            });
        }

        // PRE-ESTUDO: Diagnóstico de capacidade por recurso antes de alocar
        agent_logs.push(`--- PRÉ-ANÁLISE DE GARGALOS DE CAPACIDADE ---`);
        const demandaPorRecurso = {};
        for (const op of opsEncontradas) {
            const qtdPend = Math.max(0, op.qtde - op.qtde_feita);
            for (const rot of (roteiroMap[op.produto] || [])) {
                if (!demandaPorRecurso[rot.recurso]) demandaPorRecurso[rot.recurso] = 0;
                demandaPorRecurso[rot.recurso] += qtdPend * rot.tempoMinutos;
            }
        }
        for (const [rec, demandaTotal] of Object.entries(demandaPorRecurso)) {
            const capDia = capacidades[rec] || 480;
            const diasNec = Math.ceil(demandaTotal / capDia);
            const pct = capDia > 0 ? ((demandaTotal / capDia) * 100).toFixed(0) : '??';
            const desc = descRecursoMap[rec] || rec;
            if (diasNec > 1) {
                agent_logs.push(`  ⚠️ GARGALO [${rec}] ${desc}: demanda total = ${Math.round(demandaTotal)} min | cap/dia = ${capDia} min | ${diasNec} dias necessários (${pct}% da cap. diária).`);
            } else {
                agent_logs.push(`  ✅ OK     [${rec}] ${desc}: demanda total = ${Math.round(demandaTotal)} min | ${pct}% da cap. diária.`);
            }
        }
        agent_logs.push(`------`);

        // 2. ALGORITMO FCS (Sequenciamento de Capacidade Finita)
        agent_logs.push(`Iniciando motor FCS a partir da data base: ${data_inicio}`);
        const resource_buckets = {};

        // Verifica se uma data é dia útil (seg-sex)
        const isBusinessDay = (dateStr) => {
            const d = new Date(dateStr + 'T12:00:00');
            const dow = d.getDay(); // 0=Dom, 6=Sab
            return dow !== 0 && dow !== 6;
        };

        // Avança N dias corridos, mas garante que o resultado seja dia útil
        const addDays = (dateStr, days) => {
            const date = new Date(dateStr + 'T12:00:00');
            date.setDate(date.getDate() + days);
            // Pula fins de semana
            while (date.getDay() === 0 || date.getDay() === 6) {
                date.setDate(date.getDate() + 1);
            }
            return date.toISOString().split('T')[0];
        };

        // Retorna o primeiro dia útil a partir de uma data (inclusive)
        const toBusinessDay = (dateStr) => {
            const date = new Date(dateStr + 'T12:00:00');
            while (date.getDay() === 0 || date.getDay() === 6) {
                date.setDate(date.getDate() + 1);
            }
            return date.toISOString().split('T')[0];
        };

        const getCapacity = (dateStr, recurso) => {
            // Fins de semana: capacidade zero — dia não existe para produção
            if (!isBusinessDay(dateStr)) return 0;
            if (!resource_buckets[dateStr]) resource_buckets[dateStr] = {};
            if (resource_buckets[dateStr][recurso] === undefined) {
                resource_buckets[dateStr][recurso] = capacidades[recurso] || 480; // 480 = 8h fallback
            }
            return resource_buckets[dateStr][recurso];
        };

        const consumeCapacity = (dateStr, recurso, minNeeded) => {
            // Dia não útil: não aloca nada, devolve tudo como remaining
            if (!isBusinessDay(dateStr)) return { allocated: 0, remaining: minNeeded };
            let available = getCapacity(dateStr, recurso);
            if (available >= minNeeded) {
                resource_buckets[dateStr][recurso] -= minNeeded;
                return { allocated: minNeeded, remaining: 0 };
            } else {
                resource_buckets[dateStr][recurso] = 0;
                return { allocated: available, remaining: minNeeded - available };
            }
        };


        const newPlans = [];
        const forecastUpdates = [];
        const usuario = req.user?.login || req.user?.username || 'planejamento_inteligente';
        const hoje = new Date();

        // Garante que a data base informada seja um dia útil
        const dataBaseUtil = toBusinessDay(data_inicio);
        if (dataBaseUtil !== data_inicio) {
            agent_logs.push(`⚠️ Data base ${data_inicio} é fim de semana. Ajustando para o primeiro dia útil: ${dataBaseUtil}.`);
        } else {
            agent_logs.push(`✅ Data base ${data_inicio} é dia útil (${new Date(data_inicio + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}). Produção começa neste dia.`);
        }

        for (const op of opsEncontradas) {
            const roteiros = roteiroMap[op.produto] || [];
            let currentDate = dataBaseUtil;
            let lastAllocatedDate = null; // para salvar a data final do pai
            let finalQtdeRestante = op.qtde; // Saldo calculado pelo MySQL
            
            agent_logs.push(`[ESTUDO] Analisando OP ${op.op_num} (Qtd: ${op.qtde} | Produto: ${op.produto})`);

            for (let i = 0; i < roteiros.length; i++) {
                const rot = roteiros[i];
                
                // Desconta o que já foi apontado NESTA operação específica
                const keyApontamento = `${op.op_num}-${rot.operac}`;
                const qtdeApontada = apontamentosMap[keyApontamento] || 0;
                
                // Pega o maior entre a qtd totalmente finalizada no Protheus (c2_quje) e a apontada na operação
                const qtdeJaFeita = Math.max(Number(op.qtde_feita) || 0, qtdeApontada);
                const qtdeRestante = Math.max(0, op.qtde - qtdeJaFeita);
                
                if (i === roteiros.length - 1) {
                    finalQtdeRestante = qtdeRestante;
                }
                
                let minNeeded = qtdeRestante * rot.tempoMinutos;
                
                if (minNeeded <= 0) {
                    agent_logs.push(` ↳ Operação ${rot.operac}: Quantidade concluída (Apontado: ${qtdeJaFeita}/${op.qtde}), ignorando.`);
                    continue; 
                }

                agent_logs.push(` ↳ Operação ${rot.operac} (${rot.recurso}): Faltam ${qtdeRestante} peças. Requer ${minNeeded.toFixed(0)} min. Cap/dia = ${capacidades[rot.recurso]||480} min.`);

                let dataPlanejadaInicio = currentDate;
                lastAllocatedDate = currentDate;

                let logsLocais = { alocados: 0, diasAvancados: 0 };

                while (minNeeded > 0) {
                    const { allocated, remaining } = consumeCapacity(currentDate, rot.recurso, minNeeded);
                    if (allocated > 0) {
                        lastAllocatedDate = currentDate;
                        logsLocais.alocados += allocated;
                    }
                    if (remaining > 0) {
                        currentDate = addDays(currentDate, 1);
                        logsLocais.diasAvancados++;
                    }
                    minNeeded = remaining;
                }

                agent_logs.push(`    → Alocação concluída: de ${dataPlanejadaInicio} até ${lastAllocatedDate} (avanço de ${logsLocais.diasAvancados} dia(s)).`);

                newPlans.push({
                    op_numero: op.op_num,
                    op_item: op.item_op,
                    op_sequencia: op.sequen,
                    operacao_codigo: rot.operac,
                    recurso_codigo: rot.recurso,
                    produto_codigo: op.produto,
                    data_planejada_inicio: dataPlanejadaInicio,
                    data_planejada_fim: lastAllocatedDate,
                    usuario_planejador: usuario,
                    observacao_lote: `Planejamento Inteligente - Gerado em ${hoje.toLocaleDateString('pt-BR')} ${hoje.toLocaleTimeString('pt-BR')}`
                });

                // Regra de sequenciamento entre operações:
                // - Mesma peça passa por uma operação e vai para a próxima.
                // - Se o próximo recurso for IGUAL, obriga a pular para o dia seguinte (senão encavala o tempo).
                // - Se o próximo recurso for DIFERENTE, pode iniciar no mesmo lastAllocatedDate (fluxo contínuo), 
                //   desde que haja capacidade no outro recurso.
                if (i < roteiros.length - 1) {
                    const proxRecurso = roteiros[i + 1].recurso;
                    if (proxRecurso === rot.recurso) {
                        // Mesmo recurso: operação seguinte obrigatoriamente no próximo dia útil
                        currentDate = addDays(lastAllocatedDate, 1);
                        agent_logs.push(`    → Mesmo recurso (${rot.recurso}): próxima operação forçada para ${currentDate}.`);
                    } else {
                        // Recurso diferente: usa o lastAllocatedDate como referência.
                        // A próxima op começa no dia em que a anterior TERMINOU (fluxo de peça),
                        // mas usa o bucket do SEU próprio recurso — sem conflito.
                        currentDate = lastAllocatedDate;
                        const capProx = getCapacity(currentDate, proxRecurso);
                        if (capProx <= 0) {
                            // Recurso diferente mas sem cap hoje → avança
                            currentDate = addDays(lastAllocatedDate, 1);
                            agent_logs.push(`    → Recurso diferente (${proxRecurso}) sem capacidade em ${lastAllocatedDate}. Avançando para ${currentDate}.`);
                        } else {
                            agent_logs.push(`    → Recurso diferente (${proxRecurso}): ${capProx} min disponíveis em ${currentDate}. Mantendo dia.`);
                        }
                    }
                }

            }
            
            // Check if this is a parent OP and we scheduled it
            if (op.pedido && op.itempv && lastAllocatedDate) {
                forecastUpdates.push({
                    pedido: op.pedido,
                    item: op.itempv,
                    data_entrega_pcp: lastAllocatedDate,
                    quantidade_pcp: finalQtdeRestante,
                    op_protheus: op.op_num
                });
            }
        }

        // 3. SALVAR NO MYSQL
        if (newPlans.length > 0) {
            agent_logs.push(`Salvando planejamento consolidado no banco de dados (${newPlans.length} operações).`);
            const mysqlValues = newPlans.map(p => [
                p.op_numero, p.op_item, p.op_sequencia, p.operacao_codigo, p.recurso_codigo, p.produto_codigo,
                p.data_planejada_inicio, p.data_planejada_fim, p.usuario_planejador, p.observacao_lote
            ]);

            await mysqlPool.query(`
                INSERT INTO app_production_planning
                    (op_numero, op_item, op_sequencia, operacao_codigo, recurso_codigo, produto_codigo,
                     data_planejada_inicio, data_planejada_fim, usuario_planejador, observacao_lote)
                VALUES ?
                ON DUPLICATE KEY UPDATE
                    recurso_codigo        = VALUES(recurso_codigo),
                    produto_codigo        = VALUES(produto_codigo),
                    data_planejada_inicio = VALUES(data_planejada_inicio),
                    data_planejada_fim    = VALUES(data_planejada_fim),
                    usuario_planejador    = VALUES(usuario_planejador),
                    observacao_lote       = VALUES(observacao_lote)
            `, [mysqlValues]);

            if (forecastUpdates.length > 0) {
                agent_logs.push(`Atualizando previsão de entrega PCP para ${forecastUpdates.length} pedido(s) associado(s).`);
                const forecastValues = forecastUpdates.map(f => [
                    f.pedido, f.item, f.data_entrega_pcp, f.quantidade_pcp, usuario, 'Automático - Agente FCS', f.op_protheus
                ]);
                await mysqlPool.query(`
                    INSERT INTO app_pcp_delivery_forecasts 
                        (pedido, item, data_entrega_pcp, quantidade_pcp, usuario, observacao, op_protheus)
                    VALUES ?
                `, [forecastValues]);
            }
            
            agent_logs.push(`Gerando logs de auditoria e rastreabilidade.`);
            const historicoValues = newPlans.map(p => [
                p.op_numero, p.operacao_codigo, usuario, hoje, 
                'Automático IA', `Inicio: ${p.data_planejada_inicio} | Fim: ${p.data_planejada_fim}`, 'Planejamento Inteligente'
            ]);
            
            await mysqlPool.query(`CREATE TABLE IF NOT EXISTS app_pcp_historico_revisao (id INT AUTO_INCREMENT PRIMARY KEY, op_numero VARCHAR(50), operacao_codigo VARCHAR(50), usuario VARCHAR(100), data_alteracao DATETIME, mudou_de TEXT, mudou_para TEXT, origem VARCHAR(100))`);
            if (historicoValues.length > 0) {
                await mysqlPool.query(`INSERT INTO app_pcp_historico_revisao (op_numero, operacao_codigo, usuario, data_alteracao, mudou_de, mudou_para, origem) VALUES ?`, [historicoValues]);
            }
        }

        // 4. GERAR RELATÓRIO ESTRUTURADO (tudo em MINUTOS)
        const report = {
            gerado_em: new Date().toISOString(),
            planejador: usuario,
            data_base: data_inicio,
            total_ops: opsEncontradas.length,
            total_operacoes_planejadas: newPlans.length,
            resumo_recursos: {},
            decisoes: []
        };

        for (const plan of newPlans) {
            // Encontra a operação correspondente no roteiro para pegar os minutos
            const op = opsEncontradas.find(o => o.op_num === plan.op_numero);
            const rot = (roteiroMap[plan.produto_codigo] || []).find(r => r.operac === plan.operacao_codigo);
            const qtdPendente = op ? Math.max(0, op.qtde - op.qtde_feita) : 0;
            const minTotais = rot ? Math.round(qtdPendente * rot.tempoMinutos) : 0;
            const capDia = capacidades[plan.recurso_codigo] || 480;
            const diasNecessarios = capDia > 0 ? Math.ceil(minTotais / capDia) : 1;
            const dataDif = plan.data_planejada_inicio !== plan.data_planejada_fim;

            // Acumula por recurso
            if (!report.resumo_recursos[plan.recurso_codigo]) {
                report.resumo_recursos[plan.recurso_codigo] = {
                    recurso: plan.recurso_codigo,
                    desc_recurso: descRecursoMap[plan.recurso_codigo] || plan.recurso_codigo,
                    capacidade_diaria_min: capDia,
                    total_minutos_alocados: 0,
                    total_operacoes: 0
                };
            }
            report.resumo_recursos[plan.recurso_codigo].total_minutos_alocados += minTotais;
            report.resumo_recursos[plan.recurso_codigo].total_operacoes += 1;

            report.decisoes.push({
                op_numero: plan.op_numero,
                produto: plan.produto_codigo,
                operacao: plan.operacao_codigo,
                recurso: plan.recurso_codigo,
                desc_recurso: descRecursoMap[plan.recurso_codigo] || plan.recurso_codigo,
                capacidade_recurso_min_dia: capDia,
                qtd_pendente: qtdPendente,
                tempo_unitario_min: rot ? Math.round(rot.tempoMinutos) : 0,
                total_minutos_necessarios: minTotais,
                // Percentual da capacidade diária que esta operação ocupa (pode ser >100%)
                capacity_pct: capDia > 0 ? Math.round((minTotais / capDia) * 100) : null,
                excede_capacidade_dia: minTotais > capDia,
                dias_necessarios: diasNecessarios,
                data_inicio: plan.data_planejada_inicio,
                data_fim: plan.data_planejada_fim,
                span_multiplos_dias: dataDif,
                justificativa: dataDif
                    ? `Carga de ${minTotais} min excede capacidade diária de ${capDia} min do recurso ${plan.recurso_codigo}. Distribuída em ${diasNecessarios} dia(s).`
                    : `Carga de ${minTotais} min dentro da capacidade diária de ${capDia} min. Alocada em ${plan.data_planejada_inicio}.`
            });
        }

        agent_logs.push(`Fim do processamento.`);
        res.json({
            message: 'Planejamento inteligente concluído com sucesso.',
            plans: newPlans.length,
            agent_logs,
            report
        });
    } catch (error) {
        console.error('❌ Erro em /smart-plan:', error);
        res.status(500).json({ error: error.message });
    } finally {
        if (pgClient) pgClient.release();
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