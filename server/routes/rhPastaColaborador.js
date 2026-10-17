const express = require('express');
const router = express.Router();
const db = require('../services/mysqlService');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

router.use(tenantMiddleware);

// ── 1. LISTAGEM GERAL DE COLABORADORES COM RESUMO RH ────────────

// GET /api/rh/pasta/colaboradores - Lista resumo de colaboradores com indicadores
router.get('/colaboradores', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const [colabs] = await db.query(`
            SELECT 
                u.idUsuario, u.NomeCompleto, u.email, u.Setor, u.Funcao, u.fotoUsuario,
                d.regime_contratacao, d.cpf_cnpj, d.data_admissao, d.status_funcional,
                COUNT(DISTINCT a.id) AS total_atestados,
                COUNT(DISTINCT f.id) AS total_faltas,
                COUNT(DISTINCT o.id) AS total_ocorrencias,
                MAX(av.media_geral) AS ultima_avaliacao_media
            FROM usuario u
            LEFT JOIN rh_colaboradores_detalhes d ON d.usuario_id = u.idUsuario AND (d.IdEmpresa = ? OR (d.IdEmpresa IS NULL AND ? = 1))
            LEFT JOIN rh_pasta_atestados a ON a.usuario_id = u.idUsuario
            LEFT JOIN rh_pasta_faltas f ON f.usuario_id = u.idUsuario
            LEFT JOIN rh_pasta_ocorrencias o ON o.usuario_id = u.idUsuario
            LEFT JOIN rh_pasta_avaliacoes av ON av.usuario_id = u.idUsuario
            WHERE (u.IdEmpresa = ? OR (u.IdEmpresa IS NULL AND ? = 1))
              AND (u.D_E_L_E_T_E IS NULL OR u.D_E_L_E_T_E <> '*')
            GROUP BY u.idUsuario, d.id
            ORDER BY u.NomeCompleto ASC
        `, [tenantId, tenantId, tenantId, tenantId]);

        res.json({ colaboradores: colabs });
    } catch (err) {
        console.error('Erro ao listar pasta colaboradores:', err);
        res.status(500).json({ error: 'Erro ao carregar colaboradores.' });
    }
});

// GET /api/rh/pasta/colaboradores/:usuario_id - Dossiê 360° Completo do Colaborador
router.get('/colaboradores/:usuario_id', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const { usuario_id } = req.params;

        // 1. Dados cadastrais do usuário
        const [usrRows] = await db.query(`
            SELECT idUsuario, NomeCompleto, Login, email, whatsapp, telefone, Setor, Funcao, fotoUsuario
            FROM usuario WHERE idUsuario = ? AND (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1))
        `, [usuario_id, tenantId, tenantId]);

        if (usrRows.length === 0) {
            return res.status(404).json({ error: 'Colaborador não encontrado.' });
        }
        const usuario = usrRows[0];

        // 2. Detalhes funcionais de RH
        const [detRows] = await db.query(`
            SELECT * FROM rh_colaboradores_detalhes WHERE usuario_id = ? AND (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1))
        `, [usuario_id, tenantId, tenantId]);
        const detalhes = detRows[0] || null;

        // 3. Diário de ocorrências
        const [ocorrencias] = await db.query(`
            SELECT o.*, u.NomeCompleto AS registrado_por_nome
            FROM rh_pasta_ocorrencias o
            LEFT JOIN usuario u ON u.idUsuario = o.registrado_por
            WHERE o.usuario_id = ?
            ORDER BY o.data_ocorrencia DESC, o.id DESC
        `, [usuario_id]);

        // 4. Atestados médicos (fotos em base64)
        const [atestados] = await db.query(`
            SELECT a.*, u.NomeCompleto AS registrado_por_nome
            FROM rh_pasta_atestados a
            LEFT JOIN usuario u ON u.idUsuario = a.registrado_por
            WHERE a.usuario_id = ?
            ORDER BY a.data_inicio DESC, a.id DESC
        `, [usuario_id]);

        // 5. Faltas e assiduidade
        const [faltas] = await db.query(`
            SELECT f.*, u.NomeCompleto AS registrado_por_nome
            FROM rh_pasta_faltas f
            LEFT JOIN usuario u ON u.idUsuario = f.registrado_por
            WHERE f.usuario_id = ?
            ORDER BY f.data_falta DESC, f.id DESC
        `, [usuario_id]);

        // 6. Avaliações 360°
        const [avaliacoes] = await db.query(`
            SELECT av.*, u.NomeCompleto AS avaliador_nome
            FROM rh_pasta_avaliacoes av
            LEFT JOIN usuario u ON u.idUsuario = av.avaliador_id
            WHERE av.usuario_id = ?
            ORDER BY av.data_avaliacao DESC, av.id DESC
        `, [usuario_id]);

        // 7. Vistorias de Uniforme & EPI
        const [uniformes] = await db.query(`
            SELECT uni.*, u.NomeCompleto AS inspetor_nome
            FROM rh_pasta_uniformes_epis uni
            LEFT JOIN usuario u ON u.idUsuario = uni.inspetor_id
            WHERE uni.usuario_id = ?
            ORDER BY uni.data_inspecao DESC, uni.id DESC
        `, [usuario_id]);

        res.json({
            usuario,
            detalhes,
            ocorrencias,
            atestados,
            faltas,
            avaliacoes,
            uniformes
        });
    } catch (err) {
        console.error('Erro ao buscar dossiê do colaborador:', err);
        res.status(500).json({ error: 'Erro ao carregar dossiê completo.' });
    }
});

