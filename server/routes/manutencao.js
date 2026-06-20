// Módulo de Manutenção de Equipamentos (Nodemon trigger comment)
const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');

// ==============================================
// 1. MÁQUINAS E EQUIPAMENTOS
// ==============================================

// GET /api/manutencao/maquinas
router.get('/maquinas', async (req, res) => {
    try {
        const query = `
            SELECT m.*, 
                   c.nome AS categoria_nome, 
                   s.nome AS setor_nome,
                   (SELECT o.sintoma FROM pcp_manutencao_ordens o 
                    WHERE o.id_maquina = m.id AND o.status IN ('SOLICITADA','EM_ANDAMENTO','AGUARDANDO_PECA') 
                    ORDER BY o.id DESC LIMIT 1) AS motivo_parada
            FROM pcp_manutencao_maquinas m
            LEFT JOIN pcp_manutencao_categorias c ON m.id_categoria = c.id
            LEFT JOIN pcp_setores s ON m.id_setor = s.id
            ORDER BY m.nome ASC
        `;
        const [rows] = await mysqlPool.query(query);
        
        const formatadas = rows.map(r => ({
            ...r,
            fotos: r.fotos ? JSON.parse(r.fotos) : [],
            documentos_pdf: r.documentos_pdf ? JSON.parse(r.documentos_pdf) : [],
            checklists_vinculados: r.checklists_vinculados ? JSON.parse(r.checklists_vinculados) : [],
            operadores_vinculados: r.operadores_vinculados ? JSON.parse(r.operadores_vinculados) : [],
            dados_aluguel: r.dados_aluguel ? JSON.parse(r.dados_aluguel) : {}
        }));

        res.json(formatadas);
    } catch (err) {
        console.error("Erro ao listar máquinas:", err);
        res.status(500).json({ error: "Erro interno ao listar máquinas" });
    }
});

