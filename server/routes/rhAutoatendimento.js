const express = require('express');
const router = express.Router();
const db = require('../services/mysqlService');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

router.use(tenantMiddleware);

// ── 1. PORTAL DO COLABORADOR (MOBILE-FRIENDLY) ──────────────────

// GET /api/rh/autoatendimento/minhas-solicitacoes
router.get('/minhas-solicitacoes', async (req, res) => {
    try {
        const usuario_id = req.user.id || req.user.idUsuario;

        const [solicitacoes] = await db.query(`
            SELECT id, tipo_solicitacao, status, data_solicitacao, observacao_colaborador,
                   imutavel, resposta_rh, avaliado_em, avaliador_nome, foto_nome,
                   CASE WHEN foto_base64 IS NOT NULL THEN 1 ELSE 0 END AS possui_anexo
            FROM rh_autoatendimento_solicitacoes
            WHERE usuario_id = ?
            ORDER BY data_solicitacao DESC
        `, [usuario_id]);

        res.json({ solicitacoes });
    } catch (err) {
        console.error('Erro ao listar solicitações do colaborador:', err);
        res.status(500).json({ error: 'Erro ao carregar histórico de solicitações.' });
    }
});

// POST /api/rh/autoatendimento/solicitacoes - Colaborador envia solicitação/atestado
router.post('/solicitacoes', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const usuario_id = req.user.id || req.user.idUsuario;
        const colaborador_nome = req.user.nome || req.user.NomeCompleto || req.user.login;
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const userAgent = req.headers['user-agent'] || 'Desconhecido';

        const { tipo_solicitacao, dados, foto_nome, foto_base64, observacao_colaborador } = req.body;

        if (!tipo_solicitacao) {
            return res.status(400).json({ error: 'O tipo de solicitação é obrigatório.' });
        }

        const dadosJson = dados ? JSON.stringify(dados) : null;

        const [result] = await db.query(`
            INSERT INTO rh_autoatendimento_solicitacoes (
                IdEmpresa, usuario_id, colaborador_nome, tipo_solicitacao, status,
                dados_json, foto_nome, foto_base64, observacao_colaborador,
                ip_envio, dispositivo, imutavel
            ) VALUES (?, ?, ?, ?, 'pendente', ?, ?, ?, ?, ?, ?, 0)
        `, [
            tenantId, usuario_id, colaborador_nome, tipo_solicitacao,
            dadosJson, foto_nome || null, foto_base64 || null, observacao_colaborador || null,
            clientIp, userAgent.slice(0, 255)
        ]);

        res.json({
            id: result.insertId,
            message: 'Solicitação enviada com sucesso para homologação do RH!'
        });
    } catch (err) {
        console.error('Erro ao enviar solicitação:', err);
        res.status(500).json({ error: 'Erro ao processar solicitação.' });
    }
});

// ── 2. FLUXO DE APROVAÇÃO DO RH (COM REGRA DE IMUTABILIDADE) ────

// GET /api/rh/autoatendimento/pendentes - RH visualiza fila de aprovação
router.get('/pendentes', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const { status = 'pendente' } = req.query;

        const [solicitacoes] = await db.query(`
            SELECT s.*, u.Setor, u.Funcao, u.email, u.whatsapp
            FROM rh_autoatendimento_solicitacoes s
            INNER JOIN usuario u ON u.idUsuario = s.usuario_id
            WHERE (s.IdEmpresa = ? OR (s.IdEmpresa IS NULL AND ? = 1))
              AND s.status = ?
            ORDER BY s.data_solicitacao ASC
        `, [tenantId, tenantId, status]);

        res.json({ solicitacoes });
    } catch (err) {
        console.error('Erro na fila de aprovação RH:', err);
        res.status(500).json({ error: 'Erro ao listar solicitações pendentes.' });
    }
});

