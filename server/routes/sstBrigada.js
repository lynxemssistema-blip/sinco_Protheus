const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const { authenticateToken } = require('./auth');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { sendText: waSend } = require('../services/whatsapp');

// ============================================================================
// CONFIGURAÇÃO DE UPLOADS (CERTIFICADOS E SIMULADOS)
// ============================================================================
const certStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/brigada_certificados');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, `cert_${Date.now()}_${safeBase}${ext}`);
    }
});
const uploadCertificado = multer({
    storage: certStorage,
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

const simuladoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/brigada_simulados');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, `simulado_${Date.now()}_${safeBase}${ext}`);
    }
});
const uploadSimulado = multer({
    storage: simuladoStorage,
    limits: { fileSize: 30 * 1024 * 1024 }
});

const inspecaoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/brigada_inspecoes');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, `inspecao_${Date.now()}_${safeBase}${ext}`);
    }
});
const uploadInspecao = multer({
    storage: inspecaoStorage,
    limits: { fileSize: 30 * 1024 * 1024 }
});

const emergenciaStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/brigada_emergencias');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, `emergencia_${Date.now()}_${safeBase}${ext}`);
    }
});
const uploadEmergencia = multer({
    storage: emergenciaStorage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB (permite fotos e pequenos vídeos de evidência)
});

// Garante tabela de histórico de alertas de emergência
(async () => {
    try {
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS sst_brigada_alertas_emergencia (
                id INT AUTO_INCREMENT PRIMARY KEY,
                solicitante_usuario_id INT NULL,
                solicitante_nome VARCHAR(255) NULL,
                local_incidente VARCHAR(255) NOT NULL,
                descricao_ocorrencia TEXT NOT NULL,
                nivel_urgencia VARCHAR(50) DEFAULT 'grave',
                turno_alvo VARCHAR(50) DEFAULT '1_turno',
                midia_url VARCHAR(500) NULL,
                tipo_midia ENUM('foto','video','nenhum') DEFAULT 'nenhum',
                telefones_notificados INT DEFAULT 0,
                criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    } catch (e) {
        console.warn('[Brigada Emergencia] Tabela já existente ou erro:', e.message);
    }
})();

// Aplica autenticação a todas as rotas
router.use(authenticateToken);

// ============================================================================
// 1. DASHBOARD & INDICADORES DE PRONTIDÃO
// ============================================================================
router.get('/dashboard', async (req, res) => {
    try {
        // 1. Configuração e dimensionamento
        const [configRows] = await mysqlPool.query(`SELECT * FROM sst_brigada_config LIMIT 1`);
        const config = configRows[0] || {};

        // 2. Membros e status de treinamento
        const [membros] = await mysqlPool.query(`
            SELECT m.id, m.usuario_id, m.papel, m.turno, m.setor_atuacao, m.status,
                   u.NomeCompleto, u.Setor, u.Funcao, u.idUsuario AS Matricula, u.fotoUsuario, u.whatsapp, u.email,
                   (
                       SELECT t.status_validade 
                       FROM sst_brigada_treinamentos t 
                       WHERE t.membro_id = m.id 
                       ORDER BY t.data_validade DESC 
                       LIMIT 1
                   ) as status_treinamento,
                   (
                       SELECT t.data_validade 
                       FROM sst_brigada_treinamentos t 
                       WHERE t.membro_id = m.id 
                       ORDER BY t.data_validade DESC 
                       LIMIT 1
                   ) as validade_treinamento,
                   (
                       SELECT t.nivel 
                       FROM sst_brigada_treinamentos t 
                       WHERE t.membro_id = m.id 
                       ORDER BY t.data_validade DESC 
                       LIMIT 1
                   ) as nivel_treinamento
            FROM sst_brigada_membros m
            JOIN usuario u ON u.idUsuario = m.usuario_id
            WHERE m.status = 'ativo'
            ORDER BY 
                CASE m.papel 
                    WHEN 'coordenador_geral' THEN 1 
                    WHEN 'chefe_brigada' THEN 2 
                    WHEN 'lider_setor' THEN 3 
                    ELSE 4 
                END ASC,
                u.NomeCompleto ASC
        `);

        // Totais por turno
        const porTurno = {
            '1_turno': membros.filter(m => m.turno === '1_turno' || m.turno === 'geral'),
            '2_turno': membros.filter(m => m.turno === '2_turno' || m.turno === 'geral'),
            '3_turno': membros.filter(m => m.turno === '3_turno' || m.turno === 'geral'),
            'administrativo': membros.filter(m => m.turno === 'administrativo')
        };

        // Status de Treinamentos (Hoje)
        const hoje = new Date();
        const em30Dias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);

        let aptos = 0;
        let vencendo30d = 0;
        let vencidosOuSem = 0;

        membros.forEach(m => {
            if (!m.validade_treinamento) {
                vencidosOuSem++;
            } else {
                const val = new Date(m.validade_treinamento);
                if (val < hoje) {
                    vencidosOuSem++;
                } else if (val <= em30Dias) {
                    vencendo30d++;
                    aptos++;
                } else {
                    aptos++;
                }
            }
        });

        // 3. Equipamentos (Extintores e Hidrantes)
        const [equipamentos] = await mysqlPool.query(`
            SELECT id, codigo_identificador, tipo, setor_localizacao, status_operacional,
                   data_proxima_recarga, data_proximo_teste_hidrostatico,
                   (
                       SELECT i.data_inspecao 
                       FROM sst_brigada_inspecoes i 
                       WHERE i.equipamento_id = sst_brigada_equipamentos.id 
                       ORDER BY i.data_inspecao DESC 
                       LIMIT 1
                   ) as ultima_inspecao,
                   (
                       SELECT i.resultado_final 
                       FROM sst_brigada_inspecoes i 
                       WHERE i.equipamento_id = sst_brigada_equipamentos.id 
                       ORDER BY i.data_inspecao DESC 
                       LIMIT 1
                   ) as ultimo_resultado
            FROM sst_brigada_equipamentos
        `);

        let eqOperacionais = 0;
        let eqVencendoRecarga = 0;
        let eqRecargaVencida = 0;
        let eqInspecaoPendente = 0; // Mais de 30 dias sem vistoria

        const limiteInspecao = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);

        equipamentos.forEach(e => {
            if (e.status_operacional === 'operacional') eqOperacionais++;
            if (e.data_proxima_recarga) {
                const dtRec = new Date(e.data_proxima_recarga);
                if (dtRec < hoje) eqRecargaVencida++;
                else if (dtRec <= em30Dias) eqVencendoRecarga++;
            }
            if (!e.ultima_inspecao || new Date(e.ultima_inspecao) < limiteInspecao) {
                eqInspecaoPendente++;
            }
        });

        // 4. Último simulado
        const [ultSimulado] = await mysqlPool.query(`
            SELECT * FROM sst_brigada_simulados ORDER BY data_simulado DESC, id DESC LIMIT 1
        `);

        res.json({
            config,
            totais_membros: {
                total_ativos: membros.length,
                aptos,
                vencendo30d,
                vencidosOuSem,
                turno1_total: porTurno['1_turno'].length,
                turno1_minimo: config.minimo_brigadistas_1_turno || 8,
                turno1_conforme: porTurno['1_turno'].length >= (config.minimo_brigadistas_1_turno || 8),
                turno2_total: porTurno['2_turno'].length,
                turno2_minimo: config.minimo_brigadistas_2_turno || 6,
                turno2_conforme: porTurno['2_turno'].length >= (config.minimo_brigadistas_2_turno || 6),
                turno3_total: porTurno['3_turno'].length,
                turno3_minimo: config.minimo_brigadistas_3_turno || 2,
                turno3_conforme: porTurno['3_turno'].length >= (config.minimo_brigadistas_3_turno || 2)
            },
            totais_equipamentos: {
                total: equipamentos.length,
                operacionais: eqOperacionais,
                vencendo_recarga: eqVencendoRecarga,
                recarga_vencida: eqRecargaVencida,
                inspecoes_pendentes: eqInspecaoPendente
            },
            membros,
            equipamentos,
            ultimo_simulado: ultSimulado[0] || null
        });

    } catch (err) {
        console.error('[BRIGADA Dashboard] Erro:', err);
        res.status(500).json({ error: 'Erro ao carregar dashboard da brigada: ' + err.message });
    }
});

