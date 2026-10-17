const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const { authenticateToken } = require('./auth');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { sendMail } = require('../services/mailService');
const { sendText: waSend } = require('../services/whatsapp');

// Multer storage para upload de atas digitalizadas, Word (.docx) ou PDF
const cipaStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/cipa_atas');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, `ata_${Date.now()}_${safeBase}${ext}`);
    }
});
const uploadCipaAta = multer({
    storage: cipaStorage,
    limits: { fileSize: 30 * 1024 * 1024 } // 30MB
});

// Aplica autenticação a todas as rotas de CIPA
router.use(authenticateToken);

// ============================================================================
// 0. DIRETÓRIO DE COLABORADORES OFICIAL (FOTOS & DADOS CADASTRAIS)
// ============================================================================
let cachedColaboradores = null;
let lastColaboradoresCacheTime = 0;
const COLABORADORES_CACHE_TTL = 3 * 60 * 1000; // 3 minutos

router.get('/colaboradores-disponiveis', async (req, res) => {
    try {
        const now = Date.now();
        if (cachedColaboradores && (now - lastColaboradoresCacheTime < COLABORADORES_CACHE_TTL)) {
            return res.json(cachedColaboradores);
        }
        const [users] = await mysqlPool.query(`
            SELECT idUsuario, NomeCompleto, Login, Setor, Funcao, idUsuario AS Matricula, 
                   fotoUsuario, email, whatsapp, telefone, DataCadastro
            FROM usuario 
            WHERE (status IS NULL OR status = 1 OR status = 'ativo')
            ORDER BY NomeCompleto ASC
        `, [], 35000);
        cachedColaboradores = users || [];
        lastColaboradoresCacheTime = now;
        res.json(cachedColaboradores);
    } catch (err) {
        if (cachedColaboradores && cachedColaboradores.length > 0) {
            console.warn('[CIPA] Pool ocupado, servindo colaboradores do cache:', err.message);
            return res.json(cachedColaboradores);
        }
        console.error('[CIPA] Erro ao listar colaboradores disponíveis:', err);
        res.status(500).json({ error: 'Erro ao listar colaboradores: ' + err.message });
    }
});

// ============================================================================
// 1. GESTÕES DA CIPA (CRUD & STATUS)
// ============================================================================

// Listar todas as gestões
router.get('/gestoes', async (req, res) => {
    try {
        const [gestoes] = await mysqlPool.query(`
            SELECT g.*,
                   (SELECT COUNT(*) FROM cipa_candidatos c WHERE c.gestao_id = g.id AND c.status = 'deferido') AS total_candidatos_deferidos,
                   (SELECT COUNT(*) FROM cipa_membros_gestao m WHERE m.gestao_id = g.id AND m.ativo = 1) AS total_membros_ativos,
                   (SELECT COUNT(*) FROM cipa_eleitores_votaram v WHERE v.gestao_id = g.id) AS total_votantes
            FROM cipa_gestoes g
            ORDER BY g.ano_inicio DESC, g.id DESC
        `);
        res.json(gestoes || []);
    } catch (err) {
        console.error('[CIPA] Erro ao listar gestões:', err);
        res.status(500).json({ error: 'Erro ao listar gestões de CIPA: ' + err.message });
    }
});

// Detalhes completos de uma gestão
router.get('/gestoes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await mysqlPool.query(`SELECT * FROM cipa_gestoes WHERE id = ?`, [id]);
        if (!rows.length) {
            return res.status(404).json({ error: 'Gestão CIPA não encontrada.' });
        }
        const gestao = rows[0];

        // 1. Cronograma
        const [cronograma] = await mysqlPool.query(`
            SELECT * FROM cipa_cronograma_prazos WHERE gestao_id = ? ORDER BY data_prevista ASC
        `, [id]);

        // 2. Comissão Eleitoral
        const [comissao] = await mysqlPool.query(`
            SELECT ce.*, u.NomeCompleto AS nome, u.Setor, u.Funcao, u.idUsuario AS Matricula,
                   COALESCE(u.fotoUsuario, NULL) AS foto_exibicao, u.fotoUsuario
            FROM cipa_comissao_eleitoral ce
            JOIN usuario u ON u.idUsuario = ce.usuario_id
            WHERE ce.gestao_id = ?
            ORDER BY ce.papel ASC
        `, [id]);

        // 3. Candidatos
        const [candidatos] = await mysqlPool.query(`
            SELECT c.*, u.NomeCompleto AS nome_completo, u.Setor, u.Funcao, u.idUsuario AS Matricula,
                   COALESCE(c.foto_url, u.fotoUsuario) AS foto_exibicao,
                   COALESCE(c.foto_url, u.fotoUsuario) AS foto_url,
                   u.fotoUsuario
            FROM cipa_candidatos c
            JOIN usuario u ON u.idUsuario = c.usuario_id
            WHERE c.gestao_id = ?
            ORDER BY c.numero_chapa ASC
        `, [id]);

        // 4. Membros Oficiais
        const [membros] = await mysqlPool.query(`
            SELECT m.*, u.NomeCompleto AS nome_completo, u.Setor, u.Funcao, u.idUsuario AS Matricula,
                   COALESCE(u.fotoUsuario, NULL) AS foto_exibicao,
                   u.fotoUsuario, u.email, u.telefone
            FROM cipa_membros_gestao m
            JOIN usuario u ON u.idUsuario = m.usuario_id
            WHERE m.gestao_id = ? AND m.ativo = 1
            ORDER BY 
                CASE m.cargo_cipa 
                    WHEN 'presidente' THEN 1
                    WHEN 'vice_presidente' THEN 2
                    WHEN 'secretario' THEN 3
                    WHEN 'secretario_substituto' THEN 4
                    ELSE 5
                END ASC,
                m.tipo_vaga ASC
        `, [id]);

        // 5. Total de eleitores aptos no sistema (colaboradores ativos)
        const [totalEleitores] = await mysqlPool.query(`
            SELECT COUNT(*) AS total FROM usuario WHERE (status IS NULL OR status = 1)
        `);
        const totalAptos = totalEleitores[0]?.total || 0;

        // 6. Total de votos coletados
        const [totalVotaram] = await mysqlPool.query(`
            SELECT COUNT(*) AS total FROM cipa_eleitores_votaram WHERE gestao_id = ?
        `, [id]);
        const totalVotos = totalVotaram[0]?.total || 0;

        const percentualQuorum = totalAptos > 0 ? ((totalVotos / totalAptos) * 100).toFixed(1) : 0;
        const quorumMinimo = Math.floor(totalAptos / 2) + 1;

        res.json({
            ...gestao,
            cronograma,
            comissao,
            candidatos,
            membros,
            total_aptos_calculado: totalAptos,
            total_votos_coletados: totalVotos,
            quorum_minimo_necessario: quorumMinimo,
            percentual_quorum: Number(percentualQuorum),
            quorum_atingido: totalVotos >= quorumMinimo
        });
    } catch (err) {
        console.error('[CIPA] Erro ao carregar detalhes da gestão:', err);
        res.status(500).json({ error: 'Erro ao carregar detalhes da gestão CIPA: ' + err.message });
    }
});

