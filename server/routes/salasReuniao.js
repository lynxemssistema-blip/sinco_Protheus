const express = require('express');
const router = express.Router();
const db = require('../services/mysqlService');
const { tenantMiddleware } = require('../middlewares/tenantMiddleware');
const mailService = require('../services/mailService');

// Middleware de isolamento multi-tenant
router.use(tenantMiddleware);

// Helper para obter o tenant ID garantido
const getTenantId = (req) => req.tenantId || req.user?.IdEmpresa || 1;

// Helper para gerar e-mail HTML executivo de convocação de reunião
function gerarHtmlConvocacao({ titulo, pauta, salaNome, localizacao, dataFormatada, horaInicio, horaFim, organizadorNome, organizadorEmail, participantesNomes, recursos }) {
    return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F1F5F9; margin: 0; padding: 24px; color: #1E293B; }
            .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #CBD5E1; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); }
            .header { background: linear-gradient(135deg, #1E3A5F 0%, #0F172A 100%); padding: 32px 28px; text-align: left; color: #FFFFFF; }
            .header-badge { display: inline-block; background: rgba(251, 191, 36, 0.15); border: 1px solid rgba(251, 191, 36, 0.3); color: #F59E0B; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 4px 10px; rounded-full; border-radius: 9999px; margin-bottom: 12px; }
            .header-title { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.3; }
            .header-sub { margin: 8px 0 0 0; font-size: 13px; color: #94A3B8; }
            .content { padding: 28px; }
            .info-grid { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
            .info-row { display: flex; margin-bottom: 12px; font-size: 14px; }
            .info-row:last-child { margin-bottom: 0; }
            .info-label { width: 130px; font-weight: 600; color: #64748B; font-size: 13px; }
            .info-value { flex: 1; font-weight: 700; color: #0F172A; }
            .pauta-box { background: #FFFBEB; border-left: 4px solid #F59E0B; padding: 14px 18px; border-radius: 6px; margin-bottom: 24px; font-size: 13.5px; color: #92400E; line-height: 1.5; }
            .attendees-box { border-top: 1px solid #E2E8F0; padding-top: 18px; margin-bottom: 24px; }
            .attendees-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748B; margin-bottom: 8px; }
            .attendees-list { font-size: 13px; color: #334155; line-height: 1.6; }
            .footer { background: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 20px 28px; text-align: center; font-size: 12px; color: #94A3B8; }
            .btn-cta { display: inline-block; background: #1E3A5F; color: #FFFFFF !important; text-decoration: none; font-weight: 700; font-size: 13px; padding: 12px 24px; border-radius: 10px; margin-top: 8px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <span class="header-badge">Convocação de Reunião</span>
                <h1 class="header-title">${titulo}</h1>
                <p class="header-sub">Você foi convocado(a) para participar desta reunião corporativa.</p>
            </div>
            <div class="content">
                <div class="info-grid">
                    <div class="info-row">
                        <span class="info-label">🏢 Sala:</span>
                        <span class="info-value">${salaNome} (${localizacao || 'Planta Principal'})</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">📅 Data:</span>
                        <span class="info-value">${dataFormatada}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">⏰ Horário:</span>
                        <span class="info-value">${horaInicio} às ${horaFim}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">👤 Organizador:</span>
                        <span class="info-value">${organizadorNome} (${organizadorEmail})</span>
                    </div>
                    ${recursos ? `
                    <div class="info-row">
                        <span class="info-label">⚙️ Recursos:</span>
                        <span class="info-value">${recursos}</span>
                    </div>
                    ` : ''}
                </div>

                ${pauta ? `
                <div class="pauta-box">
                    <strong>Pauta / Objetivo:</strong><br />
                    ${pauta.replace(/\n/g, '<br/>')}
                </div>
                ` : ''}

                ${participantesNomes ? `
                <div class="attendees-box">
                    <div class="attendees-title">Participantes Convocados:</div>
                    <div class="attendees-list">${participantesNomes}</div>
                </div>
                ` : ''}

                <div style="text-align: center; margin-top: 24px;">
                    <p style="font-size: 13px; color: #64748B; margin-bottom: 12px;">Por favor, chegue com 5 minutos de antecedência.</p>
                    <a href="https://lynxems.com.br/salas" class="btn-cta">Abrir Central de Salas no Sistema</a>
                </div>
            </div>
            <div class="footer">
                <p style="margin: 0;">SINCO Protheus / Suíte Corporativa • Gestão Inteligente de Espaços</p>
                <p style="margin: 4px 0 0 0;">Este é um e-mail automático. Não responda diretamente a esta mensagem.</p>
            </div>
        </div>
    </body>
    </html>
    `;
}

// ── 1. GESTÃO DE SALAS (MULTI-TENANT) ─────────────────────────────

// GET /api/salas-reuniao E /api/salas-reuniao/salas
// Lista salas do tenant calculando em tempo real: status, minutos restantes, reunião atual e próxima reunião
router.get(['/', '/salas'], async (req, res) => {
    try {
        const tenantId = getTenantId(req);

        // 1. Buscar todas as salas ativas do tenant
        const [salas] = await db.query(
            `SELECT s.*, 
                    COALESCE(u.NomeCompleto, 'Não atribuído') AS aprovador_nome
             FROM salas_reuniao s
             LEFT JOIN usuario u ON u.idUsuario = s.aprovador_id
             WHERE (s.IdEmpresa = ? OR (s.IdEmpresa IS NULL AND ? = 1)) 
               AND s.ativo = 1 
             ORDER BY s.nome ASC`,
            [tenantId, tenantId]
        );

        // 2. Buscar reuniões de hoje para computar status atual (Livre/Ocupada/Em Breve)
        const [reservasHoje] = await db.query(
            `SELECT r.id, r.codigo, r.sala_id, r.titulo, r.pauta, r.hora_inicio, r.hora_fim, 
                    r.data_hora_inicio, r.data_hora_fim, r.status, r.liberada_antecipadamente,
                    u.NomeCompleto AS organizador_nome, u.email AS organizador_email
             FROM reservas_salas r
             INNER JOIN usuario u ON u.idUsuario = r.organizador_id
             WHERE (r.IdEmpresa = ? OR (r.IdEmpresa IS NULL AND ? = 1))
               AND r.data_reserva = CURDATE()
               AND r.status IN ('confirmada', 'em_andamento')
               AND r.liberada_antecipadamente = 0
             ORDER BY r.data_hora_inicio ASC`,
            [tenantId, tenantId]
        );

        const agora = new Date();
        const agoraTime = agora.getTime();

        const salasComStatus = salas.map(sala => {
            let recursos = [];
            try {
                recursos = typeof sala.recursos_json === 'string' ? JSON.parse(sala.recursos_json) : (sala.recursos_json || []);
            } catch (e) {
                recursos = [];
            }

            const reservasDaSala = reservasHoje.filter(r => r.sala_id === sala.id);

            // Reunião em andamento agora
            const reuniaoAtual = reservasDaSala.find(r => {
                const ini = new Date(r.data_hora_inicio).getTime();
                const fim = new Date(r.data_hora_fim).getTime();
                return agoraTime >= ini && agoraTime < fim;
            });

            // Reunião iniciando nos próximos 15 minutos
            const reuniaoEmBreve = !reuniaoAtual && reservasDaSala.find(r => {
                const ini = new Date(r.data_hora_inicio).getTime();
                const diffMinutos = (ini - agoraTime) / 60000;
                return diffMinutos > 0 && diffMinutos <= 15;
            });

            // Próxima reunião do dia
            const proximaReuniao = reservasDaSala.find(r => {
                const ini = new Date(r.data_hora_inicio).getTime();
                return ini > agoraTime;
            });

            let status = 'LIVRE';
            let segundosRestantes = 0;
            let minutosRestantes = 0;

            if (reuniaoAtual) {
                status = 'OCUPADA';
                const fimMs = new Date(reuniaoAtual.data_hora_fim).getTime();
                segundosRestantes = Math.max(0, Math.floor((fimMs - agoraTime) / 1000));
                minutosRestantes = Math.max(0, Math.ceil((fimMs - agoraTime) / 60000));
            } else if (reuniaoEmBreve) {
                status = 'EM_BREVE';
            }

            const status_realtime = {
                ocupada_agora: status === 'OCUPADA',
                status,
                minutos_restantes: minutosRestantes,
                segundos_restantes: segundosRestantes,
                reserva_atual: reuniaoAtual || null,
                proxima_reserva: proximaReuniao || null,
                reuniao_em_breve: reuniaoEmBreve || null
            };

            return {
                ...sala,
                cor_hex: sala.cor_etiqueta || '#1E3A5F',
                recursos,
                status,
                minutosRestantes,
                minutos_restantes: minutosRestantes,
                segundosRestantes,
                segundos_restantes: segundosRestantes,
                reuniaoAtual: reuniaoAtual || null,
                reuniaoEmBreve: reuniaoEmBreve || null,
                proximaReuniao: proximaReuniao || null,
                totalReservasHoje: reservasDaSala.length,
                status_realtime
            };
        });

        res.json({ salas: salasComStatus });
    } catch (err) {
        console.error('Erro ao buscar salas:', err);
        res.status(500).json({ error: 'Erro ao buscar salas de reunião.' });
    }
});

// POST /api/salas-reuniao e POST /api/salas-reuniao/salas - Cadastra nova sala física
router.post(['/', '/salas'], async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { nome, descricao, localizacao, capacidade, recursos, recursos_json, foto_url, cor_etiqueta, exige_aprovacao, aprovador_id } = req.body;

        if (!nome || !nome.trim()) {
            return res.status(400).json({ error: 'O nome da sala é obrigatório.' });
        }

        const recursosFinais = recursos_json || (recursos ? JSON.stringify(recursos) : null);
        const cor = cor_etiqueta || '#1E3A5F';
        const cap = parseInt(capacidade) || 6;

        const [result] = await db.query(
            `INSERT INTO salas_reuniao 
            (IdEmpresa, nome, descricao, localizacao, capacidade, recursos_json, foto_url, cor_etiqueta, exige_aprovacao, aprovador_id, ativo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [
                tenantId, 
                nome.trim(), 
                descricao || null, 
                localizacao || null, 
                cap, 
                recursosFinais, 
                foto_url || null, 
                cor, 
                exige_aprovacao ? 1 : 0, 
                aprovador_id || null
            ]
        );

        res.json({ id: result.insertId, message: 'Sala cadastrada com sucesso!' });
    } catch (err) {
        console.error('Erro ao cadastrar sala:', err);
        res.status(500).json({ error: 'Erro ao cadastrar sala de reunião.' });
    }
});

// PUT /api/salas-reuniao/:id e PUT /api/salas-reuniao/salas/:id - Atualiza sala física
router.put(['/:id', '/salas/:id'], async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { id } = req.params;
        const { nome, descricao, localizacao, capacidade, recursos, recursos_json, foto_url, cor_etiqueta, exige_aprovacao, aprovador_id } = req.body;

        if (!nome || !nome.trim()) {
            return res.status(400).json({ error: 'O nome da sala é obrigatório.' });
        }

        const recursosFinais = recursos_json || (recursos ? JSON.stringify(recursos) : null);
        const cor = cor_etiqueta || '#1E3A5F';
        const cap = parseInt(capacidade) || 6;

        await db.query(
            `UPDATE salas_reuniao SET
                nome = ?, descricao = ?, localizacao = ?, capacidade = ?, recursos_json = ?, 
                foto_url = ?, cor_etiqueta = ?, exige_aprovacao = ?, aprovador_id = ?
            WHERE id = ? AND (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1))`,
            [
                nome.trim(), 
                descricao || null, 
                localizacao || null, 
                cap, 
                recursosFinais, 
                foto_url || null, 
                cor, 
                exige_aprovacao ? 1 : 0, 
                aprovador_id || null, 
                id, 
                tenantId, 
                tenantId
            ]
        );

        res.json({ message: 'Sala atualizada com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar sala:', err);
        res.status(500).json({ error: 'Erro ao atualizar sala.' });
    }
});

// DELETE /api/salas-reuniao/:id e DELETE /api/salas-reuniao/salas/:id - Inativa sala
router.delete(['/:id', '/salas/:id'], async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { id } = req.params;

        await db.query(
            `UPDATE salas_reuniao SET ativo = 0 WHERE id = ? AND (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1))`,
            [id, tenantId, tenantId]
        );

        res.json({ message: 'Sala inativada com sucesso!' });
    } catch (err) {
        console.error('Erro ao inativar sala:', err);
        res.status(500).json({ error: 'Erro ao inativar sala.' });
    }
});


// ── 2. GESTÃO DE RESERVAS (ALGORITMO ANTI-CONFLITO ESTRITO) ───────

// GET /api/salas-reuniao/reservas - Lista reservas por período, sala ou status
router.get('/reservas', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { sala_id, data_inicio, data_fim, status, search } = req.query;

        let query = `
            SELECT r.*, 
                   s.nome AS sala_nome, s.cor_etiqueta, s.capacidade AS sala_capacidade, s.localizacao AS sala_localizacao,
                   u.NomeCompleto AS organizador_nome, u.email AS organizador_email, u.Setor AS organizador_setor,
                   (SELECT COUNT(*) FROM reservas_participantes rp WHERE rp.reserva_id = r.id) AS total_participantes
            FROM reservas_salas r
            INNER JOIN salas_reuniao s ON s.id = r.sala_id
            INNER JOIN usuario u ON u.idUsuario = r.organizador_id
            WHERE (r.IdEmpresa = ? OR (r.IdEmpresa IS NULL AND ? = 1))
        `;
        const params = [tenantId, tenantId];

        if (sala_id) {
            query += ` AND r.sala_id = ?`;
            params.push(sala_id);
        }
        if (data_inicio) {
            query += ` AND r.data_reserva >= ?`;
            params.push(data_inicio);
        }
        if (data_fim) {
            query += ` AND r.data_reserva <= ?`;
            params.push(data_fim);
        }
        if (status && status !== 'todos') {
            query += ` AND r.status = ?`;
            params.push(status);
        }
        if (search && search.trim()) {
            query += ` AND (r.titulo LIKE ? OR r.codigo LIKE ? OR u.NomeCompleto LIKE ?)`;
            const term = `%${search.trim()}%`;
            params.push(term, term, term);
        }

        query += ` ORDER BY r.data_hora_inicio ASC`;

        const [reservas] = await db.query(query, params);

        // Anexar lista de participantes detalhada para renderização na interface
        if (reservas.length > 0) {
            const reservaIds = reservas.map(r => r.id);
            const [partRows] = await db.query(`
                SELECT rp.reserva_id, rp.usuario_id, rp.confirmou_presenca,
                       u.NomeCompleto, u.email, u.Setor, u.fotoUsuario
                FROM reservas_participantes rp
                INNER JOIN usuario u ON u.idUsuario = rp.usuario_id
                WHERE rp.reserva_id IN (?)
            `, [reservaIds]);

            const mapParticipantes = {};
            partRows.forEach(p => {
                if (!mapParticipantes[p.reserva_id]) mapParticipantes[p.reserva_id] = [];
                mapParticipantes[p.reserva_id].push(p);
            });

            reservas.forEach(r => {
                r.participantes = mapParticipantes[r.id] || [];
            });
        }

        res.json({ reservas });
    } catch (err) {
        console.error('Erro ao listar reservas:', err);
        res.status(500).json({ error: 'Erro ao buscar reservas de salas.' });
    }
});

// GET /api/salas-reuniao/reservas/:id - Detalhes completos da reserva
router.get('/reservas/:id', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { id } = req.params;

        const [rows] = await db.query(`
            SELECT r.*, 
                   s.nome AS sala_nome, s.cor_etiqueta, s.capacidade AS sala_capacidade, s.localizacao AS sala_localizacao, s.recursos_json,
                   u.NomeCompleto AS organizador_nome, u.email AS organizador_email, u.Setor AS organizador_setor,
                   canc.NomeCompleto AS cancelado_por_nome
            FROM reservas_salas r
            INNER JOIN salas_reuniao s ON s.id = r.sala_id
            INNER JOIN usuario u ON u.idUsuario = r.organizador_id
            LEFT JOIN usuario canc ON canc.idUsuario = r.cancelado_por
            WHERE r.id = ? AND (r.IdEmpresa = ? OR (r.IdEmpresa IS NULL AND ? = 1))
        `, [id, tenantId, tenantId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Reserva não encontrada.' });
        }

        const reserva = rows[0];

        const [participantes] = await db.query(`
            SELECT rp.id, rp.usuario_id, rp.confirmou_presenca,
                   u.NomeCompleto, u.email, u.Setor, u.fotoUsuario
            FROM reservas_participantes rp
            INNER JOIN usuario u ON u.idUsuario = rp.usuario_id
            WHERE rp.reserva_id = ?
            ORDER BY u.NomeCompleto ASC
        `, [id]);

        const [historico] = await db.query(`
            SELECT h.*, u.NomeCompleto AS usuario_nome
            FROM reservas_historico h
            LEFT JOIN usuario u ON u.idUsuario = h.usuario_id
            WHERE h.reserva_id = ?
            ORDER BY h.created_at DESC
        `, [id]);

        res.json({
            reserva,
            participantes,
            historico
        });
    } catch (err) {
        console.error('Erro ao buscar detalhes da reserva:', err);
        res.status(500).json({ error: 'Erro ao buscar dados da reserva.' });
    }
});

// POST /api/salas-reuniao/reservas - Criação de reserva com algoritmo anti-conflito estrito + disparo de e-mail HTML
router.post('/reservas', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { sala_id, titulo, pauta, data_reserva, hora_inicio, hora_fim, participantes, recursos_solicitados, notificar_email = true } = req.body;
        const organizador_id = req.user.id || req.user.idUsuario;

        if (!sala_id || !titulo || !data_reserva || !hora_inicio || !hora_fim) {
            return res.status(400).json({ error: 'Todos os campos de agendamento são obrigatórios.' });
        }

        // Formatação padronizada DATETIME
        const data_hora_inicio = `${data_reserva} ${hora_inicio}:00`;
        const data_hora_fim = `${data_reserva} ${hora_fim}:00`;

        if (new Date(data_hora_inicio) >= new Date(data_hora_fim)) {
            return res.status(400).json({ error: 'A hora de término deve ser posterior à hora de início.' });
        }

        // 🛑 ALGORITMO ANTI-CONFLITO RIGOROSO:
        // Bloqueia se (inicio_existente < fim_nova) E (fim_existente > inicio_nova) para reservas ativas na mesma sala.
        const [conflitos] = await db.query(`
            SELECT id, titulo, hora_inicio, hora_fim, data_reserva
            FROM reservas_salas 
            WHERE sala_id = ? 
              AND (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1))
              AND status IN ('confirmada', 'em_andamento')
              AND liberada_antecipadamente = 0
              AND data_hora_inicio < ?
              AND data_hora_fim > ?
        `, [sala_id, tenantId, tenantId, data_hora_fim, data_hora_inicio]);

        if (conflitos.length > 0) {
            const conf = conflitos[0];
            return res.status(409).json({ 
                error: `Conflito de horário! A sala já está reservada para "${conf.titulo}" das ${String(conf.hora_inicio).slice(0, 5)} às ${String(conf.hora_fim).slice(0, 5)}.` 
            });
        }

        // Buscar dados da sala para dados cadastrais e e-mail
        const [salaRows] = await db.query(
            `SELECT nome, localizacao, capacidade, recursos_json FROM salas_reuniao WHERE id = ?`, 
            [sala_id]
        );
        const salaInfo = salaRows[0] || { nome: 'Sala de Reunião', localizacao: 'Planta Principal' };

        // Gerar código único corporativo (ex: RES-2026-8491)
        const anoAtual = new Date().getFullYear();
        const randNum = Math.floor(1000 + Math.random() * 9000);
        const codigo = `RES-${anoAtual}-${randNum}`;

        const [result] = await db.query(`
            INSERT INTO reservas_salas (
                IdEmpresa, codigo, sala_id, organizador_id, titulo, pauta,
                data_reserva, hora_inicio, hora_fim, data_hora_inicio, data_hora_fim,
                status, recursos_solicitados
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmada', ?)
        `, [
            tenantId, 
            codigo, 
            sala_id, 
            organizador_id, 
            titulo.trim(), 
            pauta || null, 
            data_reserva, 
            hora_inicio, 
            hora_fim, 
            data_hora_inicio, 
            data_hora_fim,
            recursos_solicitados || null
        ]);

        const reservaId = result.insertId;

        // Inserir participantes na tabela reservas_participantes
        const participantesAdicionados = [];
        if (Array.isArray(participantes) && participantes.length > 0) {
            for (const usrId of participantes) {
                if (usrId) {
                    await db.query(`
                        INSERT IGNORE INTO reservas_participantes (IdEmpresa, reserva_id, usuario_id) 
                        VALUES (?, ?, ?)
                    `, [tenantId, reservaId, usrId]);
                    participantesAdicionados.push(usrId);
                }
            }
        }

        // Registrar auditoria
        await db.query(`
            INSERT INTO reservas_historico (IdEmpresa, reserva_id, usuario_id, acao, descricao)
            VALUES (?, ?, ?, 'criacao', ?)
        `, [tenantId, reservaId, organizador_id, `Reserva criada: "${titulo}" (${hora_inicio} às ${hora_fim}) no dia ${data_reserva}`]);

        // Disparo de E-mail HTML de convocação
        let emailsEnviados = 0;
        if (notificar_email) {
            try {
                // Obter dados do organizador
                const [orgRows] = await db.query(
                    `SELECT NomeCompleto, email FROM usuario WHERE idUsuario = ?`,
                    [organizador_id]
                );
                const organizador = orgRows[0] || { NomeCompleto: req.user.nome || 'Organizador', email: req.user.email || '' };

                // Buscar emails dos participantes
                let listaEmails = [];
                let nomesParticipantes = [];

                if (participantesAdicionados.length > 0) {
                    const [usuariosRows] = await db.query(
                        `SELECT idUsuario, NomeCompleto, email FROM usuario WHERE idUsuario IN (?) AND email IS NOT NULL AND email != ''`,
                        [participantesAdicionados]
                    );
                    listaEmails = usuariosRows.map(u => u.email).filter(Boolean);
                    nomesParticipantes = usuariosRows.map(u => u.NomeCompleto);
                }

                // Também enviar cópia ao organizador
                if (organizador.email && !listaEmails.includes(organizador.email)) {
                    listaEmails.push(organizador.email);
                }

                if (listaEmails.length > 0) {
                    // Formatar data em pt-BR
                    let dataFmt = data_reserva;
                    try {
                        const [y, m, d] = data_reserva.split('-');
                        dataFmt = `${d}/${m}/${y}`;
                    } catch (e) {}

                    const html = gerarHtmlConvocacao({
                        titulo: titulo.trim(),
                        pauta: pauta || '',
                        salaNome: salaInfo.nome,
                        localizacao: salaInfo.localizacao,
                        dataFormatada: dataFmt,
                        horaInicio,
                        horaFim,
                        organizadorNome: organizador.NomeCompleto,
                        organizadorEmail: organizador.email,
                        participantesNomes: nomesParticipantes.join(', '),
                        recursos: recursos_solicitados
                    });

                    // Disparo assíncrono seguro
                    mailService.sendMail({
                        to: listaEmails,
                        subject: `[Convocação] ${titulo.trim()} • ${salaInfo.nome} (${dataFmt} ${horaInicio})`,
                        html
                    }).then(() => {
                        console.log(`✅ [Salas Reunião] Convocação enviada com sucesso para: ${listaEmails.join(', ')}`);
                    }).catch(errEmail => {
                        console.error('⚠️ [Salas Reunião] Erro ao enviar convocações por e-mail:', errEmail.message);
                    });

                    emailsEnviados = listaEmails.length;
                }
            } catch (errEmail) {
                console.error('⚠️ [Salas Reunião] Falha na rotina de envio de e-mails:', errEmail.message);
            }
        }

        res.json({ 
            id: reservaId, 
            codigo, 
            emailsEnviados,
            message: 'Reserva confirmada com sucesso! Convocação processada.' 
        });
    } catch (err) {
        console.error('Erro ao criar reserva:', err);
        res.status(500).json({ error: 'Erro ao processar reserva.' });
    }
});

// PUT /api/salas-reuniao/reservas/:id - Edição de reserva com anti-conflito (ignora próprio ID)
router.put('/reservas/:id', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { id } = req.params;
        const { sala_id, titulo, pauta, data_reserva, hora_inicio, hora_fim, participantes, recursos_solicitados } = req.body;
        const usuario_id = req.user.id || req.user.idUsuario;

        const [existenteRows] = await db.query(
            `SELECT * FROM reservas_salas WHERE id = ? AND (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1))`,
            [id, tenantId, tenantId]
        );

        if (existenteRows.length === 0) {
            return res.status(404).json({ error: 'Reserva não encontrada.' });
        }

        const reservaAntiga = existenteRows[0];

        if (reservaAntiga.status === 'cancelada') {
            return res.status(400).json({ error: 'Não é possível editar uma reserva cancelada.' });
        }

        const data_hora_inicio = `${data_reserva} ${hora_inicio}:00`;
        const data_hora_fim = `${data_reserva} ${hora_fim}:00`;

        if (new Date(data_hora_inicio) >= new Date(data_hora_fim)) {
            return res.status(400).json({ error: 'A hora de término deve ser posterior à hora de início.' });
        }

        // Validação anti-conflito excluindo a própria reserva
        const [conflitos] = await db.query(`
            SELECT id, titulo, hora_inicio, hora_fim 
            FROM reservas_salas 
            WHERE sala_id = ? 
              AND (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1))
              AND status IN ('confirmada', 'em_andamento')
              AND liberada_antecipadamente = 0
              AND id != ?
              AND data_hora_inicio < ?
              AND data_hora_fim > ?
        `, [sala_id, tenantId, tenantId, id, data_hora_fim, data_hora_inicio]);

        if (conflitos.length > 0) {
            const conf = conflitos[0];
            return res.status(409).json({ 
                error: `Conflito de horário! A sala já está reservada para "${conf.titulo}" das ${String(conf.hora_inicio).slice(0, 5)} às ${String(conf.hora_fim).slice(0, 5)}.` 
            });
        }

        await db.query(`
            UPDATE reservas_salas SET
                sala_id = ?, titulo = ?, pauta = ?,
                data_reserva = ?, hora_inicio = ?, hora_fim = ?,
                data_hora_inicio = ?, data_hora_fim = ?,
                recursos_solicitados = ?
            WHERE id = ? AND (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1))
        `, [
            sala_id, 
            titulo.trim(), 
            pauta || null, 
            data_reserva, 
            hora_inicio, 
            hora_fim, 
            data_hora_inicio, 
            data_hora_fim, 
            recursos_solicitados || null, 
            id, 
            tenantId, 
            tenantId
        ]);

        if (Array.isArray(participantes)) {
            await db.query(`DELETE FROM reservas_participantes WHERE reserva_id = ?`, [id]);
            for (const usrId of participantes) {
                if (usrId) {
                    await db.query(`
                        INSERT IGNORE INTO reservas_participantes (IdEmpresa, reserva_id, usuario_id) 
                        VALUES (?, ?, ?)
                    `, [tenantId, id, usrId]);
                }
            }
        }

        await db.query(`
            INSERT INTO reservas_historico (IdEmpresa, reserva_id, usuario_id, acao, descricao, dados_anteriores)
            VALUES (?, ?, ?, 'alteracao', ?, ?)
        `, [
            tenantId, 
            id, 
            usuario_id, 
            `Reserva alterada para: "${titulo}" em ${data_reserva} (${hora_inicio} às ${hora_fim})`,
            JSON.stringify({
                titulo: reservaAntiga.titulo,
                sala_id: reservaAntiga.sala_id,
                data_reserva: reservaAntiga.data_reserva,
                hora_inicio: reservaAntiga.hora_inicio,
                hora_fim: reservaAntiga.hora_fim
            })
        ]);

        res.json({ message: 'Reserva atualizada com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar reserva:', err);
        res.status(500).json({ error: 'Erro ao atualizar reserva.' });
    }
});

