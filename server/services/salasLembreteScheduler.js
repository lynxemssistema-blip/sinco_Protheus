/**
 * Serviço de Agendamento e Disparo de Lembretes Automáticos de Salas de Reunião
 * Permite envio programado por E-mail corporativo e/ou WhatsApp (ex: 1 dia antes, 3h antes, 1h antes)
 */

const db = require('./mysqlService');
const mailService = require('./mailService');
const whatsappService = require('./whatsapp');

// Helper de formatação de data brasileira estrita
function formatarDataPtBr(rawDate) {
    if (!rawDate) return '';
    try {
        if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
            const parts = rawDate.slice(0, 10).split('-');
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            const d = parseInt(parts[2], 10);
            const dt = new Date(y, m - 1, d);
            const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
            const sem = diasSemana[dt.getDay()] || '';
            const pad = (n) => String(n).padStart(2, '0');
            return `${pad(d)}/${pad(m)}/${y}${sem ? ` (${sem})` : ''}`;
        }

        if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
            const pad = (n) => String(n).padStart(2, '0');
            const y = rawDate.getUTCFullYear();
            const m = rawDate.getUTCMonth() + 1;
            const d = rawDate.getUTCDate();
            const dt = new Date(y, m - 1, d);
            const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
            const sem = diasSemana[dt.getDay()] || '';
            return `${pad(d)}/${pad(m)}/${y}${sem ? ` (${sem})` : ''}`;
        }
    } catch (_) {}

    return String(rawDate);
}

