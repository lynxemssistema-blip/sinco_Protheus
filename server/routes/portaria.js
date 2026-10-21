const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { createSafeFileFilter, SAFE_IMAGE_EXTENSIONS, IMAGE_UPLOAD_LIMITS } = require('../util/uploadSecurity');
const db = require('../services/mysqlService');
const { authenticateToken } = require('./auth');

// 1. Configurar diretório de upload para fotos da portaria
const uploadDir = path.join(__dirname, '..', 'uploads', 'portaria');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `foto-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: IMAGE_UPLOAD_LIMITS,
    fileFilter: createSafeFileFilter(SAFE_IMAGE_EXTENSIONS)
});

// Valores aceitos pelos ENUMs do banco (evita erro 500 ou valor vazio silencioso)
const TIPOS_ACESSO = ['VISITANTE', 'PRESTADOR', 'FORNECEDOR_CARGA', 'CLIENTE', 'COLABORADOR', 'OUTRO'];
const TIPOS_VEICULO = ['CARRETA', 'CAMINHAO', 'VUC', 'UTILITARIO', 'CARRO', 'MOTO', 'NENHUM'];
const STATUS_PORTEIRO = ['ATIVO', 'FERIAS', 'AFASTADO', 'INATIVO'];

// Converte '' / undefined / 'null' em null (campos vindos de form/multipart chegam como string)
const toNull = (v) => (v === undefined || v === null || v === '' || v === 'null' ? null : v);
const toIntOrNull = (v) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
};

// SINCO é multi-tenant: eventos em tempo real vão só para a sala da empresa (tenant_<IdEmpresa>),
// na qual o socket entra após validação do JWT no servidor (evento 'join_tenant' em index.js).
const emitTenant = (req, event, payload) => {
    const io = req.app.get('io');
    if (io && payload) io.to(`tenant_${req.tenantId ?? 'global'}`).emit(event, payload);
};

// Helper: Salvar imagem base64 (capturada via webcam do navegador)
function saveBase64Image(base64Data, prefix = 'cam') {
    if (!base64Data || !base64Data.includes('base64,')) {
        return null;
    }
    try {
        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) return null;
        
        const ext = matches[1].includes('png') ? '.png' : '.jpg';
        const buffer = Buffer.from(matches[2], 'base64');
        const filename = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
        const filePath = path.join(uploadDir, filename);
        
        fs.writeFileSync(filePath, buffer);
        return `/uploads/portaria/${filename}`;
    } catch (err) {
        console.error('Erro ao salvar imagem base64:', err.message);
        return null;
    }
}

// ==========================================
// 1. DADOS AUXILIARES (Para Autocomplete e Agilidade)
// ==========================================
router.get('/auxiliares', async (req, res) => {
    try {
        const [setoresRows] = await db.execute(`
            SELECT DISTINCT Setor 
            FROM usuario 
            WHERE Setor IS NOT NULL AND TRIM(Setor) != ''
            ORDER BY Setor ASC
        `);
        const setores = setoresRows.map(r => r.Setor);

        const [colabsRows] = await db.execute(`
            SELECT idUsuario, NomeCompleto, Setor 
            FROM usuario 
            WHERE (D_E_L_E_T_E != '*' OR D_E_L_E_T_E IS NULL)
            ORDER BY NomeCompleto ASC
        `);

        const [turnos] = await db.execute(`
            SELECT id, nome, hora_inicio, hora_fim, descricao, ativo 
            FROM portaria_turnos 
            WHERE ativo = 1 
            ORDER BY hora_inicio ASC
        `);

        const [porteiros] = await db.execute(`
            SELECT p.*, t.nome as nome_turno 
            FROM portaria_porteiros p
            LEFT JOIN portaria_turnos t ON p.turno_id = t.id
            WHERE p.status = 'ATIVO'
            ORDER BY p.nome ASC
        `);

        res.json({
            setores,
            colaboradores: colabsRows,
            turnos,
            porteiros
        });
    } catch (err) {
        console.error('Erro ao carregar dados auxiliares da portaria:', err);
        res.status(500).json({ error: 'Erro ao buscar dados auxiliares.' });
    }
});

// ==========================================
// 2. GESTÃO DE PORTEIROS
// ==========================================
router.get('/porteiros', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT p.*, t.nome as nome_turno, u.Login as login_usuario
            FROM portaria_porteiros p
            LEFT JOIN portaria_turnos t ON p.turno_id = t.id
            LEFT JOIN usuario u ON p.usuario_id = u.idUsuario
            ORDER BY p.status ASC, p.nome ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error('Erro ao listar porteiros:', err);
        res.status(500).json({ error: 'Erro ao listar porteiros.' });
    }
});

router.post('/porteiros', upload.single('foto'), async (req, res) => {
    try {
        const {
            usuario_id,
            nome,
            apelido,
            cpf,
            rg,
            telefone,
            telefone_emergencia,
            contato_emergencia_nome,
            turno_id,
            status = 'ATIVO',
            observacoes,
            foto_base64
        } = req.body;

        if (!nome || nome.trim() === '') {
            return res.status(400).json({ error: 'O nome do porteiro é obrigatório.' });
        }
        if (!STATUS_PORTEIRO.includes(status)) {
            return res.status(400).json({ error: `Status inválido. Use: ${STATUS_PORTEIRO.join(', ')}.` });
        }

        let fotoUrl = null;
        if (req.file) {
            fotoUrl = `/uploads/portaria/${req.file.filename}`;
        } else if (foto_base64) {
            fotoUrl = saveBase64Image(foto_base64, 'porteiro');
        }

        const [result] = await db.execute(`
            INSERT INTO portaria_porteiros (
                usuario_id, nome, apelido, cpf, rg, telefone,
                telefone_emergencia, contato_emergencia_nome,
                foto_url, turno_id, status, observacoes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            toIntOrNull(usuario_id),
            nome.trim(),
            toNull(apelido?.trim()),
            toNull(cpf),
            toNull(rg),
            toNull(telefone),
            toNull(telefone_emergencia),
            toNull(contato_emergencia_nome),
            fotoUrl,
            toIntOrNull(turno_id),
            status,
            toNull(observacoes)
        ]);

        res.status(201).json({ id: result.insertId, message: 'Porteiro cadastrado com sucesso!', foto_url: fotoUrl });
    } catch (err) {
        console.error('Erro ao cadastrar porteiro:', err);
        res.status(500).json({ error: 'Erro ao cadastrar porteiro.' });
    }
});