// POST /api/salas-reuniao/reservas/:id/liberar (e alias /checkout)
// Check-out antecipado que encerra a reunião no minuto atual, liberando a sala no sistema e no totem
router.post(['/reservas/:id/liberar', '/reservas/:id/checkout'], async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { id } = req.params;
        const usuario_id = req.user.id || req.user.idUsuario;

        const agora = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const agoraStr = `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())} ${pad(agora.getHours())}:${pad(agora.getMinutes())}:${pad(agora.getSeconds())}`;
        const horaFimStr = `${pad(agora.getHours())}:${pad(agora.getMinutes())}:00`;

        await db.query(`
            UPDATE reservas_salas SET 
                status = 'concluida', 
                liberada_antecipadamente = 1,
                hora_fim = ?,
                data_hora_fim = ?
            WHERE id = ? AND (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1))
        `, [horaFimStr, agoraStr, id, tenantId, tenantId]);

        await db.query(`
            INSERT INTO reservas_historico (IdEmpresa, reserva_id, usuario_id, acao, descricao)
            VALUES (?, ?, ?, 'liberacao_antecipada', 'Sala liberada antecipadamente pelo usuário/totem.')
        `, [tenantId, id, usuario_id]);

        res.json({ message: 'Sala liberada com sucesso! O horário restante já está disponível no sistema e no totem.' });
    } catch (err) {
        console.error('Erro no check-out antecipado:', err);
        res.status(500).json({ error: 'Erro ao liberar sala.' });
    }
});

