const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const db = require('../db');

const { emitHermesAlert } = require('../services/hermes/proactiveCron');

// GET /api/ata-viva/prioridades-tv
// Fetch pending max priority tasks and calculate production evolution for TV Dashboard
router.get('/prioridades-tv', async (req, res) => {
    try {
        // 1. Fetch active priorities
        const [tarefas] = await mysqlPool.query(`
            SELECT * FROM app_ata_viva_tarefas 
            WHERE status = 'PENDENTE' 
            AND (texto_tarefa LIKE '%PRIORIDADE MÁXIMA%' OR texto_tarefa LIKE '%[PRIORIDADE MÁXIMA]%')
            ORDER BY criado_em DESC LIMIT 100
        `);

        // 2. Fetch PCP forecasts (this week and delayed)
        const pcpQuery = `
            SELECT id, pedido, item, data_entrega_pcp, quantidade_pcp, op_protheus, observacao, usuario
            FROM app_pcp_delivery_forecasts
            WHERE (data_entrega_pcp BETWEEN DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 6 DAY))
               OR (data_entrega_pcp < CURDATE())
        `;
        const [pcpRows] = await mysqlPool.query(pcpQuery);

        if (tarefas.length === 0 && pcpRows.length === 0) {
            return res.json({ success: true, prioridades: [], pcp: [] });
        }

        // Gather all unique order numbers to fetch client names from Protheus
        const allOrders = [
            ...new Set([
                ...tarefas.map(t => String(t.pedido).trim()),
                ...pcpRows.map(p => String(p.pedido).trim())
            ])
        ].filter(Boolean);

        let pedsMap = {};
        if (allOrders.length > 0) {
            const pedsBase = allOrders.map(p => String(p).trim());
            const sc5Res = await db.query(`
                SELECT TRIM(c5_num) as c5_num, TRIM(sa1.a1_nome) as a1_nome
                FROM public.sc5010 c5
                INNER JOIN public.sa1010 sa1 ON sa1.a1_cod = c5.c5_cliente AND sa1.a1_loja = c5.c5_lojacli AND COALESCE(sa1.d_e_l_e_t_, '') = ''
                WHERE c5.c5_num = ANY($1::varchar[]) AND COALESCE(c5.d_e_l_e_t_, '') = ''
            `, [pedsBase]);
            sc5Res.rows.forEach(r => {
                pedsMap[r.c5_num] = r.a1_nome;
            });
        }

        // Fetch product description and balance to invoice for PCP forecasts
        let pcpDetailsMap = {};
        if (pcpRows.length > 0) {
            const pedsBase = [...new Set(pcpRows.map(p => String(p.pedido).trim()))];
            const sc6Res = await db.query(`
                SELECT 
                    TRIM(c6.c6_num) as pedido, 
                    TRIM(c6.c6_item) as item, 
                    TRIM(c6.c6_produto) as produto_codigo,
                    TRIM(sb1.b1_desc) as produto_descricao,
                    (COALESCE(c6.c6_qtdven, 0) - COALESCE(c6.c6_qtdent, 0)) as qtd_faturar
                FROM public.sc6010 c6
                INNER JOIN public.sb1010 sb1 ON sb1.b1_cod = c6.c6_produto AND COALESCE(sb1.d_e_l_e_t_, '') = ''
                WHERE c6.c6_num = ANY($1::varchar[]) AND COALESCE(c6.d_e_l_e_t_, '') = ''
            `, [pedsBase]);
            sc6Res.rows.forEach(r => {
                const key = `${r.pedido}-${r.item}`;
                pcpDetailsMap[key] = r;
            });
        }

        // Map tasks
        const mappedTasks = tarefas.map(t => {
            const basePed = String(t.pedido).trim();
            return {
                ...t,
                is_pcp_forecast: false,
                cliente_nome: pedsMap[basePed] || 'LYNX'
            };
        });

        // Map and filter PCP forecasts
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const mappedPcpTasks = [];
        pcpRows.forEach(row => {
            const key = `${String(row.pedido).trim()}-${String(row.item).trim()}`;
            const detail = pcpDetailsMap[key];
            if (!detail) return;

            const pcpDate = new Date(row.data_entrega_pcp);
            const isDelayed = pcpDate < today;

            // Skip delayed items with no balance
            if (isDelayed && detail.qtd_faturar <= 0) {
                return;
            }

            mappedPcpTasks.push({
                id: `pcp-${row.id}`,
                is_pcp_forecast: true,
                pedido: row.pedido,
                item_pedido: row.item,
                op_numero: row.op_protheus,
                produto: `${detail.produto_codigo} - ${detail.produto_descricao}`,
                texto_tarefa: row.observacao || 'Previsão de entrega PCP',
                status: 'PENDENTE',
                criado_em: row.data_entrega_pcp,
                data_pcp: row.data_entrega_pcp,
                cliente_nome: pedsMap[String(row.pedido).trim()] || 'LYNX',
                quantidade_pcp: row.quantidade_pcp
            });
        });

        // Combined for evolution calculation
        const combined = [...mappedTasks, ...mappedPcpTasks];

        const produtos = [...new Set(combined.map(t => {
            if (t.is_pcp_forecast) {
                return t.produto.split(' - ')[0].trim();
            }
            return t.produto;
        }).filter(Boolean))];

        const opsFull = [...new Set(combined.map(t => t.op_numero).filter(Boolean))];

        let sc2Map = {};
        if (opsFull.length > 0) {
            const opsBase = [...new Set(opsFull.map(op => String(op).substring(0, 6)))];
            const sc2Res = await db.query(`
                SELECT TRIM(c2_num) as c2_num, TRIM(c2_item) as c2_item, TRIM(c2_sequen) as c2_sequen, c2_quant, TRIM(c2_produto) as c2_produto
                FROM public.sc2010
                WHERE c2_num = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') = ''
            `, [opsBase]);
            sc2Res.rows.forEach(r => {
                const fullOp = `${r.c2_num}${r.c2_item}${r.c2_sequen}`;
                const key = `${r.c2_num}-${r.c2_produto}`;
                if (!sc2Map[key]) sc2Map[key] = [];
                sc2Map[key].push({
                    quant: parseFloat(r.c2_quant) || 0,
                    fullOp: fullOp
                });
            });
        }

        let operacoesMap = {};
        if (produtos.length > 0) {
            // Padronizar para 15 caracteres (char(15) do Protheus) para utilizar o índice no Postgres
            const produtosPadded = produtos.map(p => String(p).padEnd(15, ' '));
            const sg2Res = await db.query(`
                SELECT TRIM(g2_produto) as produto, COUNT(g2_operac) as total_operacoes
                FROM public.sg2010
                WHERE g2_produto = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') = ''
                GROUP BY g2_produto
            `, [produtosPadded]);
            sg2Res.rows.forEach(r => {
                operacoesMap[String(r.produto).trim()] = parseInt(r.total_operacoes, 10) || 1;
            });
        }

        let prodMap = {};
        if (opsFull.length > 0) {
            const opsBase = [...new Set(opsFull.map(op => String(op).substring(0, 6)))];
            const placeholders = opsBase.map(() => '?').join(',');
            const [prodRes] = await mysqlPool.query(`
                SELECT CONCAT(op_numero, op_item, op_sequencia) as op_full, SUM(quantidade) as produzido
                FROM app_production_appointments
                WHERE op_numero IN (${placeholders})
                AND conferencia_status NOT IN ('CANCELADO', 'DIVERGENTE')
                GROUP BY op_full
            `, opsBase);
            prodRes.forEach(r => {
                prodMap[r.op_full] = parseFloat(r.produzido) || 0;
            });
        }

        const calculated = combined.map(t => {
            let evolucao = 0;
            let op_qtd = 0;
            let saldo_produzido = 0;

            const prodCode = t.is_pcp_forecast ? t.produto.split(' - ')[0].trim() : t.produto;

            if (t.op_numero) {
                const baseOp = String(t.op_numero).substring(0, 6);
                const sc2List = sc2Map[`${baseOp}-${prodCode}`];
                
                if (sc2List && sc2List.length > 0) {
                    const totalOps = operacoesMap[prodCode] || 1;
                    let totalQtd = 0;
                    let totalSumProduced = 0;

                    sc2List.forEach(sc2Info => {
                        totalQtd += sc2Info.quant;
                        
                        let sumProduced = prodMap[sc2Info.fullOp] || 0;
                        totalSumProduced += sumProduced;
                    });

                    saldo_produzido = totalSumProduced / totalOps;
                    op_qtd = totalQtd;

                    if (op_qtd > 0) {
                        evolucao = (saldo_produzido / op_qtd) * 100;
                        if (evolucao > 100) evolucao = 100;
                    }
                }
            }

            return {
                ...t,
                op_qtd,
                saldo_produzido,
                evolucao_op: evolucao
            };
        });

        // Split back to separate lists
        const prioridades = calculated.filter(x => !x.is_pcp_forecast);
        const pcp = calculated.filter(x => x.is_pcp_forecast);

        res.json({
            success: true,
            prioridades,
            pcp
        });

    } catch (error) {
        console.error('Erro na API /prioridades-tv:', error);
        res.status(500).json({ error: 'Erro ao buscar prioridades TV' });
    }
});