// PUT /api/rh/pasta/colaboradores/:usuario_id/detalhes - Atualiza detalhes funcionais
router.put('/colaboradores/:usuario_id/detalhes', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const { usuario_id } = req.params;
        const {
            regime_contratacao, cpf_cnpj, rg, data_nascimento, data_admissao,
            salario_base, valor_hora, contato_emergencia, telefone_emergencia,
            status_funcional, observacoes_rh
        } = req.body;

        await db.query(`
            INSERT INTO rh_colaboradores_detalhes (
                IdEmpresa, usuario_id, regime_contratacao, cpf_cnpj, rg, data_nascimento, data_admissao,
                salario_base, valor_hora, contato_emergencia, telefone_emergencia, status_funcional, observacoes_rh
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                regime_contratacao = VALUES(regime_contratacao),
                cpf_cnpj = VALUES(cpf_cnpj),
                rg = VALUES(rg),
                data_nascimento = VALUES(data_nascimento),
                data_admissao = VALUES(data_admissao),
                salario_base = VALUES(salario_base),
                valor_hora = VALUES(valor_hora),
                contato_emergencia = VALUES(contato_emergencia),
                telefone_emergencia = VALUES(telefone_emergencia),
                status_funcional = VALUES(status_funcional),
                observacoes_rh = VALUES(observacoes_rh)
        `, [
            tenantId, usuario_id, regime_contratacao || 'CLT', cpf_cnpj || null, rg || null,
            data_nascimento || null, data_admissao || null, salario_base || null, valor_hora || null,
            contato_emergencia || null, telefone_emergencia || null, status_funcional || 'ativo', observacoes_rh || null
        ]);

        res.json({ message: 'Detalhes funcionais salvos com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar detalhes de RH:', err);
        res.status(500).json({ error: 'Erro ao salvar detalhes de RH.' });
    }
});

// ── 2. LANÇAMENTO NAS 5 VERTENTES ───────────────────────────────

// POST /api/rh/pasta/ocorrencias - Lança ocorrência / elogio / advertência
router.post('/ocorrencias', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const { usuario_id, tipo = 'feedback', titulo, descricao, data_ocorrencia, anexo_base64, anexo_nome, anexo_tipo } = req.body;
        const registrado_por = req.user.id || req.user.idUsuario;

        if (!usuario_id || !titulo || !descricao || !data_ocorrencia) {
            return res.status(400).json({ error: 'Colaborador, título, descrição e data são obrigatórios.' });
        }

        const [result] = await db.query(`
            INSERT INTO rh_pasta_ocorrencias (
                IdEmpresa, usuario_id, tipo, titulo, descricao, data_ocorrencia, registrado_por, anexo_base64, anexo_nome, anexo_tipo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [tenantId, usuario_id, tipo, titulo, descricao, data_ocorrencia, registrado_por, anexo_base64 || null, anexo_nome || null, anexo_tipo || null]);

        res.json({ id: result.insertId, message: 'Ocorrência registrada com sucesso!' });
    } catch (err) {
        console.error('Erro ao registrar ocorrência:', err);
        res.status(500).json({ error: 'Erro ao salvar ocorrência.' });
    }
});

// POST /api/rh/pasta/atestados - Cadastra atestado médico com foto Base64
router.post('/atestados', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const {
            usuario_id, data_emissao, data_inicio, dias_afastamento = 1,
            medico_nome, crm, cid10, motivo_resumo, tipo_afastamento,
            foto_atestado_base64, anexo_nome, anexo_tipo, abona_falta = 1, impacta_inss = 0, observacoes
        } = req.body;
        const registrado_por = req.user.id || req.user.idUsuario;

        if (!usuario_id || !data_inicio || !data_emissao) {
            return res.status(400).json({ error: 'Datas e colaborador são obrigatórios.' });
        }

        // Calcular data de retorno
        const dtInicio = new Date(data_inicio);
        const dtRetorno = new Date(dtInicio.getTime() + (parseInt(dias_afastamento) || 1) * 24 * 60 * 60 * 1000)
            .toISOString().slice(0, 10);

        const [result] = await db.query(`
            INSERT INTO rh_pasta_atestados (
                IdEmpresa, usuario_id, data_emissao, data_inicio, dias_afastamento, data_retorno,
                medico_nome, crm, cid10, motivo_resumo, tipo_afastamento, foto_atestado_base64,
                anexo_nome, anexo_tipo, abona_falta, impacta_inss, registrado_por, observacoes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            tenantId, usuario_id, data_emissao, data_inicio, dias_afastamento, dtRetorno,
            medico_nome || null, crm || null, cid10 || null, motivo_resumo || null, tipo_afastamento || 'medico_comum',
            foto_atestado_base64 || null, anexo_nome || null, anexo_tipo || null, abona_falta ? 1 : 0, impacta_inss ? 1 : 0,
            registrado_por, observacoes || null
        ]);

        res.json({ id: result.insertId, message: 'Atestado médico anexado à pasta com sucesso!' });
    } catch (err) {
        console.error('Erro ao cadastrar atestado:', err);
        res.status(500).json({ error: 'Erro ao registrar atestado.' });
    }
});