// POST /api/salas-reuniao/reservas/:id/cancelar - Cancelamento com justificativa obrigatória
router.post('/reservas/:id/cancelar', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { id } = req.params;
        const { motivo } = req.body;
        const usuario_id = req.user.id || req.user.idUsuario;

        if (!motivo || !motivo.trim()) {
            return res.status(400).json({ error: 'A justificativa de cancelamento é obrigatória.' });
        }

        const motivoFinal = motivo.trim();

        await db.query(`
            UPDATE reservas_salas SET 
                status = 'cancelada', 
                motivo_cancelamento = ?,
                cancelado_por = ?,
                cancelado_em = NOW()
            WHERE id = ? AND (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1))
        `, [motivoFinal, usuario_id, id, tenantId, tenantId]);

        await db.query(`
            INSERT INTO reservas_historico (IdEmpresa, reserva_id, usuario_id, acao, descricao)
            VALUES (?, ?, ?, 'cancelamento', ?)
        `, [tenantId, id, usuario_id, `Cancelada. Motivo: ${motivoFinal}`]);

        res.json({ message: 'Reserva cancelada com sucesso.' });
    } catch (err) {
        console.error('Erro ao cancelar reserva:', err);
        res.status(500).json({ error: 'Erro ao cancelar reserva.' });
    }
});

