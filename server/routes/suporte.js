const express = require('express');
const router = express.Router();
const db = require('../services/mysqlService');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

router.use(tenantMiddleware);

// Função atômica para geração de código sequencial anual CHM-AAAA-XXXX
async function gerarCodigoChamado(tenantId = 1) {
    const ano = new Date().getFullYear();
    const prefixo = `CHM-${ano}-`;
    const [rows] = await db.query(
        "SELECT codigo FROM suporte_chamados WHERE (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1)) AND codigo LIKE ? ORDER BY id DESC LIMIT 1",
        [tenantId, tenantId, `${prefixo}%`]
    );
    if (rows.length === 0) return `${prefixo}0001`;
    const numPart = parseInt(rows[0].codigo.replace(prefixo, ''), 10) || 0;
    return `${prefixo}${String(numPart + 1).padStart(4, '0')}`;
}

// ── 1. GESTÃO DE CHAMADOS ───────────────────────────────────────

// GET /api/suporte/chamados - Lista chamados com filtros
router.get('/chamados', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const { status, prioridade, modulo, meus_chamados } = req.query;
        const userId = req.user.id || req.user.idUsuario;

        let query = `
            SELECT c.*,
                COUNT(DISTINCT m.id) AS total_mensagens,
                COUNT(DISTINCT a.id) AS total_anexos
            FROM suporte_chamados c
            LEFT JOIN suporte_mensagens m ON m.chamado_id = c.id
            LEFT JOIN suporte_anexos a ON a.chamado_id = c.id
            WHERE (c.IdEmpresa = ? OR (c.IdEmpresa IS NULL AND ? = 1))
        `;
        const params = [tenantId, tenantId];

        if (meus_chamados === 'true' && !req.isSuperAdmin) {
            query += ` AND (c.solicitante_id = ? OR c.responsavel_id = ?)`;
            params.push(userId, userId);
        }
        if (status) {
            query += ` AND c.status = ?`;
            params.push(status);
        }
        if (prioridade) {
            query += ` AND c.prioridade = ?`;
            params.push(prioridade);
        }
        if (modulo) {
            query += ` AND c.modulo = ?`;
            params.push(modulo);
        }

        query += ` GROUP BY c.id ORDER BY c.created_at DESC`;

        const [chamados] = await db.query(query, params);
        res.json({ chamados });
    } catch (err) {
        console.error('Erro ao listar chamados:', err);
        res.status(500).json({ error: 'Erro ao carregar chamados.' });
    }
});

// GET /api/suporte/chamados/:id - Detalhes do chamado, timeline e anexos
router.get('/chamados/:id', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const { id } = req.params;

        const [chamadoRows] = await db.query(`
            SELECT * FROM suporte_chamados 
            WHERE id = ? AND (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1))
        `, [id, tenantId, tenantId]);

        if (chamadoRows.length === 0) {
            return res.status(404).json({ error: 'Chamado não encontrado.' });
        }
        const chamado = chamadoRows[0];

        // Mensagens / Chat timeline
        const [mensagens] = await db.query(`
            SELECT * FROM suporte_mensagens WHERE chamado_id = ? ORDER BY created_at ASC
        `, [id]);

        // Anexos
        const [anexos] = await db.query(`
            SELECT id, chamado_id, mensagem_id, nome_original, mimetype, tamanho_bytes, created_at,
                   dados_base64
            FROM suporte_anexos WHERE chamado_id = ?
        `, [id]);

        res.json({ chamado, mensagens, anexos });
    } catch (err) {
        console.error('Erro ao buscar detalhes do chamado:', err);
        res.status(500).json({ error: 'Erro ao carregar chamado.' });
    }
});

// POST /api/suporte/chamados - Abre novo chamado
router.post('/chamados', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const solicitante_id = req.user.id || req.user.idUsuario;
        const solicitante_nome = req.user.nome || req.user.NomeCompleto || req.user.login;
        const solicitante_setor = req.user.Setor || req.user.setor || 'Geral';

        const { titulo, descricao, erros_console, modulo, tipo_solicitacao = 'problema', prioridade = 'media', anexos } = req.body;

        if (!titulo || !descricao || !modulo) {
            return res.status(400).json({ error: 'Título, descrição e módulo são obrigatórios.' });
        }

        const codigo = await gerarCodigoChamado(tenantId);

        const [result] = await db.query(`
            INSERT INTO suporte_chamados (
                IdEmpresa, codigo, titulo, descricao, erros_console, modulo,
                tipo_solicitacao, prioridade, status, visibilidade,
                solicitante_id, solicitante_nome, solicitante_setor
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aberto', 'privado', ?, ?, ?)
        `, [
            tenantId, codigo, titulo, descricao, erros_console || null, modulo,
            tipo_solicitacao, prioridade, solicitante_id, solicitante_nome, solicitante_setor
        ]);

        const chamadoId = result.insertId;

        // Inserir anexos se fornecidos
        if (Array.isArray(anexos) && anexos.length > 0) {
            for (const a of anexos) {
                if (a.dados_base64) {
                    await db.query(`
                        INSERT INTO suporte_anexos (
                            chamado_id, nome_original, mimetype, dados_base64, tamanho_bytes
                        ) VALUES (?, ?, ?, ?, ?)
                    `, [chamadoId, a.nome || 'anexo.png', a.mimetype || 'image/png', a.dados_base64, a.tamanho || 0]);
                }
            }
        }

        // Mensagem inicial do sistema
        await db.query(`
            INSERT INTO suporte_mensagens (
                chamado_id, usuario_id, usuario_nome, is_suporte, mensagem, tipo
            ) VALUES (?, ?, ?, 0, ?, 'mensagem')
        `, [chamadoId, solicitante_id, solicitante_nome, `Chamado aberto com prioridade ${prioridade.toUpperCase()}`]);

        res.json({ id: chamadoId, codigo, message: `Chamado ${codigo} aberto com sucesso!` });
    } catch (err) {
        console.error('Erro ao abrir chamado:', err);
        res.status(500).json({ error: 'Erro ao abrir chamado de suporte.' });
    }
});