// POST /api/manutencao/maquinas
router.post('/maquinas', async (req, res) => {
    try {
        const { nome, numero_serie, tag_identificacao, tipo, propriedade, id_categoria, id_setor, status, status_operacional, fotos, documentos_pdf, checklists_vinculados, operadores_vinculados, dados_aluguel } = req.body;
        const [result] = await mysqlPool.query(`
            INSERT INTO pcp_manutencao_maquinas (nome, numero_serie, tag_identificacao, tipo, propriedade, id_categoria, id_setor, status, status_operacional, fotos, documentos_pdf, checklists_vinculados, operadores_vinculados, dados_aluguel)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            nome,
            numero_serie || null,
            tag_identificacao || null,
            tipo || 'MAQUINA',
            propriedade || 'PROPRIO',
            id_categoria || null,
            id_setor || null,
            status || 'ATIVO',
            status_operacional || 'OPERANDO',
            fotos ? JSON.stringify(fotos) : '[]',
            documentos_pdf ? JSON.stringify(documentos_pdf) : '[]',
            checklists_vinculados ? JSON.stringify(checklists_vinculados) : '[]',
            operadores_vinculados ? JSON.stringify(operadores_vinculados) : '[]',
            dados_aluguel ? JSON.stringify(dados_aluguel) : '{}'
        ]);
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error("Erro ao criar máquina:", err);
        res.status(500).json({ error: "Erro interno ao criar máquina" });
    }
});

// PUT /api/manutencao/maquinas/:id
router.put('/maquinas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, numero_serie, tag_identificacao, tipo, propriedade, id_categoria, id_setor, status, status_operacional, fotos, documentos_pdf, checklists_vinculados, operadores_vinculados, dados_aluguel } = req.body;
        await mysqlPool.query(`
            UPDATE pcp_manutencao_maquinas
            SET nome=?, numero_serie=?, tag_identificacao=?, tipo=?, propriedade=?, id_categoria=?, id_setor=?,
                status=?, status_operacional=?, fotos=?, documentos_pdf=?,
                checklists_vinculados=?, operadores_vinculados=?, dados_aluguel=?
            WHERE id=?
        `, [
            nome,
            numero_serie || null,
            tag_identificacao || null,
            tipo || 'MAQUINA',
            propriedade || 'PROPRIO',
            id_categoria || null,
            id_setor || null,
            status || 'ATIVO',
            status_operacional || 'OPERANDO',
            fotos ? JSON.stringify(fotos) : '[]',
            documentos_pdf ? JSON.stringify(documentos_pdf) : '[]',
            checklists_vinculados ? JSON.stringify(checklists_vinculados) : '[]',
            operadores_vinculados ? JSON.stringify(operadores_vinculados) : '[]',
            dados_aluguel ? JSON.stringify(dados_aluguel) : '{}',
            id
        ]);
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao atualizar máquina:", err);
        res.status(500).json({ error: "Erro interno" });
    }
});

// DELETE /api/manutencao/maquinas/:id
router.delete('/maquinas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await mysqlPool.query('DELETE FROM pcp_manutencao_maquinas WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao deletar máquina:", err);
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ error: "Não é possível excluir esta máquina pois ela possui vínculos (ex: ordens de manutenção, históricos)." });
        }
        res.status(500).json({ error: "Erro interno ao deletar máquina" });
    }
});

// ==============================================
// 2. CATEGORIAS DE MANUTENÇÃO
// ==============================================
router.get('/categorias', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query('SELECT * FROM pcp_manutencao_categorias ORDER BY nome ASC');
        res.json(rows);
    } catch (err) {
        console.error("Erro ao listar categorias:", err);
        res.status(500).json({ error: "Erro interno ao listar categorias" });
    }
});

router.post('/categorias', async (req, res) => {
    try {
        const { nome, descricao } = req.body;
        const [result] = await mysqlPool.query('INSERT INTO pcp_manutencao_categorias (nome, descricao) VALUES (?, ?)', [nome, descricao]);
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error("Erro ao criar categoria:", err);
        res.status(500).json({ error: "Erro interno ao criar categoria" });
    }
});

// ==============================================
// 3. MODELOS DE CHECKLIST (POKA-YOKE)
// ==============================================
router.get('/checklists/modelos', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query('SELECT * FROM pcp_manutencao_checklists_modelos ORDER BY id DESC');
        const formatados = rows.map(r => ({
            ...r,
            itens: r.itens ? JSON.parse(r.itens) : [],
            turnos: r.turnos ? JSON.parse(r.turnos) : []
        }));
        res.json(formatados);
    } catch (err) {
        console.error("Erro ao listar modelos de checklist:", err);
        res.status(500).json({ error: "Erro interno" });
    }
});

router.post('/checklists/modelos', async (req, res) => {
    try {
        const { nome, observacoes, tipo, frequencia_dia, turnos, responsavel, itens, status } = req.body;
        const [result] = await mysqlPool.query(
            'INSERT INTO pcp_manutencao_checklists_modelos (nome, observacoes, tipo, frequencia_dia, turnos, responsavel, itens, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
            [
                nome, 
                observacoes || null, 
                tipo || 'DIARIO', 
                frequencia_dia || null,
                turnos ? JSON.stringify(turnos) : '[]',
                responsavel || 'OPERADOR',
                itens ? JSON.stringify(itens) : '[]', 
                status || 'ATIVO'
            ]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error("Erro ao criar modelo de checklist:", err);
        res.status(500).json({ error: "Erro interno" });
    }
});

// PUT /api/manutencao/checklists/modelos/:id
router.put('/checklists/modelos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, observacoes, tipo, frequencia_dia, turnos, responsavel, itens, status } = req.body;
        await mysqlPool.query(
            'UPDATE pcp_manutencao_checklists_modelos SET nome=?, observacoes=?, tipo=?, frequencia_dia=?, turnos=?, responsavel=?, itens=?, status=? WHERE id=?', 
            [
                nome, 
                observacoes || null, 
                tipo || 'DIARIO', 
                frequencia_dia || null,
                turnos ? JSON.stringify(turnos) : '[]',
                responsavel || 'OPERADOR',
                itens ? JSON.stringify(itens) : '[]', 
                status || 'ATIVO', 
                id
            ]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao atualizar modelo de checklist:", err);
        res.status(500).json({ error: "Erro interno" });
    }
});

// ==============================================
// FUNÇÃO AUXILIAR DE HISTÓRICO
// ==============================================
async function addHistory(ordem_id, usuario_id, usuario_nome, acao, detalhes) {
    try {
        await mysqlPool.query(
            'INSERT INTO pcp_manutencao_ordens_historico (ordem_id, usuario_id, usuario_nome, acao, detalhes) VALUES (?, ?, ?, ?, ?)',
            [ordem_id, usuario_id || null, usuario_nome || 'Sistema', acao, detalhes]
        );
    } catch (e) {
        console.error("Erro ao registrar historico:", e);
    }
}

// ==============================================
// 4. ORDENS DE MANUTENÇÃO
// ==============================================
router.get('/ordens', async (req, res) => {
    try {
        const query = `
            SELECT
                o.id,
                o.id_maquina,
                o.solicitante_id,
                o.tecnico_id,
                o.tecnicos_execucao,
                o.tipo        AS tipo_manutencao,
                o.status,
                o.sintoma     AS descricao_problema,
                o.prioridade,
                o.fotos,
                o.data_solicitacao AS data_abertura,
                o.data_inicio,
                o.data_fim,
                o.observacoes_tecnicas,
                o.atividades_realizadas,
                o.custo_materiais,
                o.custo_servico,
                m.nome        AS maquina_nome,
                u1.NomeCompleto AS solicitante_nome,
                u2.NomeCompleto AS tecnico_nome
            FROM pcp_manutencao_ordens o
            LEFT JOIN pcp_manutencao_maquinas m ON o.id_maquina = m.id
            LEFT JOIN usuario u1 ON o.solicitante_id = u1.idUsuario
            LEFT JOIN usuario u2 ON o.tecnico_id = u2.idUsuario
            ORDER BY o.data_solicitacao DESC
        `;
        const [rows] = await mysqlPool.query(query);
        res.json(rows);
    } catch (err) {
        console.error("Erro ao listar ordens:", err);
        res.status(500).json({ error: "Erro interno", details: err.message });
    }
});

router.post('/ordens', async (req, res) => {
    try {
        const { id_maquina, solicitante, descricao_problema, tipo_manutencao, prioridade, fotos } = req.body;
        const [result] = await mysqlPool.query(`
            INSERT INTO pcp_manutencao_ordens 
            (id_maquina, solicitante_id, sintoma, tipo, prioridade, fotos) 
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            id_maquina,
            solicitante || null,
            descricao_problema,
            tipo_manutencao || 'CORRETIVA',
            prioridade || 'MEDIA',
            fotos ? JSON.stringify(fotos) : '[]'
        ]);
        
        await addHistory(result.insertId, solicitante, req.body.usuario_nome || 'Sistema', 'CRIACAO', 'Ordem de manutenção aberta.');
        
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error("Erro ao abrir ordem de manutenção:", err);
        res.status(500).json({ error: "Erro interno", details: err.message });
    }
});