// POST /api/salas-reuniao/reservas/:id/enviar-convite-email - Disparo manual de convite
router.post('/reservas/:id/enviar-convite-email', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { id } = req.params;

        const [rows] = await db.query(`
            SELECT r.*, s.nome AS sala_nome, s.localizacao AS sala_localizacao,
                   u.NomeCompleto AS organizador_nome, u.email AS organizador_email
            FROM reservas_salas r
            INNER JOIN salas_reuniao s ON s.id = r.sala_id
            INNER JOIN usuario u ON u.idUsuario = r.organizador_id
            WHERE r.id = ? AND (r.IdEmpresa = ? OR (r.IdEmpresa IS NULL AND ? = 1))
        `, [id, tenantId, tenantId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Reserva não encontrada.' });
        }

        const r = rows[0];

        const [partRows] = await db.query(`
            SELECT u.NomeCompleto, u.email
            FROM reservas_participantes rp
            INNER JOIN usuario u ON u.idUsuario = rp.usuario_id
            WHERE rp.reserva_id = ? AND u.email IS NOT NULL AND u.email != ''
        `, [id]);

        const emails = partRows.map(p => p.email).filter(Boolean);
        if (r.organizador_email && !emails.includes(r.organizador_email)) {
            emails.push(r.organizador_email);
        }

        if (emails.length === 0) {
            return res.status(400).json({ error: 'Nenhum e-mail de participante cadastrado para esta reunião.' });
        }

        let dataFmt = r.data_reserva;
        try {
            const [y, m, d] = String(r.data_reserva).split('T')[0].split('-');
            dataFmt = `${d}/${m}/${y}`;
        } catch (e) {}

        const html = gerarHtmlConvocacao({
            titulo: r.titulo,
            pauta: r.pauta || '',
            salaNome: r.sala_nome,
            localizacao: r.sala_localizacao,
            dataFormatada: dataFmt,
            horaInicio: String(r.hora_inicio).slice(0, 5),
            horaFim: String(r.hora_fim).slice(0, 5),
            organizadorNome: r.organizador_nome,
            organizadorEmail: r.organizador_email,
            participantesNomes: partRows.map(p => p.NomeCompleto).join(', '),
            recursos: r.recursos_solicitados
        });

        await mailService.sendMail({
            to: emails,
            subject: `[Reenvio Convocação] ${r.titulo} • ${r.sala_nome} (${dataFmt})`,
            html
        });

        res.json({ message: `E-mails de convocação reenviados com sucesso para ${emails.length} destinatários!` });
    } catch (err) {
        console.error('Erro ao reenviar convites:', err);
        res.status(500).json({ error: 'Erro ao disparar e-mails de convocação.' });
    }
});

