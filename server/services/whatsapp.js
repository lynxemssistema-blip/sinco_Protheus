const axios = require('axios');

const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY  = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

let mysqlPool = null;
try { mysqlPool = require('./mysqlService'); } catch (e) { /* sem db, logs ignorados */ }

// Garante tabela de log
(async () => {
    if (!mysqlPool) return;
    try {
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_whatsapp_logs (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                recipient   VARCHAR(30) NOT NULL,
                subject     VARCHAR(255),
                message     TEXT,
                status      ENUM('ok','failed') DEFAULT 'ok',
                error_info  TEXT,
                sent_at     DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    } catch (e) { console.warn('[WhatsApp] Tabela de log não criada:', e.message); }
})();

function normalizePhone(raw) {
    if (!raw) return null;
    if (String(raw).includes('@')) return String(raw);
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 11) return '55' + digits;
    if (digits.length === 12 || digits.length === 13) return digits;
    return null;
}

async function logSend({ recipient, subject, message, status, error_info }) {
    if (!mysqlPool) return;
    try {
        await mysqlPool.query(
            'INSERT INTO app_whatsapp_logs (recipient, subject, message, status, error_info) VALUES (?, ?, ?, ?, ?)',
            [recipient, subject || null, message || null, status, error_info || null]
        );
    } catch (e) { /* silencioso */ }
}

async function logEmailSent({ recipients, subject, body }) {
    if (!mysqlPool) return;
    const recipientStr = Array.isArray(recipients) ? recipients.join(', ') : String(recipients || '');
    try {
        const sender = process.env.SMTP_USER || 'suporte@lynxems.com.br';
        await mysqlPool.query(
            `INSERT INTO app_emails (folder, sender_email, recipient_email, subject, body_html, date)
             VALUES ('SENT', ?, ?, ?, ?, NOW())`,
            [sender, recipientStr, subject || null, body || null]
        );
    } catch (e) { /* silencioso */ }
}

/**
 * Envia mensagem de texto via Evolution API e registra no log.
 * @param {string|string[]} numbers  Números brutos (serão normalizados)
 * @param {string}          text     Texto da mensagem
 * @param {string}          subject  Descrição breve para o histórico
 */
async function sendText(numbers, text, subject) {
    if (!BASE_URL || !API_KEY || !INSTANCE) {
        throw new Error('Evolution API não configurada (verifique .env)');
    }

    const targets = (Array.isArray(numbers) ? numbers : [numbers])
        .map(normalizePhone)
        .filter(Boolean);

    if (targets.length === 0) return [];

    const results = await Promise.allSettled(
        targets.map(number =>
            axios.post(
                `${BASE_URL}/message/sendText/${INSTANCE}`,
                { number, text },
                { headers: { apikey: API_KEY, 'Content-Type': 'application/json' } }
            )
        )
    );

    for (let i = 0; i < targets.length; i++) {
        const r = results[i];
        const ok = r.status === 'fulfilled';
        const errInfo = ok ? null : JSON.stringify(r.reason?.response?.data || r.reason?.message);
        if (!ok) console.warn(`[WhatsApp] Falha ao enviar para ${targets[i]}:`, errInfo);
        await logSend({ recipient: targets[i], subject, message: text, status: ok ? 'ok' : 'failed', error_info: errInfo });
    }

    return results.map((r, i) => ({
        number: targets[i],
        ok: r.status === 'fulfilled',
        error: r.status === 'rejected' ? r.reason?.response?.data || r.reason?.message : null
    }));
}

// ──── Templates de mensagem ──────────────────────────────────────────────────

function msgNovaFaturamento({ numero_solicitacao, usuario, qtd_itens }) {
    return (
        `🚨 *Nova Solicitação de Faturamento*\n` +
        `Nº: ${numero_solicitacao}\n` +
        `Solicitante: ${usuario}\n` +
        `Itens: ${qtd_itens}\n` +
        `Acesse "Controle de Faturamento" no ERP.`
    );
}

function msgFaturamentoPendente(qtd) {
    return (
        `⏰ *Faturamentos Pendentes*\n` +
        `${qtd} solicitação(ões) aguardam faturamento.\n` +
        `Acesse "Controle de Faturamento" no ERP.`
    );
}

function msgMeuCanal({ nome, setores }) {
    const linhas = setores.map(s => {
        const emoji = s.score >= 90 ? '✅' : s.score >= 60 ? '⚠️' : '❌';
        return `• *${s.nome}*: ${s.producaoRealizada ?? 0}/${s.producaoPlanejada ?? 0} pçs — ${s.score}% ${emoji}`;
    }).join('\n');

    return (
        `📊 *Meu Canal — Performance*\n` +
        `Olá, ${nome}!\n\n` +
        `${linhas}`
    );
}

function msgAvisoPpapGits({ pedido, item, produto, recurso, usuario, quantidade }) {
    return (
        `🚨 *Aviso PPAP/Gits: Avanço de Operação*\n\n` +
        `Pedido/Item: *${pedido} / ${item}*\n` +
        `Produto: *${produto}*\n\n` +
        `O usuário *${usuario}* finalizou um apontamento no recurso *${recurso}* (Qtd: ${quantidade}).\n` +
        `O produto está sendo liberado e enviado para a próxima operação.`
    );
}

module.exports = { sendText, normalizePhone, logEmailSent, msgNovaFaturamento, msgFaturamentoPendente, msgMeuCanal, msgAvisoPpapGits };