router.put('/porteiros/:id', upload.single('foto'), async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body || {};

        const [existentes] = await db.execute('SELECT * FROM portaria_porteiros WHERE id = ?', [id]);
        if (existentes.length === 0) {
            return res.status(404).json({ error: 'Porteiro não encontrado.' });
        }
        const atual = existentes[0];

        // Atualização parcial: campo não enviado mantém o valor atual (antes, virava NULL/undefined)
        const pick = (campo) => (Object.prototype.hasOwnProperty.call(body, campo) ? body[campo] : atual[campo]);

        const nome = pick('nome');
        if (!nome || String(nome).trim() === '') {
            return res.status(400).json({ error: 'O nome do porteiro é obrigatório.' });
        }
        const status = pick('status') || 'ATIVO';
        if (!STATUS_PORTEIRO.includes(status)) {
            return res.status(400).json({ error: `Status inválido. Use: ${STATUS_PORTEIRO.join(', ')}.` });
        }

        let fotoUrl = atual.foto_url;
        if (req.file) {
            fotoUrl = `/uploads/portaria/${req.file.filename}`;
        } else if (body.foto_base64) {
            fotoUrl = saveBase64Image(body.foto_base64, 'porteiro') || atual.foto_url;
        }

        await db.execute(`
            UPDATE portaria_porteiros SET
                usuario_id = ?, nome = ?, apelido = ?, cpf = ?, rg = ?,
                telefone = ?, telefone_emergencia = ?, contato_emergencia_nome = ?,
                foto_url = ?, turno_id = ?, status = ?, observacoes = ?
            WHERE id = ?
        `, [
            toIntOrNull(pick('usuario_id')),
            String(nome).trim(),
            toNull(pick('apelido')),
            toNull(pick('cpf')),
            toNull(pick('rg')),
            toNull(pick('telefone')),
            toNull(pick('telefone_emergencia')),
            toNull(pick('contato_emergencia_nome')),
            fotoUrl,
            toIntOrNull(pick('turno_id')),
            status,
            toNull(pick('observacoes')),
            id
        ]);

        res.json({ message: 'Porteiro atualizado com sucesso!', foto_url: fotoUrl });
    } catch (err) {
        console.error('Erro ao atualizar porteiro:', err);
        res.status(500).json({ error: 'Erro ao atualizar porteiro.' });
    }
});

