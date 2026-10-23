const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mysqlPool = require('../services/mysqlService');

// Inicializa a tabela de Inteligência do Agente (Perguntas e Respostas)
(async () => {
    try {
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_ai_qa_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_name VARCHAR(255),
                question TEXT,
                answer TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    } catch (e) {
        console.error('[AI Suporte] Erro ao criar tabela de inteligência (QA):', e.message);
    }
})();

// Config do Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Cache do HelpContent (lê a base de conhecimento dinâmica)
let helpContentText = '';
const potentialPaths = [
    path.join(__dirname, '../../client/src/config/helpContent.js'),
    path.join(__dirname, '../config/helpContent.js'),
    path.join(__dirname, '../../client/dist/helpContent.js')
];
for (const p of potentialPaths) {
    try {
        if (fs.existsSync(p)) {
            helpContentText = fs.readFileSync(p, 'utf8');
            break;
        }
    } catch (_) {}
}

// Histórico de Conversas
const HISTORY_CACHE = {}; 

// GET /api/webhook - Health check e confirmação da URL do Webhook
router.get(['/', '/status', '/suporte-ia', '/evolution'], (req, res) => {
    res.json({
        status: 'ok',
        service: 'Lynx EMS Evolution API Webhook Listener',
        webhook_url: 'https://lynxems.com.br/api/webhook',
        instance: process.env.EVOLUTION_INSTANCE || 'Suporte Lynx',
        timestamp: new Date().toISOString()
    });
});