// ============================================================================
// 2. CONFIGURAÇÃO & DIMENSIONAMENTO
// ============================================================================
router.get('/config', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(`SELECT * FROM sst_brigada_config LIMIT 1`);
        res.json(rows[0] || {});
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar configurações: ' + err.message });
    }
});

router.put('/config', async (req, res) => {
    try {
        const {
            planta_nome, grau_risco, populacao_fixa_total,
            populacao_1_turno, populacao_2_turno, populacao_3_turno,
            minimo_brigadistas_1_turno, minimo_brigadistas_2_turno, minimo_brigadistas_3_turno,
            contato_emergencia_bombeiros, contato_emergencia_sesmt,
            ponto_encontro_principal, ponto_encontro_secundario
        } = req.body;

        await mysqlPool.query(`
            UPDATE sst_brigada_config 
            SET planta_nome = ?, grau_risco = ?, populacao_fixa_total = ?,
                populacao_1_turno = ?, populacao_2_turno = ?, populacao_3_turno = ?,
                minimo_brigadistas_1_turno = ?, minimo_brigadistas_2_turno = ?, minimo_brigadistas_3_turno = ?,
                contato_emergencia_bombeiros = ?, contato_emergencia_sesmt = ?,
                ponto_encontro_principal = ?, ponto_encontro_secundario = ?
            WHERE id = 1
        `, [
            planta_nome, grau_risco, populacao_fixa_total,
            populacao_1_turno, populacao_2_turno, populacao_3_turno,
            minimo_brigadistas_1_turno, minimo_brigadistas_2_turno, minimo_brigadistas_3_turno,
            contato_emergencia_bombeiros, contato_emergencia_sesmt,
            ponto_encontro_principal, ponto_encontro_secundario
        ]);

        res.json({ success: true, message: 'Configurações de dimensionamento atualizadas com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar configurações: ' + err.message });
    }
});