// POST /api/ata-viva/prioridade
// Request Instant Priority for an item and emit Hermes alert
router.post('/prioridade', async (req, res) => {
    try {
        const { pedido, item_pedido, op_numero, produto, texto_livre, usuario } = req.body;

        if (!pedido || !produto) {
            return res.status(400).json({ error: 'Pedido e Produto são obrigatórios para definir prioridade.' });
        }

        const texto_tarefa = `[PRIORIDADE MÁXIMA] ${texto_livre || 'Prioridade de produção solicitada.'}`;
        const user = usuario || 'Sistema';

        // 1. Insert into Ata Viva
        const query = `
            INSERT INTO app_ata_viva_tarefas 
            (pedido, item_pedido, op_numero, produto, texto_tarefa, usuario_criacao)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        await mysqlPool.query(query, [
            pedido, 
            item_pedido || '', 
            op_numero || '', 
            produto, 
            texto_tarefa, 
            user
        ]);

        // 2. Emit Hermes Live Feed Alert
        const alertMsg = `**Prioridade de Produção**\n**Pedido:** ${pedido} | **OP:** ${op_numero || 'N/A'} | **Produto:** ${produto}\n**Solicitante:** ${user}\n**Motivo:** ${texto_livre || 'Sem observação'}`;
        emitHermesAlert(alertMsg, 'error', { pedido, op_numero, requires_ack: true });

        const io = req.app.get('io');
        if (io) io.emit('tv:prioridades_atualizadas');

        res.json({ success: true, message: 'Prioridade definida e alerta enviado com sucesso.' });
    } catch (error) {
        console.error('Erro ao definir prioridade:', error);
        res.status(500).json({ error: error.message || 'Erro interno ao definir prioridade.' });
    }
});

// POST /api/ata-viva/prioridade-lote
// Request Instant Priority for multiple items and emit a single grouped Hermes alert
router.post('/prioridade-lote', async (req, res) => {
    try {
        const { itens, texto_livre, usuario } = req.body;

        if (!itens || !Array.isArray(itens) || itens.length === 0) {
            return res.status(400).json({ error: 'Nenhum item fornecido.' });
        }

        const texto_tarefa = `[PRIORIDADE MÁXIMA] ${texto_livre || 'Prioridade de produção solicitada.'}`;
        const user = usuario || 'Sistema';

        // 1. Insert into Ata Viva for each item
        for (const target of itens) {
            const query = `
                INSERT INTO app_ata_viva_tarefas 
                (pedido, item_pedido, op_numero, produto, texto_tarefa, usuario_criacao)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            await mysqlPool.query(query, [
                target.pedido, 
                target.item_pedido || '', 
                target.op_numero || '', 
                target.produto, 
                texto_tarefa, 
                user
            ]);
        }

        // 2. Emit a single Hermes Live Feed Alert
        let alertMsg = `**Prioridade de Produção em Lote (${itens.length} itens)**\n**Solicitante:** ${user}\n**Motivo:** ${texto_livre || 'Sem observação'}\n\n`;
        itens.forEach(t => {
            alertMsg += `- **Pedido:** ${t.pedido} | **OP:** ${t.op_numero || '-'} | **Produto:** ${t.produto}\n`;
        });
        
        emitHermesAlert(alertMsg, 'error', { requires_ack: true });

        const io = req.app.get('io');
        if (io) io.emit('tv:prioridades_atualizadas');

        res.json({ success: true, message: 'Prioridades definidas e alerta enviado com sucesso.' });
    } catch (error) {
        console.error('Erro ao definir prioridade em lote:', error);
        res.status(500).json({ error: error.message || 'Erro interno ao definir prioridade em lote.' });
    }
});

