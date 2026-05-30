const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const db = require('../db');

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
        const [mysqlResult] = await mysqlPool.query('SELECT recurso_codigo, tempo_padrao_minutos, capacidade_diaria_minutos FROM app_recursos_capacidade');
        
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
                capacidade_diaria_minutos: conf.capacidade_diaria_minutos || 0
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
        const { recurso_codigo, tempo_padrao_minutos, capacidade_diaria_minutos } = req.body;
        
        if (!recurso_codigo) {
            return res.status(400).json({ error: 'O código do recurso é obrigatório' });
        }

        const query = `
            INSERT INTO app_recursos_capacidade (recurso_codigo, tempo_padrao_minutos, capacidade_diaria_minutos)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                tempo_padrao_minutos = VALUES(tempo_padrao_minutos),
                capacidade_diaria_minutos = VALUES(capacidade_diaria_minutos)
        `;

        await mysqlPool.query(query, [recurso_codigo, tempo_padrao_minutos || 0, capacidade_diaria_minutos || 0]);
        
        res.json({ message: 'Capacidade atualizada com sucesso' });
    } catch (error) {
        console.error('❌ [PCP REFINADO] Error saving recurso:', error);
        res.status(500).json({ error: 'Erro ao salvar capacidade: ' + error.message });
    }
});