// ==========================================
// 3. GESTÃO DE TURNOS
// ==========================================
router.get('/turnos', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM portaria_turnos ORDER BY hora_inicio ASC');
        res.json(rows);
    } catch (err) {
        console.error('Erro ao listar turnos:', err);
        res.status(500).json({ error: 'Erro ao listar turnos.' });
    }
});

router.post('/turnos', async (req, res) => {
    try {
        const { nome, hora_inicio, hora_fim, descricao, ativo = 1 } = req.body;
        if (!nome || !hora_inicio || !hora_fim) {
            return res.status(400).json({ error: 'Nome e horários são obrigatórios.' });
        }
        const [result] = await db.execute(`
            INSERT INTO portaria_turnos (nome, hora_inicio, hora_fim, descricao, ativo)
            VALUES (?, ?, ?, ?, ?)
        `, [nome, hora_inicio, hora_fim, descricao || null, ativo ? 1 : 0]);
        res.status(201).json({ id: result.insertId, message: 'Turno salvo com sucesso!' });
    } catch (err) {
        console.error('Erro ao salvar turno:', err);
        res.status(500).json({ error: 'Erro ao salvar turno.' });
    }
});

router.put('/turnos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, hora_inicio, hora_fim, descricao, ativo } = req.body;
        if (!nome || !hora_inicio || !hora_fim) {
            return res.status(400).json({ error: 'Nome e horários são obrigatórios.' });
        }
        await db.execute(`
            UPDATE portaria_turnos SET
                nome = ?, hora_inicio = ?, hora_fim = ?, descricao = ?, ativo = ?
            WHERE id = ?
        `, [nome, hora_inicio, hora_fim, descricao || null, ativo !== undefined ? (ativo ? 1 : 0) : 1, id]);
        res.json({ message: 'Turno atualizado com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar turno:', err);
        res.status(500).json({ error: 'Erro ao atualizar turno.' });
    }
});

router.delete('/turnos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [porteirosVinculados] = await db.execute('SELECT COUNT(*) as count FROM portaria_porteiros WHERE turno_id = ?', [id]);
        if (porteirosVinculados[0].count > 0) {
            await db.execute('UPDATE portaria_turnos SET ativo = 0 WHERE id = ?', [id]);
            return res.json({ message: 'Turno desativado (há porteiros vinculados).' });
        }
        await db.execute('DELETE FROM portaria_turnos WHERE id = ?', [id]);
        res.json({ message: 'Turno excluído com sucesso!' });
    } catch (err) {
        console.error('Erro ao excluir turno:', err);
        res.status(500).json({ error: 'Erro ao excluir turno.' });
    }
});