// POST /api/rh/pasta/faltas - Lança falta ou atraso com impacto na cesta
router.post('/faltas', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const {
            usuario_id, data_falta, tipo_falta = 'injustificada', minutos_atraso = 0,
            justificativa, atestado_id, impacta_cesta_basica = 1, descontar_folha = 1
        } = req.body;
        const registrado_por = req.user.id || req.user.idUsuario;

        if (!usuario_id || !data_falta) {
            return res.status(400).json({ error: 'Colaborador e data da falta são obrigatórios.' });
        }

        const [result] = await db.query(`
            INSERT INTO rh_pasta_faltas (
                IdEmpresa, usuario_id, data_falta, tipo_falta, minutos_atraso, justificativa,
                atestado_id, impacta_cesta_basica, descontar_folha, registrado_por
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            tenantId, usuario_id, data_falta, tipo_falta, minutos_atraso || 0,
            justificativa || null, atestado_id || null, impacta_cesta_basica ? 1 : 0, descontar_folha ? 1 : 0, registrado_por
        ]);

        res.json({ id: result.insertId, message: 'Registro de assiduidade lançado!' });
    } catch (err) {
        console.error('Erro ao registrar falta:', err);
        res.status(500).json({ error: 'Erro ao salvar registro de falta.' });
    }
});

// POST /api/rh/pasta/avaliacoes - Lança avaliação 360° ponderada
router.post('/avaliacoes', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const {
            usuario_id, data_avaliacao = new Date().toISOString().slice(0, 10),
            nota_comprometimento = 5, nota_pontualidade = 5, nota_qualidade_trabalho = 5,
            nota_relacionamento_equipe = 5, nota_conservacao_uniforme_5s = 5,
            pontos_fortes, pontos_melhoria
        } = req.body;
        const avaliador_id = req.user.id || req.user.idUsuario;

        const media = (
            (parseFloat(nota_comprometimento) +
             parseFloat(nota_pontualidade) +
             parseFloat(nota_qualidade_trabalho) +
             parseFloat(nota_relacionamento_equipe) +
             parseFloat(nota_conservacao_uniforme_5s)) / 5
        ).toFixed(1);

        const [result] = await db.query(`
            INSERT INTO rh_pasta_avaliacoes (
                IdEmpresa, usuario_id, data_avaliacao, avaliador_id, nota_comprometimento,
                nota_pontualidade, nota_qualidade_trabalho, nota_relacionamento_equipe,
                nota_conservacao_uniforme_5s, media_geral, pontos_fortes, pontos_melhoria
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            tenantId, usuario_id, data_avaliacao, avaliador_id, nota_comprometimento,
            nota_pontualidade, nota_qualidade_trabalho, nota_relacionamento_equipe,
            nota_conservacao_uniforme_5s, media, pontos_fortes || null, pontos_melhoria || null
        ]);

        res.json({ id: result.insertId, mediaGeral: media, message: 'Avaliação 360° salva com sucesso!' });
    } catch (err) {
        console.error('Erro na avaliação 360°:', err);
        res.status(500).json({ error: 'Erro ao salvar avaliação de desempenho.' });
    }
});

// POST /api/rh/pasta/uniformes - Vistoria de fardamento e conservação de EPI
router.post('/uniformes', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const {
            usuario_id, data_inspecao = new Date().toISOString().slice(0, 10),
            estado_camisa = 'bom', estado_calca = 'bom', estado_botina = 'bom',
            uso_epi_obrigatorio = 'conforme_100', necessita_reposicao = 0,
            itens_reposicao, foto_inspecao_base64, anexo_nome, observacoes
        } = req.body;
        const inspetor_id = req.user.id || req.user.idUsuario;

        const [result] = await db.query(`
            INSERT INTO rh_pasta_uniformes_epis (
                IdEmpresa, usuario_id, data_inspecao, inspetor_id, estado_camisa,
                estado_calca, estado_botina, uso_epi_obrigatorio, necessita_reposicao,
                itens_reposicao, foto_inspecao_base64, anexo_nome, observacoes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            tenantId, usuario_id, data_inspecao, inspetor_id, estado_camisa,
            estado_calca, estado_botina, uso_epi_obrigatorio, necessita_reposicao ? 1 : 0,
            itens_reposicao || null, foto_inspecao_base64 || null, anexo_nome || null, observacoes || null
        ]);

        res.json({ id: result.insertId, message: 'Vistoria de fardamento registrada!' });
    } catch (err) {
        console.error('Erro na inspeção de uniforme:', err);
        res.status(500).json({ error: 'Erro ao registrar inspeção de fardamento.' });
    }
});

module.exports = router;
