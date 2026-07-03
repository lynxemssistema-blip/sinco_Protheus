const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');

// Auxiliares de conversão de tempo
function hhmmssToSeconds(str) {
    if (!str) return 0;
    const parts = str.split(':');
    const hrs = parseInt(parts[0]) || 0;
    const mins = parseInt(parts[1]) || 0;
    const secs = parseInt(parts[2]) || 0;
    return (hrs * 3600) + (mins * 60) + secs;
}

function secondsToHhmmss(totalSecs) {
    if (isNaN(totalSecs) || totalSecs < 0) return '00:00:00';
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return [
        String(hrs).padStart(2, '0'),
        String(mins).padStart(2, '0'),
        String(secs).padStart(2, '0')
    ].join(':');
}

// 1. Criar Liberação de Programa
// POST /api/pcp/programas
router.post('/', async (req, res) => {
    try {
        const {
            maquina_id,
            nome_programa,
            data_criacao,
            tempo_previsto, // Fallback/default tempo
            tipo_material,
            quantidade_vezes,
            chapas_planejadas, // Array de objetos [{codigo, tempo}]
            criado_por,
            turno_previsao,
            ordem_execucao
        } = req.body;

        if (!maquina_id || !nome_programa || !data_criacao || !tipo_material || !criado_por || !turno_previsao) {
            return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos.' });
        }

        let chapasArray = [];
        if (chapas_planejadas) {
            chapasArray = Array.isArray(chapas_planejadas)
                ? chapas_planejadas
                : (typeof chapas_planejadas === 'string' ? JSON.parse(chapas_planejadas) : []);
        }

        // Suffix duplicate codes dynamically
        const counts = {};
        chapasArray.forEach(ch => {
            const code = ch.codigo ? ch.codigo.trim() : '';
            if (code) {
                counts[code] = (counts[code] || 0) + 1;
            }
        });
        const countsTracker = {};
        const processedChapas = chapasArray.map(ch => {
            let code = ch.codigo ? ch.codigo.trim() : '';
            if (!code) return null;
            if (counts[code] > 1) {
                countsTracker[code] = (countsTracker[code] || 0) + 1;
                code = `${code} (${countsTracker[code]})`;
            }
            return {
                codigo: code,
                tempo: ch.tempo || '00:00:00',
                tipo: ch.tipo || 'inteira'
            };
        }).filter(Boolean);

        const finalQty = processedChapas.length > 0 ? processedChapas.length : (parseInt(quantidade_vezes) || 1);
        const chapasStr = JSON.stringify(processedChapas);

        // Calculate average expected time
        let avgTempo = '00:00:00';
        if (processedChapas.length > 0) {
            const totalSecs = processedChapas.reduce((sum, ch) => sum + hhmmssToSeconds(ch.tempo), 0);
            const avgSecs = Math.round(totalSecs / processedChapas.length);
            avgTempo = secondsToHhmmss(avgSecs);
        } else if (tempo_previsto) {
            avgTempo = tempo_previsto;
        }

        const [result] = await mysqlPool.query(`
            INSERT INTO pcp_programas_liberados (
                maquina_id, nome_programa, data_criacao, tempo_previsto, 
                tipo_material, quantidade_vezes, chapas_planejadas, criado_por, turno_previsao, status, ordem_execucao
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'LIBERADO', ?)
        `, [
            maquina_id,
            nome_programa,
            data_criacao,
            avgTempo,
            tipo_material,
            finalQty,
            chapasStr,
            criado_por,
            turno_previsao,
            parseInt(ordem_execucao) || 0
        ]);

        const io = req.app.get('io');
        if (io) io.emit('tv:programas_atualizados');

        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error("Erro ao criar liberação de programa:", err);
        res.status(500).json({ error: "Erro interno ao cadastrar liberação." });
    }
});