// ==========================================
// 4. CHECK-IN (Entrada na Lynx EMS)
// ==========================================
router.post('/acessos/check-in', upload.fields([
    { name: 'foto_pessoa', maxCount: 1 },
    { name: 'foto_veiculo', maxCount: 1 }
]), async (req, res) => {
    try {
        const {
            tipo = 'VISITANTE',
            nome_pessoa,
            documento,
            telefone,
            empresa_origem,
            setor_destino,
            responsavel_interno,
            tipo_veiculo = 'NENHUM',
            placa_veiculo,
            modelo_veiculo,
            cor_veiculo,
            numero_cracha,
            numero_nf,
            motivo_visita,
            porteiro_entrada_id,
            observacoes,
            foto_pessoa_base64,
            foto_veiculo_base64
        } = req.body;

        if (!nome_pessoa || nome_pessoa.trim() === '') {
            return res.status(400).json({ error: 'O nome da pessoa é obrigatório para entrada.' });
        }
        if (!TIPOS_ACESSO.includes(tipo)) {
            return res.status(400).json({ error: `Tipo de acesso inválido. Use: ${TIPOS_ACESSO.join(', ')}.` });
        }
        if (!TIPOS_VEICULO.includes(tipo_veiculo)) {
            return res.status(400).json({ error: `Tipo de veículo inválido. Use: ${TIPOS_VEICULO.join(', ')}.` });
        }
        if (tipo_veiculo !== 'NENHUM' && (!placa_veiculo || !String(placa_veiculo).trim())) {
            return res.status(400).json({ error: 'Informe a placa do veículo.' });
        }

        // Salvar fotos se vieram via arquivo ou webcam base64
        let fotoPessoaUrl = null;
        if (req.files && req.files['foto_pessoa'] && req.files['foto_pessoa'][0]) {
            fotoPessoaUrl = `/uploads/portaria/${req.files['foto_pessoa'][0].filename}`;
        } else if (foto_pessoa_base64) {
            fotoPessoaUrl = saveBase64Image(foto_pessoa_base64, 'visitante');
        }

        let fotoVeiculoUrl = null;
        if (req.files && req.files['foto_veiculo'] && req.files['foto_veiculo'][0]) {
            fotoVeiculoUrl = `/uploads/portaria/${req.files['foto_veiculo'][0].filename}`;
        } else if (foto_veiculo_base64) {
            fotoVeiculoUrl = saveBase64Image(foto_veiculo_base64, 'veiculo');
        }

        const placaFormatada = placa_veiculo ? placa_veiculo.toUpperCase().replace(/[^A-Z0-9]/g, '') : null;

        const [result] = await db.execute(`
            INSERT INTO portaria_acessos (
                tipo, nome_pessoa, documento, telefone, empresa_origem,
                setor_destino, responsavel_interno, tipo_veiculo, placa_veiculo,
                modelo_veiculo, cor_veiculo, numero_cracha, numero_nf, motivo_visita,
                foto_pessoa_url, foto_veiculo_url, porteiro_entrada_id,
                data_entrada, status, observacoes
            ) VALUES (
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?,
                NOW(), 'NO_PATIO', ?
            )
        `, [
            tipo,
            nome_pessoa.trim(),
            toNull(documento),
            toNull(telefone),
            toNull(empresa_origem),
            toNull(setor_destino),
            toNull(responsavel_interno),
            tipo_veiculo,
            tipo_veiculo === 'NENHUM' ? null : placaFormatada,
            toNull(modelo_veiculo),
            toNull(cor_veiculo),
            toNull(numero_cracha),
            toNull(numero_nf),
            toNull(motivo_visita),
            fotoPessoaUrl,
            fotoVeiculoUrl,
            toIntOrNull(porteiro_entrada_id),
            toNull(observacoes)
        ]);

        const novoAcessoId = result.insertId;

        // Buscar registro completo para emitir via Socket.IO
        const [acessoRecente] = await db.execute(`
            SELECT a.*, p.nome as nome_porteiro_entrada
            FROM portaria_acessos a
            LEFT JOIN portaria_porteiros p ON a.porteiro_entrada_id = p.id
            WHERE a.id = ?
        `, [novoAcessoId]);

        emitTenant(req, 'portaria:novo_acesso', acessoRecente[0]);

        res.status(201).json({
            message: 'Entrada registrada com sucesso!',
            acesso: acessoRecente[0]
        });
    } catch (err) {
        console.error('Erro no check-in de portaria:', err);
        res.status(500).json({ error: 'Erro ao registrar entrada.' });
    }
});