// GET /api/pcp-refinado/taxa-ocupacao - Calculate daily occupation rate
router.get('/taxa-ocupacao', async (req, res) => {
    let pgClient;
    try {
        pgClient = await db.connect();
        
        // 1. Fetch active OPs and their operations
        // Considering an OP active if C2_QUJE < C2_QUANT (has pending balance)
        const { data_inicio, data_fim, recurso, only_active = 'false' } = req.query;

        let whereClause = `
            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
              AND c2.c2_quje < c2.c2_quant
              AND TRIM(c2.c2_datpri) <> ''
              AND TRIM(c2.c2_num) <> ''
        `;

        const queryParams = [];

        if (data_inicio) {
            queryParams.push(data_inicio.replace(/-/g, ''));
            whereClause += ` AND c2.c2_datpri >= $${queryParams.length}`;
        }
        
        if (data_fim) {
            queryParams.push(data_fim.replace(/-/g, ''));
            whereClause += ` AND c2.c2_datpri <= $${queryParams.length}`;
        }

        if (recurso) {
            queryParams.push(`%${recurso.toUpperCase().trim()}%`);
            whereClause += ` AND (TRIM(g2.g2_recurso) LIKE $${queryParams.length} OR UPPER(TRIM(h1.h1_descri)) LIKE $${queryParams.length})`;
        }

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

        const pgQuery = `
            SELECT 
                TRIM(c2.c2_num) AS op_num,
                TRIM(c2.c2_produto) AS produto,
                TRIM(c2.c2_pedido) AS pedido,
                TRIM(c2.c2_itempv) AS item_pedido,
                c2.c2_quant AS qtde,
                c2.c2_quje AS qtde_feita,
                TRIM(c2.c2_datpri) AS data_planejada,
                TRIM(c2.c2_datprf) AS data_planejada_final,
                TRIM(g2.g2_operac) AS operacao,
                TRIM(g2.g2_recurso) AS recurso_codigo,
                g2.g2_tempad AS tempo_operacao_g2,
                TRIM(h1.h1_descri) AS recurso_descri,
                TRIM(a1.a1_nome) AS cliente_nome
            FROM public.sc2010 c2
            JOIN public.sg2010 g2 ON TRIM(g2.g2_produto) = TRIM(c2.c2_produto) 
                                 AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sh1010 h1 ON TRIM(h1.h1_codigo) = TRIM(g2.g2_recurso)
                                      AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sc5010 c5 ON TRIM(c5.c5_num) = TRIM(c2.c2_pedido)
                                      AND COALESCE(c5.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN public.sa1010 a1 ON TRIM(a1.a1_cod) = TRIM(c5.c5_cliente)
                                      AND COALESCE(a1.d_e_l_e_t_, '') IN ('', ' ')
            ${whereClause}
        `;
        const pgResult = await pgClient.query(pgQuery, queryParams);
        const ops = pgResult.rows;

        // === INÍCIO: Buscar datas do planejamento no MySQL (app_production_planning) ===
        const opNums = [...new Set(ops.map(o => o.op_num))];
        if (opNums.length > 0) {
            const [planRows] = await mysqlPool.query(`
                SELECT op_numero, op_item, op_sequencia, operacao_codigo, data_planejada_inicio, data_planejada_fim 
                FROM app_production_planning 
                WHERE op_numero IN (?)
            `, [opNums]);
            
            const planMap = {};
            for (const row of planRows) {
                const op = row.op_numero ? row.op_numero.trim() : '';
                const it = row.op_item ? row.op_item.trim() : '';
                const sq = row.op_sequencia ? row.op_sequencia.trim() : '';
                const opc = row.operacao_codigo ? row.operacao_codigo.trim() : '';
                const key = `${op}_${it}_${sq}_${opc}`;
                planMap[key] = row;
            }

            const formatMySqlDateToYYYYMMDD = (val) => {
                if (!val) return '';
                if (typeof val === 'string') return val.replace(/-/g, '');
                if (val instanceof Date) {
                    const y = val.getFullYear();
                    const m = String(val.getMonth() + 1).padStart(2, '0');
                    const d = String(val.getDate()).padStart(2, '0');
                    return `${y}${m}${d}`;
                }
                return '';
            };
            
            for (const op of ops) {
                const opn = op.op_num ? op.op_num.trim() : '';
                const itn = op.item_op ? op.item_op.trim() : '01';
                const sqn = op.sequen ? op.sequen.trim() : '001';
                const opcn = op.operacao ? op.operacao.trim() : '';
                const key = `${opn}_${itn}_${sqn}_${opcn}`;
                
                let planData = planMap[key];
                
                // Fallback para mapeamento antigo (caso os campos op_item e op_sequencia estejam vazios na base)
                if (!planData) {
                    const fallbackKey = Object.keys(planMap).find(k => k.startsWith(`${opn}_`) && k.endsWith(`_${opcn}`));
                    if (fallbackKey) planData = planMap[fallbackKey];
                }

                if (planData) {
                    const pInicio = planData.data_planejada_inicio;
                    const pFim = planData.data_planejada_fim;
                    
                    if (pInicio) {
                        op.data_planejada = formatMySqlDateToYYYYMMDD(pInicio);
                    }
                    if (pFim) {
                        op.data_planejada_final = formatMySqlDateToYYYYMMDD(pFim);
                    }
                }
            }
        }
        // === FIM: Buscar datas ===

        // 2. Fetch local capacity configurations
        const [mysqlResult] = await mysqlPool.query('SELECT recurso_codigo, tempo_padrao_minutos, capacidade_diaria_minutos FROM app_recursos_capacidade');
        const configMap = {};
        mysqlResult.forEach(row => {
            configMap[row.recurso_codigo] = row;
        });

        // 2b. Fetch inactive sales orders to exclude them
        const [inativosResult] = await mysqlPool.query('SELECT pedido_numero FROM app_pedidos_inativos');
        const inativosSet = new Set(inativosResult.map(r => r.pedido_numero.trim()));

        // 3. Process and aggregate data
        const aggregated = {}; // Format: { date: { resource_code: { resource_desc, consumed_minutes, capacity, occupation_percent } } }

        for (const op of ops) {
            // Ignore OPs without a sales order or tied to an inactive sales order
            if (!op.pedido || inativosSet.has(op.pedido)) {
                continue;
            }

            const resCode = op.recurso_codigo;
            if (!resCode) continue;

            const dateKey = op.data_planejada; // YYYYMMDD
            const conf = configMap[resCode] || {};
            
            // Use Protheus time (g2_tempad) if > 0.01, otherwise use our defined default time
            // Protheus default for empty time is usually 0.01, so we ignore values <= 0.01
            let unitTime = (op.tempo_operacao_g2 && parseFloat(op.tempo_operacao_g2) > 0.01) 
                ? parseFloat(op.tempo_operacao_g2) 
                : (conf.tempo_padrao_minutos || 0);
            
            // Protheus stores g2_tempo in hours normally? Usually it's in hours. 
            // Wait, he said "se o tempo tiver definido, usa ele (em minutos), senão usa a taxa média".
            // I'll assume g2_tempo is in the same unit or needs to be treated as minutes. 
            // Actually let's assume it's directly usable as minutes per piece based on his audio.
            const pendingQty = op.qtde - op.qtde_feita;
            
            const minutos_totais = op.qtde * unitTime;
            const minutos_executados = op.qtde_feita * unitTime;
            const minutos_pendentes = pendingQty * unitTime;
            
            const capacity = conf.capacidade_diaria_minutos || 0;

            if (!aggregated[dateKey]) {
                aggregated[dateKey] = {};
            }

            if (!aggregated[dateKey][resCode]) {
                aggregated[dateKey][resCode] = {
                    recurso_codigo: resCode,
                    recurso_descri: op.recurso_descri || 'Desconhecido',
                    minutos_consumidos: 0, // this is pending load
                    minutos_totais: 0,
                    minutos_executados: 0,
                    capacidade_diaria: capacity,
                    taxa_ocupacao: 0,
                    percentual_executado: 0,
                    ops: []
                };
            }

            aggregated[dateKey][resCode].minutos_consumidos += minutos_pendentes;
            aggregated[dateKey][resCode].minutos_totais += minutos_totais;
            aggregated[dateKey][resCode].minutos_executados += minutos_executados;
            
            aggregated[dateKey][resCode].ops.push({
                op: op.op_num,
                operacao: op.operacao,
                item_op: op.item_op,
                sequen: op.sequen,
                recurso: resCode,
                produto: op.produto,
                pedido: op.pedido || '',
                item_pedido: op.item_pedido || '',
                cliente: op.cliente_nome || '',
                data_planejada: op.data_planejada || '',
                data_planejada_final: op.data_planejada_final || '',
                qtde_total: op.qtde,
                qtde_pendente: pendingQty,
                minutos_estimados: minutos_pendentes
            });
        }

        // Calculate final percentages and flatten structure for easier frontend consumption
        const reportList = [];
        Object.keys(aggregated).forEach(dateStr => {
            Object.keys(aggregated[dateStr]).forEach(resCode => {
                const data = aggregated[dateStr][resCode];
                if (data.capacidade_diaria > 0) {
                    data.taxa_ocupacao = (data.minutos_consumidos / data.capacidade_diaria) * 100;
                } else {
                    data.taxa_ocupacao = data.minutos_consumidos > 0 ? 999 : 0; // Infinite/Overload if no capacity
                }

                if (data.minutos_totais > 0) {
                    data.percentual_executado = (data.minutos_executados / data.minutos_totais) * 100;
                }
                
                // Format date from YYYYMMDD to YYYY-MM-DD for easier reading
                const formattedDate = dateStr.length === 8 ? `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}` : dateStr;

                reportList.push({
                    data: formattedDate,
                    ...data
                });
            });
        });

        // Sort by date ascending, then occupation descending
        reportList.sort((a, b) => {
            if (a.data < b.data) return -1;
            if (a.data > b.data) return 1;
            return b.taxa_ocupacao - a.taxa_ocupacao;
        });

        res.json(reportList);
    } catch (error) {
        console.error('❌ [TAXA OCUPAÇÃO] Error:', error);
        res.status(500).json({ error: 'Erro ao gerar taxa de ocupação: ' + error.message });
    } finally {
        if (pgClient) pgClient.release();
    }
});

