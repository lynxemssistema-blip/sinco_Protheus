const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../services/mysqlService');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');

router.use(tenantMiddleware);

// ── 1. GESTÃO DE COMPETÊNCIAS / PERÍODOS ────────────────────────

// GET /api/sst/cesta/periodos - Lista todas as competências
router.get('/periodos', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const [periodos] = await db.query(`
            SELECT p.*,
                COUNT(e.id) AS total_colaboradores,
                COUNT(CASE WHEN e.elegivel = 1 THEN 1 END) AS total_elegiveis,
                COUNT(CASE WHEN e.status = 'entregue' THEN 1 END) AS total_entregues,
                COUNT(CASE WHEN e.elegivel = 0 THEN 1 END) AS total_inaptos
            FROM sst_cesta_periodos p
            LEFT JOIN sst_cesta_entregas e ON e.periodo_id = p.id
            WHERE (p.IdEmpresa = ? OR (p.IdEmpresa IS NULL AND ? = 1))
            GROUP BY p.id
            ORDER BY p.competencia DESC
        `, [tenantId, tenantId]);

        res.json({ periodos });
    } catch (err) {
        console.error('Erro ao listar períodos de cesta básica:', err);
        res.status(500).json({ error: 'Erro ao buscar competências.' });
    }
});

// POST /api/sst/cesta/periodos - Cria nova competência e gera elegibilidade automática
router.post('/periodos', async (req, res) => {
    try {
        const tenantId = req.tenantId || 1;
        const { competencia, descricao, data_liberacao, data_limite_retirada, observacoes } = req.body;
        const created_by = req.user.nome || req.user.login || 'RH / SST';

        if (!competencia || !data_liberacao) {
            return res.status(400).json({ error: 'Competência (AAAA-MM) e data de liberação são obrigatórias.' });
        }

        // 1. Criar o período
        const [pResult] = await db.query(`
            INSERT INTO sst_cesta_periodos (
                IdEmpresa, competencia, descricao, data_liberacao, data_limite_retirada, status, observacoes, created_by
            ) VALUES (?, ?, ?, ?, ?, 'liberado', ?, ?)
        `, [
            tenantId, competencia, descricao || `Cesta Básica - ${competencia}`,
            data_liberacao, data_limite_retirada || null, observacoes || null, created_by
        ]);

        const periodoId = pResult.insertId;

        // 2. Buscar todos os colaboradores ativos da empresa
        const [colaboradores] = await db.query(`
            SELECT idUsuario, NomeCompleto, Login
            FROM usuario
            WHERE (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1))
              AND (D_E_L_E_T_E IS NULL OR D_E_L_E_T_E <> '*')
        `, [tenantId, tenantId]);

        // 3. Apuração de elegibilidade por colaborador no mês da competência
        // Trava automática: falta injustificada que impacta cesta básica
        const mesInicio = `${competencia}-01`;
        // Último dia do mês
        const ano = parseInt(competencia.slice(0, 4));
        const mes = parseInt(competencia.slice(5, 7));
        const ultimoDia = new Date(ano, mes, 0).getDate();
        const mesFim = `${competencia}-${String(ultimoDia).padStart(2, '0')}`;

        for (const colab of colaboradores) {
            // Verificar faltas injustificadas no período
            const [faltas] = await db.query(`
                SELECT data_falta, justificativa
                FROM rh_pasta_faltas
                WHERE usuario_id = ?
                  AND data_falta BETWEEN ? AND ?
                  AND tipo_falta = 'injustificada'
                  AND impacta_cesta_basica = 1
                LIMIT 1
            `, [colab.idUsuario, mesInicio, mesFim]);

            let elegivel = 1;
            let motivoInaptidao = null;

            if (faltas.length > 0) {
                elegivel = 0;
                const dtFalta = new Date(faltas[0].data_falta).toLocaleDateString('pt-BR');
                motivoInaptidao = `Falta injustificada registrada em ${dtFalta}`;
            }

            await db.query(`
                INSERT INTO sst_cesta_entregas (
                    IdEmpresa, periodo_id, usuario_id, elegivel, motivo_inaptidao, status
                ) VALUES (?, ?, ?, ?, ?, 'pendente')
            `, [tenantId, periodoId, colab.idUsuario, elegivel, motivoInaptidao]);
        }

        res.json({ id: periodoId, message: `Competência ${competencia} aberta com ${colaboradores.length} colaboradores processados!` });
    } catch (err) {
        console.error('Erro ao abrir período de cesta:', err);
        res.status(500).json({ error: 'Erro ao gerar competência de cesta básica.' });
    }
});