// POST /api/webhook ou /api/webhook/suporte-ia ou /api/webhook/evolution
router.post(['/', '/suporte-ia', '/evolution'], async (req, res) => {
    try {
        const SUPORTE_INSTANCE = process.env.EVOLUTION_INSTANCE || 'Suporte Lynx';
        const SUPORTE_APIKEY = process.env.EVOLUTION_API_KEY || '1C62EE90D11A-4C75-B1BA-383CDF634A39';

        // Validação de segurança opcional no webhook: se fornecida, valida apikey
        const providedKey = req.headers['apikey'] || req.headers['x-api-key'] || req.query.apikey;
        if (providedKey && SUPORTE_APIKEY && providedKey !== SUPORTE_APIKEY) {
            return res.status(401).json({ error: 'Chave de webhook inválida' });
        }

        const body = req.body;

        // Responde de imediato para webhooks de conexão, status etc.
        if (!body || body.event !== 'messages.upsert') {
            return res.status(200).send('OK');
        }

        const data = body.data;
        if (!data) return res.status(200).send('OK');

        // Verifica configurações globais para saber se o Agente está ativo
        const [configRows] = await mysqlPool.query('SELECT general_config FROM app_company_settings WHERE id = 1');
        if (configRows.length && configRows[0].general_config) {
            const cfg = typeof configRows[0].general_config === 'string' ? JSON.parse(configRows[0].general_config) : configRows[0].general_config;
            if (cfg?.automations?.ai_whatsapp_active === false) {
                // Agente desativado globalmente, apenas ignora a mensagem silenciosamente
                return res.status(200).send('OK');
            }
        }

        
        // Em mensagens de upsert, a Evolution manda o message dentro do object (as vezes varia a versão)
        let msg = data.message;
        let messageKey = data.key || (msg && msg.key);
        
        // Em versões recentes da Evo API, as vezes a message inteira vem no data
        if (!msg && data.conversation) msg = data;
        if (!messageKey && data.remoteJid) messageKey = data;

        if (!messageKey) return res.status(200).send('OK');

        const remoteJid = messageKey.remoteJid;
        const fromMe = messageKey.fromMe;

        // Ignora mensagens enviadas pelo próprio bot ou mensagens de status
        if (fromMe || remoteJid === 'status@broadcast') {
            return res.status(200).send('OK');
        }

        // Ignora respostas privadas (apenas atende grupos)
        if (!remoteJid.endsWith('@g.us')) {
            return res.status(200).send('OK');
        }

        // Ignora mensagens do usuário bloqueado (ex: 31995574906)
        const participant = messageKey.participant || data.participant || '';
        if (participant.includes('31995574906')) {
            return res.status(200).send('OK');
        }

        // Extrai o texto da mensagem (suporta texto puro ou reply)
        let text = '';
        let imagePart = null;

        if (msg) {
            if (msg.conversation) {
                text = msg.conversation;
            } else if (msg.extendedTextMessage && msg.extendedTextMessage.text) {
                text = msg.extendedTextMessage.text;
            } else if (msg.imageMessage) {
                text = msg.imageMessage.caption || 'O usuário enviou uma imagem (print de tela). Analise e relacione com possíveis erros do sistema.';
                try {
                    // Baixa a imagem em Base64 através da Evolution API
                    const base64Res = await axios.post(
                        `${process.env.EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${encodeURIComponent(SUPORTE_INSTANCE)}`,
                        { message: data },
                        { headers: { apikey: SUPORTE_APIKEY } }
                    );
                    const base64Data = base64Res.data.base64;
                    if (base64Data) {
                        imagePart = {
                            inlineData: {
                                data: base64Data,
                                mimeType: msg.imageMessage.mimetype || 'image/jpeg'
                            }
                        };
                    }
                } catch (err) {
                    console.error('[AI Suporte] Erro ao baixar imagem do Evolution:', err.message);
                }
            }
        }
        
        if (!text && !imagePart) return res.status(200).send('OK');

        // Validar estritamente o grupo (Opcional, mas muito útil para segurança)
        try {
            const groupMetadataUrl = `${process.env.EVOLUTION_API_URL}/group/findGroupInfos/${encodeURIComponent(SUPORTE_INSTANCE)}?groupJid=${remoteJid}`;
            const groupMeta = await axios.get(groupMetadataUrl, {
                headers: { apikey: SUPORTE_APIKEY }
            });
            
            const groupSubject = groupMeta.data?.subject || groupMeta.data?.name || groupMeta.data?.subject; 
            
            // Log util para dev
            console.log(`[AI Suporte] Mensagem recebida no grupo: ${groupSubject || 'Desconhecido'} (${remoteJid})`);
            
            if (groupSubject) {
                // Check if this group is registered in our monitored groups table
                const [monitored] = await mysqlPool.query(
                    'SELECT id FROM app_whatsapp_grupos_monitorados WHERE grupo_nome = ? OR grupo_jid = ?',
                    [groupSubject, remoteJid]
                );

                if (monitored.length > 0) {
                    // Update the JID in case it wasn't set yet
                    await mysqlPool.query(
                        'UPDATE app_whatsapp_grupos_monitorados SET grupo_jid = ? WHERE grupo_nome = ? AND grupo_jid IS NULL',
                        [remoteJid, groupSubject]
                    );

                    const messageId = (data.key && data.key.id) || messageKey.id || null;
                    const remetenteFone = (messageKey.participant || data.participant || '').split('@')[0] || null;

                    let midiaUrl = null;
                    if (msg && msg.imageMessage && imagePart && imagePart.inlineData && imagePart.inlineData.data) {
                        try {
                            const uploadDir = path.join(__dirname, '../uploads/whatsapp');
                            if (!fs.existsSync(uploadDir)) {
                                fs.mkdirSync(uploadDir, { recursive: true });
                            }
                            const fileName = `${messageId || Date.now()}.jpg`;
                            const filePath = path.join(uploadDir, fileName);
                            fs.writeFileSync(filePath, Buffer.from(imagePart.inlineData.data, 'base64'));
                            midiaUrl = fileName;
                            console.log(`[WhatsApp Monitor] Imagem do grupo salva com sucesso em: ${filePath}`);
                        } catch (writeErr) {
                            console.error('[WhatsApp Monitor] Erro ao salvar imagem no disco:', writeErr.message);
                        }
                    }

                    // Save the message
                    await mysqlPool.query(
                        `INSERT INTO app_whatsapp_mensagens_recebidas 
                         (grupo_nome, grupo_jid, remetente_nome, remetente_fone, mensagem, tipo_midia, midia_url, id_mensagem)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE grupo_nome = grupo_nome`,
                        [
                            groupSubject,
                            remoteJid,
                            data.pushName || 'Desconhecido',
                            remetenteFone,
                            text || '[Mídia ou Mensagem Vazia]',
                            (msg && msg.imageMessage) ? 'image' : 'text',
                            midiaUrl,
                            messageId
                        ]
                    );

                    // Broadcast via Socket.io
                    const io = req.app.get('io');
                    if (io) {
                        io.emit('whatsapp_nova_mensagem', {
                            grupo_nome: groupSubject,
                            grupo_jid: remoteJid,
                            remetente_nome: data.pushName || 'Desconhecido',
                            remetente_fone: remetenteFone,
                            mensagem: text || '[Mídia ou Mensagem Vazia]',
                            tipo_midia: (msg && msg.imageMessage) ? 'image' : 'text',
                            midia_url: midiaUrl,
                            recebido_em: new Date(),
                            id_mensagem: messageId
                        });
                    }
                }
            }

            if (groupSubject && groupSubject !== SUPORTE_GROUP_NAME) {
                return res.status(200).send('OK'); // Ignora outros grupos (ou conclui se monitorado)
            }
        } catch (err) {
            console.warn('[AI Suporte] Nao foi possivel validar nome do grupo, prosseguindo por fallback:', err.message);
        }

        const userName = data.pushName || 'Usuário Lynx';

        // Manter o histórico da sessão (limitado as últimas 10 interações)
        if (!HISTORY_CACHE[remoteJid]) HISTORY_CACHE[remoteJid] = [];
        if (HISTORY_CACHE[remoteJid].length > 10) {
            HISTORY_CACHE[remoteJid].splice(0, 2); // Remove oldest user/model pair
        }

        // Buscar inteligência coletiva (últimas 15 perguntas e respostas resolvidas)
        let qaIntelligence = '';
        try {
            const [qaRows] = await mysqlPool.query(`
                SELECT user_name, question, answer 
                FROM app_ai_qa_history 
                ORDER BY created_at DESC 
                LIMIT 15
            `);
            if (qaRows.length > 0) {
                qaIntelligence = "\n\n============= INTELIGÊNCIA COLETIVA (DÚVIDAS RECENTES RESOLVIDAS) =============\n";
                qaIntelligence += "As interações abaixo são dúvidas reais que você já resolveu recentemente para outros usuários. Use-as como contexto se a dúvida atual for semelhante:\n\n";
                // Invertemos para colocar a mais antiga primeiro e a mais recente por último no bloco
                qaRows.reverse().forEach(row => {
                    qaIntelligence += `[Usuário: ${row.user_name}] Perguntou: ${row.question}\n[Você] Respondeu: ${row.answer}\n\n`;
                });
                qaIntelligence += "============= FIM DA INTELIGÊNCIA COLETIVA =============\n";
            }
        } catch (dbErr) {
            console.error('[AI Suporte] Falha ao buscar inteligência coletiva:', dbErr.message);
        }

        // Chama o LLM
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const systemPrompt = `
Você é o Agente de IA do "Suporte do Grupo Lynx". 
Regras OBRIGATÓRIAS:
1. Responda em Português-BR.
2. Seja sempre extremamente educado e profissional, utilizando emojis com moderação. 
3. Sempre que possível, dirija-se ao usuário pelo PRIMEIRO NOME, com muito respeito. O nome completo dele é: ${userName}.
4. Utilize formatação amigável para WhatsApp: listas e *negrito* para destaques.
5. **RESTRIÇÃO TOTAL DE CONTEXTO**: Você foi programado única e exclusivamente para dar suporte e responder sobre o app Lynx SINCO. Se o usuário perguntar ou pedir qualquer coisa que seja fora deste escopo (assuntos gerais, programação, piadas, tradução, clima, etc.), você DEVE educadamente dizer que "sua função é limitada a ajudar com dados e dúvidas de como operar o sistema Lynx SINCO" e se recusar a responder.
6. **Sua única base de inteligência sobre o ERP é o dicionário abaixo e a Inteligência Coletiva**. Não invente funções, rotas ou nomes de telas que não constem no documento.
7. Se o usuário apontar um erro sistêmico que não está na base, oriente a verificar conexão, limpar o cache ou avisar o suporte nível 2.
8. CUIDADO COM LINKS E PERMISSÕES: Se você sugerir um link ou módulo da base de conhecimento, lembre o usuário explicitamente de que ele deve ter permissão de acesso no sistema para abrir a referida página.

============= BASE DE CONHECIMENTO (helpContent.js) =============
${helpContentText}
============= FIM DA BASE DE CONHECIMENTO =============${qaIntelligence}
`;

        const chat = model.startChat({
            history: [
                { role: "user", parts: [{ text: systemPrompt }] },
                { role: "model", parts: [{ text: "Compreendido. Operarei estritamente sob essas diretrizes como Suporte do Grupo Lynx." }] },
                ...HISTORY_CACHE[remoteJid]
            ]
        });

        // Marca que o bot está digitando no WhatsApp
        try {
            await axios.post(`${process.env.EVOLUTION_API_URL}/chat/sendPresence/${encodeURIComponent(SUPORTE_INSTANCE)}`, 
                { number: remoteJid, delay: 15000, presence: "composing" }, 
                { headers: { apikey: SUPORTE_APIKEY, 'Content-Type': 'application/json' } }
            );
        } catch(e) {}

        let msgPayload = text;
        if (imagePart) {
            msgPayload = [text, imagePart];
        }

        const result = await chat.sendMessage(msgPayload);
        let botResponse = result.response.text();

        // Salvar Histórico da Sessão
        HISTORY_CACHE[remoteJid].push({ role: "user", parts: [{ text: text }] });
        HISTORY_CACHE[remoteJid].push({ role: "model", parts: [{ text: botResponse }] });

        // Salvar Histórico Global (Inteligência Coletiva do Agente) no Banco de Dados
        try {
            await mysqlPool.query(
                `INSERT INTO app_ai_qa_history (user_name, question, answer) VALUES (?, ?, ?)`,
                [userName, text.substring(0, 5000), botResponse.substring(0, 5000)]
            );
        } catch (dbErr) {
            console.error('[AI Suporte] Falha ao salvar QA na inteligência coletiva:', dbErr.message);
        }

        // Responde de volta para o grupo
        await axios.post(
            `${process.env.EVOLUTION_API_URL}/message/sendText/${encodeURIComponent(SUPORTE_INSTANCE)}`,
            {
                number: remoteJid,
                text: botResponse,
                delay: 1000 // Atraso humano antes do disparo
            },
            {
                headers: { 
                    apikey: SUPORTE_APIKEY,
                    'Content-Type': 'application/json' 
                }
            }
        );

        res.status(200).send('OK');
    } catch (err) {
        console.error('[AI Suporte Webhook] Erro ao processar msg:', err.message);
        res.status(500).send('Erro Interno');
    }
});

module.exports = router;