// POST /api/rh/autoatendimento/solicitacoes/:id/aprovar - Homologação do RH com Imutabilidade
router.post('/solicitacoes/:id/aprovar', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const { id } = req.params;
        const { resposta_rh } = req.body;
        const avaliador_id = req.user.id || req.user.idUsuario;
        const avaliador_nome = req.user.nome || req.user.NomeCompleto || req.user.login;

        const [solRows] = await db.query(`SELECT * FROM rh_autoatendimento_solicitacoes WHERE id = ?`, [id]);
        if (solRows.length === 0) {
            return res.status(404).json({ error: 'Solicitação não encontrada.' });
        }
        const sol = solRows[0];

        if (sol.imutavel === 1) {
            return res.status(403).json({ error: 'Esta solicitação já foi homologada e está sob regra de imutabilidade.' });
        }

        const dados = sol.dados_json ? (typeof sol.dados_json === 'string' ? JSON.parse(sol.dados_json) : sol.dados_json) : {};
        let vinculado_id = null;

        // Se for atestado, cria automaticamente o registro oficial na tabela de atestados
        if (sol.tipo_solicitacao === 'atestado') {
            const dtInicio = dados.data_inicio || new Date().toISOString().slice(0, 10);
            const diasAfast = parseInt(dados.dias_afastamento) || 1;
            const dtRetorno = new Date(new Date(dtInicio).getTime() + diasAfast * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

            const [atestadoRes] = await db.query(`
                INSERT INTO rh_pasta_atestados (
                    IdEmpresa, usuario_id, data_emissao, data_inicio, dias_afastamento, data_retorno,
                    medico_nome, crm, cid10, motivo_resumo, tipo_afastamento, foto_atestado_base64,
                    anexo_nome, abona_falta, impacta_inss, registrado_por, observacoes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'medico_comum', ?, ?, 1, 0, ?, ?)
            `, [
                tenantId, sol.usuario_id, dados.data_emissao || dtInicio, dtInicio, diasAfast, dtRetorno,
                dados.medico_nome || null, dados.crm || null, dados.cid10 || null, dados.motivo_resumo || 'Enviado via Autoatendimento Mobile',
                sol.foto_base64, sol.foto_nome || 'atestado.jpg', avaliador_id,
                `Homologado pelo RH em ${new Date().toLocaleString('pt-BR')}: ${resposta_rh || ''}`
            ]);
            vinculado_id = atestadoRes.insertId;
        }

        // Atualiza solicitação para APROVADO com IMUTABILIDADE ATIVA
        await db.query(`
            UPDATE rh_autoatendimento_solicitacoes SET
                status = 'aprovado',
                imutavel = 1,
                resposta_rh = ?,
                avaliado_por = ?,
                avaliador_nome = ?,
                avaliado_em = NOW(),
                vinculado_id = ?
            WHERE id = ?
        `, [resposta_rh || 'Aprovado e integrado à Pasta Digital do Colaborador.', avaliador_id, avaliador_nome, vinculado_id, id]);

        res.json({
            message: 'Solicitação aprovada, integrada e protegida com imutabilidade!',
            vinculado_id
        });
    } catch (err) {
        console.error('Erro ao aprovar solicitação:', err);
        res.status(500).json({ error: 'Erro ao homologar solicitação.' });
    }
});

// POST /api/rh/autoatendimento/solicitacoes/:id/recusar
router.post('/solicitacoes/:id/recusar', async (req, res) => {
    try {
        const { id } = req.params;
        const { resposta_rh } = req.body;
        const avaliador_id = req.user.id || req.user.idUsuario;
        const avaliador_nome = req.user.nome || req.user.NomeCompleto || req.user.login;

        if (!resposta_rh) {
            return res.status(400).json({ error: 'A justificativa de recusa é obrigatória.' });
        }

        await db.query(`
            UPDATE rh_autoatendimento_solicitacoes SET
                status = 'recusado',
                imutavel = 1,
                resposta_rh = ?,
                avaliado_por = ?,
                avaliador_nome = ?,
                avaliado_em = NOW()
            WHERE id = ?
        `, [resposta_rh, avaliador_id, avaliador_nome, id]);

        res.json({ message: 'Solicitação recusada com justificativa enviada ao colaborador.' });
    } catch (err) {
        console.error('Erro ao recusar solicitação:', err);
        res.status(500).json({ error: 'Erro ao recusar solicitação.' });
    }
});

module.exports = router;