// Atualizar Datas Planejadas da OP
router.put('/op/:op/dates', async (req, res) => {
    const { op } = req.params;
    const { data_inicio, data_fim, operacao_codigo, item_op, sequen, pedido, item_pedido, produto } = req.body; // YYYYMMDD
    let pgClient = null;

    try {
        console.log(`[UPDATE OP DATES] Start for OP: ${op}`, req.body);
        if (!op || (!data_inicio && !data_fim)) {
            return res.status(400).json({ error: 'OP e pelo menos uma data são obrigatórios.' });
        }

        pgClient = await db.connect();
        console.log(`[UPDATE OP DATES] Connected to PG`);

        // Busca os itens/sequencias/operações da OP no Postgres para persistir no MySQL
        let pgQuery = `
            SELECT 
                TRIM(c2.c2_num) AS op_num,
                TRIM(c2.c2_item) AS item_op,
                TRIM(c2.c2_sequen) AS sequen,
                TRIM(g2.g2_operac) AS operacao
            FROM public.sc2010 c2
            JOIN public.sg2010 g2 ON TRIM(g2.g2_produto) = TRIM(c2.c2_produto) 
                                 AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
            WHERE TRIM(c2.c2_num) = $1
              AND COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
        `;
        
        const queryParams = [op];
        
        if (item_op) {
            queryParams.push(item_op.trim());
            pgQuery += ` AND TRIM(c2.c2_item) = $${queryParams.length}`;
        }
        if (sequen) {
            queryParams.push(sequen.trim());
            pgQuery += ` AND TRIM(c2.c2_sequen) = $${queryParams.length}`;
        }
        if (operacao_codigo) {
            queryParams.push(operacao_codigo.trim());
            pgQuery += ` AND TRIM(g2.g2_operac) = $${queryParams.length}`;
        }
        if (pedido) {
            queryParams.push(pedido.trim());
            pgQuery += ` AND TRIM(c2.c2_pedido) = $${queryParams.length}`;
        }
        if (item_pedido) {
            queryParams.push(item_pedido.trim());
            pgQuery += ` AND TRIM(c2.c2_itempv) = $${queryParams.length}`;
        }
        if (produto) {
            queryParams.push(produto.trim());
            pgQuery += ` AND TRIM(c2.c2_produto) = $${queryParams.length}`;
        }

        const pgResult = await pgClient.query(pgQuery, queryParams);

        if (pgResult.rows.length === 0) {
            return res.status(404).json({ error: 'OP não encontrada ou sem operações associadas no roteiro.' });
        }

        const formattedStart = data_inicio ? `${data_inicio.substring(0,4)}-${data_inicio.substring(4,6)}-${data_inicio.substring(6,8)}` : null;
        const formattedEnd = data_fim ? `${data_fim.substring(0,4)}-${data_fim.substring(4,6)}-${data_fim.substring(6,8)}` : null;
        
        const usuario = req.user?.login || req.user?.username || 'pcp_refinado';

        // 1. Fetch existing data for history
        const [existingPlanRows] = await mysqlPool.query(`
            SELECT op_numero, op_item, op_sequencia, operacao_codigo, data_planejada_inicio, data_planejada_fim
            FROM app_production_planning
            WHERE op_numero = ?
        `, [op]);

        const existingMap = {};
        for (const row of existingPlanRows) {
            const o = row.op_numero ? row.op_numero.trim() : '';
            const i = row.op_item ? row.op_item.trim() : '';
            const s = row.op_sequencia ? row.op_sequencia.trim() : '';
            const c = row.operacao_codigo ? row.operacao_codigo.trim() : '';
            existingMap[`${o}_${i}_${s}_${c}`] = row;
        }

        const mysqlValues = [];
        const historicoValues = [];
        const hoje = new Date();

        pgResult.rows.forEach(row => {
            const mysqlOp = row.op_num;
            const mysqlItemOp = row.item_op || '01';
            const mysqlSequen = row.sequen || '001';
            const mysqlOpCodigo = row.operacao || '01';

            mysqlValues.push([
                mysqlOp, 
                mysqlItemOp, 
                mysqlSequen, 
                mysqlOpCodigo,
                formattedStart,
                formattedEnd,
                usuario,
                'Atualização via Painel Taxa de Ocupação'
            ]);

            const key = `${mysqlOp}_${mysqlItemOp}_${mysqlSequen}_${mysqlOpCodigo}`;
            const existing = existingMap[key];
            const oldStart = existing?.data_planejada_inicio || null;
            const oldEnd = existing?.data_planejada_fim || null;

            const formatOld = (d) => {
                if (!d) return null;
                if (typeof d === 'string') return d.substring(0,10);
                if (d instanceof Date) {
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const dNum = String(d.getDate()).padStart(2, '0');
                    return `${y}-${m}-${dNum}`;
                }
                return null;
            };
            const fOldStart = formatOld(oldStart);
            const fOldEnd = formatOld(oldEnd);

            if (fOldStart !== formattedStart || fOldEnd !== formattedEnd) {
                const mudou_de = `Início: ${fOldStart || 'N/A'} | Fim: ${fOldEnd || 'N/A'}`;
                const mudou_para = `Início: ${formattedStart || 'N/A'} | Fim: ${formattedEnd || 'N/A'}`;
                
                historicoValues.push([
                    mysqlOp,
                    mysqlOpCodigo,
                    usuario,
                    hoje,
                    mudou_de,
                    mudou_para,
                    'Painel Taxa de Ocupação'
                ]);
            }
        });
        
        const mysqlQuery = `
            INSERT INTO app_production_planning
                (op_numero, op_item, op_sequencia, operacao_codigo, data_planejada_inicio, data_planejada_fim, usuario_planejador, observacao_lote)
            VALUES ?
            ON DUPLICATE KEY UPDATE
                data_planejada_inicio = IF(VALUES(data_planejada_inicio) IS NOT NULL, VALUES(data_planejada_inicio), data_planejada_inicio),
                data_planejada_fim = IF(VALUES(data_planejada_fim) IS NOT NULL, VALUES(data_planejada_fim), data_planejada_fim),
                usuario_planejador = VALUES(usuario_planejador),
                observacao_lote = VALUES(observacao_lote)
        `;
        await mysqlPool.query(mysqlQuery, [mysqlValues]);

        // Registrar Histórico
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_pcp_historico_revisao (
                id INT AUTO_INCREMENT PRIMARY KEY,
                op_numero VARCHAR(50),
                operacao_codigo VARCHAR(50),
                usuario VARCHAR(100),
                data_alteracao DATETIME,
                mudou_de TEXT,
                mudou_para TEXT,
                origem VARCHAR(100)
            )
        `);

        if (historicoValues.length > 0) {
            await mysqlPool.query(`
                INSERT INTO app_pcp_historico_revisao
                    (op_numero, operacao_codigo, usuario, data_alteracao, mudou_de, mudou_para, origem)
                VALUES ?
            `, [historicoValues]);
        }

        res.json({ message: 'Datas da OP atualizadas com sucesso.', op });
    } catch (error) {
        console.error('❌ [UPDATE OP DATES] Error:', error);
        res.status(500).json({ error: 'Erro ao atualizar datas da OP: ' + error.message });
    } finally {
        if (pgClient) pgClient.release();
    }
});

// Obter Histórico de Revisão
router.get('/historico', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(`
            SELECT id, op_numero, operacao_codigo, usuario, data_alteracao, mudou_de, mudou_para, origem
            FROM app_pcp_historico_revisao
            ORDER BY data_alteracao DESC
            LIMIT 200
        `);
        res.json(rows);
    } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE') {
            return res.json([]);
        }
        console.error('❌ [HISTORICO REVISAO] Error:', error);
        res.status(500).json({ error: 'Erro ao buscar histórico: ' + error.message });
    }
});

module.exports = router;