// ==========================================
// 5. CHECK-OUT (Saída da Lynx EMS)
// ==========================================
router.post('/acessos/check-out/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { porteiro_saida_id } = req.body || {};
        const obsSaida = toNull(req.body?.observacoes_saida);

        // UPDATE atômico: só finaliza se ainda estiver NO_PATIO.
        // Antes era SELECT + UPDATE separados: dois tablets clicando juntos davam saída dupla.
        const [upd] = await db.execute(`
            UPDATE portaria_acessos SET
                data_saida = NOW(),
                tempo_permanencia_min = TIMESTAMPDIFF(MINUTE, data_entrada, NOW()),
                status = 'FINALIZADO',
                porteiro_saida_id = ?,
                observacoes = CASE
                    WHEN ? IS NOT NULL THEN CONCAT(COALESCE(observacoes, ''), ' | Saída: ', ?)
                    ELSE observacoes
                END
            WHERE id = ? AND status = 'NO_PATIO'
        `, [toIntOrNull(porteiro_saida_id), obsSaida, obsSaida, id]);

        if (upd.affectedRows === 0) {
            const [existe] = await db.execute('SELECT status FROM portaria_acessos WHERE id = ?', [id]);
            if (existe.length === 0) {
                return res.status(404).json({ error: 'Registro de acesso não encontrado.' });
            }
            return res.status(409).json({ error: 'Este acesso já foi finalizado anteriormente.' });
        }

        const [acessoAtualizado] = await db.execute(`
            SELECT a.*, 
                   pe.nome as nome_porteiro_entrada,
                   ps.nome as nome_porteiro_saida
            FROM portaria_acessos a
            LEFT JOIN portaria_porteiros pe ON a.porteiro_entrada_id = pe.id
            LEFT JOIN portaria_porteiros ps ON a.porteiro_saida_id = ps.id
            WHERE a.id = ?
        `, [id]);

        emitTenant(req, 'portaria:saida_acesso', acessoAtualizado[0]);

        res.json({
            message: 'Saída registrada com sucesso!',
            acesso: acessoAtualizado[0]
        });
    } catch (err) {
        console.error('Erro no check-out de portaria:', err);
        res.status(500).json({ error: 'Erro ao registrar saída.' });
    }
});

// ==========================================
// 6. ACESSOS ATIVOS (Quem está na Lynx EMS agora)
// ==========================================
router.get('/acessos/ativos', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT 
                a.*,
                TIMESTAMPDIFF(MINUTE, a.data_entrada, NOW()) as permanencia_atual_min,
                pe.nome as nome_porteiro_entrada,
                pe.foto_url as foto_porteiro_entrada
            FROM portaria_acessos a
            LEFT JOIN portaria_porteiros pe ON a.porteiro_entrada_id = pe.id
            WHERE a.status = 'NO_PATIO'
            ORDER BY a.data_entrada ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar acessos ativos:', err);
        res.status(500).json({ error: 'Erro ao buscar acessos ativos.' });
    }
});

// ==========================================
// 7. HISTÓRICO & RELATÓRIOS
// ==========================================
router.get('/acessos/historico', async (req, res) => {
    try {
        const { dataInicio, dataFim, tipo, placa, busca, status, limit = 100 } = req.query;

        let whereClauses = ['1=1'];
        let params = [];

        if (status && status !== 'TODOS') {
            whereClauses.push('a.status = ?');
            params.push(status);
        }

        if (tipo && tipo !== 'TODOS') {
            whereClauses.push('a.tipo = ?');
            params.push(tipo);
        }

        if (placa && placa.trim() !== '') {
            whereClauses.push('a.placa_veiculo LIKE ?');
            params.push(`%${placa.trim().toUpperCase()}%`);
        }

        // Comparação direta na coluna (sem DATE()) para o banco usar o índice idx_data_entrada
        if (dataInicio) {
            whereClauses.push('a.data_entrada >= ?');
            params.push(dataInicio);
        }

        if (dataFim) {
            whereClauses.push('a.data_entrada < DATE_ADD(?, INTERVAL 1 DAY)');
            params.push(dataFim);
        }

        if (busca && busca.trim() !== '') {
            const termo = `%${busca.trim()}%`;
            whereClauses.push(`(
                a.nome_pessoa LIKE ? OR
                a.documento LIKE ? OR
                a.empresa_origem LIKE ? OR
                a.placa_veiculo LIKE ? OR
                a.numero_cracha LIKE ? OR
                a.numero_nf LIKE ?
            )`);
            params.push(termo, termo, termo, termo, termo, termo);
        }

        const sql = `
            SELECT 
                a.*,
                pe.nome as nome_porteiro_entrada,
                ps.nome as nome_porteiro_saida
            FROM portaria_acessos a
            LEFT JOIN portaria_porteiros pe ON a.porteiro_entrada_id = pe.id
            LEFT JOIN portaria_porteiros ps ON a.porteiro_saida_id = ps.id
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY a.data_entrada DESC
            LIMIT ?
        `;
        params.push(parseInt(limit, 10) || 100);

        const [rows] = await db.execute(sql, params);
        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar histórico de acessos:', err);
        res.status(500).json({ error: 'Erro ao buscar histórico.' });
    }
});