// POST /api/ata-viva/tarefas
// Create tasks for selected items
router.post('/tarefas', async (req, res) => {
    try {
        const { itens, texto_tarefa, usuario } = req.body;

        if (!itens || !Array.isArray(itens) || itens.length === 0) {
            return res.status(400).json({ error: 'Nenhum item selecionado.' });
        }
        if (!texto_tarefa) {
            return res.status(400).json({ error: 'Texto da tarefa é obrigatório.' });
        }

        const values = itens.map(i => [
            i.pedido || '',
            i.item_pedido || '',
            i.op_numero || '',
            i.produto || '',
            texto_tarefa,
            usuario || 'Sistema'
        ]);

        const query = `
            INSERT INTO app_ata_viva_tarefas 
            (pedido, item_pedido, op_numero, produto, texto_tarefa, usuario_criacao)
            VALUES ?
        `;

        const [result] = await mysqlPool.query(query, [values]);

        const io = req.app.get('io');
        if (io) io.emit('tv:prioridades_atualizadas');

        res.json({ message: `${result.affectedRows} tarefas criadas com sucesso.`, success: true });
    } catch (error) {
        console.error('Erro ao criar tarefas da Ata Viva:', error);
        res.status(500).json({ error: 'Erro interno ao criar tarefas.' });
    }
});

