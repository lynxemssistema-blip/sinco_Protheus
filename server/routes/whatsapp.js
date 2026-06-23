const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const whatsappAiAgent = require('../services/whatsappAiAgent');

(async () => {
    try {
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_whatsapp_grupo_resumos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                grupo_nome VARCHAR(191) NOT NULL,
                grupo_jid VARCHAR(191) NOT NULL,
                resumo_dia TEXT,
                pendencias TEXT,
                data_referencia DATE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_grupo_data (grupo_jid, data_referencia)
            )
        `);
    } catch (e) {
        console.error('[WhatsApp Monitor] Erro ao criar tabela app_whatsapp_grupo_resumos:', e.message);
    }
})();

/**
 * GET /api/whatsapp/logs
 * Histórico unificado: email (SENT) + WhatsApp
 * Query params: channel=all|email|whatsapp  limit  offset
 */
router.get('/logs', async (req, res) => {
    try {
        const channel = req.query.channel || 'all';
        const limit   = Math.min(parseInt(req.query.limit  || '100'), 500);
        const offset  = parseInt(req.query.offset || '0');

        let rows = [], total = 0;

        if (channel === 'whatsapp') {
            [[{ total }]] = await mysqlPool.query('SELECT COUNT(*) AS total FROM app_whatsapp_logs');
            [rows] = await mysqlPool.query(
                `SELECT id, 'whatsapp' AS channel, recipient AS recipient, subject,
                        message AS body_preview, status, error_info, sent_at AS sent_at
                 FROM app_whatsapp_logs ORDER BY sent_at DESC LIMIT ? OFFSET ?`,
                [limit, offset]
            );
        } else if (channel === 'email') {
            [[{ total }]] = await mysqlPool.query(`SELECT COUNT(*) AS total FROM app_emails WHERE folder = 'SENT'`);
            [rows] = await mysqlPool.query(
                `SELECT id, 'email' AS channel, recipient_email AS recipient, subject,
                        SUBSTRING(COALESCE(body_text, body_html), 1, 200) AS body_preview,
                        'ok' AS status, NULL AS error_info, COALESCE(date, created_at) AS sent_at
                 FROM app_emails WHERE folder = 'SENT' ORDER BY sent_at DESC LIMIT ? OFFSET ?`,
                [limit, offset]
            );
        } else {
            // UNION das duas tabelas
            [[{ total }]] = await mysqlPool.query(`
                SELECT COUNT(*) AS total FROM (
                    SELECT id FROM app_whatsapp_logs
                    UNION ALL
                    SELECT id FROM app_emails WHERE folder = 'SENT'
                ) t
            `);
            [rows] = await mysqlPool.query(
                `SELECT id, 'whatsapp' AS channel, recipient, subject,
                        message AS body_preview, status, error_info, sent_at
                 FROM app_whatsapp_logs
                 UNION ALL
                 SELECT id, 'email' AS channel, recipient_email AS recipient, subject,
                        SUBSTRING(COALESCE(body_text, body_html), 1, 200) AS body_preview,
                        'ok' AS status, NULL AS error_info, COALESCE(date, created_at) AS sent_at
                 FROM app_emails WHERE folder = 'SENT'
                 ORDER BY sent_at DESC LIMIT ? OFFSET ?`,
                [limit, offset]
            );
        }

        res.json({ total, rows });
    } catch (err) {
        console.error('[Notificações] Erro ao buscar histórico:', err);
        res.status(500).json({ error: 'Erro ao buscar histórico' });
    }
});

const axios = require('axios');

const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY  = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

// --- Monitored Groups Endpoints ---

// 1. GET /api/whatsapp/grupos
// Lists all registered monitored groups
router.get('/grupos', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(
            'SELECT id, grupo_nome, grupo_jid, created_at FROM app_whatsapp_grupos_monitorados ORDER BY grupo_nome ASC'
        );
        res.json(rows);
    } catch (err) {
        console.error('[WhatsApp Monitor] Erro ao listar grupos:', err);
        res.status(500).json({ error: 'Erro ao listar grupos' });
    }
});

// 2. POST /api/whatsapp/grupos
// Registers a new group to monitor and tries to resolve its JID from Evolution API
router.post('/grupos', async (req, res) => {
    try {
        const { grupo_nome } = req.body;
        if (!grupo_nome) {
            return res.status(400).json({ error: 'O nome do grupo é obrigatório.' });
        }

        let grupo_jid = null;
        try {
            if (BASE_URL && API_KEY && INSTANCE) {
                const searchUrl = `${BASE_URL}/group/fetchAllGroups/${encodeURIComponent(INSTANCE)}?getParticipants=false`;
                const response = await axios.get(searchUrl, {
                    headers: { apikey: API_KEY }
                });
                const groups = response.data || [];
                const match = groups.find(g => 
                    (g.subject && g.subject.toLowerCase() === grupo_nome.toLowerCase()) || 
                    (g.name && g.name.toLowerCase() === grupo_nome.toLowerCase())
                );
                if (match) {
                    grupo_jid = match.id || match.jid;
                }
            }
        } catch (apiErr) {
            console.warn('[WhatsApp Monitor] Não foi possível buscar JID na Evolution API:', apiErr.message);
        }

        const [result] = await mysqlPool.query(
            'INSERT INTO app_whatsapp_grupos_monitorados (grupo_nome, grupo_jid) VALUES (?, ?)',
            [grupo_nome, grupo_jid]
        );
        
        res.status(201).json({
            success: true,
            id: result.insertId,
            grupo_nome,
            grupo_jid,
            message: 'Grupo registrado para monitoramento com sucesso.'
        });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Este grupo já está cadastrado.' });
        }
        console.error('[WhatsApp Monitor] Erro ao cadastrar grupo:', err);
        res.status(500).json({ error: 'Erro ao cadastrar grupo.' });
    }
});

// 3. DELETE /api/whatsapp/grupos/:id
// Removes a group from monitoring
router.delete('/grupos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await mysqlPool.query(
            'DELETE FROM app_whatsapp_grupos_monitorados WHERE id = ?',
            [id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Grupo não encontrado.' });
        }
        res.json({ success: true, message: 'Grupo removido do monitoramento.' });
    } catch (err) {
        console.error('[WhatsApp Monitor] Erro ao remover grupo:', err);
        res.status(500).json({ error: 'Erro ao remover grupo.' });
    }
});

// 4. GET /api/whatsapp/grupos/:grupo_nome/mensagens
// Gets messages received for a specific group (ordered by recebido_em DESC, default limit 100)
router.get('/grupos/:grupo_nome/mensagens', async (req, res) => {
    try {
        const { grupo_nome } = req.params;
        const limit = Math.min(parseInt(req.query.limit || '100'), 500);
        const [rows] = await mysqlPool.query(
            `SELECT id, grupo_nome, grupo_jid, remetente_nome, remetente_fone, mensagem, tipo_midia, midia_url, recebido_em, id_mensagem
             FROM app_whatsapp_mensagens_recebidas
             WHERE grupo_nome = ?
             ORDER BY recebido_em DESC LIMIT ?`,
            [grupo_nome, limit]
        );
        // Return in chronological order (oldest at top, newest at bottom for chat feel)
        res.json(rows.reverse());
    } catch (err) {
        console.error('[WhatsApp Monitor] Erro ao buscar mensagens do grupo:', err);
        res.status(500).json({ error: 'Erro ao buscar mensagens.' });
    }
});

// 5. POST /api/whatsapp/grupos/:grupo_nome/sync
// Syncs chat history for the group from Evolution API
router.post('/grupos/:grupo_nome/sync', async (req, res) => {
    try {
        const { grupo_nome } = req.params;
        
        // Find the group to get the JID
        const [[group]] = await mysqlPool.query(
            'SELECT grupo_jid FROM app_whatsapp_grupos_monitorados WHERE grupo_nome = ?',
            [grupo_nome]
        );
        
        if (!group || !group.grupo_jid) {
            return res.status(400).json({ error: 'Grupo não cadastrado ou JID não resolvido.' });
        }
        
        const JID = group.grupo_jid;
        
        if (!BASE_URL || !API_KEY || !INSTANCE) {
            return res.status(400).json({ error: 'Configurações da Evolution API incompletas no servidor.' });
        }
        
        // Fetch messages from Evolution API
        // Endpoint: POST /chat/findMessages/{instance}
        const searchUrl = `${BASE_URL}/chat/findMessages/${encodeURIComponent(INSTANCE)}`;
        
        const response = await axios.post(searchUrl, {
            where: {
                key: {
                    remoteJid: JID
                }
            },
            limit: 50
        }, {
            headers: { apikey: API_KEY }
        });
        
        const messages = 
            response.data?.messages?.response?.records ||
            response.data?.response?.records ||
            response.data?.messages?.records ||
            response.data?.records ||
            (Array.isArray(response.data) ? response.data : []) ||
            [];
        let count = 0;
        
        for (const raw of messages) {
            const key = raw.key || {};
            const messageId = key.id;
            if (!messageId) continue;
            
            // Skip messages from the bot itself to only log client interactions
            if (key.fromMe) continue;
            
            const remetenteFone = (key.participant || raw.participant || '').split('@')[0] || null;
            const pushName = raw.pushName || 'Desconhecido';
            
            // Extract text
            let text = '';
            let tipoMidia = 'text';
            const msgObj = raw.message || {};
            
            let midiaUrl = null;
            if (msgObj.conversation) {
                text = msgObj.conversation;
            } else if (msgObj.extendedTextMessage && msgObj.extendedTextMessage.text) {
                text = msgObj.extendedTextMessage.text;
            } else if (msgObj.imageMessage) {
                text = msgObj.imageMessage.caption || '[Imagem]';
                tipoMidia = 'image';
                
                try {
                    console.log(`[WhatsApp Monitor Sync] Baixando imagem da mensagem ${messageId}...`);
                    const base64Res = await axios.post(
                        `${BASE_URL}/chat/getBase64FromMediaMessage/${encodeURIComponent(INSTANCE)}`,
                        { message: raw },
                        { headers: { apikey: API_KEY } }
                    );
                    const base64Data = base64Res.data?.base64;
                    if (base64Data) {
                        const path = require('path');
                        const fs = require('fs');
                        const uploadDir = path.join(__dirname, '../uploads/whatsapp');
                        if (!fs.existsSync(uploadDir)) {
                            fs.mkdirSync(uploadDir, { recursive: true });
                        }
                        const fileName = `${messageId}.jpg`;
                        const filePath = path.join(uploadDir, fileName);
                        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
                        midiaUrl = fileName;
                        console.log(`[WhatsApp Monitor Sync] Imagem salva com sucesso em: ${filePath}`);
                    }
                } catch (mediaErr) {
                    console.error(`[WhatsApp Monitor Sync] Erro ao obter mídia da mensagem ${messageId}:`, mediaErr.message);
                }
            }
            
            if (!text && tipoMidia === 'text') continue;
            
            const msgDate = raw.messageTimestamp ? new Date(raw.messageTimestamp * 1000) : new Date();

            // Save to DB (avoid duplicates, but update midia_url if new)
            await mysqlPool.query(
                `INSERT INTO app_whatsapp_mensagens_recebidas 
                 (grupo_nome, grupo_jid, remetente_nome, remetente_fone, mensagem, tipo_midia, id_mensagem, recebido_em, midia_url)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE midia_url = VALUES(midia_url)`,
                [
                    grupo_nome,
                    JID,
                    pushName,
                    remetenteFone,
                    text,
                    tipoMidia,
                    messageId,
                    msgDate,
                    midiaUrl
                ]
            );
            count++;
        }
        
        res.json({ success: true, message: `Sincronização concluída. ${count} mensagens processadas.`, count });
    } catch (err) {
        console.error('[WhatsApp Monitor] Erro ao sincronizar histórico:', err.message);
        res.status(500).json({ error: `Erro ao sincronizar com a Evolution API: ${err.message}` });
    }
});

// 6. GET /api/whatsapp/grupos/:grupo_jid/resumo
// Fetch summary/pendencies of the group for today (calculates in real-time if not cached)
router.get('/grupos/:grupo_jid/resumo', async (req, res) => {
    try {
        const { grupo_jid } = req.params;
        const todayStr = whatsappAiAgent.getLocalDateString();

        // 1. Check DB Cache
        const [[cached]] = await mysqlPool.query(
            'SELECT resumo_dia, pendencias, data_referencia FROM app_whatsapp_grupo_resumos WHERE grupo_jid = ? AND data_referencia = ?',
            [grupo_jid, todayStr]
        );

        if (cached) {
            return res.json({
                resumo: cached.resumo_dia,
                pendencias: JSON.parse(cached.pendencias || '[]'),
                data_referencia: cached.data_referencia,
                cached: true
            });
        }

        // 2. Not cached: find group name to compute real-time
        const [[group]] = await mysqlPool.query(
            'SELECT grupo_nome FROM app_whatsapp_grupos_monitorados WHERE grupo_jid = ?',
            [grupo_jid]
        );
        if (!group) {
            return res.status(404).json({ error: 'Grupo não encontrado.' });
        }

        // 3. Compute real-time analysis (but do not send to WhatsApp group)
        const summaryData = await whatsappAiAgent.generateGroupDailySummary(group.grupo_nome, grupo_jid, todayStr);
        res.json({
            ...summaryData,
            cached: false
        });
    } catch (err) {
        console.error('[WhatsApp Monitor AI] Erro ao buscar resumo do grupo:', err.message);
        res.status(500).json({ error: `Erro ao gerar resumo com IA: ${err.message}` });
    }
});

// 7. POST /api/whatsapp/grupos/:grupo_jid/resumo/force
// Forces real-time recalculation of the summary/pendencies for today
router.post('/grupos/:grupo_jid/resumo/force', async (req, res) => {
    try {
        const { grupo_jid } = req.params;
        const todayStr = whatsappAiAgent.getLocalDateString();

        const [[group]] = await mysqlPool.query(
            'SELECT grupo_nome FROM app_whatsapp_grupos_monitorados WHERE grupo_jid = ?',
            [grupo_jid]
        );
        if (!group) {
            return res.status(404).json({ error: 'Grupo não encontrado.' });
        }

        const summaryData = await whatsappAiAgent.generateGroupDailySummary(group.grupo_nome, grupo_jid, todayStr);
        res.json({
            success: true,
            ...summaryData
        });
    } catch (err) {
        console.error('[WhatsApp Monitor AI] Erro ao forçar recálculo do resumo:', err.message);
        res.status(500).json({ error: `Erro ao forçar recálculo com IA: ${err.message}` });
    }
});

module.exports = router;
