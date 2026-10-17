const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const mysqlPool = require('../services/mysqlService');
const db = require('../db');
const { emitHermesAlert } = require('../services/hermes/proactiveCron');

// Helper to format date as YYYY-MM-DD
function formatDate(date) {
    if (!date) return null;
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 1. GET /api/calendario/eventos
// Returns all events for the current user in a date range (start & end)
router.get('/eventos', async (req, res) => {
    try {
        const { start, end } = req.query;
        if (!start || !end) {
            return res.status(400).json({ error: 'Parâmetros "start" e "end" são obrigatórios (formato YYYY-MM-DD).' });
        }

        const userId = req.user.id;
        const tenantId = req.user?.IdEmpresa || req.tenantId || 1;

        // Query 1: Custom activities (app_calendario_atividades) - filtered by tenant
        const customQuery = `
            SELECT a.id, a.idRemetente, a.idDestinatario, a.texto, a.data_atividade, a.concluido, a.criado_em, a.data_conclusao, a.grupo_id,
                   ur.NomeCompleto as remetenteNome, ud.NomeCompleto as destinatarioNome
            FROM app_calendario_atividades a
            JOIN usuario ur ON a.idRemetente = ur.idUsuario
            JOIN usuario ud ON a.idDestinatario = ud.idUsuario
            WHERE a.data_atividade BETWEEN ? AND ?
              AND (a.IdEmpresa = ? OR (a.IdEmpresa IS NULL AND ? = 1))
        `;
        const [customRows] = await mysqlPool.query(customQuery, [start, end, tenantId, tenantId]);

        // Query 2: Ata Viva tasks (app_ata_viva_tarefas) - filtered by tenant
        const atavivaQuery = `
            SELECT id, pedido, item_pedido, op_numero, produto, texto_tarefa, status, criado_em, data_conclusao, usuario_criacao, usuario_conclusao
            FROM app_ata_viva_tarefas
            WHERE DATE(criado_em) BETWEEN ? AND ?
              AND (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1))
        `;
        const [atavivaRows] = await mysqlPool.query(atavivaQuery, [start, end, tenantId, tenantId]);

        // Query 3: Warnings/notices (sistema_avisos) - filtered by tenant
        const avisosQuery = `
            SELECT a.idAviso, a.idRemetente, a.idDestinatario, a.idGrupo, a.mensagem, a.lido, a.concluido, a.data_envio, a.data_conclusao,
                   ur.NomeCompleto as remetenteNome, ud.NomeCompleto as destinatarioNome, g.nome as grupoNome
            FROM sistema_avisos a
            JOIN usuario ur ON a.idRemetente = ur.idUsuario
            LEFT JOIN usuario ud ON a.idDestinatario = ud.idUsuario
            LEFT JOIN sistema_avisos_grupos g ON a.idGrupo = g.idGrupo
            WHERE (a.idRemetente = ? OR a.idDestinatario = ? OR a.idGrupo IN (
                SELECT idGrupo FROM sistema_avisos_grupos_membros WHERE idUsuario = ?
            ))
              AND DATE(a.data_envio) BETWEEN ? AND ?
              AND (a.IdEmpresa = ? OR (a.IdEmpresa IS NULL AND ? = 1))
        `;
        const [avisosRows] = await mysqlPool.query(avisosQuery, [userId, userId, userId, start, end, tenantId, tenantId]);

        // Query 4: Check if there are PCP deliveries in this range to mark on calendar
        const pcpQuery = `
            SELECT DISTINCT DATE(data_entrega_pcp) as data_pcp
            FROM app_pcp_delivery_forecasts
            WHERE data_entrega_pcp BETWEEN ? AND ?
              AND (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1))
        `;
        const [pcpRows] = await mysqlPool.query(pcpQuery, [start, end, tenantId, tenantId]);
        const pcpDatesSet = new Set(pcpRows.map(r => formatDate(r.data_pcp)));

        // Unify events
        const events = [];

        // Add custom activities
        customRows.forEach(row => {
            events.push({
                id: `custom-${row.id}`,
                dbId: row.id,
                tipo: 'custom',
                titulo: row.texto,
                data: formatDate(row.data_atividade),
                concluido: !!row.concluido,
                criado_em: row.criado_em,
                data_conclusao: row.data_conclusao,
                remetenteNome: row.remetenteNome,
                destinatarioNome: row.destinatarioNome,
                idRemetente: row.idRemetente,
                idDestinatario: row.idDestinatario,
                grupo_id: row.grupo_id
            });
        });

        // Add Ata Viva notes
        atavivaRows.forEach(row => {
            events.push({
                id: `ataviva-${row.id}`,
                dbId: row.id,
                tipo: 'ataviva',
                titulo: row.texto_tarefa,
                data: formatDate(row.criado_em),
                concluido: row.status === 'CONCLUIDO',
                criado_em: row.criado_em,
                data_conclusao: row.data_conclusao,
                usuario_criacao: row.usuario_criacao,
                usuario_conclusao: row.usuario_conclusao,
                pedido: row.pedido,
                item_pedido: row.item_pedido,
                op_numero: row.op_numero,
                produto: row.produto
            });
        });

        // Add warnings/notices
        avisosRows.forEach(row => {
            events.push({
                id: `aviso-${row.idAviso}`,
                dbId: row.idAviso,
                tipo: 'aviso',
                titulo: row.mensagem,
                data: formatDate(row.data_envio),
                concluido: !!row.concluido,
                criado_em: row.data_envio,
                data_conclusao: row.data_conclusao,
                remetenteNome: row.remetenteNome,
                destinatarioNome: row.destinatarioNome,
                grupoNome: row.grupoNome,
                idRemetente: row.idRemetente,
                idDestinatario: row.idDestinatario,
                idGrupo: row.idGrupo
            });
        });

        res.json({
            eventos: events,
            datasComPcp: Array.from(pcpDatesSet)
        });

    } catch (error) {
        console.error('Erro ao buscar eventos do calendário:', error);
        res.status(500).json({ error: 'Erro ao buscar eventos do calendário.' });
    }
});

// 2. POST /api/calendario/atividades
// Creates a new custom activity (can support multiple assignees)
router.post('/atividades', async (req, res) => {
    try {
        const { idDestinatario, idDestinatarios, texto, data_atividade } = req.body;
        const idRemetente = req.user.id;

        if (!texto || !data_atividade) {
            return res.status(400).json({ error: 'Texto e data_atividade são obrigatórios.' });
        }

        // Standardize assignees list to an array of integers
        let assignees = [];
        if (Array.isArray(idDestinatarios)) {
            assignees = idDestinatarios.map(id => parseInt(id)).filter(Boolean);
        } else if (idDestinatario) {
            assignees = [parseInt(idDestinatario)];
        } else {
            assignees = [idRemetente];
        }

        // If the array is empty, default to self
        if (assignees.length === 0) {
            assignees = [idRemetente];
        }

        const tenantId = req.user?.IdEmpresa || req.tenantId || 1;
        const grupoId = crypto.randomUUID();
        const insertedIds = [];
        const io = req.app.get('io');

        // Fetch creator's name
        const [remetenteRows] = await mysqlPool.query(
            'SELECT NomeCompleto FROM usuario WHERE idUsuario = ?',
            [idRemetente]
        );
        const remetenteNome = remetenteRows[0]?.NomeCompleto || req.user.nome || 'Usuário';

        for (const targetDestinatario of assignees) {
            const [result] = await mysqlPool.query(
                `INSERT INTO app_calendario_atividades (idRemetente, idDestinatario, texto, data_atividade, concluido, grupo_id, IdEmpresa)
                 VALUES (?, ?, ?, ?, 0, ?, ?)`,
                [idRemetente, targetDestinatario, texto, data_atividade, grupoId, tenantId]
            );
            insertedIds.push(result.insertId);

            // Fetch receiver's name for socket message
            const [destRows] = await mysqlPool.query(
                'SELECT NomeCompleto FROM usuario WHERE idUsuario = ?',
                [targetDestinatario]
            );
            const destinatarioNome = destRows[0]?.NomeCompleto || 'Usuário';

            // If activity is created for another user, trigger proactive alert & socket event
            if (targetDestinatario !== idRemetente) {
                // 1. Proactive alert in Hermes feed
                const alertMsg = `🔔 **Nova Atividade:** **${remetenteNome}** criou uma atividade para **${destinatarioNome}**: "${texto}" (Data: ${new Date(data_atividade).toLocaleDateString('pt-BR')})`;
                emitHermesAlert(alertMsg, 'info', {
                    type: 'calendario_tarefa',
                    atividadeId: result.insertId,
                    idRemetente,
                    idDestinatario: targetDestinatario,
                    texto
                });

                // 2. Immediate WebSocket notification for recipient
                if (io) {
                    io.to(`usuario_${targetDestinatario}`).emit('nova_atividade', {
                        id: result.insertId,
                        texto,
                        data_atividade,
                        idRemetente,
                        remetenteNome,
                        destinatarioNome
                    });
                }
            } else {
                // Also notify creator's active session just in case of multiple tabs
                if (io) {
                    io.to(`usuario_${idRemetente}`).emit('nova_atividade', {
                        id: result.insertId,
                        texto,
                        data_atividade,
                        idRemetente,
                        remetenteNome,
                        destinatarioNome
                    });
                }
            }
        }

        res.status(201).json({
            success: true,
            ids: insertedIds,
            message: 'Atividades criadas com sucesso.'
        });

    } catch (error) {
        console.error('Erro ao criar atividade no calendário:', error);
        res.status(500).json({ error: 'Erro ao criar atividade.' });
    }
});

// 3. PUT /api/calendario/atividades/:id/status
// Toggles or updates completion status of a custom activity
router.put('/atividades/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { concluido, baixarTodos } = req.body;
        const userId = req.user.id;

        if (concluido === undefined) {
            return res.status(400).json({ error: 'O campo "concluido" é obrigatório.' });
        }

        const isConcluido = concluido ? 1 : 0;
        const dataConclusao = concluido ? new Date() : null;

        if (baixarTodos) {
            // First find the activity to get grupo_id and check permissions
            const [rows] = await mysqlPool.query(
                'SELECT grupo_id, idRemetente, idDestinatario FROM app_calendario_atividades WHERE id = ?',
                [id]
            );
            const act = rows[0];
            if (!act) {
                return res.status(404).json({ error: 'Atividade não encontrada.' });
            }

            // Verify permission (user must be creator or assignee)
            if (act.idRemetente !== userId && act.idDestinatario !== userId) {
                return res.status(403).json({ error: 'Sem permissão para alterar esta atividade.' });
            }

            const grupoId = act.grupo_id;
            if (grupoId) {
                await mysqlPool.query(
                    `UPDATE app_calendario_atividades
                     SET concluido = ?, data_conclusao = ?
                     WHERE grupo_id = ?`,
                    [isConcluido, dataConclusao, grupoId]
                );
                return res.json({ success: true, message: 'Status de todas as atividades do grupo atualizado com sucesso.' });
            }
        }

        // Ensure user is creator or recipient
        const [result] = await mysqlPool.query(
            `UPDATE app_calendario_atividades
             SET concluido = ?, data_conclusao = ?
             WHERE id = ? AND (idDestinatario = ? OR idRemetente = ?)` ,
            [isConcluido, dataConclusao, id, userId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Atividade não encontrada ou sem permissão para alteração.' });
        }

        res.json({ success: true, message: 'Status da atividade atualizado com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar status da atividade:', error);
        res.status(500).json({ error: 'Erro ao atualizar status da atividade.' });
    }
});

// 4. GET /api/calendario/dia
// Returns activities and PCP delivery forecasts details for a specific day
router.get('/dia', async (req, res) => {
    let pgClient;
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ error: 'Parâmetro "date" é obrigatório (formato YYYY-MM-DD).' });
        }

        const userId = req.user.id;
        const tenantId = req.user?.IdEmpresa || req.tenantId || 1;

        // 1. Fetch custom activities for this day - filtered by tenant
        const customQuery = `
            SELECT a.id, a.idRemetente, a.idDestinatario, a.texto, a.data_atividade, a.concluido, a.criado_em, a.data_conclusao, a.grupo_id,
                   ur.NomeCompleto as remetenteNome, ud.NomeCompleto as destinatarioNome
            FROM app_calendario_atividades a
            JOIN usuario ur ON a.idRemetente = ur.idUsuario
            JOIN usuario ud ON a.idDestinatario = ud.idUsuario
            WHERE a.data_atividade = ?
              AND (a.IdEmpresa = ? OR (a.IdEmpresa IS NULL AND ? = 1))
        `;
        const [customRows] = await mysqlPool.query(customQuery, [date, tenantId, tenantId]);

        // 2. Fetch Ata Viva tasks for this day - filtered by tenant
        const atavivaQuery = `
            SELECT id, pedido, item_pedido, op_numero, produto, texto_tarefa, status, criado_em, data_conclusao, usuario_criacao, usuario_conclusao
            FROM app_ata_viva_tarefas
            WHERE DATE(criado_em) = ?
              AND (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1))
        `;
        const [atavivaRows] = await mysqlPool.query(atavivaQuery, [date, tenantId, tenantId]);

        // 3. Fetch warnings/notices for this day - filtered by tenant
        const avisosQuery = `
            SELECT a.idAviso, a.idRemetente, a.idDestinatario, a.idGrupo, a.mensagem, a.lido, a.concluido, a.data_envio, a.data_conclusao,
                   ur.NomeCompleto as remetenteNome, ud.NomeCompleto as destinatarioNome, g.nome as grupoNome
            FROM sistema_avisos a
            JOIN usuario ur ON a.idRemetente = ur.idUsuario
            LEFT JOIN usuario ud ON a.idDestinatario = ud.idUsuario
            LEFT JOIN sistema_avisos_grupos g ON a.idGrupo = g.idGrupo
            WHERE (a.idRemetente = ? OR a.idDestinatario = ? OR a.idGrupo IN (
                SELECT idGrupo FROM sistema_avisos_grupos_membros WHERE idUsuario = ?
            ))
              AND DATE(a.data_envio) = ?
              AND (a.IdEmpresa = ? OR (a.IdEmpresa IS NULL AND ? = 1))
        `;
        const [avisosRows] = await mysqlPool.query(avisosQuery, [userId, userId, userId, date, tenantId, tenantId]);

        // 4. Fetch PCP forecasts for this day - filtered by tenant
        const pcpQuery = `
            SELECT id, TRIM(pedido) as pedido, TRIM(item) as item, data_entrega_pcp, quantidade_pcp, op_protheus, observacao
            FROM app_pcp_delivery_forecasts
            WHERE DATE(data_entrega_pcp) = ?
              AND (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1))
        `;
        const [pcpRows] = await mysqlPool.query(pcpQuery, [date, tenantId, tenantId]);

        const unifiedActivities = [];

        customRows.forEach(row => {
            unifiedActivities.push({
                id: row.id,
                tipo: 'custom',
                titulo: row.texto,
                concluido: !!row.concluido,
                criado_em: row.criado_em,
                data_conclusao: row.data_conclusao,
                remetenteNome: row.remetenteNome,
                destinatarioNome: row.destinatarioNome,
                idRemetente: row.idRemetente,
                idDestinatario: row.idDestinatario,
                grupo_id: row.grupo_id
            });
        });

        atavivaRows.forEach(row => {
            unifiedActivities.push({
                id: row.id,
                tipo: 'ataviva',
                titulo: row.texto_tarefa,
                concluido: row.status === 'CONCLUIDO',
                criado_em: row.criado_em,
                data_conclusao: row.data_conclusao,
                usuario_criacao: row.usuario_criacao,
                usuario_conclusao: row.usuario_conclusao,
                pedido: row.pedido,
                item_pedido: row.item_pedido,
                op_numero: row.op_numero,
                produto: row.produto
            });
        });

        avisosRows.forEach(row => {
            unifiedActivities.push({
                id: row.idAviso,
                tipo: 'aviso',
                titulo: row.mensagem,
                concluido: !!row.concluido,
                criado_em: row.data_envio,
                data_conclusao: row.data_conclusao,
                remetenteNome: row.remetenteNome,
                destinatarioNome: row.destinatarioNome,
                grupoNome: row.grupoNome,
                idRemetente: row.idRemetente,
                idDestinatario: row.idDestinatario,
                idGrupo: row.idGrupo
            });
        });

        // If there are PCP forecasts, fetch product details from Protheus PostgreSQL
        let pcpDetails = [];
        if (pcpRows.length > 0) {
            const pedidosSet = [...new Set(pcpRows.map(r => r.pedido))];
            
            pgClient = await db.connect();
            const pgQuery = `
                SELECT 
                    TRIM(c5.c5_num) as pedido,
                    TRIM(c6.c6_item) as item,
                    TRIM(sa1.a1_nome) as cliente_nome,
                    TRIM(c6.c6_produto) as produto_codigo,
                    TRIM(sb1.b1_desc) as produto_descricao,
                    c6.c6_qtdven as quantidade_original
                FROM public.sc6010 c6
                JOIN public.sc5010 c5 ON c5.c5_num = c6.c6_num AND c5.c5_filial = c6.c6_filial AND COALESCE(c5.d_e_l_e_t_, '') = ''
                LEFT JOIN public.sa1010 sa1 ON sa1.a1_cod = c5.c5_cliente AND sa1.a1_loja = c5.c5_lojacli AND COALESCE(sa1.d_e_l_e_t_, '') = ''
                LEFT JOIN public.sb1010 sb1 ON sb1.b1_cod = c6.c6_produto AND COALESCE(sb1.d_e_l_e_t_, '') = ''
                WHERE COALESCE(c6.d_e_l_e_t_, '') = ''
                  AND TRIM(c5.c5_num) = ANY($1::varchar[])
            `;
            const pgResult = await pgClient.query(pgQuery, [pedidosSet]);
            const pgRows = pgResult.rows;

            // Map MySQL items with Protheus data
            pcpDetails = pcpRows.map(row => {
                const match = pgRows.find(p => p.pedido === row.pedido && p.item === row.item);
                return {
                    id: row.id,
                    pedido: row.pedido,
                    item: row.item,
                    data_entrega_pcp: row.data_entrega_pcp,
                    quantidade_pcp: row.quantidade_pcp,
                    op_protheus: row.op_protheus,
                    observacao: row.observacao,
                    cliente_nome: match ? match.cliente_nome : 'Não encontrado',
                    produto_codigo: match ? match.produto_codigo : 'Não encontrado',
                    produto_descricao: match ? match.produto_descricao : 'Não encontrado',
                    quantidade_original: match ? match.quantidade_original : 0
                };
            });
        }

        res.json({
            atividades: unifiedActivities,
            pcp: pcpDetails
        });

    } catch (error) {
        console.error('Erro ao buscar detalhes do dia:', error);
        res.status(500).json({ error: 'Erro ao buscar detalhes do dia.' });
    } finally {
        if (pgClient) pgClient.release();
    }
});

module.exports = router;