// 2. Listar programas liberados por máquina
// GET /api/pcp/programas/maquina/:maquina_id
router.get('/maquina/:maquina_id', async (req, res) => {
    try {
        const { maquina_id } = req.params;
        const filterClause = (maquina_id && maquina_id !== 'todas' && maquina_id !== 'all')
            ? 'WHERE p.maquina_id = ?' : '';
        const params = filterClause ? [maquina_id] : [];

        // Subqueries correlacionadas substituídas por derived tables (avaliadas 1x, não N vezes)
        const query = `
            SELECT p.*,
                   m.nome AS maquina_nome,
                   m.tag_identificacao AS maquina_tag,
                   COALESCE(agg.chapas_concluidas, 0)       AS chapas_concluidas,
                   COALESCE(agg.chapas_em_andamento, 0)     AS chapas_em_andamento,
                   COALESCE(agg.total_realizado_segundos, 0) AS total_realizado_segundos,
                   el.usuario_apontamento                   AS usuario_execucao,
                   COALESCE(u1.fotoUsuario, u2.fotoUsuario) AS usuario_foto
            FROM pcp_programas_liberados p
            LEFT JOIN pcp_manutencao_maquinas m ON p.maquina_id = m.id
            LEFT JOIN (
                SELECT programa_id,
                       SUM(status = 'CONCLUIDA')                                   AS chapas_concluidas,
                       SUM(status = 'EM_ANDAMENTO')                                AS chapas_em_andamento,
                       SUM(CASE WHEN status = 'CONCLUIDA' THEN COALESCE(tempo_realizado_segundos,0) ELSE 0 END) AS total_realizado_segundos
                FROM pcp_programas_execucoes
                GROUP BY programa_id
            ) agg ON agg.programa_id = p.id
            LEFT JOIN (
                SELECT e1.programa_id, e1.usuario_apontamento
                FROM pcp_programas_execucoes e1
                INNER JOIN (SELECT programa_id, MAX(id) AS max_id FROM pcp_programas_execucoes GROUP BY programa_id) e2
                    ON e1.id = e2.max_id
            ) el ON el.programa_id = p.id
            LEFT JOIN (SELECT NomeCompleto, MAX(fotoUsuario) as fotoUsuario FROM usuario GROUP BY NomeCompleto) u1 ON u1.NomeCompleto = p.criado_por
            LEFT JOIN (SELECT NomeCompleto, MAX(fotoUsuario) as fotoUsuario FROM usuario GROUP BY NomeCompleto) u2 ON u2.NomeCompleto = el.usuario_apontamento
            ${filterClause}
            ORDER BY
                CASE WHEN p.status = 'CONCLUIDO' THEN 2 ELSE 1 END ASC,
                CASE WHEN p.ordem_execucao = 0 THEN 999999 ELSE p.ordem_execucao END ASC,
                p.id DESC
        `;

        const [programs] = await mysqlPool.query(query, params);
        res.json(programs);
    } catch (err) {
        console.error("Erro ao listar programas da máquina:", err);
        res.status(500).json({ error: "Erro interno ao buscar programas." });
    }
});

// 2.5 Reordenar programas CNC em lote
// PUT /api/pcp/programas/reordenar
router.put('/reordenar', async (req, res) => {
    try {
        const { programIds } = req.body;
        if (!Array.isArray(programIds)) {
            return res.status(400).json({ error: "Lista de IDs inválida." });
        }

        for (let i = 0; i < programIds.length; i++) {
            const id = programIds[i];
            const ordem = i + 1;
            await mysqlPool.query(
                `UPDATE pcp_programas_liberados SET ordem_execucao = ? WHERE id = ?`,
                [ordem, id]
            );
        }

        const io = req.app.get('io');
        if (io) io.emit('tv:programas_atualizados');

        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao reordenar programas:", err);
        res.status(500).json({ error: "Erro interno ao reordenar programas." });
    }
});

// ==========================================
// API DE CONFIGURAÇÃO DE TURNOS (pcp_turnos)
// ==========================================