// GET /api/ata-viva/tarefas
// Fetch tasks with filters
router.get('/tarefas', async (req, res) => {
    try {
        const { status, pedido, produto } = req.query;
        let query = 'SELECT * FROM app_ata_viva_tarefas WHERE 1=1';
        const params = [];

        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        if (pedido) {
            query += ' AND pedido LIKE ?';
            params.push(`%${pedido}%`);
        }
        if (produto) {
            query += ' AND produto LIKE ?';
            params.push(`%${produto}%`);
        }

        query += ' ORDER BY criado_em DESC LIMIT 500';

        const [rows] = await mysqlPool.query(query, params);
        res.json({ data: rows });
    } catch (error) {
        console.error('Erro ao buscar tarefas da Ata Viva:', error);
        res.status(500).json({ error: 'Erro interno ao buscar tarefas.' });
    }
});

// PUT /api/ata-viva/tarefas/:id/status
// Update task status
router.put('/tarefas/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, usuario } = req.body;

        if (!status || !['PENDENTE', 'CONCLUIDO'].includes(status)) {
            return res.status(400).json({ error: 'Status inválido.' });
        }

        let query = 'UPDATE app_ata_viva_tarefas SET status = ?';
        const params = [status];

        if (status === 'CONCLUIDO') {
            query += ', data_conclusao = CURRENT_TIMESTAMP, usuario_conclusao = ?';
            params.push(usuario || 'Sistema');
        } else {
            query += ', data_conclusao = NULL, usuario_conclusao = NULL';
        }

        query += ' WHERE id = ?';
        params.push(id);

        await mysqlPool.query(query, params);

        const io = req.app.get('io');
        if (io) io.emit('tv:prioridades_atualizadas');

        res.json({ success: true, message: 'Status atualizado com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar status da tarefa:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar status.' });
    }
});

// PUT /api/ata-viva/tarefas/:id
// Edit task text
router.put('/tarefas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { texto_tarefa } = req.body;

        if (!texto_tarefa) {
            return res.status(400).json({ error: 'O texto da tarefa é obrigatório.' });
        }

        await mysqlPool.query(
            'UPDATE app_ata_viva_tarefas SET texto_tarefa = ? WHERE id = ?',
            [texto_tarefa, id]
        );

        const io = req.app.get('io');
        if (io) io.emit('tv:prioridades_atualizadas');

        res.json({ success: true, message: 'Tarefa atualizada com sucesso.' });
    } catch (error) {
        console.error('Erro ao editar tarefa da Ata Viva:', error);
        res.status(500).json({ error: 'Erro interno ao editar tarefa.' });
    }
});