// ============================================================================
// 3. GESTÃO DE MEMBROS DA BRIGADA
// ============================================================================
router.get('/membros', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(`
            SELECT m.*, u.NomeCompleto, u.Setor, u.Funcao, u.idUsuario AS Matricula, 
                   u.fotoUsuario, u.email, u.whatsapp, u.telefone,
                   (
                       SELECT t.nivel FROM sst_brigada_treinamentos t 
                       WHERE t.membro_id = m.id ORDER BY t.data_validade DESC LIMIT 1
                   ) as nivel_treinamento,
                   (
                       SELECT t.data_validade FROM sst_brigada_treinamentos t 
                       WHERE t.membro_id = m.id ORDER BY t.data_validade DESC LIMIT 1
                   ) as data_validade_treinamento,
                   (
                       SELECT t.certificado_url FROM sst_brigada_treinamentos t 
                       WHERE t.membro_id = m.id ORDER BY t.data_validade DESC LIMIT 1
                   ) as certificado_url
            FROM sst_brigada_membros m
            JOIN usuario u ON u.idUsuario = m.usuario_id
            WHERE m.status = 'ativo'
            ORDER BY 
                CASE m.papel 
                    WHEN 'coordenador_geral' THEN 1 
                    WHEN 'chefe_brigada' THEN 2 
                    WHEN 'lider_setor' THEN 3 
                    ELSE 4 
                END ASC,
                u.NomeCompleto ASC
        `);
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar membros da brigada: ' + err.message });
    }
});

router.post('/membros', async (req, res) => {
    try {
        const { usuario_id, papel, turno, setor_atuacao, data_admissao_brigada, observacoes } = req.body;
        if (!usuario_id || !papel || !turno) {
            return res.status(400).json({ error: 'Usuário, papel e turno são obrigatórios.' });
        }

        // Verifica se já existe ativo
        const [exist] = await mysqlPool.query(`
            SELECT id FROM sst_brigada_membros WHERE usuario_id = ? AND status = 'ativo'
        `, [usuario_id]);
        if (exist.length > 0) {
            return res.status(400).json({ error: 'Este colaborador já é um brigadista ativo no sistema.' });
        }

        const [result] = await mysqlPool.query(`
            INSERT INTO sst_brigada_membros (usuario_id, papel, turno, setor_atuacao, data_admissao_brigada, observacoes, status)
            VALUES (?, ?, ?, ?, ?, ?, 'ativo')
        `, [usuario_id, papel, turno, setor_atuacao || null, data_admissao_brigada || new Date(), observacoes || null]);

        res.json({ success: true, id: result.insertId, message: 'Brigadista incluído com sucesso na equipe!' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao cadastrar brigadista: ' + err.message });
    }
});

router.put('/membros/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { papel, turno, setor_atuacao, data_admissao_brigada, status, observacoes } = req.body;
        await mysqlPool.query(`
            UPDATE sst_brigada_membros 
            SET papel = ?, turno = ?, setor_atuacao = ?, data_admissao_brigada = ?, status = ?, observacoes = ?
            WHERE id = ?
        `, [papel, turno, setor_atuacao || null, data_admissao_brigada, status || 'ativo', observacoes || null, id]);
        res.json({ success: true, message: 'Dados do brigadista atualizados com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar brigadista: ' + err.message });
    }
});

router.delete('/membros/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await mysqlPool.query(`UPDATE sst_brigada_membros SET status = 'inativo' WHERE id = ?`, [id]);
        res.json({ success: true, message: 'Membro inativado da brigada.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao inativar membro: ' + err.message });
    }
});

// ============================================================================
// 4. TREINAMENTOS, CURSOS & CERTIFICADOS
// ============================================================================
router.get('/treinamentos', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(`
            SELECT t.*, m.papel, m.turno, u.NomeCompleto, u.Setor, u.fotoUsuario
            FROM sst_brigada_treinamentos t
            JOIN sst_brigada_membros m ON m.id = t.membro_id
            JOIN usuario u ON u.idUsuario = m.usuario_id
            ORDER BY t.data_validade ASC
        `);
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar treinamentos: ' + err.message });
    }
});