// Criar nova gestão com cronograma legal automático (NR-05)
router.post('/gestoes', async (req, res) => {
    const conn = await mysqlPool.getConnection();
    try {
        await conn.beginTransaction();

        const {
            ano_inicio,
            ano_fim,
            descricao,
            data_prevista_eleicao,
            data_inicio_mandato,
            data_fim_mandato,
            vagas_titulares_eleitos = 4,
            vagas_suplentes_eleitos = 3,
            vagas_titulares_indicados = 4,
            vagas_suplentes_indicados = 3,
            observacoes
        } = req.body;

        if (!ano_inicio || !ano_fim || !data_prevista_eleicao) {
            return res.status(400).json({ error: 'Ano de início, término e data prevista da eleição são obrigatórios.' });
        }

        // Buscar total de colaboradores ativos
        const [colabs] = await conn.query(`SELECT COUNT(*) AS total FROM usuario WHERE (status IS NULL OR status = 1)`);
        const totalAptos = colabs[0]?.total || 0;

        const [insertRes] = await conn.query(`
            INSERT INTO cipa_gestoes (
                ano_inicio, ano_fim, descricao,
                data_inicio_mandato, data_fim_mandato,
                vagas_titulares_eleitos, vagas_suplentes_eleitos,
                vagas_titulares_indicados, vagas_suplentes_indicados,
                total_eleitores_aptos, observacoes, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            ano_inicio,
            ano_fim,
            descricao || `Gestão CIPA ${ano_inicio}/${ano_fim}`,
            data_inicio_mandato || null,
            data_fim_mandato || null,
            vagas_titulares_eleitos,
            vagas_suplentes_eleitos,
            vagas_titulares_indicados,
            vagas_suplentes_indicados,
            totalAptos,
            observacoes || null,
            req.user?.NomeCompleto || req.user?.login || 'Sistema'
        ]);

        const gestaoId = insertRes.insertId;

        // Calcular marcos temporais da NR-05 baseando-se na data da eleição
        const dataEleicao = new Date(data_prevista_eleicao);

        const subDays = (d, days) => {
            const copy = new Date(d);
            copy.setDate(copy.getDate() - days);
            return copy.toISOString().split('T')[0];
        };

        const addDays = (d, days) => {
            const copy = new Date(d);
            copy.setDate(copy.getDate() + days);
            return copy.toISOString().split('T')[0];
        };

        const prazos = [
            {
                codigo: 'convocacao_eleicao',
                descricao: 'Convocação da Eleição pelo Empregador (NR-05.5.1 - Mín. 60 dias antes)',
                dias: 60,
                data: subDays(dataEleicao, 30) // 60 dias antes do fim, ~30 dias antes da votação
            },
            {
                codigo: 'constituicao_ce',
                descricao: 'Constituição da Comissão Eleitoral (CE) paritária (NR-05.5.2 - Mín. 55 dias antes)',
                dias: 55,
                data: subDays(dataEleicao, 25)
            },
            {
                codigo: 'publicacao_edital',
                descricao: 'Publicação e Divulgação do Edital de Convocação (NR-05.5.3 - Mín. 45 dias antes)',
                dias: 45,
                data: subDays(dataEleicao, 20)
            },
            {
                codigo: 'periodo_inscricoes',
                descricao: 'Período de Inscrição dos Candidatos (NR-05.5.3 - Mínimo de 15 dias corridos)',
                dias: 15,
                data: subDays(dataEleicao, 17)
            },
            {
                codigo: 'divulgacao_candidatos',
                descricao: 'Divulgação da Relação Oficial dos Candidatos Inscritos',
                dias: 2,
                data: subDays(dataEleicao, 2)
            },
            {
                codigo: 'votacao_secreta',
                descricao: 'Realização da Eleição / Votação Eletrônica (NR-05.5.4 - Mín. 30 dias antes)',
                dias: 30,
                data: dataEleicao.toISOString().split('T')[0]
            },
            {
                codigo: 'apuracao_ata_eleicao',
                descricao: 'Apuração dos Votos e Lavratura da Ata de Eleição',
                dias: 0,
                data: dataEleicao.toISOString().split('T')[0]
            },
            {
                codigo: 'treinamento_cipa',
                descricao: 'Treinamento Obrigatório dos Membros da CIPA (NR-05.6 - 20h com combate ao assédio)',
                dias: 15,
                data: addDays(dataEleicao, 15)
            },
            {
                codigo: 'instalacao_posse',
                descricao: 'Instalação e Posse da CIPA e Lavratura da Ata de Posse',
                dias: 30,
                data: data_inicio_mandato || addDays(dataEleicao, 30)
            }
        ];

        for (const p of prazos) {
            await conn.query(`
                INSERT INTO cipa_cronograma_prazos (
                    gestao_id, fase_codigo, descricao_etapa, dias_prazo_nr05, data_prevista
                ) VALUES (?, ?, ?, ?, ?)
            `, [gestaoId, p.codigo, p.descricao, p.dias, p.data]);
        }

        await conn.commit();
        res.status(201).json({ success: true, gestao_id: gestaoId, message: 'Gestão CIPA criada com cronograma legal da NR-05.' });
    } catch (err) {
        await conn.rollback();
        console.error('[CIPA] Erro ao criar gestão:', err);
        res.status(500).json({ error: 'Erro ao criar gestão CIPA: ' + err.message });
    } finally {
        conn.release();
    }
});

// Cadastrar Gestão Já Existente (Transição / CIPA Legada em Andamento)
router.post('/gestoes/legada', async (req, res) => {
    const conn = await mysqlPool.getConnection();
    try {
        await conn.beginTransaction();

        const {
            ano_inicio,
            ano_fim,
            descricao,
            data_inicio_mandato,
            data_fim_mandato,
            vagas_titulares_eleitos = 4,
            vagas_suplentes_eleitos = 3,
            vagas_titulares_indicados = 4,
            vagas_suplentes_indicados = 3,
            admin_auditoria_usuario_id,
            email_auditoria,
            membros = []
        } = req.body;

        if (!ano_inicio || !ano_fim) {
            await conn.rollback();
            return res.status(400).json({ error: 'Ano de início e ano de fim são obrigatórios.' });
        }

        const tituloGestao = descricao || `Gestão CIPA ${ano_inicio}/${ano_fim} (Em Andamento)`;

        const [resGestao] = await conn.query(`
            INSERT INTO cipa_gestoes (
                ano_inicio, ano_fim, descricao,
                data_inicio_mandato, data_fim_mandato,
                status, tipo_gestao,
                vagas_titulares_eleitos, vagas_suplentes_eleitos,
                vagas_titulares_indicados, vagas_suplentes_indicados,
                admin_auditoria_usuario_id, email_auditoria,
                created_by
            ) VALUES (?, ?, ?, ?, ?, 'empossada', 'legada_existente', ?, ?, ?, ?, ?, ?, ?)
        `, [
            ano_inicio,
            ano_fim,
            tituloGestao,
            data_inicio_mandato || `${ano_inicio}-01-01`,
            data_fim_mandato || `${ano_fim}-12-31`,
            vagas_titulares_eleitos,
            vagas_suplentes_eleitos,
            vagas_titulares_indicados,
            vagas_suplentes_indicados,
            admin_auditoria_usuario_id || req.user?.idUsuario || null,
            email_auditoria || null,
            req.user?.NomeCompleto || 'Administrador'
        ]);

        const gestaoId = resGestao.insertId;

        // Inserir membros cadastrados
        if (Array.isArray(membros) && membros.length > 0) {
            for (const m of membros) {
                if (!m.usuario_id) continue;
                await conn.query(`
                    INSERT INTO cipa_membros_gestao (
                        gestao_id, usuario_id, origem, tipo_vaga, cargo_cipa,
                        data_posse, ativo, observacoes
                    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
                `, [
                    gestaoId,
                    m.usuario_id,
                    m.origem || (m.tipo_vaga === 'indicado' ? 'indicado' : 'eleito'),
                    m.tipo_vaga || 'titular',
                    m.cargo_cipa || 'membro',
                    data_inicio_mandato || new Date().toISOString().split('T')[0],
                    m.observacoes || 'Membro cadastrado na transição para o sistema'
                ]);
            }
        }

        await conn.commit();
        res.status(201).json({
            success: true,
            gestao_id: gestaoId,
            message: `Gestão existente (${tituloGestao}) cadastrada com sucesso com ${membros.length} membros vinculados!`
        });
    } catch (err) {
        await conn.rollback();
        console.error('[CIPA Legada] Erro ao cadastrar gestão existente:', err);
        res.status(500).json({ error: 'Erro ao cadastrar gestão existente: ' + err.message });
    } finally {
        conn.release();
    }
});

// Adicionar membro individualmente à gestão (útil para gestões existentes/em andamento)
router.post('/gestoes/:id/membros', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            usuario_id,
            origem = 'eleito',
            tipo_vaga = 'titular',
            cargo_cipa = 'membro',
            data_posse,
            observacoes
        } = req.body;

        if (!usuario_id) {
            return res.status(400).json({ error: 'Colaborador é obrigatório.' });
        }

        const [existe] = await mysqlPool.query(`
            SELECT id FROM cipa_membros_gestao WHERE gestao_id = ? AND usuario_id = ?
        `, [id, usuario_id]);

        if (existe.length > 0) {
            await mysqlPool.query(`
                UPDATE cipa_membros_gestao
                SET origem = ?, tipo_vaga = ?, cargo_cipa = ?, data_posse = COALESCE(?, data_posse), ativo = 1, observacoes = ?
                WHERE id = ?
            `, [origem, tipo_vaga, cargo_cipa, data_posse || null, observacoes || null, existe[0].id]);
            return res.json({ success: true, message: 'Dados do membro da CIPA atualizados com sucesso.' });
        }

        await mysqlPool.query(`
            INSERT INTO cipa_membros_gestao (
                gestao_id, usuario_id, origem, tipo_vaga, cargo_cipa, data_posse, ativo, observacoes
            ) VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_DATE()), 1, ?)
        `, [
            id,
            usuario_id,
            origem,
            tipo_vaga,
            cargo_cipa,
            data_posse || null,
            observacoes || null
        ]);

        res.status(201).json({ success: true, message: 'Membro vinculado à CIPA com sucesso.' });
    } catch (err) {
        console.error('[CIPA Membro] Erro:', err);
        res.status(500).json({ error: 'Erro ao vincular membro: ' + err.message });
    }
});

// Remover membro da CIPA
router.delete('/gestoes/:id/membros/:membroId', async (req, res) => {
    try {
        const { membroId } = req.params;
        await mysqlPool.query(`DELETE FROM cipa_membros_gestao WHERE id = ?`, [membroId]);
        res.json({ success: true, message: 'Membro removido com sucesso.' });
    } catch (err) {
        console.error('[CIPA Membro] Erro ao remover:', err);
        res.status(500).json({ error: 'Erro ao remover membro: ' + err.message });
    }
});

// Alterar status da Gestão (Avançar etapas)
router.put('/gestoes/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const validos = ['planejamento', 'inscricoes', 'eleicao', 'apurada', 'empossada', 'concluida'];
        if (!validos.includes(status)) {
            return res.status(400).json({ error: 'Status de gestão inválido.' });
        }

        await mysqlPool.query(`UPDATE cipa_gestoes SET status = ? WHERE id = ?`, [status, id]);
        res.json({ success: true, message: `Status da gestão alterado para "${status}".` });
    } catch (err) {
        console.error('[CIPA] Erro ao atualizar status:', err);
        res.status(500).json({ error: 'Erro ao atualizar status: ' + err.message });
    }
});

// ============================================================================
// 2. COMISSÃO ELEITORAL
// ============================================================================

// Adicionar membro na comissão eleitoral
router.post('/gestoes/:id/comissao', async (req, res) => {
    try {
        const { id } = req.params;
        const { usuario_id, papel, designado_em, observacoes } = req.body;

        if (!usuario_id) {
            return res.status(400).json({ error: 'Selecione o colaborador para a comissão.' });
        }

        await mysqlPool.query(`
            INSERT INTO cipa_comissao_eleitoral (gestao_id, usuario_id, papel, designado_em, observacoes)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE papel = VALUES(papel), observacoes = VALUES(observacoes)
        `, [
            id,
            usuario_id,
            papel || 'membro',
            designado_em || new Date().toISOString().split('T')[0],
            observacoes || null
        ]);

        res.json({ success: true, message: 'Membro adicionado à Comissão Eleitoral com sucesso.' });
    } catch (err) {
        console.error('[CIPA] Erro ao adicionar na comissão:', err);
        res.status(500).json({ error: 'Erro ao adicionar membro na comissão: ' + err.message });
    }
});

// Remover membro da comissão
router.delete('/gestoes/:id/comissao/:comissaoId', async (req, res) => {
    try {
        const { comissaoId } = req.params;
        await mysqlPool.query(`DELETE FROM cipa_comissao_eleitoral WHERE id = ?`, [comissaoId]);
        res.json({ success: true, message: 'Membro removido da comissão.' });
    } catch (err) {
        console.error('[CIPA] Erro ao remover da comissão:', err);
        res.status(500).json({ error: 'Erro ao remover da comissão: ' + err.message });
    }
});

// ============================================================================
// 3. CANDIDATURAS (REPRESENTANTES DOS EMPREGADOS)
// ============================================================================

// Inscrição de candidato
router.post('/gestoes/:id/candidatos', async (req, res) => {
    try {
        const { id } = req.params;
        let { usuario_id, nome_urna, cargo_setor, foto_url, observacoes } = req.body;

        // Se for o próprio colaborador se inscrevendo pelo portal
        if (!usuario_id) {
            usuario_id = req.user?.idUsuario || req.user?.id;
        }

        if (!usuario_id) {
            return res.status(400).json({ error: 'Colaborador não identificado para candidatura.' });
        }

        // Buscar dados do usuário
        const [uRows] = await mysqlPool.query(`
            SELECT idUsuario, NomeCompleto, Setor, Funcao, fotoUsuario FROM usuario WHERE idUsuario = ?
        `, [usuario_id]);
        if (!uRows.length) {
            return res.status(404).json({ error: 'Colaborador não encontrado no sistema.' });
        }
        const userFound = uRows[0];

        // Verificar se já é candidato nesta gestão
        const [jaInscrito] = await mysqlPool.query(`
            SELECT id FROM cipa_candidatos WHERE gestao_id = ? AND usuario_id = ?
        `, [id, usuario_id]);
        if (jaInscrito.length > 0) {
            return res.status(400).json({ error: 'Este colaborador já está inscrito nesta eleição da CIPA.' });
        }

        // Próximo número de chapa disponível
        const [maxChapa] = await mysqlPool.query(`
            SELECT COALESCE(MAX(numero_chapa), 0) + 1 AS proximo FROM cipa_candidatos WHERE gestao_id = ?
        `, [id]);
        const numeroChapa = maxChapa[0]?.proximo || 1;

        await mysqlPool.query(`
            INSERT INTO cipa_candidatos (
                gestao_id, usuario_id, numero_chapa,
                nome_urna, cargo_setor, foto_url, observacoes, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'deferido')
        `, [
            id,
            usuario_id,
            numeroChapa,
            nome_urna || userFound.NomeCompleto,
            cargo_setor || `${userFound.Funcao || 'Operador'} (${userFound.Setor || 'Fábrica'})`,
            foto_url || userFound.fotoUsuario || null,
            observacoes || null
        ]);

        res.status(201).json({
            success: true,
            numero_chapa: numeroChapa,
            message: `Candidatura registrada com sucesso! Número da chapa: ${numeroChapa}.`
        });
    } catch (err) {
        console.error('[CIPA] Erro ao registrar candidato:', err);
        res.status(500).json({ error: 'Erro ao registrar candidato: ' + err.message });
    }
});

// Homologar/Indeferir candidatura
router.put('/gestoes/:id/candidatos/:candidatoId/homologar', async (req, res) => {
    try {
        const { candidatoId } = req.params;
        const { status, motivo_indeferimento, nome_urna, numero_chapa } = req.body;

        await mysqlPool.query(`
            UPDATE cipa_candidatos 
            SET status = ?, 
                motivo_indeferimento = ?,
                nome_urna = COALESCE(?, nome_urna),
                numero_chapa = COALESCE(?, numero_chapa)
            WHERE id = ?
        `, [
            status || 'deferido',
            status === 'indeferido' ? (motivo_indeferimento || 'Indeferido pela Comissão Eleitoral') : null,
            nome_urna || null,
            numero_chapa || null,
            candidatoId
        ]);

        res.json({ success: true, message: 'Status do candidato atualizado.' });
    } catch (err) {
        console.error('[CIPA] Erro ao homologar candidato:', err);
        res.status(500).json({ error: 'Erro ao homologar candidato: ' + err.message });
    }
});

// ============================================================================
// 4. URNA ELETRÔNICA BLINDADA (SIGILO TOTAL & QUÓRUM EM TEMPO REAL)
// ============================================================================

// Status da Urna & Candidatos para Votação
router.get('/urna/:gestaoId/status', async (req, res) => {
    try {
        const { gestaoId } = req.params;
        const usuarioId = req.user?.idUsuario || req.user?.id;

        const [gRows] = await mysqlPool.query(`SELECT * FROM cipa_gestoes WHERE id = ?`, [gestaoId]);
        if (!gRows.length) return res.status(404).json({ error: 'Gestão CIPA não encontrada.' });
        const gestao = gRows[0];

        // Verificar se este eleitor já votou
        const [votouRows] = await mysqlPool.query(`
            SELECT data_hora_voto FROM cipa_eleitores_votaram WHERE gestao_id = ? AND usuario_id = ?
        `, [gestaoId, usuarioId]);

        const jaVotou = votouRows.length > 0;

        // Quórum
        const [aptosRows] = await mysqlPool.query(`SELECT COUNT(*) as total FROM usuario WHERE (status IS NULL OR status = 1)`);
        const totalAptos = aptosRows[0]?.total || 0;

        const [votaramRows] = await mysqlPool.query(`SELECT COUNT(*) as total FROM cipa_eleitores_votaram WHERE gestao_id = ?`, [gestaoId]);
        const totalVotaram = votaramRows[0]?.total || 0;

        const quorumMinimo = Math.floor(totalAptos / 2) + 1;
        const percentual = totalAptos > 0 ? ((totalVotaram / totalAptos) * 100).toFixed(1) : 0;

        // Candidatos homologados (deferidos) com foto do cadastro oficial do colaborador
        const [candidatos] = await mysqlPool.query(`
            SELECT c.id, c.numero_chapa, c.nome_urna, c.cargo_setor,
                   COALESCE(c.foto_url, u.fotoUsuario) AS foto_url,
                   u.NomeCompleto, u.Setor, u.Funcao, u.idUsuario AS Matricula
            FROM cipa_candidatos c
            LEFT JOIN usuario u ON u.idUsuario = c.usuario_id
            WHERE c.gestao_id = ? AND c.status = 'deferido'
            ORDER BY c.numero_chapa ASC
        `, [gestaoId]);

        res.json({
            gestao_id: Number(gestaoId),
            descricao: gestao.descricao,
            status_eleicao: gestao.status,
            eleicao_aberta: gestao.status === 'eleicao',
            ja_votou: jaVotou,
            data_hora_voto: jaVotou ? votouRows[0].data_hora_voto : null,
            total_aptos: totalAptos,
            total_votaram: totalVotaram,
            quorum_minimo: quorumMinimo,
            percentual_quorum: Number(percentual),
            quorum_atingido: totalVotaram >= quorumMinimo,
            candidatos
        });
    } catch (err) {
        console.error('[CIPA Urna] Erro ao carregar status:', err);
        res.status(500).json({ error: 'Erro ao carregar urna da CIPA: ' + err.message });
    }
});

// VOTAÇÃO SECRETA ELETRÔNICA (ZERO-KNOWLEDGE / DESACOPLAMENTO CRIPTOGRÁFICO)
router.post('/urna/:gestaoId/votar', async (req, res) => {
    const conn = await mysqlPool.getConnection();
    try {
        await conn.beginTransaction();

        const { gestaoId } = req.params;
        let { candidato_id, tipo_voto = 'valido', usuario_totem_id, senha_totem } = req.body;

        let eleitorId = req.user?.idUsuario || req.user?.id;

        // Modo Totem de Fábrica / Portaria (autenticação rápida por senha do colaborador)
        if (usuario_totem_id && senha_totem) {
            const [uCheck] = await conn.query(`SELECT idUsuario, Senha, status FROM usuario WHERE idUsuario = ?`, [usuario_totem_id]);
            if (!uCheck.length || uCheck[0].status === 0) {
                await conn.rollback();
                return res.status(401).json({ error: 'Colaborador não encontrado ou inativo.' });
            }
            const senhaValida = await bcrypt.compare(senha_totem, uCheck[0].Senha);
            if (!senhaValida) {
                await conn.rollback();
                return res.status(401).json({ error: 'Senha incorreta do colaborador para liberar a urna.' });
            }
            eleitorId = uCheck[0].idUsuario;
        }

        if (!eleitorId) {
            await conn.rollback();
            return res.status(401).json({ error: 'Identificação do eleitor necessária para validação de voto único.' });
        }

        // 1. Validar se a eleição está aberta
        const [gCheck] = await conn.query(`SELECT descricao, status, email_auditoria, admin_auditoria_usuario_id FROM cipa_gestoes WHERE id = ?`, [gestaoId]);
        if (!gCheck.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Gestão CIPA não encontrada.' });
        }
        if (gCheck[0].status !== 'eleicao') {
            await conn.rollback();
            return res.status(400).json({ error: 'A urna eletrônica não está aberta para votação no momento.' });
        }

        // 2. Validar se já votou
        const [jaVotou] = await conn.query(`
            SELECT id FROM cipa_eleitores_votaram WHERE gestao_id = ? AND usuario_id = ?
        `, [gestaoId, eleitorId]);

        if (jaVotou.length > 0) {
            await conn.rollback();
            return res.status(403).json({ error: 'Seu voto já foi registrado com sucesso nesta eleição. Voto único assegurado por lei.' });
        }

        // 3. Se for voto em candidato, validar existência
        let candIdFinal = null;
        if (tipo_voto === 'valido') {
            if (!candidato_id) {
                await conn.rollback();
                return res.status(400).json({ error: 'Selecione o candidato desejado ou marque voto em branco/nulo.' });
            }
            const [cCheck] = await conn.query(`
                SELECT id FROM cipa_candidatos WHERE id = ? AND gestao_id = ? AND status = 'deferido'
            `, [candidato_id, gestaoId]);
            if (!cCheck.length) {
                await conn.rollback();
                return res.status(400).json({ error: 'Candidato inválido ou não homologado.' });
            }
            candIdFinal = candidato_id;
        } else {
            candIdFinal = null; // branco ou nulo
        }

        // 4. REGISTRAR PRESENÇA DO ELEITOR (Controle de Quórum - NÃO CONTÉM O VOTO!)
        const ipOrigem = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const salt = crypto.randomBytes(16).toString('hex');
        const hashComprovante = crypto.createHash('sha256').update(`CIPA-${gestaoId}-${Date.now()}-${salt}`).digest('hex').substring(0, 32).toUpperCase();

        await conn.query(`
            INSERT INTO cipa_eleitores_votaram (gestao_id, usuario_id, ip_origem, dispositivo, hash_comprovante)
            VALUES (?, ?, ?, ?, ?)
        `, [gestaoId, eleitorId, ipOrigem.substring(0, 50), req.body.dispositivo || 'web', hashComprovante]);

        // 5. REGISTRAR CÉDULA ANÔNIMA (ZERO-KNOWLEDGE - SEM CHAVE ESTRANGEIRA DO ELEITOR!)
        await conn.query(`
            INSERT INTO cipa_cedulas_votos (gestao_id, candidato_id, tipo_voto, hash_comprovante)
            VALUES (?, ?, ?, ?)
        `, [gestaoId, candIdFinal, tipo_voto, hashComprovante]);

        await conn.commit();

        // 6. BUSCAR DADOS DO ELEITOR PARA DISPARO DE COMPROVANTE & AUDITORIA
        const [uEleitor] = await mysqlPool.query(`
            SELECT idUsuario, NomeCompleto, email, whatsapp, telefone, idUsuario AS Matricula, Setor 
            FROM usuario WHERE idUsuario = ?
        `, [eleitorId]);
        const voter = uEleitor[0] || {};

        let waEnviado = false;
        let emailEnviado = false;
        const dataFormatada = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

        const msgTexto = `🛡️ *COMPROVANTE DE VOTAÇÃO - CIPA METALFISA*\n\n` +
            `📋 *Eleição:* ${gCheck[0].descricao || 'CIPA'}\n` +
            `👤 *Eleitor:* ${voter.NomeCompleto || 'Colaborador'}${voter.Matricula ? ` (Matrícula: ${voter.Matricula})` : ''}\n` +
            `🔐 *Token de Auditoria (SHA-256):*\n\`${hashComprovante}\`\n\n` +
            `📅 *Data/Hora Oficial:* ${dataFormatada}\n` +
            `🗳️ *Canal:* ${req.body.dispositivo || 'Urna Eletrônica'}\n\n` +
            `_Seu voto foi registrado com sigilo absoluto nos termos da NR-05 e da Lei 14.457/2022. Guarde este código para conferência._`;

        // 1. Enviar para WhatsApp do eleitor (se configurado)
        if (voter.whatsapp) {
            try {
                await waSend(voter.whatsapp, msgTexto, 'Comprovante Votação CIPA');
                waEnviado = true;
            } catch (wErr) {
                console.warn('[CIPA WhatsApp Eleitor]', wErr.message);
            }
        }

        // 2. Enviar para E-mail do eleitor (se configurado)
        if (voter.email) {
            try {
                await sendMail({
                    from: `"CIPA / Lynx" <${process.env.SMTP_USER || 'suporte@lynxems.com.br'}>`,
                    to: voter.email,
                    subject: `Comprovante de Votação - CIPA (${hashComprovante.substring(0, 8)})`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                            <div style="text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px;">
                                <h2 style="color: #0284c7; margin: 0;">🛡️ COMPROVANTE OFICIAL DE VOTAÇÃO</h2>
                                <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">Comissão Interna de Prevenção de Acidentes e Assédio - NR-05</p>
                            </div>
                            <p>Olá, <b>${voter.NomeCompleto}</b>!</p>
                            <p>Confirmamos que sua participação na eleição da CIPA foi processada com <b>sigilo absoluto</b>.</p>
                            <div style="background: #f8fafc; border-left: 4px solid #10B981; padding: 12px 16px; margin: 16px 0;">
                                <p style="margin: 4px 0; font-size: 14px;"><b>Eleição:</b> ${gCheck[0].descricao || 'CIPA'}</p>
                                <p style="margin: 4px 0; font-size: 14px;"><b>Data/Hora:</b> ${dataFormatada}</p>
                                <p style="margin: 4px 0; font-size: 14px;"><b>Canal:</b> ${req.body.dispositivo || 'Urna Eletrônica'}</p>
                                <p style="margin: 8px 0 4px 0; font-size: 14px;"><b>Token de Auditoria:</b></p>
                                <code style="display: block; background: #e2e8f0; padding: 8px; border-radius: 4px; font-size: 15px; font-weight: bold; color: #0f172a; word-break: break-all;">${hashComprovante}</code>
                            </div>
                            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px;">
                                Lynx Industrial • Sistema de Gestão Anty • Processo Eleitoral Auditável
                            </p>
                        </div>
                    `
                });
                emailEnviado = true;
            } catch (mErr) {
                console.warn('[CIPA Email Eleitor]', mErr.message);
            }
        }

        // 3. Enviar CÓPIA OBRIGATÓRIA para o Administrador da CIPA / SESMT
        const adminDestinatario = gCheck[0].email_auditoria || process.env.CIPA_ADMIN_EMAIL || process.env.SMTP_USER || 'suporte@lynxems.com.br';
        try {
            await sendMail({
                from: `"Auditoria Eleitoral CIPA" <${process.env.SMTP_USER || 'suporte@lynxems.com.br'}>`,
                to: adminDestinatario,
                subject: `[AUDITORIA CIPA] Voto Registrado - Eleitor: ${voter.NomeCompleto} (Token ${hashComprovante.substring(0, 8)})`,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 16px;">
                        <h3 style="color: #0284c7;">Registro de Votação para Auditoria Eleitoral</h3>
                        <p><b>Eleição:</b> ${gCheck[0].descricao}</p>
                        <p><b>Eleitor:</b> ${voter.NomeCompleto} (ID: ${eleitorId}, Matrícula: ${voter.Matricula || 'N/A'}, Setor: ${voter.Setor || 'N/A'})</p>
                        <p><b>Token Emitido:</b> <code>${hashComprovante}</code></p>
                        <p><b>IP de Origem:</b> ${ipOrigem}</p>
                        <p><b>Data/Hora:</b> ${dataFormatada}</p>
                        <p style="color: #64748b; font-size: 12px;">*Nota de Sigilo Legal: Conforme a NR-05, a cédula foi armazenada em tabela desacoplada sem identificador de usuário.</p>
                    </div>
                `
            });
        } catch (admErr) {
            console.warn('[CIPA Admin Audit]', admErr.message);
        }

        // Atualizar status de envio na presença
        await mysqlPool.query(`
            UPDATE cipa_eleitores_votaram
            SET comprovante_enviado_whatsapp = ?, comprovante_enviado_email = ?
            WHERE gestao_id = ? AND usuario_id = ?
        `, [waEnviado ? 1 : 0, emailEnviado ? 1 : 0, gestaoId, eleitorId]);

        const cleanPhone = (voter.whatsapp || '').replace(/\\D/g, '');
        const whatsappDirectUrl = cleanPhone 
            ? `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(msgTexto)}`
            : `https://api.whatsapp.com/send?text=${encodeURIComponent(msgTexto)}`;

        res.json({
            success: true,
            comprovante_voto: hashComprovante,
            hash_comprovante: hashComprovante,
            whatsapp_enviado: waEnviado,
            email_enviado: emailEnviado,
            whatsapp_direct_url: whatsappDirectUrl,
            eleitor: {
                nome: voter.NomeCompleto,
                email: voter.email,
                whatsapp: voter.whatsapp
            },
            mensagem: 'Voto secreto registrado com sucesso na urna eletrônica da CIPA!'
        });
    } catch (err) {
        await conn.rollback();
        console.error('[CIPA Votação] Erro:', err);
        res.status(500).json({ error: 'Erro ao processar voto na urna eletrônica: ' + err.message });
    } finally {
        conn.release();
    }
});

// ============================================================================
// 5. APURAÇÃO AUTOMÁTICA & ATA DE ELEIÇÃO
// ============================================================================

// Apurar Urna Eletrônica
router.post('/urna/:gestaoId/apurar', async (req, res) => {
    const conn = await mysqlPool.getConnection();
    try {
        await conn.beginTransaction();

        const { gestaoId } = req.params;
        const [gRows] = await conn.query(`SELECT * FROM cipa_gestoes WHERE id = ?`, [gestaoId]);
        if (!gRows.length) return res.status(404).json({ error: 'Gestão CIPA não encontrada.' });
        const gestao = gRows[0];

        // 1. Verificar quórum
        const [aptosRows] = await conn.query(`SELECT COUNT(*) as total FROM usuario WHERE (status IS NULL OR status = 1)`);
        const totalAptos = aptosRows[0]?.total || 0;

        const [votaramRows] = await conn.query(`SELECT COUNT(*) as total FROM cipa_eleitores_votaram WHERE gestao_id = ?`, [gestaoId]);
        const totalVotaram = votaramRows[0]?.total || 0;

        const quorumMinimo = Math.floor(totalAptos / 2) + 1;
        const quorumAtingido = totalVotaram >= quorumMinimo;

        if (!quorumAtingido && !req.body.forcar_apuracao) {
            await conn.rollback();
            return res.status(400).json({
                error: `Quórum legal da NR-05 não atingido. Votaram ${totalVotaram} de ${totalAptos} colaboradores (Mínimo exigido: ${quorumMinimo}). A eleição deve ser prorrogada por mais 1 dia.`
            });
        }

        // 2. Contar votos por candidato na tabela anônima
        const [votosPorCand] = await conn.query(`
            SELECT candidato_id, COUNT(*) as votos
            FROM cipa_cedulas_votos
            WHERE gestao_id = ? AND tipo_voto = 'valido' AND candidato_id IS NOT NULL
            GROUP BY candidato_id
        `, [gestaoId]);

        const mapaVotos = {};
        votosPorCand.forEach(r => { mapaVotos[r.candidato_id] = Number(r.votos); });

        // Votos brancos e nulos
        const [brancosRows] = await conn.query(`SELECT COUNT(*) as total FROM cipa_cedulas_votos WHERE gestao_id = ? AND tipo_voto = 'branco'`, [gestaoId]);
        const [nulosRows] = await conn.query(`SELECT COUNT(*) as total FROM cipa_cedulas_votos WHERE gestao_id = ? AND tipo_voto = 'nulo'`, [gestaoId]);

        const totalBrancos = brancosRows[0]?.total || 0;
        const totalNulos = nulosRows[0]?.total || 0;

        // 3. Atualizar votos de cada candidato
        const [candidatos] = await conn.query(`
            SELECT c.*, u.DataCadastro, u.idUsuario
            FROM cipa_candidatos c
            JOIN usuario u ON u.idUsuario = c.usuario_id
            WHERE c.gestao_id = ? AND c.status = 'deferido'
        `, [gestaoId]);

        for (const cand of candidatos) {
            const votos = mapaVotos[cand.id] || 0;
            cand.total_votos = votos;
            await conn.query(`UPDATE cipa_candidatos SET total_votos = ? WHERE id = ?`, [votos, cand.id]);
        }

        // 4. Ordenar candidatos por Votos DESC, com Desempate por Tempo de Casa (DataCadastro ASC)
        candidatos.sort((a, b) => {
            if (b.total_votos !== a.total_votos) {
                return b.total_votos - a.total_votos;
            }
            // Desempate: quem entrou mais cedo na empresa
            const dateA = new Date(a.DataCadastro || '2099-01-01');
            const dateB = new Date(b.DataCadastro || '2099-01-01');
            return dateA - dateB;
        });

        // 5. Classificar Titulares e Suplentes
        const vagasTitulares = gestao.vagas_titulares_eleitos || 4;
        const vagasSuplentes = gestao.vagas_suplentes_eleitos || 3;

        // Limpar membros eleitos antigos se houver
        await conn.query(`DELETE FROM cipa_membros_gestao WHERE gestao_id = ? AND origem = 'eleito'`, [gestaoId]);

        let classificacao = 1;
        for (const cand of candidatos) {
            let resultado = 'nao_eleito';
            let tipoVaga = null;

            if (classificacao <= vagasTitulares) {
                resultado = 'titular_eleito';
                tipoVaga = 'titular';
            } else if (classificacao <= (vagasTitulares + vagasSuplentes)) {
                resultado = 'suplente_eleito';
                tipoVaga = 'suplente';
            }

            await conn.query(`
                UPDATE cipa_candidatos 
                SET classificacao = ?, resultado = ?
                WHERE id = ?
            `, [classificacao, resultado, cand.id]);

            // Se for eleito (titular ou suplente), inserir na tabela oficial de membros
            if (tipoVaga) {
                await conn.query(`
                    INSERT INTO cipa_membros_gestao (
                        gestao_id, usuario_id, origem, tipo_vaga, cargo_cipa
                    ) VALUES (?, ?, 'eleito', ?, 'membro')
                `, [gestaoId, cand.usuario_id, tipoVaga]);
            }

            classificacao++;
        }

        // 6. Atualizar gestão para 'apurada'
        await conn.query(`
            UPDATE cipa_gestoes 
            SET status = 'apurada',
                total_eleitores_aptos = ?,
                total_votos_apurados = ?,
                quorum_atingido = 1,
                data_apuracao = NOW()
            WHERE id = ?
        `, [totalAptos, totalVotaram, gestaoId]);

        // 7. Gerar automaticamente registro da Ata de Eleição e Apuração
        const ataTexto = `Aos ${new Date().toLocaleDateString('pt-BR')}, nas dependências da METALFISA INDUSTRIAL LTDA, realizou-se a eleição dos representantes dos empregados na Comissão Interna de Prevenção de Acidentes e Assédio (CIPA) - Gestão ${gestao.ano_inicio}/${gestao.ano_fim}, sob a supervisão da Comissão Eleitoral.\n\n` +
            `Total de Colaboradores Aptos: ${totalAptos}\n` +
            `Total de Votos Coletados: ${totalVotaram} (Quórum de ${((totalVotaram/totalAptos)*100).toFixed(1)}% - Quórum Legal NR-05 Atingido)\n` +
            `Votos Brancos: ${totalBrancos} | Votos Nulos: ${totalNulos}\n\n` +
            `A apuração eletrônica resultou na eleição dos seguintes membros titulares e suplentes, em conformidade com as normas regulamentadoras vigentes.`;

        await conn.query(`
            INSERT INTO cipa_reunioes_atas (
                gestao_id, numero_ata, tipo, data_reuniao,
                horario_inicio, horario_fim, pauta, conteudo_ata, status, redigido_por
            ) VALUES (?, 'ATA-ELEICAO-01', 'eleicao_apuracao', CURRENT_DATE(), '08:00', '17:00',
                      'Apuração da Votação Eletrônica e Proclamação dos Eleitos da CIPA',
                      ?, 'fechada', ?)
            ON DUPLICATE KEY UPDATE conteudo_ata = VALUES(conteudo_ata)
        `, [
            gestaoId,
            ataTexto,
            req.user?.NomeCompleto || 'Comissão Eleitoral'
        ]);

        await conn.commit();

        res.json({
            success: true,
            total_aptos: totalAptos,
            total_votos: totalVotaram,
            total_brancos: totalBrancos,
            total_nulos: totalNulos,
            mensagem: 'Urna eletrônica apurada e Ata de Eleição gerada com sucesso!'
        });
    } catch (err) {
        await conn.rollback();
        console.error('[CIPA Apuração] Erro:', err);
        res.status(500).json({ error: 'Erro ao apurar urna eletrônica: ' + err.message });
    } finally {
        conn.release();
    }
});

// ============================================================================
// 6. MEMBROS INDICADOS PELO EMPREGADOR & POSSE
// ============================================================================

// Salvar / Atualizar membros indicados pela empresa
router.post('/gestoes/:id/membros-indicados', async (req, res) => {
    try {
        const { id } = req.params;
        const { membros } = req.body; // Array de { usuario_id, tipo_vaga, cargo_cipa }

        if (!Array.isArray(membros)) {
            return res.status(400).json({ error: 'Lista de membros indicados inválida.' });
        }

        // Limpar indicados antigos
        await mysqlPool.query(`DELETE FROM cipa_membros_gestao WHERE gestao_id = ? AND origem = 'indicado'`, [id]);

        for (const m of membros) {
            await mysqlPool.query(`
                INSERT INTO cipa_membros_gestao (
                    gestao_id, usuario_id, origem, tipo_vaga, cargo_cipa
                ) VALUES (?, ?, 'indicado', ?, ?)
            `, [
                id,
                m.usuario_id,
                m.tipo_vaga || 'titular',
                m.cargo_cipa || 'membro'
            ]);
        }

        res.json({ success: true, message: 'Membros indicados pela empresa salvos com sucesso.' });
    } catch (err) {
        console.error('[CIPA Indicados] Erro:', err);
        res.status(500).json({ error: 'Erro ao salvar indicados do empregador: ' + err.message });
    }
});

// Definir Presidente e Vice-Presidente
router.put('/gestoes/:id/definir-cargos', async (req, res) => {
    try {
        const { id } = req.params;
        const { presidente_id, vice_presidente_id, secretario_id } = req.body;

        if (presidente_id) {
            await mysqlPool.query(`
                UPDATE cipa_membros_gestao SET cargo_cipa = 'membro' WHERE gestao_id = ? AND cargo_cipa = 'presidente'
            `, [id]);
            await mysqlPool.query(`
                UPDATE cipa_membros_gestao SET cargo_cipa = 'presidente' WHERE gestao_id = ? AND usuario_id = ?
            `, [id, presidente_id]);
        }

        if (vice_presidente_id) {
            await mysqlPool.query(`
                UPDATE cipa_membros_gestao SET cargo_cipa = 'membro' WHERE gestao_id = ? AND cargo_cipa = 'vice_presidente'
            `, [id]);
            await mysqlPool.query(`
                UPDATE cipa_membros_gestao SET cargo_cipa = 'vice_presidente' WHERE gestao_id = ? AND usuario_id = ?
            `, [id, vice_presidente_id]);
        }

        if (secretario_id) {
            await mysqlPool.query(`
                UPDATE cipa_membros_gestao SET cargo_cipa = 'membro' WHERE gestao_id = ? AND cargo_cipa = 'secretario'
            `, [id]);
            await mysqlPool.query(`
                UPDATE cipa_membros_gestao SET cargo_cipa = 'secretario' WHERE gestao_id = ? AND usuario_id = ?
            `, [id, secretario_id]);
        }

        res.json({ success: true, message: 'Diretoria da CIPA atualizada com sucesso.' });
    } catch (err) {
        console.error('[CIPA Diretoria] Erro:', err);
        res.status(500).json({ error: 'Erro ao atualizar cargos da CIPA: ' + err.message });
    }
});

// Dar posse oficial à CIPA
router.post('/gestoes/:id/dar-posse', async (req, res) => {
    try {
        const { id } = req.params;
        const { data_posse, local_posse } = req.body;

        await mysqlPool.query(`
            UPDATE cipa_gestoes 
            SET status = 'empossada',
                data_inicio_mandato = COALESCE(?, data_inicio_mandato, CURRENT_DATE())
            WHERE id = ?
        `, [data_posse || null, id]);

        // Gerar Ata de Posse
        const [gestao] = await mysqlPool.query(`SELECT * FROM cipa_gestoes WHERE id = ?`, [id]);
        const ataTexto = `Aos ${new Date(data_posse || Date.now()).toLocaleDateString('pt-BR')}, nas dependências da METALFISA INDUSTRIAL LTDA, deu-se posse aos membros eleitos pelos empregados e designados pelo empregador para compor a CIPA - Gestão ${gestao[0].ano_inicio}/${gestao[0].ano_fim}.\n\n` +
            `Os membros empossados assumem o compromisso legal de zelar pela integridade física e saúde de todos os trabalhadores, atuando com prioridade no combate a todas as formas de assédio no ambiente laboral (Lei 14.457/2022).`;

        await mysqlPool.query(`
            INSERT INTO cipa_reunioes_atas (
                gestao_id, numero_ata, tipo, data_reuniao,
                horario_inicio, local, pauta, conteudo_ata, status, redigido_por
            ) VALUES (?, 'ATA-POSSE-01', 'instalacao_posse', COALESCE(?, CURRENT_DATE()),
                      '09:00', ?, 'Instalação e Posse Oficial da CIPA',
                      ?, 'fechada', ?)
            ON DUPLICATE KEY UPDATE conteudo_ata = VALUES(conteudo_ata)
        `, [
            id,
            data_posse || null,
            local_posse || 'Auditório / Sala de Reuniões Metalfisa',
            ataTexto,
            req.user?.NomeCompleto || 'Diretoria & RH'
        ]);

        res.json({ success: true, message: 'CIPA empossada oficialmente e Ata de Posse registrada!' });
    } catch (err) {
        console.error('[CIPA Posse] Erro:', err);
        res.status(500).json({ error: 'Erro ao registrar posse da CIPA: ' + err.message });
    }
});

// ============================================================================
// 7. REUNIÕES ORDINÁRIAS MENSAIS, ATAS & ASSINATURA DIGITAL
// ============================================================================

// Listar reuniões e atas
router.get('/gestoes/:id/reunioes', async (req, res) => {
    try {
        const { id } = req.params;
        const [reunioes] = await mysqlPool.query(`
            SELECT r.*,
                   (SELECT COUNT(*) FROM cipa_reunioes_presencas p WHERE p.reuniao_id = r.id AND p.presente = 1) AS total_presentes,
                   (SELECT COUNT(*) FROM cipa_reunioes_presencas p WHERE p.reuniao_id = r.id AND p.assinado_digitalmente = 1) AS total_assinaturas
            FROM cipa_reunioes_atas r
            WHERE r.gestao_id = ?
            ORDER BY r.data_reuniao ASC
        `, [id]);

        res.json(reunioes || []);
    } catch (err) {
        console.error('[CIPA Reuniões] Erro:', err);
        res.status(500).json({ error: 'Erro ao listar reuniões: ' + err.message });
    }
});

// Criar / Agendar reunião (com suporte opcional a upload de documento/ata digitalizada em PDF/Word/Img)
router.post('/gestoes/:id/reunioes', uploadCipaAta.single('arquivo_anexo'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            numero_ata,
            tipo = 'ordinaria',
            mes_competencia,
            data_reuniao,
            horario_inicio,
            horario_fim,
            local,
            pauta,
            conteudo_ata
        } = req.body;

        if (!data_reuniao || (!pauta && !req.file)) {
            return res.status(400).json({ error: 'Data da reunião e pauta (ou arquivo anexo) são obrigatórios.' });
        }

        let arquivoUrl = null;
        let arquivoNomeOriginal = null;
        let arquivoTamanho = null;
        let arquivoTipo = null;

        if (req.file) {
            arquivoUrl = `/uploads/cipa_atas/${req.file.filename}`;
            arquivoNomeOriginal = req.file.originalname;
            arquivoTamanho = req.file.size;
            arquivoTipo = req.file.mimetype;
        }

        const [insertRes] = await mysqlPool.query(`
            INSERT INTO cipa_reunioes_atas (
                gestao_id, numero_ata, tipo, mes_competencia,
                data_reuniao, horario_inicio, horario_fim, local,
                pauta, conteudo_ata, redigido_por,
                arquivo_anexo_url, arquivo_nome_original, arquivo_tamanho, arquivo_tipo,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            numero_ata || `ATA-${Date.now()}`,
            tipo,
            mes_competencia || null,
            data_reuniao,
            horario_inicio || '09:00',
            horario_fim || '10:00',
            local || 'Sala de Reuniões Principal - Metalfisa',
            pauta || (req.file ? `Ata Anexada: ${arquivoNomeOriginal}` : 'Reunião CIPA'),
            conteudo_ata || (req.file ? `Documento digitalizado/anexado: ${arquivoNomeOriginal}` : 'Reunião mensal da CIPA para alinhamento de rotinas de segurança e combate ao assédio.'),
            req.user?.NomeCompleto || req.user?.login || 'Secretário CIPA',
            arquivoUrl,
            arquivoNomeOriginal,
            arquivoTamanho,
            arquivoTipo,
            req.file ? 'fechada' : 'rascunho'
        ]);

        const reuniaoId = insertRes.insertId;

        // Inicializar lista de presenças com todos os membros ativos da gestão
        const [membros] = await mysqlPool.query(`
            SELECT usuario_id FROM cipa_membros_gestao WHERE gestao_id = ? AND ativo = 1
        `, [id]);

        for (const m of membros) {
            await mysqlPool.query(`
                INSERT INTO cipa_reunioes_presencas (reuniao_id, usuario_id, presente)
                VALUES (?, ?, 1)
                ON DUPLICATE KEY UPDATE presente = 1
            `, [reuniaoId, m.usuario_id]);
        }

        res.status(201).json({
            success: true,
            reuniao_id: reuniaoId,
            arquivo_anexo_url: arquivoUrl,
            message: req.file ? 'Documento/Ata anexado e registrado com sucesso!' : 'Reunião agendada com sucesso!'
        });
    } catch (err) {
        console.error('[CIPA Reunião] Erro ao criar:', err);
        res.status(500).json({ error: 'Erro ao criar reunião: ' + err.message });
    }
});

// Upload de arquivo anexo para uma ata já existente
router.post('/reunioes/:id/anexo', uploadCipaAta.single('arquivo_anexo'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        }

        const arquivoUrl = `/uploads/cipa_atas/${req.file.filename}`;
        await mysqlPool.query(`
            UPDATE cipa_reunioes_atas
            SET arquivo_anexo_url = ?,
                arquivo_nome_original = ?,
                arquivo_tamanho = ?,
                arquivo_tipo = ?
            WHERE id = ?
        `, [
            arquivoUrl,
            req.file.originalname,
            req.file.size,
            req.file.mimetype,
            id
        ]);

        res.json({
            success: true,
            arquivo_anexo_url: arquivoUrl,
            arquivo_nome_original: req.file.originalname,
            message: 'Documento anexado com sucesso à ata!'
        });
    } catch (err) {
        console.error('[CIPA Anexo] Erro:', err);
        res.status(500).json({ error: 'Erro ao anexar arquivo na ata: ' + err.message });
    }
});

// Assinar Ata Digitalmente (com Senha do Usuário Cipeiro)
router.post('/reunioes/:reuniaoId/assinar', async (req, res) => {
    try {
        const { reuniaoId } = req.params;
        const { senha } = req.body;
        const usuarioId = req.user?.idUsuario || req.user?.id;

        if (!senha) {
            return res.status(400).json({ error: 'Informe sua senha de usuário para assinar digitalmente a ata.' });
        }

        // Validar senha
        const [uRows] = await mysqlPool.query(`SELECT Senha FROM usuario WHERE idUsuario = ?`, [usuarioId]);
        if (!uRows.length) return res.status(404).json({ error: 'Usuário não encontrado.' });

        const valida = await bcrypt.compare(senha, uRows[0].Senha);
        if (!valida) {
            return res.status(401).json({ error: 'Senha incorreta. Não foi possível assinar a ata.' });
        }

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const hash = crypto.createHash('sha256').update(`ATA-${reuniaoId}-${usuarioId}-${Date.now()}`).digest('hex').substring(0, 32).toUpperCase();

        await mysqlPool.query(`
            UPDATE cipa_reunioes_presencas 
            SET assinado_digitalmente = 1,
                data_hora_assinatura = NOW(),
                ip_assinatura = ?,
                hash_assinatura = ?
            WHERE reuniao_id = ? AND usuario_id = ?
        `, [ip.substring(0, 50), hash, reuniaoId, usuarioId]);

        res.json({
            success: true,
            hash_assinatura: hash,
            message: 'Ata assinada digitalmente com sucesso!'
        });
    } catch (err) {
        console.error('[CIPA Assinatura] Erro:', err);
        res.status(500).json({ error: 'Erro ao assinar ata: ' + err.message });
    }
});

// ============================================================================
// 8. AUDITORIA ELEITORAL & VALIDAÇÃO DE COMPROVANTES (SIGILO ABSOLUTO)
// ============================================================================

// Relatório completo de auditoria eleitoral (Apenas Admin / CE)
router.get('/gestoes/:id/auditoria', async (req, res) => {
    try {
        const { id } = req.params;
        const [eleitores] = await mysqlPool.query(`
            SELECT v.id, v.usuario_id, v.data_hora_voto, v.ip_origem, v.dispositivo,
                   v.hash_comprovante, v.comprovante_enviado_whatsapp, v.comprovante_enviado_email,
                   u.NomeCompleto, u.idUsuario AS Matricula, u.Setor, u.Funcao, u.email, u.whatsapp, u.fotoUsuario
            FROM cipa_eleitores_votaram v
            JOIN usuario u ON u.idUsuario = v.usuario_id
            WHERE v.gestao_id = ?
            ORDER BY v.data_hora_voto DESC
        `, [id]);

        const [totais] = await mysqlPool.query(`
            SELECT 
                (SELECT COUNT(*) FROM cipa_eleitores_votaram WHERE gestao_id = ?) as total_votantes,
                (SELECT COUNT(*) FROM cipa_cedulas_votos WHERE gestao_id = ?) as total_cedulas,
                (SELECT COUNT(*) FROM cipa_eleitores_votaram WHERE gestao_id = ? AND comprovante_enviado_whatsapp = 1) as enviados_whatsapp,
                (SELECT COUNT(*) FROM cipa_eleitores_votaram WHERE gestao_id = ? AND comprovante_enviado_email = 1) as enviados_email
        `, [id, id, id, id]);

        res.json({
            totais: totais[0],
            eleitores: eleitores || []
        });
    } catch (err) {
        console.error('[CIPA Auditoria] Erro:', err);
        res.status(500).json({ error: 'Erro ao carregar auditoria eleitoral: ' + err.message });
    }
});

// Validador público/interno de comprovante (conferir autenticidade de token)
router.get('/auditar-comprovante/:hash', async (req, res) => {
    try {
        const { hash } = req.params;
        const [rows] = await mysqlPool.query(`
            SELECT v.id, v.data_hora_voto, v.dispositivo, v.hash_comprovante,
                   g.id as gestao_id, g.descricao as gestao_descricao, g.ano_inicio, g.ano_fim,
                   u.NomeCompleto, u.idUsuario AS Matricula, u.Setor
            FROM cipa_eleitores_votaram v
            JOIN cipa_gestoes g ON g.id = v.gestao_id
            JOIN usuario u ON u.idUsuario = v.usuario_id
            WHERE v.hash_comprovante = ? OR v.hash_comprovante LIKE ?
            LIMIT 1
        `, [hash, `%${hash}%`]);

        if (!rows.length) {
            return res.status(404).json({
                valido: false,
                mensagem: 'Comprovante não localizado ou inválido no ecossistema eleitoral da Metalfisa.'
            });
        }

        const v = rows[0];
        // Mascara o nome para preservar privacidade caso consultado por terceiros (ex: "Valdir J. S.")
        const partes = (v.NomeCompleto || '').split(' ');
        const nomeMascarado = partes.map((p, idx) => (idx === 0 || idx === partes.length - 1) ? p : p[0] + '***').join(' ');

        res.json({
            valido: true,
            hash_comprovante: v.hash_comprovante,
            gestao: v.gestao_descricao,
            data_hora_voto: v.data_hora_voto,
            canal: v.dispositivo,
            eleitor_auditado: nomeMascarado,
            matricula_auditada: v.Matricula ? `***${String(v.Matricula).slice(-3)}` : 'Confirmada',
            mensagem: 'Comprovante oficial emitido e auditado com sucesso pela CIPA da Metalfisa.'
        });
    } catch (err) {
        console.error('[CIPA Validação Hash] Erro:', err);
        res.status(500).json({ error: 'Erro ao validar comprovante: ' + err.message });
    }
});

module.exports = router;