// POST /api/salas-reuniao/reservas/rapida - Reserva expressa de porta (Totem Kiosk)
router.post('/reservas/rapida', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { sala_id, duracao_minutos = 30, titulo = 'Reunião Imediata (Totem)' } = req.body;
        const organizador_id = req.user.id || req.user.idUsuario;

        const duracao = parseInt(duracao_minutos) || 30;
        const agora = new Date();
        const fim = new Date(agora.getTime() + duracao * 60000);

        const pad = (n) => String(n).padStart(2, '0');
        const formatLocalDT = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

        const data_reserva = `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
        const hora_inicio = `${pad(agora.getHours())}:${pad(agora.getMinutes())}:00`;
        const hora_fim = `${pad(fim.getHours())}:${pad(fim.getMinutes())}:00`;
        const data_hora_inicio = formatLocalDT(agora);
        const data_hora_fim = formatLocalDT(fim);

        // Checar conflitos estritos
        const [conflitos] = await db.query(`
            SELECT id, titulo, hora_inicio, hora_fim 
            FROM reservas_salas 
            WHERE sala_id = ? 
              AND (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1))
              AND status IN ('confirmada', 'em_andamento')
              AND liberada_antecipadamente = 0
              AND data_hora_inicio < ?
              AND data_hora_fim > ?
        `, [sala_id, tenantId, tenantId, data_hora_fim, data_hora_inicio]);

        if (conflitos.length > 0) {
            const conf = conflitos[0];
            return res.status(409).json({ 
                error: `A sala já está ocupada ou reservada para "${conf.titulo}" até as ${String(conf.hora_fim).slice(0, 5)}!` 
            });
        }

        const codigo = `TOT-${Date.now().toString().slice(-6)}`;

        const [result] = await db.query(`
            INSERT INTO reservas_salas (
                IdEmpresa, codigo, sala_id, organizador_id, titulo,
                data_reserva, hora_inicio, hora_fim, data_hora_inicio, data_hora_fim,
                status, checkin_realizado, checkin_em
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'em_andamento', 1, NOW())
        `, [tenantId, codigo, sala_id, organizador_id, titulo, data_reserva, hora_inicio, hora_fim, data_hora_inicio, data_hora_fim]);

        const reservaId = result.insertId;

        await db.query(`
            INSERT INTO reservas_historico (IdEmpresa, reserva_id, usuario_id, acao, descricao)
            VALUES (?, ?, ?, 'criacao', ?)
        `, [tenantId, reservaId, organizador_id, `Reserva rápida iniciada pelo Totem: ${duracao} minutos`]);

        res.json({ id: reservaId, codigo, message: `Reserva expressa de ${duracao} min confirmada!` });
    } catch (err) {
        console.error('Erro na reserva rápida:', err);
        res.status(500).json({ error: 'Erro ao criar reserva rápida.' });
    }
});

// GET /api/salas-reuniao/totem/:sala_id - Endpoint de status em tempo real do totem de porta
router.get('/totem/:sala_id', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { sala_id } = req.params;

        const [salaRows] = await db.query(
            `SELECT * FROM salas_reuniao WHERE id = ? AND (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1))`, 
            [sala_id, tenantId, tenantId]
        );

        if (salaRows.length === 0) {
            return res.status(404).json({ error: 'Sala não encontrada para este ambiente corporativo.' });
        }
        const sala = salaRows[0];
        try {
            sala.recursos = typeof sala.recursos_json === 'string' ? JSON.parse(sala.recursos_json) : (sala.recursos_json || []);
        } catch (e) {
            sala.recursos = [];
        }

        // Reunião em andamento agora
        const [atualRows] = await db.query(`
            SELECT r.*, 
                   u.NomeCompleto AS organizador_nome, u.email AS organizador_email, u.Setor AS organizador_setor,
                   (SELECT COUNT(*) FROM reservas_participantes rp WHERE rp.reserva_id = r.id) AS total_participantes
            FROM reservas_salas r
            INNER JOIN usuario u ON u.idUsuario = r.organizador_id
            WHERE r.sala_id = ?
              AND (r.IdEmpresa = ? OR (r.IdEmpresa IS NULL AND ? = 1))
              AND r.status IN ('confirmada', 'em_andamento')
              AND r.liberada_antecipadamente = 0
              AND NOW() BETWEEN r.data_hora_inicio AND r.data_hora_fim
            ORDER BY r.data_hora_inicio ASC
            LIMIT 1
        `, [sala_id, tenantId, tenantId]);

        const reuniaoAtual = atualRows[0] || null;

        // Reunião em breve (< 15 minutos)
        let reuniaoEmBreve = null;
        if (!reuniaoAtual) {
            const [emBreveRows] = await db.query(`
                SELECT r.*, u.NomeCompleto AS organizador_nome
                FROM reservas_salas r
                INNER JOIN usuario u ON u.idUsuario = r.organizador_id
                WHERE r.sala_id = ?
                  AND (r.IdEmpresa = ? OR (r.IdEmpresa IS NULL AND ? = 1))
                  AND r.status = 'confirmada'
                  AND r.liberada_antecipadamente = 0
                  AND r.data_reserva = CURDATE()
                  AND r.data_hora_inicio > NOW()
                  AND TIMESTAMPDIFF(MINUTE, NOW(), r.data_hora_inicio) <= 15
                ORDER BY r.data_hora_inicio ASC
                LIMIT 1
            `, [sala_id, tenantId, tenantId]);
            reuniaoEmBreve = emBreveRows[0] || null;
        }

        // Próximas reuniões do dia
        const [proximasRows] = await db.query(`
            SELECT r.id, r.codigo, r.titulo, r.pauta, r.hora_inicio, r.hora_fim, r.status,
                   u.NomeCompleto AS organizador_nome,
                   (SELECT COUNT(*) FROM reservas_participantes rp WHERE rp.reserva_id = r.id) AS total_participantes
            FROM reservas_salas r
            INNER JOIN usuario u ON u.idUsuario = r.organizador_id
            WHERE r.sala_id = ?
              AND (r.IdEmpresa = ? OR (r.IdEmpresa IS NULL AND ? = 1))
              AND r.data_reserva = CURDATE()
              AND r.data_hora_fim > NOW()
              AND r.status IN ('confirmada', 'em_andamento')
              AND r.liberada_antecipadamente = 0
              AND r.id != ?
            ORDER BY r.data_hora_inicio ASC
            LIMIT 6
        `, [sala_id, tenantId, tenantId, reuniaoAtual ? reuniaoAtual.id : 0]);

        let segundosRestantes = null;
        let minutosRestantes = null;
        if (reuniaoAtual) {
            const fimMs = new Date(reuniaoAtual.data_hora_fim).getTime();
            const agoraMs = Date.now();
            segundosRestantes = Math.max(0, Math.floor((fimMs - agoraMs) / 1000));
            minutosRestantes = Math.max(0, Math.ceil((fimMs - agoraMs) / 60000));
        }

        let status = 'LIVRE';
        if (reuniaoAtual) {
            status = 'OCUPADA';
        } else if (reuniaoEmBreve) {
            status = 'EM_BREVE';
        }

        res.json({
            sala,
            status,
            minutosRestantes,
            minutos_restantes: minutosRestantes,
            segundosRestantes,
            segundos_restantes: segundosRestantes,
            reuniaoAtual,
            reuniaoEmBreve,
            proximasReunioes: proximasRows
        });
    } catch (err) {
        console.error('Erro no totem da sala:', err);
        res.status(500).json({ error: 'Erro ao carregar dados do Totem.' });
    }
});

// GET /api/salas-reuniao/participantes-disponiveis (e alias /colaboradores)
// Retorna colaboradores ativos do tenant para convite nas reuniões
router.get(['/participantes-disponiveis', '/colaboradores'], async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const [usuarios] = await db.query(`
            SELECT idUsuario, NomeCompleto, email, Setor, Funcao, fotoUsuario, login
            FROM usuario
            WHERE (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1))
              AND aprovado = 1
              AND (status IS NULL OR status = '1' OR status != '0')
            ORDER BY NomeCompleto ASC
        `, [tenantId, tenantId]);

        res.json(usuarios);
    } catch (err) {
        console.error('Erro ao buscar participantes disponíveis:', err);
        res.status(500).json({ error: 'Erro ao listar colaboradores disponíveis.' });
    }
});

// GET /api/salas-reuniao/relatorios/metricas - Métricas de uso de salas
router.get('/relatorios/metricas', async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        const { data_inicio, data_fim } = req.query;

        const hoje = new Date();
        const primeiroDiaMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
        const ultimoDiaMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

        const dtIni = data_inicio || primeiroDiaMes;
        const dtFim = data_fim || ultimoDiaMes;

        const [statusRows] = await db.query(`
            SELECT status, COUNT(*) AS total,
                   COALESCE(SUM(TIMESTAMPDIFF(MINUTE, data_hora_inicio, data_hora_fim)), 0) AS total_minutos,
                   COALESCE(SUM(checkin_realizado), 0) AS total_checkins,
                   COALESCE(SUM(liberada_antecipadamente), 0) AS total_liberacoes
            FROM reservas_salas
            WHERE (IdEmpresa = ? OR (IdEmpresa IS NULL AND ? = 1))
              AND data_reserva BETWEEN ? AND ?
            GROUP BY status
        `, [tenantId, tenantId, dtIni, dtFim]);

        let totalReservas = 0;
        let totalMinutos = 0;
        let totalCheckins = 0;
        let canceladas = 0;
        let concluidas = 0;

        statusRows.forEach(r => {
            totalReservas += r.total;
            totalMinutos += parseInt(r.total_minutos) || 0;
            totalCheckins += parseInt(r.total_checkins) || 0;
            if (r.status === 'cancelada') canceladas += r.total;
            if (r.status === 'concluida') concluidas += r.total;
        });

        const totalHoras = (totalMinutos / 60).toFixed(1);
        const taxaCheckin = totalReservas > 0 ? Math.round((totalCheckins / totalReservas) * 100) : 0;

        const [rankingSalas] = await db.query(`
            SELECT s.id, s.nome, s.cor_etiqueta, s.capacidade,
                   COUNT(r.id) AS total_reservas,
                   COALESCE(SUM(TIMESTAMPDIFF(MINUTE, r.data_hora_inicio, r.data_hora_fim)), 0) AS minutos_utilizados
            FROM salas_reuniao s
            LEFT JOIN reservas_salas r ON r.sala_id = s.id 
                 AND (r.IdEmpresa = ? OR (r.IdEmpresa IS NULL AND ? = 1))
                 AND r.data_reserva BETWEEN ? AND ?
                 AND r.status IN ('confirmada', 'em_andamento', 'concluida')
            WHERE (s.IdEmpresa = ? OR (s.IdEmpresa IS NULL AND ? = 1)) AND s.ativo = 1
            GROUP BY s.id
            ORDER BY minutos_utilizados DESC
        `, [tenantId, tenantId, dtIni, dtFim, tenantId, tenantId]);

        const [topOrganizadores] = await db.query(`
            SELECT u.idUsuario, u.NomeCompleto, u.Setor,
                   COUNT(r.id) AS total_reunioes
            FROM reservas_salas r
            INNER JOIN usuario u ON u.idUsuario = r.organizador_id
            WHERE (r.IdEmpresa = ? OR (r.IdEmpresa IS NULL AND ? = 1))
              AND r.data_reserva BETWEEN ? AND ?
            GROUP BY u.idUsuario
            ORDER BY total_reunioes DESC
            LIMIT 5
        `, [tenantId, tenantId, dtIni, dtFim]);

        res.json({
            periodo: { data_inicio: dtIni, data_fim: dtFim },
            resumo: {
                totalReservas,
                totalHoras,
                totalCheckins,
                taxaCheckin,
                canceladas,
                concluidas
            },
            rankingSalas: rankingSalas.map(s => ({
                ...s,
                horas_utilizadas: (s.minutos_utilizados / 60).toFixed(1)
            })),
            topOrganizadores
        });
    } catch (err) {
        console.error('Erro nas métricas de salas:', err);
        res.status(500).json({ error: 'Erro ao gerar métricas de salas.' });
    }
});

module.exports = router;