// ==========================================
// 8. DASHBOARD GERENCIAL & ALERTAS
// ==========================================
router.get('/dashboard', async (req, res) => {
    try {
        // 1. Contagens do pátio
        const [patioRows] = await db.execute(`
            SELECT 
                COUNT(*) as total_no_patio,
                SUM(CASE WHEN tipo_veiculo != 'NENHUM' THEN 1 ELSE 0 END) as total_veiculos,
                SUM(CASE WHEN tipo_veiculo IN ('CARRETA', 'CAMINHAO', 'VUC') THEN 1 ELSE 0 END) as total_cargas,
                SUM(CASE WHEN TIMESTAMPDIFF(MINUTE, data_entrada, NOW()) > 240 THEN 1 ELSE 0 END) as total_retidos_criticos,
                SUM(CASE WHEN DATE(data_entrada) < CURDATE() THEN 1 ELSE 0 END) as total_pernoitaram
            FROM portaria_acessos
            WHERE status = 'NO_PATIO'
        `);

        // 2. Movimentação de hoje
        const [hojeRows] = await db.execute(`
            SELECT 
                COUNT(*) as entradas_hoje,
                SUM(CASE WHEN status = 'FINALIZADO' THEN 1 ELSE 0 END) as saidas_hoje,
                ROUND(AVG(tempo_permanencia_min), 0) as tempo_medio_minutos_hoje
            FROM portaria_acessos
            WHERE data_entrada >= CURDATE() AND data_entrada < CURDATE() + INTERVAL 1 DAY
        `);

        // 3. Lista de veículos retidos críticos (> 4 horas ou pernoite)
        const [criticosRows] = await db.execute(`
            SELECT 
                a.*,
                TIMESTAMPDIFF(MINUTE, a.data_entrada, NOW()) as permanencia_min,
                pe.nome as nome_porteiro_entrada
            FROM portaria_acessos a
            LEFT JOIN portaria_porteiros pe ON a.porteiro_entrada_id = pe.id
            WHERE a.status = 'NO_PATIO' 
              AND (TIMESTAMPDIFF(MINUTE, a.data_entrada, NOW()) > 240 OR DATE(a.data_entrada) < CURDATE())
            ORDER BY a.data_entrada ASC
        `);

        // 4. Porteiros ativos e plantão sugerido
        const [porteirosAtivos] = await db.execute(`
            SELECT p.*, t.nome as nome_turno, t.hora_inicio, t.hora_fim
            FROM portaria_porteiros p
            LEFT JOIN portaria_turnos t ON p.turno_id = t.id
            WHERE p.status = 'ATIVO'
            ORDER BY p.nome ASC
        `);

        res.json({
            kpis: {
                total_no_patio: patioRows[0].total_no_patio || 0,
                total_veiculos: patioRows[0].total_veiculos || 0,
                total_cargas: patioRows[0].total_cargas || 0,
                total_retidos_criticos: patioRows[0].total_retidos_criticos || 0,
                total_pernoitaram: patioRows[0].total_pernoitaram || 0,
                entradas_hoje: hojeRows[0].entradas_hoje || 0,
                saidas_hoje: hojeRows[0].saidas_hoje || 0,
                tempo_medio_minutos_hoje: hojeRows[0].tempo_medio_minutos_hoje || 0
            },
            veiculosCriticos: criticosRows,
            porteirosAtivos
        });
    } catch (err) {
        console.error('Erro no dashboard da portaria:', err);
        res.status(500).json({ error: 'Erro ao gerar dashboard.' });
    }
});

