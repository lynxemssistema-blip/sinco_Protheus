const mysqlPool = require('../services/mysqlService');
const { sendText } = require('../services/whatsapp');
const { getCorporateEmailTemplate } = require('./emailTemplate');

// Caches user phones to avoid spamming the database
const userPhoneCache = {};
// Avoid sending the same error to the same user repeatedly (rate limiting)
const lastErrorSent = {};

const SUPORTE_GROUP_ID = '120363360408453443@g.us'; // O ID do grupo pode ser descoberto enviando uma msg ao agent, mas para garantir, enviaremos apenas ao usuário e tentaremos mandar ao grupo se tivermos o JID ou usaremos logs. Para Evolution, o JID do grupo costuma ser dinâmico. 
// Para contornar e enviar ao "Agente", vamos enviar apenas ao Usuário com a persona do agente, que foi exatamente o que o solicitante pediu: "localize o usuario e responda o usuario o que a lynx esta fazendo..."

async function handleSystemError(req, errorBody) {
    try {
        if (!req.user || !req.user.id) return; // Erro anônimo
        
        const userId = req.user.id;
        const now = Date.now();

        // Evita spam (limite de 1 mensagem de erro por usuário a cada 5 minutos)
        if (lastErrorSent[userId] && (now - lastErrorSent[userId] < 5 * 60 * 1000)) {
            return;
        }

        let phone = userPhoneCache[userId];
        let nome = req.user.nome || req.user.login;

        if (!phone) {
            // Busca o whatsapp do usuario no banco
            const [rows] = await mysqlPool.query('SELECT whatsapp, NomeCompleto FROM usuario WHERE idUsuario = ?', [userId]);
            if (rows.length > 0) {
                phone = rows[0].whatsapp;
                nome = rows[0].NomeCompleto || nome;
                if (phone) {
                    userPhoneCache[userId] = phone;
                }
            }
        }

        if (!phone) return; // Sem whatsapp cadastrado, não tem como notificar

        lastErrorSent[userId] = now;

        const erroInfo = typeof errorBody === 'object' ? (errorBody.error || errorBody.message || JSON.stringify(errorBody)) : errorBody;
        const rota = req.originalUrl;
        const stringErro = String(erroInfo).substring(0, 500);

        // Salvar o erro no banco para a Lista de Erros (Settings)
        try {
            await mysqlPool.query(`
                CREATE TABLE IF NOT EXISTS app_system_errors (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    route VARCHAR(255) NOT NULL,
                    error_details TEXT,
                    status ENUM('Pendente', 'Resolvido', 'Cancelado') DEFAULT 'Pendente',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    resolved_at DATETIME NULL,
                    resolved_by INT NULL
                )
            `);
            await mysqlPool.query(
                `INSERT INTO app_system_errors (user_id, route, error_details, status) VALUES (?, ?, ?, 'Pendente')`,
                [userId, rota, stringErro]
            );
        } catch(dbErr) {
            console.error('[AI Suporte Error Tracker] Erro ao salvar log no banco:', dbErr.message);
        }

        const msgToUser = `🤖 *Suporte Lynx - Detecção Automática*\n\nOlá, *${nome}*.\n\nIdentifiquei que você encontrou um erro no sistema ao tentar acessar a funcionalidade:\n👉 _${rota}_\n\n*Detalhe técnico:* ${stringErro.substring(0, 100)}...\n\nFique tranquilo(a)! Já registrei este problema na nossa Lista de Erros e um programador da Lynx já foi acionado para analisar a causa e deixar o app mais completo e robusto.\n\nVocê poderá acompanhar a resolução desse erro.`;

        // Usa a instancia do suporte para disparar a mensagem!
        await sendText(phone, msgToUser, 'Notificação Automática de Erro do Sistema - IA Lynx');

        console.log(`[AI Suporte Error Tracker] Erro salvo no DB e notificação enviada para ${nome} (${phone}) sobre a rota ${rota}`);

    } catch (err) {
        console.error('[AI Suporte Error Tracker] Falha ao processar erro de sistema:', err.message);
    }
}

module.exports = { handleSystemError };