// Editar Ordem
router.put('/ordens/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { id_maquina, descricao_problema, tipo_manutencao, prioridade, status, usuario_id, usuario_nome } = req.body;
        
        await mysqlPool.query(`
            UPDATE pcp_manutencao_ordens 
            SET id_maquina=?, sintoma=?, tipo=?, prioridade=?, status=? 
            WHERE id=?
        `, [id_maquina, descricao_problema, tipo_manutencao, prioridade, status, id]);
        
        await addHistory(id, usuario_id, usuario_nome, 'EDICAO', 'Ordem de manutenção editada pelo usuário.');
        
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao editar ordem:", err);
        res.status(500).json({ error: "Erro interno" });
    }
});

// Histórico de uma Ordem
router.get('/ordens/:id/historico', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(
            'SELECT * FROM pcp_manutencao_ordens_historico WHERE ordem_id = ? ORDER BY data_hora DESC',
            [req.params.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Erro interno" });
    }
});

// ==========================================
// MATERIAIS DA ORDEM
// ==========================================
router.get('/ordens/:id/materiais', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query('SELECT * FROM pcp_manutencao_materiais WHERE ordem_id = ? ORDER BY criado_em DESC', [req.params.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Erro interno" });
    }
});

router.post('/ordens/:id/materiais', async (req, res) => {
    try {
        const { id } = req.params;
        const { codigo, descricao, quantidade, unidade, observacao, foto, is_novo, usuario_nome, usuario_id, custo_unitario } = req.body;
        
        const c_unit = parseFloat(custo_unitario) || 0;
        const c_tot = c_unit * parseFloat(quantidade || 0);

        await mysqlPool.query(`
            INSERT INTO pcp_manutencao_materiais (ordem_id, codigo, descricao, quantidade, unidade, observacao, foto, is_novo, criado_por, custo_unitario, custo_total)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, codigo || null, descricao, quantidade, unidade || 'UN', observacao || null, foto || null, is_novo ? 1 : 0, usuario_nome, c_unit, c_tot]);
        
        await addHistory(id, usuario_id, usuario_nome, 'MATERIAL_ADICIONADO', `Material adicionado: ${descricao} (Qtd: ${quantidade}, Custo: R$ ${c_tot.toFixed(2)})`);
        
        await mysqlPool.query('UPDATE pcp_manutencao_ordens SET custo_materiais = (SELECT COALESCE(SUM(custo_total),0) FROM pcp_manutencao_materiais WHERE ordem_id = ?) WHERE id = ?', [id, id]);

        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao adicionar material:", err);
        res.status(500).json({ error: "Erro interno" });
    }
});

router.delete('/ordens/:id/materiais/:idMaterial', async (req, res) => {
    try {
        const { id, idMaterial } = req.params;
        const { usuario_id, usuario_nome } = req.query;
        
        const [mat] = await mysqlPool.query('SELECT descricao FROM pcp_manutencao_materiais WHERE id = ?', [idMaterial]);
        const desc = mat[0] ? mat[0].descricao : 'Material desconhecido';
        
        await mysqlPool.query('DELETE FROM pcp_manutencao_materiais WHERE id = ?', [idMaterial]);
        
        await addHistory(id, usuario_id, usuario_nome, 'MATERIAL_REMOVIDO', `Material removido: ${desc}`);
        
        await mysqlPool.query('UPDATE pcp_manutencao_ordens SET custo_materiais = (SELECT COALESCE(SUM(custo_total),0) FROM pcp_manutencao_materiais WHERE ordem_id = ?) WHERE id = ?', [id, id]);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Erro interno" });
    }
});

// ==========================================
// GESTÃO GLOBAL DE MATERIAIS (PLANEJAMENTO)
// ==========================================

router.get('/materiais', async (req, res) => {
    try {
        const query = `
            SELECT 
                m.id, m.ordem_id, m.codigo, m.descricao, m.quantidade, m.unidade,
                m.observacao, m.is_novo, m.criado_por, m.criado_em,
                m.status, m.data_prevista_compras, m.data_prevista_chegada, m.data_prevista_montagem,
                m.obs_compras, m.obs_chegada, m.obs_montagem, m.descricao_planejamento,
                o.status AS status_ordem, o.prioridade AS prioridade_ordem,
                maq.nome AS maquina_nome, maq.tag_identificacao AS maquina_tag,
                s.nome AS setor_nome
            FROM pcp_manutencao_materiais m
            JOIN pcp_manutencao_ordens o ON m.ordem_id = o.id
            LEFT JOIN pcp_manutencao_maquinas maq ON o.id_maquina = maq.id
            LEFT JOIN pcp_setores s ON maq.id_setor = s.id
            ORDER BY m.criado_em DESC
        `;
        const [rows] = await mysqlPool.query(query);
        res.json(rows);
    } catch (err) {
        console.error("Erro ao listar todos os materiais:", err);
        res.status(500).json({ error: "Erro interno" });
    }
});

router.put('/materiais/:id/planejamento', async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            status, 
            data_prevista_compras, data_prevista_chegada, data_prevista_montagem, 
            obs_compras, obs_chegada, obs_montagem, descricao_planejamento,
            usuario_id, usuario_nome 
        } = req.body;
        
        // Buscar ordem associada para o histórico e valores antigos
        const [mat] = await mysqlPool.query(`
            SELECT ordem_id, descricao, status, data_prevista_compras, data_prevista_chegada, data_prevista_montagem,
                   obs_compras, obs_chegada, obs_montagem, descricao_planejamento
            FROM pcp_manutencao_materiais WHERE id = ?
        `, [id]);
        if (!mat.length) return res.status(404).json({ error: "Material não encontrado" });
        
        const ordem_id = mat[0].ordem_id;
        const descricao = mat[0].descricao;
        const oldStatus = mat[0].status;

        // Helper para garantir formato de data YYYY-MM-DD pro MySQL
        const sanitizeDate = (d) => {
            if (!d) return null;
            return typeof d === 'string' ? d.split('T')[0] : null;
        };

        // Executar a atualização do material
        await mysqlPool.query(`
            UPDATE pcp_manutencao_materiais 
            SET status = ?, data_prevista_compras = ?, data_prevista_chegada = ?, data_prevista_montagem = ?,
                obs_compras = ?, obs_chegada = ?, obs_montagem = ?, descricao_planejamento = ?
            WHERE id = ?
        `, [
            status, 
            sanitizeDate(data_prevista_compras), 
            sanitizeDate(data_prevista_chegada), 
            sanitizeDate(data_prevista_montagem), 
            obs_compras || null,
            obs_chegada || null,
            obs_montagem || null,
            descricao_planejamento || null,
            id
        ]);

        // Comparar o que mudou para registrar no histórico
        let changes = [];
        
        if (oldStatus !== status) {
            changes.push(`Status: ${oldStatus} -> ${status}`);
        }
        
        // Helper para formatar data DD/MM/YYYY para o histórico
        const formatDbDate = (d) => {
            if (!d) return 'Não definida';
            try {
                if (typeof d === 'string') {
                    const dateParts = d.split('T')[0].split('-');
                    if (dateParts.length !== 3) return 'Data Inválida';
                    return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
                }
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yy = d.getFullYear();
                return `${dd}/${mm}/${yy}`;
            } catch (e) {
                return 'Data Inválida';
            }
        };

        const oldDCom = mat[0].data_prevista_compras;
        const newDCom = data_prevista_compras;
        if ((oldDCom ? formatDbDate(oldDCom) : 'Não definida') !== (newDCom ? formatDbDate(newDCom) : 'Não definida')) {
            changes.push(`Prev. Compras: ${formatDbDate(oldDCom)} -> ${formatDbDate(newDCom)}`);
        }

        const oldDChe = mat[0].data_prevista_chegada;
        const newDChe = data_prevista_chegada;
        if ((oldDChe ? formatDbDate(oldDChe) : 'Não definida') !== (newDChe ? formatDbDate(newDChe) : 'Não definida')) {
            changes.push(`Prev. Chegada: ${formatDbDate(oldDChe)} -> ${formatDbDate(newDChe)}`);
        }

        const oldDMon = mat[0].data_prevista_montagem;
        const newDMon = data_prevista_montagem;
        if ((oldDMon ? formatDbDate(oldDMon) : 'Não definida') !== (newDMon ? formatDbDate(newDMon) : 'Não definida')) {
            changes.push(`Prev. Montagem: ${formatDbDate(oldDMon)} -> ${formatDbDate(newDMon)}`);
        }
        
        if ((mat[0].descricao_planejamento || '') !== (descricao_planejamento || '')) changes.push('Descrição Atualizada');
        if ((mat[0].obs_compras || '') !== (obs_compras || '')) changes.push('Obs Compras Atualizada');
        if ((mat[0].obs_chegada || '') !== (obs_chegada || '')) changes.push('Obs Chegada Atualizada');
        if ((mat[0].obs_montagem || '') !== (obs_montagem || '')) changes.push('Obs Montagem Atualizada');

        let histMsg = `Planejamento do material '${descricao}' atualizado. `;
        if (changes.length > 0) {
            histMsg += changes.join(' | ');
        } else {
            histMsg += "Nenhuma alteração efetiva registrada.";
        }

        await addHistory(ordem_id, usuario_id, usuario_nome, 'MATERIAL_PLANEJAMENTO', histMsg);
        
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao atualizar planejamento do material:", err);
        res.status(500).json({ error: "Erro interno" });
    }
});

// ==========================================
// TÉCNICOS DE MANUTENÇÃO
// ==========================================

// Listar todos os técnicos cadastrados
router.get('/tecnicos', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(`
            SELECT t.id, t.id_usuario, t.especialidade, t.ativo, u.NomeCompleto, u.Funcao, u.fotoUsuario 
            FROM pcp_manutencao_tecnicos t
            JOIN usuario u ON t.id_usuario = u.idUsuario
            WHERE t.ativo = 1
            ORDER BY u.NomeCompleto ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error("Erro ao listar técnicos:", err);
        res.status(500).json({ error: "Erro interno", details: err.message });
    }
});

// Listar usuários disponíveis para se tornarem técnicos
router.get('/usuarios_disponiveis', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(`
            SELECT idUsuario, NomeCompleto, Funcao 
            FROM usuario 
            WHERE idUsuario NOT IN (SELECT id_usuario FROM pcp_manutencao_tecnicos WHERE ativo = 1)
            ORDER BY NomeCompleto ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error("Erro ao listar usuários disponíveis:", err);
        res.status(500).json({ error: "Erro interno", details: err.message });
    }
});

// Cadastrar novo técnico
router.post('/tecnicos', async (req, res) => {
    try {
        const { id_usuario, especialidade } = req.body;
        await mysqlPool.query(`
            INSERT INTO pcp_manutencao_tecnicos (id_usuario, especialidade) 
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE ativo = 1, especialidade = VALUES(especialidade)
        `, [id_usuario, especialidade || 'GERAL']);
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao cadastrar técnico:", err);
        res.status(500).json({ error: "Erro interno", details: err.message });
    }
});

// Desativar técnico
router.delete('/tecnicos/:id', async (req, res) => {
    try {
        await mysqlPool.query(`UPDATE pcp_manutencao_tecnicos SET ativo = 0 WHERE id = ?`, [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao desativar técnico:", err);
        res.status(500).json({ error: "Erro interno", details: err.message });
    }
});

// ==========================================
// EXECUÇÃO DE ORDEM DE MANUTENÇÃO
// ==========================================

router.put('/ordens/:id/executar', async (req, res) => {
    try {
        const { id } = req.params;
        const { tecnicos_execucao, atividades_realizadas, fotos_execucao, resolvido, tempo_execucao_segundos, usuario_id, usuario_nome } = req.body;
        
        await mysqlPool.query(`
            UPDATE pcp_manutencao_ordens 
            SET 
                tecnicos_execucao = ?, 
                atividades_realizadas = ?, 
                fotos_execucao = ?, 
                resolvido = ?, 
                status = 'CONCLUIDA', 
                data_fim = CURRENT_TIMESTAMP,
                tempo_execucao_segundos = ?
            WHERE id = ?
        `, [
            tecnicos_execucao ? JSON.stringify(tecnicos_execucao) : '[]', 
            atividades_realizadas, 
            fotos_execucao ? JSON.stringify(fotos_execucao) : '[]', 
            resolvido ? 1 : 0, 
            tempo_execucao_segundos || 0,
            id
        ]);
        
        await addHistory(id, usuario_id, usuario_nome, 'EXECUCAO', 'Ordem executada e concluída.');
        
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao executar ordem de manutenção:", err);
        res.status(500).json({ error: "Erro interno", details: err.message });
    }
});

// ==========================================
// SOLICITAÇÕES DE COMPRAS (MANUTENÇÃO)
// ==========================================
router.post('/solicitacoes-compras', async (req, res) => {
    try {
        const { destinatarios, assunto, corpo, materiais_editados, usuario_nome } = req.body;
        
        // Gerar número
        const [last] = await mysqlPool.query('SELECT MAX(id) as maxId FROM pcp_manutencao_solicitacoes_compras');
        const nextId = (last[0].maxId || 0) + 1;
        const numSolicitacao = `SC-MANUT-${nextId.toString().padStart(4, '0')}`;

        await mysqlPool.query(`
            INSERT INTO pcp_manutencao_solicitacoes_compras 
            (numero_solicitacao, destinatarios, assunto, corpo, materiais_ids, criado_por) 
            VALUES (?, ?, ?, ?, ?, ?)
        `, [numSolicitacao, destinatarios, assunto, corpo, JSON.stringify(materiais_editados), usuario_nome]);

        // Atualizar status dos materiais, ajustar quantidade se editado e registrar historico
        for (const mat of materiais_editados) {
            const [matDb] = await mysqlPool.query('SELECT ordem_id, descricao, quantidade FROM pcp_manutencao_materiais WHERE id = ?', [mat.id]);
            if (matDb.length > 0) {
                // Atualiza status para compras e a quantidade se foi editada no carrinho
                await mysqlPool.query('UPDATE pcp_manutencao_materiais SET status = ?, quantidade = ? WHERE id = ?', ['COMPRAS', mat.quantidade, mat.id]);
                
                const qtdeInfo = parseFloat(matDb[0].quantidade) !== parseFloat(mat.quantidade) 
                    ? ` (Qtde ajustada de ${matDb[0].quantidade} para ${mat.quantidade})` 
                    : '';
                    
                const histMsg = `Material '${matDb[0].descricao}' enviado para compras via solicitação ${numSolicitacao}${qtdeInfo}.`;
                await addHistory(matDb[0].ordem_id, null, usuario_nome, 'MATERIAL_PLANEJAMENTO', histMsg);
            }
        }

        res.json({ success: true, numero_solicitacao: numSolicitacao });
    } catch (err) {
        console.error("Erro ao criar solicitação de compras:", err);
        res.status(500).json({ error: "Erro interno" });
    }
});

// ==========================================
// ATIVIDADES (CHECKLISTS + OMs unificados)
// ==========================================

// GET /api/manutencao/atividades?data=YYYY-MM-DD
router.get('/atividades', async (req, res) => {
    const dataRef = req.query.data || new Date().toISOString().slice(0, 10);
    try {
        const [maquinas] = await mysqlPool.query(`
            SELECT id, nome, tag_identificacao, tipo, status_operacional,
                   checklists_vinculados, operadores_vinculados
            FROM pcp_manutencao_maquinas WHERE status = 'ATIVO'
        `);
        const [modelos] = await mysqlPool.query(`
            SELECT id, nome, tipo, frequencia_dia, turnos, responsavel, itens
            FROM pcp_manutencao_checklists_modelos WHERE status = 'ATIVO'
        `);
        const [diarios] = await mysqlPool.query(`
            SELECT cd.*, u.NomeCompleto AS operador_nome
            FROM pcp_manutencao_checklists_diarios cd
            LEFT JOIN usuario u ON cd.id_operador = u.idUsuario
            WHERE cd.data_verificacao = ?
        `, [dataRef]);
        const [ordens] = await mysqlPool.query(`
            SELECT o.id, o.id_maquina, o.solicitante_id, o.tecnico_id,
                   o.tipo AS tipo_manutencao, o.status,
                   o.sintoma AS descricao_problema, o.prioridade,
                   o.data_solicitacao AS data_abertura,
                   o.data_inicio, o.observacoes_tecnicas,
                   m.nome AS maquina_nome, m.tag_identificacao,
                   m.tipo AS maquina_tipo,
                   u1.NomeCompleto AS solicitante_nome,
                   u2.NomeCompleto AS tecnico_nome
            FROM pcp_manutencao_ordens o
            LEFT JOIN pcp_manutencao_maquinas m ON o.id_maquina = m.id
            LEFT JOIN usuario u1 ON o.solicitante_id = u1.idUsuario
            LEFT JOIN usuario u2 ON o.tecnico_id = u2.idUsuario
            WHERE o.status IN ('SOLICITADA','EM_ANDAMENTO','AGUARDANDO_PECA')
            ORDER BY FIELD(o.prioridade,'CRITICA','ALTA','MEDIA','BAIXA'),
                     o.data_solicitacao ASC
        `);

        // Helpers to determine if a checklist should be executed today
        const dateObj = new Date(dataRef + "T00:00:00");
        const daysOfWeek = ['DOMINGO','SEGUNDA','TERCA','QUARTA','QUINTA','SEXTA','SABADO'];
        const dayOfWeekStr = daysOfWeek[dateObj.getDay()];
        const dayOfMonthStr = dateObj.getDate().toString();

        const tarefas = [];
        for (const maq of maquinas) {
            let ckIds = [], ops = [];
            try { ckIds = maq.checklists_vinculados ? JSON.parse(maq.checklists_vinculados) : []; } catch(e) {}
            try { ops   = maq.operadores_vinculados  ? JSON.parse(maq.operadores_vinculados)  : []; } catch(e) {}

            for (const idModelo of ckIds) {
                const modelo = modelos.find(m => m.id == idModelo);
                if (!modelo) continue;

                // Frequence Check
                let shouldExecuteToday = true;
                if (modelo.tipo === 'SEMANAL') {
                    if (modelo.frequencia_dia !== dayOfWeekStr) shouldExecuteToday = false;
                } else if (modelo.tipo === 'MENSAL') {
                    if (modelo.frequencia_dia !== dayOfMonthStr && modelo.frequencia_dia !== dayOfMonthStr.padStart(2, '0')) shouldExecuteToday = false;
                } else if (modelo.tipo === 'QUINZENAL') {
                    const days = modelo.frequencia_dia ? modelo.frequencia_dia.split(',').map(s => s.trim()) : [];
                    if (!days.includes(dayOfMonthStr) && !days.includes(dayOfMonthStr.padStart(2, '0'))) shouldExecuteToday = false;
                } else if (modelo.tipo === 'TRIMESTRAL' || modelo.tipo === 'ANUAL') {
                    const monthStr = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const dayMonthStr = dayOfMonthStr.padStart(2, '0') + '/' + monthStr;
                    const validDates = modelo.frequencia_dia ? modelo.frequencia_dia.split(',').map(s => s.trim()) : [];
                    if (!validDates.includes(dayMonthStr)) shouldExecuteToday = false;
                }
                
                if (!shouldExecuteToday && modelo.tipo !== 'PREVENTIVA') continue;

                let turnos_req = [];
                if (modelo.tipo === 'DIARIO') {
                    try { turnos_req = modelo.turnos ? JSON.parse(modelo.turnos) : []; } catch(e) {}
                }
                
                if (turnos_req.length === 0) {
                    turnos_req = [null]; // Executa 1 vez independente do turno
                }

                let itens = [];
                try { itens = modelo.itens ? JSON.parse(modelo.itens) : []; } catch(e) {}

                for (const t of turnos_req) {
                    const feito = diarios.find(d => 
                        d.id_maquina == maq.id && 
                        d.id_modelo_checklist == idModelo &&
                        (d.turno == t || (!d.turno && !t))
                    );

                    tarefas.push({
                        key: `${maq.id}-${idModelo}${t ? '-' + t : ''}`,
                        id_maquina:          maq.id,
                        maquina_nome:        maq.nome,
                        maquina_tag:         maq.tag_identificacao,
                        maquina_tipo:        maq.tipo || 'MAQUINA',
                        status_operacional:  maq.status_operacional,
                        operadores:          ops,
                        id_modelo:           modelo.id,
                        modelo_nome:         modelo.nome,
                        modelo_tipo:         modelo.tipo,
                        turno_req:           t,
                        responsavel:         modelo.responsavel || 'OPERADOR',
                        num_itens:           itens.length,
                        itens,
                        status:              feito ? feito.status_geral : 'PENDENTE',
                        id_preenchimento:    feito ? feito.id : null,
                        operador_nome:       feito ? feito.operador_nome : null,
                        data_preenchimento:  feito ? feito.criado_em : null
                    });
                }
            }
        }

        res.json({ data: dataRef, checklists: tarefas, ordens });
    } catch (err) {
        console.error("Erro ao buscar atividades:", err);
        res.status(500).json({ error: "Erro interno", details: err.message });
    }
});

// POST /api/manutencao/checklists/diarios — salva preenchimento do dia
router.post('/checklists/diarios', async (req, res) => {
    try {
        const { id_maquina, id_modelo_checklist, id_operador, data_verificacao, turno, status_geral, respostas } = req.body;
        const [result] = await mysqlPool.query(`
            INSERT INTO pcp_manutencao_checklists_diarios
            (id_maquina, id_modelo_checklist, id_operador, data_verificacao, turno, status_geral, respostas)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            id_maquina,
            id_modelo_checklist || null,
            id_operador || null,
            data_verificacao,
            turno || null,
            status_geral,
            JSON.stringify(respostas || [])
        ]);
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error("Erro ao salvar checklist diário:", err);
        res.status(500).json({ error: "Erro interno", details: err.message });
    }
});

