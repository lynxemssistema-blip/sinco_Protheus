const express = require('express');
const router = express.Router();
const db = require('../services/mysqlService');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { authenticateToken: authMiddleware } = require('./auth'); // Utilizando middleware de autenticação existente
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.get('/catalog', authMiddleware, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM app_protheus_query_catalog ORDER BY file_source');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/chat', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const [rows] = await db.query('SELECT * FROM app_protheus_study_chat WHERE user_id = ? ORDER BY created_at ASC', [userId]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/chat', authMiddleware, async (req, res) => {
    try {
        const { message } = req.body;
        const userId = req.user.id;

        if (!message) return res.status(400).json({ error: "Mensagem vazia." });

        // Salvar a mensagem do usuário
        await db.execute('INSERT INTO app_protheus_study_chat (user_id, role, message) VALUES (?, ?, ?)', [userId, 'user', message]);

        // Carregar as consultas para contexto
        const [catalog] = await db.query('SELECT file_source, sql_content FROM app_protheus_query_catalog');
        let contextText = "CATÁLOGO DE CONSULTAS SQL DO PROTHEUS DA METALFISA:\\n\\n";
        catalog.forEach(item => {
            contextText += `--- Arquivo: ${item.file_source} ---\\n${item.sql_content}\\n\\n`;
        });

        // Configurar Gemini
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.0-flash",
            systemInstruction: `Você é um engenheiro de dados sênior e especialista em ADVPL e banco de dados Protheus da MetalFisa.\\nSeu ÚNICO propósito é explicar, analisar e detalhar as consultas SQL utilizadas no sistema para que outro programador possa consultar e usá-las como referência.\\nVocê DEVE usar estritamente o catálogo de consultas abaixo como base da verdade.\\nNUNCA invente tabelas ou campos que não existam nesse contexto ou no padrão Protheus.\\nNUNCA alucine.\\nResponda apenas perguntas pertinentes ao contexto Protheus ou SQL.\\nAs respostas devem ser instrutivas, claras e precisas em Português do Brasil.\\n\\n${contextText}`
        });

        // Recuperar histórico
        const [history] = await db.query(`
            SELECT role, message 
            FROM (
                SELECT role, message, created_at 
                FROM app_protheus_study_chat 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT 15
            ) as sub
            ORDER BY created_at ASC
        `, [userId]);
        
        const formatRole = (r) => r === 'assistant' ? 'model' : 'user';
        const rawHistory = history.map(h => ({
            role: formatRole(h.role),
            text: h.message
        }));

        rawHistory.pop(); // Remove a última (pois será enviada agora no sendMessage)

        const chatHistory = [];
        for (const msg of rawHistory) {
            if (chatHistory.length === 0) {
                if (msg.role === 'user') {
                    chatHistory.push({ role: 'user', parts: [{ text: msg.text }] });
                }
            } else {
                const lastMsg = chatHistory[chatHistory.length - 1];
                if (lastMsg.role === msg.role) {
                    lastMsg.parts[0].text += `\n\n${msg.text}`;
                } else {
                    chatHistory.push({ role: msg.role, parts: [{ text: msg.text }] });
                }
            }
        }

        let finalMessageToSend = message;
        if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user') {
            const unansweredUserMsg = chatHistory.pop();
            finalMessageToSend = unansweredUserMsg.parts[0].text + "\n\n" + finalMessageToSend;
        }

        const chat = model.startChat({
            history: chatHistory
        });

        const result = await chat.sendMessage(finalMessageToSend);
        const responseText = result.response.text();

        // Salvar a resposta do assistente
        await db.execute('INSERT INTO app_protheus_study_chat (user_id, role, message) VALUES (?, ?, ?)', [userId, 'assistant', responseText]);

        res.json({ response: responseText });
    } catch (err) {
        console.error(err);
        if (err.message && err.message.includes('404 Not Found')) {
            return res.status(500).json({ error: "Erro de permissão na Chave do Gemini: O modelo 'gemini-1.5-flash' não está habilitado ou não foi encontrado para esta API Key. Por favor, verifique se seu projeto no Google Cloud possui a 'Generative Language API' ativa ou se a chave informada suporta modelos v1beta." });
        }
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