// GET /api/pcp/programas/turnos
router.get('/turnos', async (req, res) => {
    try {
        const [turnos] = await mysqlPool.query('SELECT * FROM pcp_turnos WHERE ativo = true ORDER BY ordem ASC, hora_inicio ASC');
        res.json(turnos);
    } catch (err) {
        console.error("Erro ao listar turnos:", err);
        res.status(500).json({ error: "Erro interno ao buscar turnos." });
    }
});

// POST /api/pcp/programas/turnos
router.post('/turnos', async (req, res) => {
    try {
        const { nome, hora_inicio, hora_fim, intervalo_inicio, intervalo_fim, ordem } = req.body;
        if (!nome || !hora_inicio || !hora_fim) {
            return res.status(400).json({ error: 'Nome, hora de início e fim são obrigatórios.' });
        }
        
        const [result] = await mysqlPool.query(`
            INSERT INTO pcp_turnos (nome, hora_inicio, hora_fim, intervalo_inicio, intervalo_fim, ordem)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [nome, hora_inicio, hora_fim, intervalo_inicio || null, intervalo_fim || null, ordem || 0]);
        
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error("Erro ao criar turno:", err);
        res.status(500).json({ error: "Erro ao criar turno." });
    }
});

// PUT /api/pcp/programas/turnos/:id
router.put('/turnos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, hora_inicio, hora_fim, intervalo_inicio, intervalo_fim, ordem, ativo } = req.body;
        
        await mysqlPool.query(`
            UPDATE pcp_turnos 
            SET nome = ?, hora_inicio = ?, hora_fim = ?, intervalo_inicio = ?, intervalo_fim = ?, ordem = ?, ativo = ?
            WHERE id = ?
        `, [nome, hora_inicio, hora_fim, intervalo_inicio || null, intervalo_fim || null, ordem || 0, ativo !== false, id]);
        
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao atualizar turno:", err);
        res.status(500).json({ error: "Erro ao atualizar turno." });
    }
});

// DELETE /api/pcp/programas/turnos/:id
router.delete('/turnos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Soft delete para manter histórico
        await mysqlPool.query('UPDATE pcp_turnos SET ativo = false WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao excluir turno:", err);
        res.status(500).json({ error: "Erro ao excluir turno." });
    }
});

// ==========================================

// 3. Atualizar liberação (ou preencher campos de recebimento)
// PUT /api/pcp/programas/:id
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            maquina_id,
            nome_programa,
            data_criacao,
            tempo_previsto,
            tipo_material,
            quantidade_vezes,
            chapas_planejadas,
            criado_por,
            turno_previsao,
            recebedor_nome,
            recebido_data,
            recebido_hora,
            notas_instrucoes,
            status,
            ordem_execucao
        } = req.body;

        let chapasStr = undefined;
        let finalQty = quantidade_vezes;
        let avgTempo = tempo_previsto;

        if (req.body.hasOwnProperty('chapas_planejadas')) {
            const chapasArray = Array.isArray(chapas_planejadas)
                ? chapas_planejadas
                : (typeof chapas_planejadas === 'string' ? JSON.parse(chapas_planejadas) : []);

            // Suffix duplicate codes dynamically
            const counts = {};
            chapasArray.forEach(ch => {
                const code = ch.codigo ? ch.codigo.trim() : '';
                if (code) {
                    counts[code] = (counts[code] || 0) + 1;
                }
            });
            const countsTracker = {};
            const processedChapas = chapasArray.map(ch => {
                let code = ch.codigo ? ch.codigo.trim() : '';
                if (!code) return null;
                if (counts[code] > 1) {
                    countsTracker[code] = (countsTracker[code] || 0) + 1;
                    code = `${code} (${countsTracker[code]})`;
                }
                return {
                    codigo: code,
                    tempo: ch.tempo || '00:00:00',
                    tipo: ch.tipo || 'inteira'
                };
            }).filter(Boolean);

            chapasStr = JSON.stringify(processedChapas);
            finalQty = processedChapas.length > 0 ? processedChapas.length : finalQty;

            // Recalculate average expected time
            if (processedChapas.length > 0) {
                const totalSecs = processedChapas.reduce((sum, ch) => sum + hhmmssToSeconds(ch.tempo), 0);
                const avgSecs = Math.round(totalSecs / processedChapas.length);
                avgTempo = secondsToHhmmss(avgSecs);
            }
        }

        const queryParams = [];
        const updateFields = [];

        const addField = (fieldName, val, isNullable = false) => {
            if (val !== undefined) {
                updateFields.push(`${fieldName} = ?`);
                if (isNullable && (val === null || (typeof val === 'string' && val.trim() === ''))) {
                    queryParams.push(null);
                } else {
                    queryParams.push(val);
                }
            }
        };

        addField('maquina_id', maquina_id);
        addField('nome_programa', nome_programa);
        addField('data_criacao', data_criacao);
        if (req.body.hasOwnProperty('chapas_planejadas') || tempo_previsto !== undefined) {
            addField('tempo_previsto', avgTempo !== undefined ? avgTempo : null, true);
        }
        addField('tipo_material', tipo_material);
        if (req.body.hasOwnProperty('chapas_planejadas')) {
            addField('quantidade_vezes', finalQty);
            addField('chapas_planejadas', chapasStr, true);
        }
        addField('criado_por', criado_por);
        addField('turno_previsao', turno_previsao);
        addField('recebedor_nome', recebedor_nome, true);
        addField('recebido_data', recebido_data, true);
        addField('recebido_hora', recebido_hora, true);
        addField('notas_instrucoes', notas_instrucoes, true);
        addField('status', status);
        addField('ordem_execucao', ordem_execucao);

        if (updateFields.length === 0) {
            return res.json({ success: true, message: "Nenhum campo para atualizar." });
        }

        queryParams.push(id);
        await mysqlPool.query(`
            UPDATE pcp_programas_liberados
            SET ${updateFields.join(', ')}
            WHERE id = ?
        `, queryParams);

        const io = req.app.get('io');
        if (io) io.emit('tv:programas_atualizados');

        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao atualizar liberação:", err);
        res.status(500).json({ error: "Erro interno ao atualizar liberação." });
    }
});

// 4. Iniciar a execução de uma chapa
// POST /api/pcp/programas/:id/execucoes/iniciar
router.post('/:id/execucoes/iniciar', async (req, res) => {
    const { id } = req.params;
    const { chapa_numero, usuario_apontamento } = req.body;

    if (!chapa_numero || !usuario_apontamento) {
        return res.status(400).json({ error: 'Chapa e usuário são obrigatórios.' });
    }

    try {
        // Garantir que a chapa não esteja ativa ou concluída
        const [exists] = await mysqlPool.query(`
            SELECT status FROM pcp_programas_execucoes 
            WHERE programa_id = ? AND chapa_numero = ?
        `, [id, chapa_numero]);

        if (exists.length > 0 && exists.some(e => e.status === 'EM_ANDAMENTO')) {
            return res.status(400).json({ error: 'Esta chapa já possui uma execução em andamento.' });
        }

        // Criar registro de execução
        const [result] = await mysqlPool.query(`
            INSERT INTO pcp_programas_execucoes (programa_id, chapa_numero, hora_inicio, status, usuario_apontamento)
            VALUES (?, ?, CURRENT_TIMESTAMP, 'EM_ANDAMENTO', ?)
        `, [id, chapa_numero, usuario_apontamento]);

        // Atualizar status do programa para 'EM_EXECUCAO'
        await mysqlPool.query(`
            UPDATE pcp_programas_liberados SET status = 'EM_EXECUCAO' WHERE id = ?
        `, [id]);

        const io = req.app.get('io');
        if (io) io.emit('tv:programas_atualizados');

        res.json({ success: true, execucao_id: result.insertId });
    } catch (err) {
        console.error("Erro ao iniciar execução de chapa:", err);
        res.status(500).json({ error: "Erro interno ao iniciar chapa." });
    }
});

// 5. Concluir a execução de uma chapa
// PUT /api/pcp/programas/:id/execucoes/concluir
router.put('/:id/execucoes/concluir', async (req, res) => {
    const { id } = req.params;
    const { chapa_numero } = req.body;

    if (!chapa_numero) {
        return res.status(400).json({ error: 'Número da chapa é obrigatório.' });
    }

    try {
        // Encontrar execução em andamento
        const [active] = await mysqlPool.query(`
            SELECT id, hora_inicio FROM pcp_programas_execucoes
            WHERE programa_id = ? AND chapa_numero = ? AND status = 'EM_ANDAMENTO'
            ORDER BY id DESC LIMIT 1
        `, [id, chapa_numero]);

        if (active.length === 0) {
            return res.status(404).json({ error: 'Nenhuma execução em andamento encontrada para esta chapa.' });
        }

        const execId = active[0].id;

        // Atualizar execução
        await mysqlPool.query(`
            UPDATE pcp_programas_execucoes
            SET hora_fim = CURRENT_TIMESTAMP,
                tempo_realizado_segundos = TIMESTAMPDIFF(SECOND, hora_inicio, CURRENT_TIMESTAMP),
                status = 'CONCLUIDA'
            WHERE id = ?
        `, [execId]);

        const [updatedExec] = await mysqlPool.query(`SELECT tempo_realizado_segundos FROM pcp_programas_execucoes WHERE id = ?`, [execId]);
        const finalSeconds = updatedExec[0]?.tempo_realizado_segundos || 1;

        // Verificar se todas as chapas do programa foram concluídas
        const [prog] = await mysqlPool.query(`SELECT quantidade_vezes FROM pcp_programas_liberados WHERE id = ?`, [id]);
        const totalChapas = prog[0]?.quantidade_vezes || 1;

        const [concluded] = await mysqlPool.query(`
            SELECT COUNT(DISTINCT chapa_numero) AS total_concluidas
            FROM pcp_programas_execucoes
            WHERE programa_id = ? AND status = 'CONCLUIDA'
        `, [id]);

        const totalConcluidas = concluded[0]?.total_concluidas || 0;

        const io = req.app.get('io');
        if (io) io.emit('tv:programas_atualizados');

        res.json({ success: true, tempo_realizado_segundos: finalSeconds, total_concluidas: totalConcluidas });
    } catch (err) {
        console.error("Erro ao concluir execução de chapa:", err);
        res.status(500).json({ error: "Erro interno ao concluir chapa." });
    }
});

// 5.5 Cancelar e reiniciar a execução de uma chapa (resetar status para PENDENTE)
// POST /api/pcp/programas/:id/execucoes/cancelar
router.post('/:id/execucoes/cancelar', async (req, res) => {
    const { id } = req.params;
    const { chapa_numero } = req.body;

    if (!chapa_numero) {
        return res.status(400).json({ error: 'Número da chapa é obrigatório.' });
    }

    try {
        // 1. Deletar os registros de parada associados a esta chapa e programa
        await mysqlPool.query(`
            DELETE FROM pcp_programas_paradas 
            WHERE programa_id = ? AND chapa_numero = ?
        `, [id, chapa_numero]);

        // 2. Deletar os registros de execução associados a esta chapa e programa
        await mysqlPool.query(`
            DELETE FROM pcp_programas_execucoes 
            WHERE programa_id = ? AND chapa_numero = ?
        `, [id, chapa_numero]);

        // 3. Verificar se ainda restam outras execuções para este programa
        const [remaining] = await mysqlPool.query(`
            SELECT COUNT(*) AS count FROM pcp_programas_execucoes WHERE programa_id = ?
        `, [id]);

        const hasRemaining = remaining[0]?.count > 0;

        if (!hasRemaining) {
            // Se nenhuma chapa possui execução ativa ou concluída, o status do programa retorna para 'LIBERADO'
            await mysqlPool.query(`
                UPDATE pcp_programas_liberados SET status = 'LIBERADO' WHERE id = ?
            `, [id]);
        } else {
            // Se houver execuções de outras chapas, checar se alguma está EM_ANDAMENTO
            const [active] = await mysqlPool.query(`
                SELECT COUNT(*) AS count FROM pcp_programas_execucoes 
                WHERE programa_id = ? AND status = 'EM_ANDAMENTO'
            `, [id]);
            
            const hasActive = active[0]?.count > 0;
            if (hasActive) {
                await mysqlPool.query(`
                    UPDATE pcp_programas_liberados SET status = 'EM_EXECUCAO' WHERE id = ?
                `, [id]);
            } else {
                // Se o programa estava CONCLUIDO, mas uma chapa foi reiniciada, volta para EM_EXECUCAO
                const [prog] = await mysqlPool.query(`SELECT status FROM pcp_programas_liberados WHERE id = ?`, [id]);
                if (prog[0]?.status === 'CONCLUIDO') {
                    await mysqlPool.query(`
                        UPDATE pcp_programas_liberados SET status = 'EM_EXECUCAO' WHERE id = ?
                    `, [id]);
                }
            }
        }

        const io = req.app.get('io');
        if (io) io.emit('tv:programas_atualizados');

        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao cancelar/reiniciar execução de chapa:", err);
        res.status(500).json({ error: "Erro interno ao reiniciar chapa." });
    }
});

// 6. Listar todas as execuções de um programa
// GET /api/pcp/programas/:id/execucoes
router.get('/:id/execucoes', async (req, res) => {
    try {
        const { id } = req.params;
        const [execs] = await mysqlPool.query(`
            SELECT *,
                   TIMESTAMPDIFF(SECOND, hora_inicio, CURRENT_TIMESTAMP) AS tempo_decorrido_segundos
            FROM pcp_programas_execucoes 
            WHERE programa_id = ?
            ORDER BY chapa_numero ASC, id ASC
        `, [id]);

        res.json(execs);
    } catch (err) {
        console.error("Erro ao obter execuções:", err);
        res.status(500).json({ error: "Erro interno ao obter execuções." });
    }
});

// 7. Relatório de Comparação de Horas (Previsto vs. Realizado)
// GET /api/pcp/programas/relatorio-horas
router.get('/relatorio-horas', async (req, res) => {
    try {
        const query = `
            SELECT 
                p.id,
                p.nome_programa,
                p.data_criacao,
                p.tempo_previsto, -- Formato HH:MM:SS
                p.quantidade_vezes AS total_chapas,
                p.criado_por,
                p.turno_previsao,
                p.status,
                p.tipo_execucao,
                p.terceirizado_empresa,
                p.terceirizado_escopo,
                p.terceirizado_data_envio,
                p.terceirizado_data_retorno,
                m.nome AS maquina_nome,
                m.tag_identificacao AS maquina_tag,
                COALESCE(SUM(e.tempo_realizado_segundos), 0) AS total_realizado_segundos,
                COUNT(DISTINCT CASE WHEN e.status = 'CONCLUIDA' THEN e.chapa_numero END) AS chapas_concluidas,
                COALESCE((SELECT SUM(tempo_segundos) FROM pcp_programas_paradas WHERE programa_id = p.id), 0) AS total_parada_segundos
            FROM pcp_programas_liberados p
            INNER JOIN pcp_manutencao_maquinas m ON p.maquina_id = m.id
            LEFT JOIN pcp_programas_execucoes e ON p.id = e.programa_id
            GROUP BY p.id, m.id
            ORDER BY p.id DESC
        `;
        const [rows] = await mysqlPool.query(query);

        const relatorio = rows.map(r => {
            const tPrevUnitSeconds = hhmmssToSeconds(r.tempo_previsto);
            const totalPrevSeconds = tPrevUnitSeconds * r.total_chapas;

            const ef = totalPrevSeconds > 0 && r.total_realizado_segundos > 0 
                ? Math.round((totalPrevSeconds / r.total_realizado_segundos) * 100) 
                : 0;

            const tempoLiquidoSegundos = Math.max(0, r.total_realizado_segundos - r.total_parada_segundos);
            const efLiquida = totalPrevSeconds > 0 && tempoLiquidoSegundos > 0
                ? Math.round((totalPrevSeconds / tempoLiquidoSegundos) * 100)
                : 0;

            return {
                id: r.id,
                nome_programa: r.nome_programa,
                data_criacao: r.data_criacao,
                maquina_nome: r.maquina_nome,
                maquina_tag: r.maquina_tag,
                total_chapas: r.total_chapas,
                chapas_concluidas: r.chapas_concluidas,
                turno_previsao: r.turno_previsao,
                criado_por: r.criado_por,
                status: r.status,
                tipo_execucao: r.tipo_execucao,
                terceirizado_empresa: r.terceirizado_empresa,
                terceirizado_escopo: r.terceirizado_escopo,
                terceirizado_data_envio: r.terceirizado_data_envio,
                terceirizado_data_retorno: r.terceirizado_data_retorno,
                
                // Formatos amigáveis
                tempo_previsto_unitario: r.tempo_previsto,
                tempo_previsto_total: secondsToHhmmss(totalPrevSeconds),
                tempo_realizado_total: secondsToHhmmss(r.total_realizado_segundos),
                tempo_parada_total: secondsToHhmmss(r.total_parada_segundos),
                tempo_liquido_total: secondsToHhmmss(tempoLiquidoSegundos),
                eficiencia: ef,
                eficiencia_liquida: efLiquida
            };
        });

        res.json(relatorio);
    } catch (err) {
        console.error("Erro ao gerar relatório comparativo:", err);
        res.status(500).json({ error: "Erro interno ao gerar relatório." });
    }
});

// 8. Excluir Liberação de Programa
// DELETE /api/pcp/programas/:id
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await mysqlPool.query('DELETE FROM pcp_programas_liberados WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao excluir programa:", err);
        res.status(500).json({ error: "Erro interno ao excluir programa." });
    }
});

// 9. Iniciar Parada de Máquina
// POST /api/pcp/programas/:id/paradas/iniciar
router.post('/:id/paradas/iniciar', async (req, res) => {
    const { id } = req.params;
    const { chapa_numero, usuario_apontamento, motivo, observacoes } = req.body;

    if (!chapa_numero || !usuario_apontamento || !motivo) {
        return res.status(400).json({ error: 'Chapa, usuário e motivo são obrigatórios.' });
    }

    try {
        // Garantir que não haja parada já em andamento para esta chapa
        const [active] = await mysqlPool.query(`
            SELECT id FROM pcp_programas_paradas
            WHERE programa_id = ? AND chapa_numero = ? AND status = 'EM_ANDAMENTO'
        `, [id, chapa_numero]);

        if (active.length > 0) {
            return res.status(400).json({ error: 'Já existe uma parada em andamento para esta chapa.' });
        }

        // Criar registro de parada
        await mysqlPool.query(`
            INSERT INTO pcp_programas_paradas (programa_id, chapa_numero, usuario_apontamento, data_inicio, motivo, observacoes, status)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, 'EM_ANDAMENTO')
        `, [id, chapa_numero, usuario_apontamento, motivo, observacoes]);

        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao iniciar parada de máquina:", err);
        res.status(500).json({ error: "Erro interno ao registrar início da parada." });
    }
});

// 10. Concluir Parada de Máquina (Retomar)
// PUT /api/pcp/programas/:id/paradas/concluir
router.put('/:id/paradas/concluir', async (req, res) => {
    const { id } = req.params;
    const { chapa_numero } = req.body;

    if (!chapa_numero) {
        return res.status(400).json({ error: 'Número da chapa é obrigatório.' });
    }

    try {
        const [active] = await mysqlPool.query(`
            SELECT id, data_inicio FROM pcp_programas_paradas
            WHERE programa_id = ? AND chapa_numero = ? AND status = 'EM_ANDAMENTO'
            ORDER BY id DESC LIMIT 1
        `, [id, chapa_numero]);

        if (active.length === 0) {
            return res.status(404).json({ error: 'Nenhuma parada em andamento encontrada.' });
        }

        const paradaId = active[0].id;

        await mysqlPool.query(`
            UPDATE pcp_programas_paradas
            SET data_fim = CURRENT_TIMESTAMP,
                tempo_segundos = TIMESTAMPDIFF(SECOND, data_inicio, CURRENT_TIMESTAMP),
                status = 'CONCLUIDA'
            WHERE id = ?
        `, [paradaId]);

        const [updatedParada] = await mysqlPool.query(`SELECT tempo_segundos FROM pcp_programas_paradas WHERE id = ?`, [paradaId]);
        const finalParadaSeconds = updatedParada[0]?.tempo_segundos || 1;

        res.json({ success: true, tempo_segundos: finalParadaSeconds });
    } catch (err) {
        console.error("Erro ao concluir parada de máquina:", err);
        res.status(500).json({ error: "Erro interno ao concluir parada." });
    }
});

// 11. Listar paradas de um programa
// GET /api/pcp/programas/:id/paradas
router.get('/:id/paradas', async (req, res) => {
    try {
        const { id } = req.params;
        const [paradas] = await mysqlPool.query(`
            SELECT *,
                   TIMESTAMPDIFF(SECOND, data_inicio, CURRENT_TIMESTAMP) AS tempo_decorrido_segundos
            FROM pcp_programas_paradas
            WHERE programa_id = ?
            ORDER BY id ASC
        `, [id]);
        res.json(paradas);
    } catch (err) {
        console.error("Erro ao obter paradas:", err);
        res.status(500).json({ error: "Erro interno ao obter paradas." });
    }
});

// 12. Concluir Programa Inteiro (forçado ou fim natural)
router.put('/:id/concluir', async (req, res) => {
    try {
        const { id } = req.params;
        await mysqlPool.query(`UPDATE pcp_programas_liberados SET status = 'CONCLUIDO' WHERE id = ?`, [id]);
        const io = req.app.get('io');
        if (io) io.emit('tv:programas_atualizados');
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao concluir programa:", err);
        res.status(500).json({ error: "Erro interno" });
    }
});

// 11. Atualizar Data Base do Cálculo
router.put('/:id/base-time', async (req, res) => {
    try {
        const { id } = req.params;
        const { base_time_calculo } = req.body;
        
        let val = null;
        if (base_time_calculo) {
            val = new Date(base_time_calculo);
        }
        
        await mysqlPool.query(`UPDATE pcp_programas_liberados SET base_time_calculo = ? WHERE id = ?`, [val, id]);
        
        const io = req.app.get('io');
        if (io) io.emit('tv:programas_atualizados');
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao atualizar data base:", err);
        res.status(500).json({ error: "Erro interno" });
    }
});

// 13. Atualizar Dados de Terceirização
// PUT /api/pcp/programas/:id/terceirizacao
router.put('/:id/terceirizacao', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            tipo_execucao,
            terceirizado_empresa,
            terceirizado_escopo,
            terceirizado_data_envio,
            terceirizado_data_retorno
        } = req.body;

        await mysqlPool.query(`
            UPDATE pcp_programas_liberados
            SET tipo_execucao = ?,
                terceirizado_empresa = ?,
                terceirizado_escopo = ?,
                terceirizado_data_envio = ?,
                terceirizado_data_retorno = ?
            WHERE id = ?
        `, [
            tipo_execucao || 'INTERNA',
            tipo_execucao === 'TERCEIRIZADA' ? terceirizado_empresa : null,
            tipo_execucao === 'TERCEIRIZADA' ? terceirizado_escopo : null,
            tipo_execucao === 'TERCEIRIZADA' ? terceirizado_data_envio : null,
            tipo_execucao === 'TERCEIRIZADA' ? terceirizado_data_retorno : null,
            id
        ]);

        const io = req.app.get('io');
        if (io) io.emit('tv:programas_atualizados');

        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao atualizar dados de terceirização:", err);
        res.status(500).json({ error: "Erro interno ao atualizar terceirização." });
    }
});

module.exports = router;