// DELETE /api/ata-viva/tarefas/:id
// Delete task
router.delete('/tarefas/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await mysqlPool.query('DELETE FROM app_ata_viva_tarefas WHERE id = ?', [id]);

        const io = req.app.get('io');
        if (io) io.emit('tv:prioridades_atualizadas');

        res.json({ success: true, message: 'Tarefa excluída com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir tarefa da Ata Viva:', error);
        res.status(500).json({ error: 'Erro interno ao excluir tarefa.' });
    }
});
// GET /api/ata-viva/carga-maquinas-tv
// Fetch open/executed operations for the current week grouped by machine
router.get('/carga-maquinas-tv', async (req, res) => {
    try {
        const [planRows] = await mysqlPool.query(`
            SELECT 
                p.recurso_codigo, 
                p.op_numero, 
                p.op_item, 
                p.op_sequencia, 
                p.data_planejada_inicio, 
                p.data_planejada_fim
            FROM app_production_planning p
            WHERE p.op_numero != '000000' AND p.op_numero != '-'
              AND p.data_planejada_fim >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
              AND p.data_planejada_inicio <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        `);

        if(planRows.length === 0) {
            return res.json({ success: true, maquinas: [] });
        }

        const opNums = [...new Set(planRows.map(r => r.op_numero).filter(Boolean))];
        const opMap = {};
        const apptMap = {};

        const CHUNK_SIZE = 500;
        for (let i = 0; i < opNums.length; i += CHUNK_SIZE) {
            const chunk = opNums.slice(i, i + CHUNK_SIZE);

            if (chunk.length === 0) continue;

            const { rows: pgRows } = await db.query(`
                SELECT TRIM(c2_num) AS op_num, TRIM(c2_item) AS item_op, TRIM(c2_produto) AS produto, c2_quant
                FROM public.sc2010
                WHERE c2_num = ANY($1::varchar[]) AND COALESCE(d_e_l_e_t_, '') = ''
            `, [chunk]);

            pgRows.forEach(r => opMap[`${r.op_num}|${r.item_op}`] = { 
                produto: r.produto, 
                quant: parseFloat(r.c2_quant) || 0 
            });

            const [appts] = await mysqlPool.query(`
                SELECT op_numero, op_item, op_sequencia, SUM(quantidade) AS total
                FROM app_production_appointments
                WHERE op_numero IN (?)
                GROUP BY op_numero, op_item, op_sequencia
            `, [chunk]);

            appts.forEach(a => apptMap[`${a.op_numero}|${a.op_item}|${a.op_sequencia}`] = parseFloat(a.total) || 0);
        }

        const maquinasMap = {};
        for(const r of planRows) {
            const key = r.recurso_codigo;
            if(!key) continue; // skip rows with null/empty recurso_codigo
            if(!maquinasMap[key]) maquinasMap[key] = { recurso: key, ops: [] };
            
            const opData = opMap[`${r.op_numero}|${r.op_item}`] || { produto: 'N/A', quant: 0 };
            const prod = opData.produto;
            const qtd_planejada = opData.quant;
            
            const exec = apptMap[`${r.op_numero}|${r.op_item}|${r.op_sequencia}`] || 0;
            const status = exec >= qtd_planejada && qtd_planejada > 0 ? 'EXECUTADO' : (exec > 0 ? 'EM ANDAMENTO' : 'ABERTO');
            
            maquinasMap[key].ops.push({
                op: `${r.op_numero}${r.op_item}${r.op_sequencia}`,
                produto: prod,
                status: status,
                inicio: r.data_planejada_inicio,
                fim: r.data_planejada_fim,
                qtd_planejada: qtd_planejada,
                qtd_executada: exec
            });
        }

        // Sort ops by date inside each machine
        const maquinas = Object.values(maquinasMap).map(m => {
            m.ops.sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
            return m;
        });

        // Sort machines by id
        maquinas.sort((a, b) => (a.recurso || '').localeCompare(b.recurso || ''));

        res.json({ success: true, maquinas });

    } catch (error) {
        console.error('Erro ao buscar carga de máquinas para TV:', error);
        res.status(500).json({ error: 'Erro interno na carga máquina.' });
    }
});

module.exports = router;