router.post('/treinamentos', uploadCertificado.single('certificado'), async (req, res) => {
    try {
        const { membro_id, nivel, entidade_formadora, instrutor_responsavel, carga_horaria_horas, data_conclusao, data_validade, observacoes } = req.body;

        if (!membro_id || !entidade_formadora || !data_conclusao || !data_validade) {
            return res.status(400).json({ error: 'Membro, entidade formadora, data de conclusão e data de validade são obrigatórios.' });
        }

        const certUrl = req.file ? `/uploads/brigada_certificados/${req.file.filename}` : null;

        const hoje = new Date();
        const dtVal = new Date(data_validade);
        let statusValidade = 'vigente';
        if (dtVal < hoje) statusValidade = 'vencido';
        else if (dtVal <= new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000)) statusValidade = 'proximo_vencimento';

        const [result] = await mysqlPool.query(`
            INSERT INTO sst_brigada_treinamentos 
            (membro_id, nivel, entidade_formadora, instrutor_responsavel, carga_horaria_horas, data_conclusao, data_validade, certificado_url, status_validade, observacoes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            membro_id, nivel || 'basico', entidade_formadora, instrutor_responsavel || null,
            carga_horaria_horas || 16, data_conclusao, data_validade, certUrl, statusValidade, observacoes || null
        ]);

        res.json({ success: true, id: result.insertId, message: 'Treinamento registrado com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao registrar treinamento: ' + err.message });
    }
});

router.put('/treinamentos/:id', uploadCertificado.single('certificado'), async (req, res) => {
    try {
        const { id } = req.params;
        const { nivel, entidade_formadora, instrutor_responsavel, carga_horaria_horas, data_conclusao, data_validade, observacoes } = req.body;
        const certUrl = req.file ? `/uploads/brigada_certificados/${req.file.filename}` : undefined;

        const hoje = new Date();
        const dtVal = new Date(data_validade);
        let statusValidade = 'vigente';
        if (dtVal < hoje) statusValidade = 'vencido';
        else if (dtVal <= new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000)) statusValidade = 'proximo_vencimento';

        if (certUrl) {
            await mysqlPool.query(`
                UPDATE sst_brigada_treinamentos 
                SET nivel = ?, entidade_formadora = ?, instrutor_responsavel = ?, carga_horaria_horas = ?,
                    data_conclusao = ?, data_validade = ?, status_validade = ?, certificado_url = ?, observacoes = ?
                WHERE id = ?
            `, [nivel, entidade_formadora, instrutor_responsavel || null, carga_horaria_horas || 16, data_conclusao, data_validade, statusValidade, certUrl, observacoes || null, id]);
        } else {
            await mysqlPool.query(`
                UPDATE sst_brigada_treinamentos 
                SET nivel = ?, entidade_formadora = ?, instrutor_responsavel = ?, carga_horaria_horas = ?,
                    data_conclusao = ?, data_validade = ?, status_validade = ?, observacoes = ?
                WHERE id = ?
            `, [nivel, entidade_formadora, instrutor_responsavel || null, carga_horaria_horas || 16, data_conclusao, data_validade, statusValidade, observacoes || null, id]);
        }

        res.json({ success: true, message: 'Treinamento e certificado atualizados com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar treinamento: ' + err.message });
    }
});

router.delete('/treinamentos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await mysqlPool.query(`DELETE FROM sst_brigada_treinamentos WHERE id = ?`, [id]);
        res.json({ success: true, message: 'Treinamento excluído com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao excluir treinamento: ' + err.message });
    }
});

// ============================================================================
// 5. EQUIPAMENTOS DE COMBATE (EXTINTORES, HIDRANTES, ALARMES)
// ============================================================================
router.get('/equipamentos', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(`
            SELECT e.*,
                   (
                       SELECT i.data_inspecao 
                       FROM sst_brigada_inspecoes i 
                       WHERE i.equipamento_id = e.id 
                       ORDER BY i.data_inspecao DESC LIMIT 1
                   ) as ultima_inspecao_data,
                   (
                       SELECT i.resultado_final 
                       FROM sst_brigada_inspecoes i 
                       WHERE i.equipamento_id = e.id 
                       ORDER BY i.data_inspecao DESC LIMIT 1
                   ) as ultima_inspecao_resultado,
                   (
                       SELECT u.NomeCompleto 
                       FROM sst_brigada_inspecoes i 
                       JOIN usuario u ON u.idUsuario = i.inspetor_usuario_id
                       WHERE i.equipamento_id = e.id 
                       ORDER BY i.data_inspecao DESC LIMIT 1
                   ) as ultimo_inspetor_nome
            FROM sst_brigada_equipamentos e
            ORDER BY e.codigo_identificador ASC
        `);
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar equipamentos: ' + err.message });
    }
});

router.post('/equipamentos', async (req, res) => {
    try {
        const {
            codigo_identificador, tipo, capacidade_carga, setor_localizacao,
            ponto_referencia, data_fabricacao, data_ultima_recarga,
            data_proxima_recarga, data_ultimo_teste_hidrostatico,
            data_proximo_teste_hidrostatico, observacoes
        } = req.body;

        if (!codigo_identificador || !tipo || !setor_localizacao) {
            return res.status(400).json({ error: 'Código, tipo e setor são obrigatórios.' });
        }

        const qrCodeHash = `BRIG-${codigo_identificador.toUpperCase().replace(/[^A-Z0-9_-]/g, '')}-MTSA`;

        const [result] = await mysqlPool.query(`
            INSERT INTO sst_brigada_equipamentos 
            (codigo_identificador, tipo, capacidade_carga, setor_localizacao, ponto_referencia,
             data_fabricacao, data_ultima_recarga, data_proxima_recarga,
             data_ultimo_teste_hidrostatico, data_proximo_teste_hidrostatico,
             qr_code_hash, status_operacional, observacoes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'operacional', ?)
        `, [
            codigo_identificador.toUpperCase(), tipo, capacidade_carga || 'Padrão', setor_localizacao, ponto_referencia || null,
            data_fabricacao || null, data_ultima_recarga || null, data_proxima_recarga || null,
            data_ultimo_teste_hidrostatico || null, data_proximo_teste_hidrostatico || null,
            qrCodeHash, observacoes || null
        ]);

        res.json({ success: true, id: result.insertId, qr_code_hash: qrCodeHash, message: 'Equipamento cadastrado com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao cadastrar equipamento: ' + err.message });
    }
});

router.put('/equipamentos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            codigo_identificador, tipo, capacidade_carga, setor_localizacao,
            ponto_referencia, data_fabricacao, data_ultima_recarga,
            data_proxima_recarga, data_ultimo_teste_hidrostatico,
            data_proximo_teste_hidrostatico, status_operacional, observacoes
        } = req.body;

        await mysqlPool.query(`
            UPDATE sst_brigada_equipamentos
            SET codigo_identificador = ?, tipo = ?, capacidade_carga = ?, setor_localizacao = ?,
                ponto_referencia = ?, data_fabricacao = ?, data_ultima_recarga = ?,
                data_proxima_recarga = ?, data_ultimo_teste_hidrostatico = ?,
                data_proximo_teste_hidrostatico = ?, status_operacional = ?, observacoes = ?
            WHERE id = ?
        `, [
            codigo_identificador.toUpperCase(), tipo, capacidade_carga || 'Padrão', setor_localizacao,
            ponto_referencia || null, data_fabricacao || null, data_ultima_recarga || null,
            data_proxima_recarga || null, data_ultimo_teste_hidrostatico || null,
            data_proximo_teste_hidrostatico || null, status_operacional || 'operacional', observacoes || null, id
        ]);

        res.json({ success: true, message: 'Equipamento atualizado com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar equipamento: ' + err.message });
    }
});

router.delete('/equipamentos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await mysqlPool.query(`DELETE FROM sst_brigada_equipamentos WHERE id = ?`, [id]);
        res.json({ success: true, message: 'Equipamento excluído com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao excluir equipamento: ' + err.message });
    }
});

router.get('/equipamentos/:id/historico', async (req, res) => {
    try {
        const { id } = req.params;
        const [inspecoes] = await mysqlPool.query(`
            SELECT i.*, u.NomeCompleto as inspetor_nome, u.fotoUsuario as inspetor_foto
            FROM sst_brigada_inspecoes i
            JOIN usuario u ON u.idUsuario = i.inspetor_usuario_id
            WHERE i.equipamento_id = ?
            ORDER BY i.data_inspecao DESC
        `, [id]);
        res.json(inspecoes || []);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao carregar histórico: ' + err.message });
    }
});

// Busca por QR Code ou Código Identificador para Inspeção Rápida
router.get('/equipamento-por-qr/:hash', async (req, res) => {
    try {
        const { hash } = req.params;
        const [rows] = await mysqlPool.query(`
            SELECT e.*,
                   (
                       SELECT i.data_inspecao FROM sst_brigada_inspecoes i 
                       WHERE i.equipamento_id = e.id ORDER BY i.data_inspecao DESC LIMIT 1
                   ) as ultima_inspecao_data,
                   (
                       SELECT i.resultado_final FROM sst_brigada_inspecoes i 
                       WHERE i.equipamento_id = e.id ORDER BY i.data_inspecao DESC LIMIT 1
                   ) as ultima_inspecao_resultado
            FROM sst_brigada_equipamentos e
            WHERE e.qr_code_hash = ? OR e.codigo_identificador = ?
            LIMIT 1
        `, [hash, hash.toUpperCase()]);

        if (!rows.length) {
            return res.status(404).json({ error: 'Equipamento não encontrado pelo código ou QR Code informado.' });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao consultar equipamento: ' + err.message });
    }
});

// ============================================================================
// 6. INSPEÇÕES E VISTORIAS MENSAIS (CHECKLIST DE CAMPO COM EVIDÊNCIA FOTOGRÁFICA)
// ============================================================================
router.post('/inspecoes', uploadInspecao.single('foto'), async (req, res) => {
    try {
        const {
            equipamento_id, lacre_intacto, manometro_pressao_conforme,
            desobstruido, sinalizacao_visivel, mangueira_bico_ok,
            carga_no_prazo, observacoes
        } = req.body;

        const inspetorId = req.user.idUsuario || req.user.id;

        if (!equipamento_id) {
            return res.status(400).json({ error: 'Equipamento não especificado.' });
        }

        const fotoEvidenciaUrl = req.file 
            ? `/uploads/brigada_inspecoes/${req.file.filename}` 
            : (req.body.foto_evidencia_url || null);

        // Helper para aceitar boolean tanto de JSON quanto de FormData ('true'/'1')
        const toBool = (val) => val === true || val === 'true' || val === 1 || val === '1';

        const isConforme = (
            toBool(lacre_intacto) &&
            toBool(manometro_pressao_conforme) &&
            toBool(desobstruido) &&
            toBool(sinalizacao_visivel) &&
            toBool(mangueira_bico_ok) &&
            toBool(carga_no_prazo)
        );

        const resultadoFinal = isConforme ? 'conforme' : 'nao_conforme';
        const osCorretiva = !isConforme ? 1 : 0;

        const [result] = await mysqlPool.query(`
            INSERT INTO sst_brigada_inspecoes 
            (equipamento_id, inspetor_usuario_id, lacre_intacto, manometro_pressao_conforme,
             desobstruido, sinalizacao_visivel, mangueira_bico_ok, carga_no_prazo,
             resultado_final, os_corretiva_gerada, foto_evidencia_url, observacoes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            equipamento_id, inspetorId,
            toBool(lacre_intacto) ? 1 : 0, toBool(manometro_pressao_conforme) ? 1 : 0,
            toBool(desobstruido) ? 1 : 0, toBool(sinalizacao_visivel) ? 1 : 0, 
            toBool(mangueira_bico_ok) ? 1 : 0, toBool(carga_no_prazo) ? 1 : 0,
            resultadoFinal, osCorretiva, fotoEvidenciaUrl, observacoes || null
        ]);

        // Se for não conforme, atualiza o status operacional do equipamento
        if (!isConforme) {
            await mysqlPool.query(`
                UPDATE sst_brigada_equipamentos 
                SET status_operacional = 'em_manutencao' 
                WHERE id = ?
            `, [equipamento_id]);
        } else {
            await mysqlPool.query(`
                UPDATE sst_brigada_equipamentos 
                SET status_operacional = 'operacional' 
                WHERE id = ?
            `, [equipamento_id]);
        }

        res.json({
            success: true,
            id: result.insertId,
            resultado_final: resultadoFinal,
            os_corretiva_gerada: osCorretiva,
            foto_evidencia_url: fotoEvidenciaUrl,
            message: isConforme 
                ? 'Inspeção registrada com sucesso! Equipamento 100% conforme.' 
                : 'Inspeção registrada com NÃO CONFORMIDADES. O equipamento foi marcado para manutenção e o SESMT foi notificado.'
        });

    } catch (err) {
        console.error('[BRIGADA Inspecao] Erro:', err);
        res.status(500).json({ error: 'Erro ao registrar inspeção: ' + err.message });
    }
});