// ── 2. GESTÃO DE ENTREGAS & RETIRADA COM HASH DE AUTENTICIDADE ─

// GET /api/sst/cesta/entregas/:periodo_id - Lista entregas de um período
router.get('/entregas/:periodo_id', async (req, res) => {
    try {
        const { periodo_id } = req.params;

        const [entregas] = await db.query(`
            SELECT e.*, u.NomeCompleto AS colaborador_nome, u.Setor, u.Funcao, u.Login, u.whatsapp
            FROM sst_cesta_entregas e
            INNER JOIN usuario u ON u.idUsuario = e.usuario_id
            WHERE e.periodo_id = ?
            ORDER BY u.NomeCompleto ASC
        `, [periodo_id]);

        res.json({ entregas });
    } catch (err) {
        console.error('Erro ao listar entregas da cesta:', err);
        res.status(500).json({ error: 'Erro ao carregar lista de entregas.' });
    }
});

// POST /api/sst/cesta/entregas/:id/retirar - Confirmação com Hash Digital SHA-256
router.post('/entregas/:id/retirar', async (req, res) => {
    try {
        const { id } = req.params;
        const entregue_por = req.user.nome || req.user.login || 'Almoxarifado';
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const agora = new Date().toISOString().slice(0, 19).replace('T', ' ');

        // Buscar dados da entrega
        const [rows] = await db.query(`SELECT * FROM sst_cesta_entregas WHERE id = ?`, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Registro de entrega não encontrado.' });
        }
        const entrega = rows[0];

        if (entrega.elegivel === 0) {
            return res.status(400).json({
                error: `Colaborador inapto para retirada deste benefício: ${entrega.motivo_inaptidao}`
            });
        }

        // Gerar Hash de Autenticidade Digital SHA256(usuario_id + periodo_id + agora + ip)
        const rawString = `${entrega.usuario_id}|${entrega.periodo_id}|${agora}|${clientIp}|LYNX-CESTA-2026`;
        const assinaturaHash = crypto.createHash('sha256').update(rawString).digest('hex');

        await db.query(`
            UPDATE sst_cesta_entregas SET
                status = 'entregue',
                data_hora_entrega = ?,
                entregue_por = ?,
                assinado_digitalmente = 1,
                data_hora_assinatura = ?,
                assinante_login = ?,
                assinante_ip = ?,
                assinatura_hash = ?
            WHERE id = ?
        `, [agora, entregue_por, agora, req.user.login || req.user.email, clientIp, assinaturaHash, id]);

        res.json({
            message: 'Retirada da cesta básica confirmada e assinada digitalmente!',
            assinaturaHash,
            dataHora: agora
        });
    } catch (err) {
        console.error('Erro na retirada da cesta básica:', err);
        res.status(500).json({ error: 'Erro ao registrar retirada de cesta básica.' });
    }
});

// PATCH /api/sst/cesta/entregas/:id/elegibilidade - Ajuste manual pelo RH/Gestor
router.patch('/entregas/:id/elegibilidade', async (req, res) => {
    try {
        const { id } = req.params;
        const { elegivel, motivo_inaptidao } = req.body;

        await db.query(`
            UPDATE sst_cesta_entregas SET
                elegivel = ?,
                motivo_inaptidao = ?
            WHERE id = ?
        `, [elegivel ? 1 : 0, elegivel ? null : (motivo_inaptidao || 'Inapto por decisão administrativa'), id]);

        res.json({ message: 'Elegibilidade atualizada com sucesso!' });
    } catch (err) {
        console.error('Erro ao ajustar elegibilidade:', err);
        res.status(500).json({ error: 'Erro ao atualizar elegibilidade.' });
    }
});

// GET /api/sst/cesta/minha-situacao - Consulta individual do colaborador
router.get('/minha-situacao', async (req, res) => {
    try {
        const userId = req.user.id || req.user.idUsuario;

        const [situacoes] = await db.query(`
            SELECT e.*, p.competencia, p.descricao, p.data_liberacao, p.data_limite_retirada
            FROM sst_cesta_entregas e
            INNER JOIN sst_cesta_periodos p ON p.id = e.periodo_id
            WHERE e.usuario_id = ?
            ORDER BY p.competencia DESC
            LIMIT 6
        `, [userId]);

        res.json({ historico: situacoes });
    } catch (err) {
        console.error('Erro ao consultar situação da cesta:', err);
        res.status(500).json({ error: 'Erro ao consultar benefício.' });
    }
});

module.exports = router;
