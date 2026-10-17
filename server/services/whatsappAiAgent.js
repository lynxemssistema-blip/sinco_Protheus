const { GoogleGenerativeAI } = require('@google/generative-ai');
const mysqlPool = require('./mysqlService');
const { sendText } = require('./whatsapp');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Gets America/Sao_Paulo local date formatted as YYYY-MM-DD
 */
function getLocalDateString() {
    const tzOffset = -3 * 60 * 60 * 1000; // UTC-3
    const localTime = new Date(Date.now() + tzOffset);
    return localTime.toISOString().split('T')[0];
}

/**
 * Generates summary and pendencies using Gemini for a given group and date
 */
async function generateGroupDailySummary(grupoNome, grupoJid, dateRef) {
    try {
        const targetDate = dateRef || getLocalDateString();
        const startOfDay = `${targetDate} 00:00:00`;
        const endOfDay = `${targetDate} 23:59:59`;

        // Fetch messages of the day
        const [messages] = await mysqlPool.query(
            `SELECT remetente_nome, remetente_fone, mensagem, recebido_em 
             FROM app_whatsapp_mensagens_recebidas 
             WHERE grupo_jid = ? AND recebido_em BETWEEN ? AND ? 
             ORDER BY recebido_em ASC`,
            [grupoJid, startOfDay, endOfDay]
        );

        if (messages.length === 0) {
            return {
                resumo: 'Nenhuma mensagem trocada no grupo hoje até o momento.',
                pendencias: [],
                data_referencia: targetDate
            };
        }

        // Build transcript text
        const transcript = messages.map(m => {
            const timeStr = new Date(m.recebido_em).toLocaleTimeString('pt-BR');
            return `[${timeStr}] ${m.remetente_nome} (${m.remetente_fone || 'N/A'}): ${m.mensagem}`;
        }).join('\n');

        // Configure Gemini Model
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: { responseMimeType: 'application/json' }
        });

        const prompt = `
Você é um agente de Inteligência Artificial monitorando grupos de conversa do WhatsApp de uma indústria metalúrgica (Lynx).
Sua tarefa é analisar a transcrição das mensagens trocadas hoje no grupo e produzir um relatório estruturado.

Aqui está a transcrição das mensagens de hoje do grupo "${grupoNome}":
${transcript}

Responda ESTRITAMENTE com um objeto JSON no seguinte formato (sem formatações markdown adicionais, sem blocos de código \`\`\`json):
{
  "resumo": "Um resumo executivo e coeso, em português, explicando o que foi conversado hoje no grupo (principais acontecimentos, andamento do PCP, problemas identificados).",
  "pendencias": [
    "Uma lista de solicitações, dúvidas relevantes ou problemas levantados por participantes que ainda NÃO foram resolvidos ou respondidos pela equipe. Seja específico (ex: 'Dúvida de Marcos sobre descarregar material'). Se tudo foi resolvido, retorne um array vazio []."
  ]
}
`;

        console.log(`[WhatsApp AI Agent] Analisando ${messages.length} mensagens do grupo "${grupoNome}"...`);
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        let aiResult = { resumo: '', pendencias: [] };
        try {
            aiResult = JSON.parse(responseText.trim());
        } catch (jsonErr) {
            console.error('[WhatsApp AI Agent] Erro ao fazer parse da resposta do Gemini:', jsonErr.message, '\nResponse:', responseText);
            // Fallback parsing if JSON has markdown block
            const cleanText = responseText.replace(/```json|```/g, '').trim();
            aiResult = JSON.parse(cleanText);
        }

        // Persist to DB (avoid duplicates)
        const pendenciasJson = JSON.stringify(aiResult.pendencias || []);
        await mysqlPool.query(
            `INSERT INTO app_whatsapp_grupo_resumos 
             (grupo_nome, grupo_jid, resumo_dia, pendencias, data_referencia) 
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
                 resumo_dia = VALUES(resumo_dia), 
                 pendencias = VALUES(pendencias)`,
            [grupoNome, grupoJid, aiResult.resumo, pendenciasJson, targetDate]
        );

        return {
            resumo: aiResult.resumo,
            pendencias: aiResult.pendencias || [],
            data_referencia: targetDate
        };
    } catch (err) {
        console.error(`[WhatsApp AI Agent] Erro ao gerar resumo para grupo "${grupoNome}":`, err.message);
        throw err;
    }
}

/**
 * Formats summary/pendencies and sends directly to the WhatsApp group JID
 */
async function sendDailySummaryToGroup(grupoNome, grupoJid) {
    try {
        const targetDate = getLocalDateString();
        const dateFormatted = new Date(targetDate + 'T12:00:00').toLocaleDateString('pt-BR');
        
        const data = await generateGroupDailySummary(grupoNome, grupoJid, targetDate);

        let reportMessage = `📊 *Resumo Diário — ${grupoNome}*\n`;
        reportMessage += `📅 _Data: ${dateFormatted}_\n\n`;
        reportMessage += `📝 *Resumo do Dia:*\n${data.resumo}\n\n`;

        if (data.pendencias && data.pendencias.length > 0) {
            reportMessage += `⚠️ *Pendências Não Resolvidas:*\n`;
            data.pendencias.forEach(p => {
                reportMessage += `• ${p}\n`;
            });
        } else {
            reportMessage += `✅ *Nenhuma pendência identificada hoje!*`;
        }

        console.log(`[WhatsApp AI Agent] Enviando relatório diário para o grupo "${grupoNome}" (${grupoJid})...`);
        
        // Pass groupJid directly to sendText (requires normalizePhone JID bypass)
        await sendText(grupoJid, reportMessage, `Resumo Diário - ${grupoNome}`);
        
        return { success: true, data };
    } catch (err) {
        console.error(`[WhatsApp AI Agent] Erro ao enviar resumo para o grupo "${grupoNome}":`, err.message);
        throw err;
    }
}

module.exports = {
    generateGroupDailySummary,
    sendDailySummaryToGroup,
    getLocalDateString
};