router.delete('/inspecoes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await mysqlPool.query(`DELETE FROM sst_brigada_inspecoes WHERE id = ?`, [id]);
        res.json({ success: true, message: 'Registro de vistoria excluído com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao excluir vistoria: ' + err.message });
    }
});

router.put('/inspecoes/:id', uploadInspecao.single('foto'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            lacre_intacto, manometro_pressao_conforme, desobstruido,
            sinalizacao_visivel, mangueira_bico_ok, carga_no_prazo,
            observacoes
        } = req.body;

        const isTrue = (val) => val === true || val === 'true' || val === 1 || val === '1';
        const lacreOk = isTrue(lacre_intacto);
        const manoOk = isTrue(manometro_pressao_conforme);
        const desobsOk = isTrue(desobstruido);
        const sinalOk = isTrue(sinalizacao_visivel);
        const mangOk = isTrue(mangueira_bico_ok);
        const cargaOk = isTrue(carga_no_prazo);

        const isConforme = lacreOk && manoOk && desobsOk && sinalOk && mangOk && cargaOk;
        const resultadoFinal = isConforme ? 'conforme' : 'nao_conforme';
        const osCorretiva = isConforme ? 0 : 1;
        const fotoEvidenciaUrl = req.file ? `/uploads/brigada_inspecoes/${req.file.filename}` : undefined;

        if (fotoEvidenciaUrl) {
            await mysqlPool.query(`
                UPDATE sst_brigada_inspecoes
                SET lacre_intacto = ?, manometro_pressao_conforme = ?, desobstruido = ?,
                    sinalizacao_visivel = ?, mangueira_bico_ok = ?, carga_no_prazo = ?,
                    resultado_final = ?, os_corretiva_gerada = ?, observacoes = ?, foto_evidencia_url = ?
                WHERE id = ?
            `, [
                lacreOk ? 1 : 0, manoOk ? 1 : 0, desobsOk ? 1 : 0, sinalOk ? 1 : 0,
                mangOk ? 1 : 0, cargaOk ? 1 : 0, resultadoFinal, osCorretiva,
                observacoes || null, fotoEvidenciaUrl, id
            ]);
        } else {
            await mysqlPool.query(`
                UPDATE sst_brigada_inspecoes
                SET lacre_intacto = ?, manometro_pressao_conforme = ?, desobstruido = ?,
                    sinalizacao_visivel = ?, mangueira_bico_ok = ?, carga_no_prazo = ?,
                    resultado_final = ?, os_corretiva_gerada = ?, observacoes = ?
                WHERE id = ?
            `, [
                lacreOk ? 1 : 0, manoOk ? 1 : 0, desobsOk ? 1 : 0, sinalOk ? 1 : 0,
                mangOk ? 1 : 0, cargaOk ? 1 : 0, resultadoFinal, osCorretiva,
                observacoes || null, id
            ]);
        }

        res.json({
            success: true,
            resultado_final: resultadoFinal,
            foto_evidencia_url: fotoEvidenciaUrl,
            message: 'Vistoria atualizada com sucesso!'
        });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar vistoria: ' + err.message });
    }
});