// GET /api/manutencao/checklists/diarios?data=&id_maquina=
router.get('/checklists/diarios', async (req, res) => {
    try {
        const { data, id_maquina } = req.query;
        let sql = `
            SELECT cd.*, m.nome AS maquina_nome,
                   u.NomeCompleto AS operador_nome,
                   cm.nome AS modelo_nome
            FROM pcp_manutencao_checklists_diarios cd
            LEFT JOIN pcp_manutencao_maquinas m ON cd.id_maquina = m.id
            LEFT JOIN usuario u ON cd.id_operador = u.idUsuario
            LEFT JOIN pcp_manutencao_checklists_modelos cm ON cd.id_modelo_checklist = cm.id
            WHERE 1=1
        `;
        const params = [];
        if (data)       { sql += ' AND cd.data_verificacao = ?'; params.push(data); }
        if (id_maquina) { sql += ' AND cd.id_maquina = ?';       params.push(id_maquina); }
        sql += ' ORDER BY cd.criado_em DESC';

        const [rows] = await mysqlPool.query(sql, params);
        res.json(rows.map(r => ({ ...r, respostas: r.respostas ? JSON.parse(r.respostas) : [] })));
    } catch (err) {
        console.error("Erro ao listar checklists diários:", err);
        res.status(500).json({ error: "Erro interno", details: err.message });
    }
});

// PUT /api/manutencao/ordens/:id/status — atualiza status de uma OM
router.put('/ordens/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, tecnico_id, observacoes_tecnicas, usuario_id, usuario_nome } = req.body;

        const sets = ['status = ?'];
        const vals = [status];

        if (status === 'EM_ANDAMENTO') {
            sets.push('data_inicio = NOW()');
            if (tecnico_id) { sets.push('tecnico_id = ?'); vals.push(tecnico_id); }
        } else if (status === 'CONCLUIDA') {
            sets.push('data_fim = NOW()');
        }
        if (observacoes_tecnicas !== undefined) {
            sets.push('observacoes_tecnicas = ?');
            vals.push(observacoes_tecnicas);
        }
        vals.push(id);

        await mysqlPool.query(
            `UPDATE pcp_manutencao_ordens SET ${sets.join(', ')} WHERE id = ?`,
            vals
        );
        await addHistory(id, usuario_id, usuario_nome || 'Sistema', 'STATUS', `Status atualizado para ${status}.`);
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao atualizar status da ordem:", err);
        res.status(500).json({ error: "Erro interno", details: err.message });
    }
});

module.exports = router;