// POST /api/suporte/chamados/:id/mensagens - Adiciona mensagem no chat
router.post('/chamados/:id/mensagens', async (req, res) => {
    try {
        const { id } = req.params;
        const usuario_id = req.user.id || req.user.idUsuario;
        const usuario_nome = req.user.nome || req.user.NomeCompleto || req.user.login;
        const is_suporte = (req.user.tipo === 'admin' || req.user.tipo === 'superadmin' || req.isSuperAdmin) ? 1 : 0;

        const { mensagem, anexos } = req.body;

        if (!mensagem && (!anexos || anexos.length === 0)) {
            return res.status(400).json({ error: 'A mensagem ou anexo é obrigatório.' });
        }

        const [msgResult] = await db.query(`
            INSERT INTO suporte_mensagens (
                chamado_id, usuario_id, usuario_nome, is_suporte, mensagem, tipo
            ) VALUES (?, ?, ?, ?, ?, 'mensagem')
        `, [id, usuario_id, usuario_nome, is_suporte, mensagem || 'Anexo enviado']);

        const mensagemId = msgResult.insertId;

        // Salvar anexos atrelados à mensagem
        if (Array.isArray(anexos) && anexos.length > 0) {
            for (const a of anexos) {
                if (a.dados_base64) {
                    await db.query(`
                        INSERT INTO suporte_anexos (
                            chamado_id, mensagem_id, nome_original, mimetype, dados_base64, tamanho_bytes
                        ) VALUES (?, ?, ?, ?, ?, ?)
                    `, [id, mensagemId, a.nome || 'anexo.png', a.mimetype || 'image/png', a.dados_base64, a.tamanho || 0]);
                }
            }
        }

        res.json({ id: mensagemId, message: 'Mensagem enviada com sucesso!' });
    } catch (err) {
        console.error('Erro ao enviar mensagem no chamado:', err);
        res.status(500).json({ error: 'Erro ao enviar mensagem.' });
    }
});

// PATCH /api/suporte/chamados/:id/status - Altera status do chamado
router.patch('/chamados/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const usuario_id = req.user.id || req.user.idUsuario;
        const usuario_nome = req.user.nome || req.user.NomeCompleto || req.user.login;

        const closedAt = (status === 'resolvido' || status === 'fechado') ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;

        await db.query(`
            UPDATE suporte_chamados SET
                status = ?,
                closed_at = ?
            WHERE id = ?
        `, [status, closedAt, id]);

        // Registrar mudança de status na timeline
        await db.query(`
            INSERT INTO suporte_mensagens (
                chamado_id, usuario_id, usuario_nome, is_suporte, mensagem, tipo
            ) VALUES (?, ?, ?, 1, ?, 'mudanca_status')
        `, [id, usuario_id, usuario_nome, `Status alterado para: ${status.replace('_', ' ').toUpperCase()}`]);

        res.json({ message: 'Status atualizado com sucesso!' });
    } catch (err) {
        console.error('Erro ao mudar status do chamado:', err);
        res.status(500).json({ error: 'Erro ao atualizar status.' });
    }
});

// PUT /api/suporte/chamados/:id/planejamento - Planejamento técnico de execução
router.put('/chamados/:id/planejamento', async (req, res) => {
    try {
        const { id } = req.params;
        const { planejamento_texto, planejamento_etapas, planejamento_prazo, planejamento_status } = req.body;
        const responsavel_id = req.user.id || req.user.idUsuario;
        const responsavel_nome = req.user.nome || req.user.NomeCompleto || req.user.login;

        const etapasJson = planejamento_etapas ? JSON.stringify(planejamento_etapas) : null;

        await db.query(`
            UPDATE suporte_chamados SET
                responsavel_id = ?,
                responsavel_nome = ?,
                planejamento_texto = ?,
                planejamento_etapas = ?,
                planejamento_prazo = ?,
                planejamento_status = ?
            WHERE id = ?
        `, [responsavel_id, responsavel_nome, planejamento_texto || null, etapasJson, planejamento_prazo || null, planejamento_status || 'em_elaboracao', id]);

        res.json({ message: 'Planejamento técnico salvo com sucesso!' });
    } catch (err) {
        console.error('Erro no planejamento do chamado:', err);
        res.status(500).json({ error: 'Erro ao salvar planejamento técnico.' });
    }
});

module.exports = router;