// ============================================================================
// 7. SIMULADOS DE ABANDONO DE ÁREA & EVACUAÇÃO (NR-23)
// ============================================================================
router.get('/simulados', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(`
            SELECT s.*, u.NomeCompleto as responsavel_nome
            FROM sst_brigada_simulados s
            JOIN usuario u ON u.idUsuario = s.responsavel_usuario_id
            ORDER BY s.data_simulado DESC
        `);
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar simulados: ' + err.message });
    }
});

router.post('/simulados', uploadSimulado.fields([{ name: 'ata', maxCount: 1 }, { name: 'fotos', maxCount: 1 }]), async (req, res) => {
    try {
        const {
            titulo, data_simulado, horario_inicio, horario_termino,
            tempo_evacuacao_segundos, turno_exercitado, total_evacuados,
            total_brigadistas_atuantes, cenario_simulado, pontos_fortes,
            oportunidades_melhoria, avaliacao_eficacia
        } = req.body;

        const responsavelId = req.user.idUsuario || req.user.id;

        if (!titulo || !data_simulado || !tempo_evacuacao_segundos || !cenario_simulado) {
            return res.status(400).json({ error: 'Título, data, tempo de evacuação e cenário são obrigatórios.' });
        }

        const ataUrl = req.files?.['ata']?.[0] ? `/uploads/brigada_simulados/${req.files['ata'][0].filename}` : null;
        const fotosUrl = req.files?.['fotos']?.[0] ? `/uploads/brigada_simulados/${req.files['fotos'][0].filename}` : null;

        const [result] = await mysqlPool.query(`
            INSERT INTO sst_brigada_simulados 
            (titulo, data_simulado, horario_inicio, horario_termino, tempo_evacuacao_segundos,
             turno_exercitado, total_evacuados, total_brigadistas_atuantes, cenario_simulado,
             pontos_fortes, oportunidades_melhoria, avaliacao_eficacia, ata_anexo_url, fotos_anexo_url,
             responsavel_usuario_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            titulo, data_simulado, horario_inicio || '10:00:00', horario_termino || '10:15:00',
            Number(tempo_evacuacao_segundos), turno_exercitado || '1_turno',
            Number(total_evacuados) || 0, Number(total_brigadistas_atuantes) || 0,
            cenario_simulado, pontos_fortes || null, oportunidades_melhoria || null,
            avaliacao_eficacia || 'bom', ataUrl, fotosUrl, responsavelId
        ]);

        res.json({ success: true, id: result.insertId, message: 'Simulado de abandono registrado com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao registrar simulado: ' + err.message });
    }
});

router.put('/simulados/:id', uploadSimulado.fields([{ name: 'ata', maxCount: 1 }, { name: 'fotos', maxCount: 1 }]), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            titulo, data_simulado, horario_inicio, horario_termino,
            tempo_evacuacao_segundos, turno_exercitado, total_evacuados,
            total_brigadistas_atuantes, cenario_simulado, pontos_fortes,
            oportunidades_melhoria, avaliacao_eficacia
        } = req.body;

        const ataUrl = req.files?.['ata']?.[0] ? `/uploads/brigada_simulados/${req.files['ata'][0].filename}` : undefined;
        const fotosUrl = req.files?.['fotos']?.[0] ? `/uploads/brigada_simulados/${req.files['fotos'][0].filename}` : undefined;

        let query = `
            UPDATE sst_brigada_simulados
            SET titulo = ?, data_simulado = ?, horario_inicio = ?, horario_termino = ?,
                tempo_evacuacao_segundos = ?, turno_exercitado = ?, total_evacuados = ?,
                total_brigadistas_atuantes = ?, cenario_simulado = ?, pontos_fortes = ?,
                oportunidades_melhoria = ?, avaliacao_eficacia = ?
        `;
        const params = [
            titulo, data_simulado, horario_inicio || '10:00:00', horario_termino || '10:15:00',
            Number(tempo_evacuacao_segundos), turno_exercitado || '1_turno',
            Number(total_evacuados) || 0, Number(total_brigadistas_atuantes) || 0,
            cenario_simulado, pontos_fortes || null, oportunidades_melhoria || null,
            avaliacao_eficacia || 'bom'
        ];

        if (ataUrl) {
            query += `, ata_anexo_url = ?`;
            params.push(ataUrl);
        }
        if (fotosUrl) {
            query += `, fotos_anexo_url = ?`;
            params.push(fotosUrl);
        }

        query += ` WHERE id = ?`;
        params.push(id);

        await mysqlPool.query(query, params);
        res.json({ success: true, message: 'Simulado de abandono atualizado com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar simulado: ' + err.message });
    }
});

router.delete('/simulados/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await mysqlPool.query(`DELETE FROM sst_brigada_simulados WHERE id = ?`, [id]);
        res.json({ success: true, message: 'Simulado excluído com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao excluir simulado: ' + err.message });
    }
});

// ============================================================================
// 8. DISPARO DE ALERTA DE EMERGÊNCIA (WHATSAPP EM MASSA)
// ============================================================================
router.post('/alerta-emergencia', uploadEmergencia.single('midia'), async (req, res) => {
    try {
        const { local_incidente, descricao_ocorrencia, nivel_urgencia, turno_alvo } = req.body;
        const solicitanteNome = req.user?.NomeCompleto || req.user?.login || 'Colaborador MetalFisa';
        const solicitanteId = req.user?.idUsuario || null;

        if (!local_incidente || !descricao_ocorrencia) {
            return res.status(400).json({ error: 'Local do incidente e descrição são obrigatórios para acionamento.' });
        }

        const midiaUrl = req.file ? `/uploads/brigada_emergencias/${req.file.filename}` : null;
        const isVideo = req.file ? req.file.mimetype.startsWith('video/') : false;
        const tipoMidia = req.file ? (isVideo ? 'video' : 'foto') : 'nenhum';

        // Buscar brigadistas para o disparo: do turno selecionado + coordenadores gerais + chefes de brigada
        const [destinatarios] = await mysqlPool.query(`
            SELECT u.NomeCompleto, u.whatsapp, u.telefone, m.papel, m.turno
            FROM sst_brigada_membros m
            JOIN usuario u ON u.idUsuario = m.usuario_id
            WHERE m.status = 'ativo'
              AND (
                  m.turno = ? 
                  OR m.turno = 'geral' 
                  OR ? = 'todos'
                  OR m.papel IN ('coordenador_geral', 'chefe_brigada')
              )
              AND (u.whatsapp IS NOT NULL OR u.telefone IS NOT NULL)
        `, [turno_alvo || '1_turno', turno_alvo || '1_turno']);

        const telefones = destinatarios
            .map(d => d.whatsapp || d.telefone)
            .filter(Boolean);

        const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

        let midiaTexto = '';
        if (midiaUrl) {
            const host = req.get('host') || 'metalfisa.com.br';
            const protocol = req.protocol || 'http';
            const linkCompleto = `${protocol}://${host}${midiaUrl}`;
            midiaTexto = `\n📷 *Evidência (${tipoMidia === 'video' ? 'Vídeo Gravado' : 'Foto Tirada'}):* ${linkCompleto}\n`;
        }

        const mensagemTexto = 
            `🚨 *ALERTA DE EMERGÊNCIA - BRIGADA DE INCÊNDIO METALFISA* 🚨\n\n` +
            `📍 *Local do Incidente:* ${local_incidente}\n` +
            `⚠️ *Nível de Urgência:* ${(nivel_urgencia || 'GRAVE').toUpperCase()}\n` +
            `📋 *Descrição:* ${descricao_ocorrencia}\n` +
            midiaTexto +
            `🕒 *Data/Hora:* ${dataHora}\n` +
            `👤 *Acionado por:* ${solicitanteNome}\n\n` +
            `⚡ *AÇÃO IMEDIATA:* Todos os brigadistas em plantão devem se dirigir imediatamente ao ponto de encontro do setor ou aguardar instruções do Chefe de Brigada. Não obstrua as rotas de fuga!`;

        let totalEnviados = 0;
        let erroDisparo = null;

        if (telefones.length > 0) {
            try {
                await waSend(telefones, mensagemTexto, 'Alerta de Emergência - Brigada de Incêndio');
                totalEnviados = telefones.length;
            } catch (errWa) {
                console.error('[BRIGADA Alerta WhatsApp] Erro no envio:', errWa.message);
                erroDisparo = errWa.message;
            }
        }

        // Registrar no banco de dados
        try {
            await mysqlPool.query(`
                INSERT INTO sst_brigada_alertas_emergencia
                (solicitante_usuario_id, solicitante_nome, local_incidente, descricao_ocorrencia, nivel_urgencia, turno_alvo, midia_url, tipo_midia, telefones_notificados)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                solicitanteId, solicitanteNome, local_incidente, descricao_ocorrencia,
                nivel_urgencia || 'grave', turno_alvo || '1_turno', midiaUrl, tipoMidia, telefones.length
            ]);
        } catch (dbErr) {
            console.error('[BRIGADA Alerta Log] Erro ao gravar histórico no DB:', dbErr.message);
        }

        res.json({
            success: true,
            total_destinatarios: destinatarios.length,
            telefones_disparados: telefones.length,
            midia_url: midiaUrl,
            tipo_midia: tipoMidia,
            status_envio: totalEnviados > 0 ? 'enviado' : (erroDisparo ? 'falha_api' : 'sem_telefones'),
            erro: erroDisparo,
            message: `Alerta processado para ${telefones.length} brigadista(s) e gestores de emergência!`
        });

    } catch (err) {
        res.status(500).json({ error: 'Erro ao disparar alerta de emergência: ' + err.message });
    }
});

// Histórico de Alertas de Emergência
router.get('/alertas-emergencia', async (req, res) => {
    try {
        const [alertas] = await mysqlPool.query(`
            SELECT a.*, u.fotoUsuario as solicitante_foto
            FROM sst_brigada_alertas_emergencia a
            LEFT JOIN usuario u ON u.idUsuario = a.solicitante_usuario_id
            ORDER BY a.criado_em DESC
            LIMIT 50
        `);
        res.json(alertas || []);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao carregar alertas: ' + err.message });
    }
});

module.exports = router;