// ==========================================
// 9. LIVRO DE OCORRÊNCIAS & PASSAGEM DE TURNO
// ==========================================
router.get('/ocorrencias', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT 
                o.*,
                ps.nome as nome_porteiro_saida,
                ps.foto_url as foto_porteiro_saida,
                pe.nome as nome_porteiro_entrada,
                pe.foto_url as foto_porteiro_entrada,
                t.nome as nome_turno
            FROM portaria_ocorrencias o
            LEFT JOIN portaria_porteiros ps ON o.porteiro_saida_id = ps.id
            LEFT JOIN portaria_porteiros pe ON o.porteiro_entrada_id = pe.id
            LEFT JOIN portaria_turnos t ON o.turno_id = t.id
            ORDER BY o.data_registro DESC
            LIMIT 50
        `);
        res.json(rows);
    } catch (err) {
        console.error('Erro ao listar ocorrências da portaria:', err);
        res.status(500).json({ error: 'Erro ao listar ocorrências.' });
    }
});

router.post('/ocorrencias/passagem-turno', async (req, res) => {
    try {
        const {
            porteiro_saida_id,
            porteiro_entrada_id,
            turno_id,
            descricao_ocorrencias
        } = req.body;

        if (!descricao_ocorrencias || descricao_ocorrencias.trim() === '') {
            return res.status(400).json({ error: 'A descrição da passagem de turno/ocorrências é obrigatória.' });
        }
        const saidaId = toIntOrNull(porteiro_saida_id);
        const entradaId = toIntOrNull(porteiro_entrada_id);
        if (!saidaId || !entradaId) {
            return res.status(400).json({ error: 'Informe o porteiro que entrega e o porteiro que assume o turno.' });
        }
        if (saidaId === entradaId) {
            return res.status(400).json({ error: 'O porteiro que entrega e o que assume o turno devem ser pessoas diferentes.' });
        }

        // Tirar snapshot dos veículos atualmente no pátio
        const [veiculosPatio] = await db.execute(`
            SELECT id, tipo, nome_pessoa, placa_veiculo, tipo_veiculo, numero_cracha, data_entrada,
                   TIMESTAMPDIFF(MINUTE, data_entrada, NOW()) as minutos_permanencia
            FROM portaria_acessos
            WHERE status = 'NO_PATIO'
        `);

        const totalVeiculos = veiculosPatio.filter(v => v.tipo_veiculo !== 'NENHUM').length;
        const totalPessoas = veiculosPatio.length;

        const [result] = await db.execute(`
            INSERT INTO portaria_ocorrencias (
                porteiro_saida_id, porteiro_entrada_id, turno_id,
                data_registro, total_veiculos_patio, total_pessoas_patio,
                descricao_ocorrencias, veiculos_pendentes_json
            ) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?)
        `, [
            saidaId,
            entradaId,
            toIntOrNull(turno_id),
            totalVeiculos,
            totalPessoas,
            descricao_ocorrencias.trim(),
            JSON.stringify(veiculosPatio)
        ]);

        res.status(201).json({
            id: result.insertId,
            message: 'Passagem de turno registrada com sucesso no Livro de Portaria!',
            veiculosPendentes: veiculosPatio,
            totalVeiculos,
            totalPessoas
        });
    } catch (err) {
        console.error('Erro ao registrar passagem de turno:', err);
        res.status(500).json({ error: 'Erro ao registrar passagem de turno.' });
    }
});

module.exports = router;