// Gerar HTML executivo para lembrete
function gerarHtmlLembrete({ titulo, pauta, salaNome, localizacao, dataFormatada, horaInicio, horaFim, organizadorNome, organizadorEmail, participantesNomes, recursos, textoAntecedencia }) {
    return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F1F5F9; margin: 0; padding: 24px; color: #1E293B; }
            .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #CBD5E1; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); }
            .header { background: linear-gradient(135deg, #0F766E 0%, #0F172A 100%); padding: 32px 28px; text-align: left; color: #FFFFFF; }
            .header-badge { display: inline-block; background: rgba(52, 211, 153, 0.2); border: 1px solid rgba(52, 211, 153, 0.4); color: #6EE7B7; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 4px 12px; border-radius: 9999px; margin-bottom: 12px; }
            .header-title { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.3; }
            .header-sub { margin: 8px 0 0 0; font-size: 13.5px; color: #CBD5E1; }
            .content { padding: 28px; }
            .alert-banner { background: #ECFDF5; border-left: 4px solid #10B981; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; color: #065F46; font-weight: 600; display: flex; align-items: center; gap: 8px; }
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
            .btn-cta { display: inline-block; background: #0F766E; color: #FFFFFF !important; text-decoration: none; font-weight: 700; font-size: 13px; padding: 12px 24px; border-radius: 10px; margin-top: 8px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <span class="header-badge">🔔 Lembrete de Reunião • ${textoAntecedencia}</span>
                <h1 class="header-title">${titulo}</h1>
                <p class="header-sub">Lembramos que esta reunião corporativa começará ${textoAntecedencia.toLowerCase()}.</p>
            </div>
            <div class="content">
                <div class="alert-banner">
                    ⏰ A sua reunião está programada para iniciar ${textoAntecedencia.toLowerCase()} (${horaInicio}).
                </div>

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
                    <strong>Pauta / Tópicos a Discutir:</strong><br />
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
                    <p style="font-size: 13px; color: #64748B; margin-bottom: 12px;">Por favor, organize-se para comparecer pontualmente.</p>
                    <a href="https://lynxems.com.br/salas" class="btn-cta">Acessar Painel da Sala de Reunião</a>
                </div>
            </div>
            <div class="footer">
                <p style="margin: 0;">SINCO Protheus / Suíte Corporativa • Gestão Inteligente de Espaços</p>
                <p style="margin: 4px 0 0 0;">Lembrete corporativo automatizado. Não responda diretamente a esta mensagem.</p>
            </div>
        </div>
    </body>
    </html>
    `;
}

function obterTextoAntecedencia(minutos) {
    if (minutos >= 1440) {
        const dias = Math.round(minutos / 1440);
        return dias === 1 ? 'em 1 dia' : `em ${dias} dias`;
    }
    if (minutos >= 60) {
        const horas = Math.round(minutos / 60);
        return horas === 1 ? 'em 1 hora' : `em ${horas} horas`;
    }
    return `em ${minutos} minutos`;
}

async function processarLembretesPendentes() {
    try {
        // Buscar lembretes que atingiram o horário de disparo
        const [lembretes] = await db.query(`
            SELECT l.id AS lembrete_id, l.reserva_id, l.tipo_lembrete, l.antecedencia_minutos, l.canal,
                   r.titulo, r.pauta, r.data_reserva, r.hora_inicio, r.hora_fim,
                   r.recursos_solicitados, r.status AS reserva_status, r.liberada_antecipadamente,
                   s.nome AS sala_nome, s.localizacao AS sala_localizacao,
                   u_org.NomeCompleto AS organizador_nome, u_org.email AS organizador_email,
                   u_org.whatsapp AS organizador_whatsapp, u_org.telefone AS organizador_telefone
            FROM reservas_lembretes_agendados l
            INNER JOIN reservas_salas r ON r.id = l.reserva_id
            INNER JOIN salas_reuniao s ON s.id = r.sala_id
            INNER JOIN usuario u_org ON u_org.idUsuario = r.organizador_id
            WHERE l.enviado = 0
              AND l.status = 'pendente'
              AND l.data_hora_agendada <= NOW()
              AND r.status IN ('confirmada', 'em_andamento')
              AND r.liberada_antecipadamente = 0
            LIMIT 20
        `);

        if (!lembretes || lembretes.length === 0) return;

        console.log(`[Lembretes Salas] Encontrados ${lembretes.length} lembrete(s) para disparo agora.`);

        for (const lembrete of lembretes) {
            try {
                // 1. Buscar participantes convocados
                const [participantes] = await db.query(`
                    SELECT u.idUsuario, u.NomeCompleto, u.email, u.whatsapp, u.telefone
                    FROM reservas_participantes rp
                    INNER JOIN usuario u ON u.idUsuario = rp.usuario_id
                    WHERE rp.reserva_id = ?
                `, [lembrete.reserva_id]);

                const emails = participantes.map(p => p.email).filter(Boolean);
                if (lembrete.organizador_email && !emails.includes(lembrete.organizador_email)) {
                    emails.push(lembrete.organizador_email);
                }

                const telefones = participantes
                    .map(p => p.whatsapp || p.telefone)
                    .filter(Boolean);
                if (lembrete.organizador_whatsapp || lembrete.organizador_telefone) {
                    const orgPhone = lembrete.organizador_whatsapp || lembrete.organizador_telefone;
                    if (!telefones.includes(orgPhone)) telefones.push(orgPhone);
                }

                const dataFmt = formatarDataPtBr(lembrete.data_reserva);
                const horaIniFmt = String(lembrete.hora_inicio).slice(0, 5);
                const horaFimFmt = String(lembrete.hora_fim).slice(0, 5);
                const textoAntecedencia = obterTextoAntecedencia(lembrete.antecedencia_minutos);
                const nomesParticipantes = participantes.map(p => p.NomeCompleto).join(', ');

                const logsDisparo = [];

                // 2. Disparo por E-mail (se 'email' ou 'ambos')
                if ((lembrete.canal === 'email' || lembrete.canal === 'ambos') && emails.length > 0) {
                    try {
                        const html = gerarHtmlLembrete({
                            titulo: lembrete.titulo,
                            pauta: lembrete.pauta || '',
                            salaNome: lembrete.sala_nome,
                            localizacao: lembrete.sala_localizacao,
                            dataFormatada: dataFmt,
                            horaInicio: horaIniFmt,
                            horaFim: horaFimFmt,
                            organizadorNome: lembrete.organizador_nome,
                            organizadorEmail: lembrete.organizador_email,
                            participantesNomes: nomesParticipantes,
                            recursos: lembrete.recursos_solicitados,
                            textoAntecedencia
                        });

                        await mailService.sendMail({
                            to: emails,
                            subject: `[Lembrete] ${lembrete.titulo} • ${lembrete.sala_nome} (${textoAntecedencia})`,
                            html
                        });
                        logsDisparo.push(`E-mail enviado para: ${emails.join(', ')}`);
                    } catch (errEmail) {
                        console.error(`[Lembretes Salas] Falha no e-mail do lembrete #${lembrete.lembrete_id}:`, errEmail.message);
                        logsDisparo.push(`Erro e-mail: ${errEmail.message}`);
                    }
                }

                // 3. Disparo por WhatsApp (se 'whatsapp' ou 'ambos')
                if ((lembrete.canal === 'whatsapp' || lembrete.canal === 'ambos') && telefones.length > 0) {
                    try {
                        const waText = 
                            `🔔 *LEMBRETE DE REUNIÃO - LYNX EMS*\n` +
                            `⏰ *A sua reunião começará ${textoAntecedencia}!*\n` +
                            `--------------------------------------------------\n` +
                            `📌 *Assunto:* ${lembrete.titulo}\n` +
                            `🏢 *Sala:* ${lembrete.sala_nome} (${lembrete.sala_localizacao || 'Planta Principal'})\n` +
                            `📅 *Data:* ${dataFmt}\n` +
                            `⏰ *Horário:* ${horaIniFmt} às ${horaFimFmt}\n` +
                            `👤 *Organizador:* ${lembrete.organizador_nome}\n` +
                            (lembrete.pauta ? `📝 *Pauta:* ${lembrete.pauta}\n` : '') +
                            (nomesParticipantes ? `👥 *Participantes:* ${nomesParticipantes}\n` : '') +
                            `\nPor favor, organize-se para comparecer pontualmente.`;

                        await whatsappService.sendText(telefones, waText, `Lembrete Reunião: ${lembrete.titulo}`);
                        logsDisparo.push(`WhatsApp enviado para: ${telefones.join(', ')}`);
                    } catch (errWa) {
                        console.warn(`[Lembretes Salas] Falha no WhatsApp do lembrete #${lembrete.lembrete_id}:`, errWa.message);
                        logsDisparo.push(`Erro WhatsApp: ${errWa.message}`);
                    }
                }

                // 4. Marcar lembrete como enviado
                await db.query(`
                    UPDATE reservas_lembretes_agendados
                    SET enviado = 1, status = 'enviado', data_hora_envio = NOW(), detalhes_envio = ?
                    WHERE id = ?
                `, [logsDisparo.join(' | '), lembrete.lembrete_id]);

                console.log(`✅ [Lembretes Salas] Lembrete #${lembrete.lembrete_id} da reunião "${lembrete.titulo}" processado.`);
            } catch (errProcesso) {
                console.error(`[Lembretes Salas] Erro ao processar lembrete individual #${lembrete.lembrete_id}:`, errProcesso);
                await db.query(`
                    UPDATE reservas_lembretes_agendados
                    SET status = 'erro', detalhes_envio = ?
                    WHERE id = ?
                `, [errProcesso.message, lembrete.lembrete_id]);
            }
        }
    } catch (errGeral) {
        console.error('[Lembretes Salas] Erro no ciclo de verificação:', errGeral.message);
    }
}

// Iniciar agendador de 1 em 1 minuto
let intervalId = null;

function iniciarSchedulerLembretes() {
    if (intervalId) return;
    console.log('⏰ [Salas Reunião] Agendador de Lembretes Automáticos ativado (verificação a cada 60s).');
    // Executa a primeira checagem em 15s
    setTimeout(processarLembretesPendentes, 15000);
    // Intervalo de 60 segundos
    intervalId = setInterval(processarLembretesPendentes, 60000);
}

module.exports = {
    iniciarSchedulerLembretes,
    processarLembretesPendentes,
    formatarDataPtBr,
    gerarHtmlLembrete
};
