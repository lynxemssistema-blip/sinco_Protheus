const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');

// GET /api/whatsapp/logs — histórico de mensagens enviadas
router.get('/logs', async (req, res) => {
    try {
        const limit  = Math.min(parseInt(req.query.limit  || '200'), 500);
        const offset = parseInt(req.query.offset || '0');

        const [rows] = await mysqlPool.query(
            `SELECT id, recipient, subject, message, status, error_info, sent_at
             FROM app_whatsapp_logs
             ORDER BY sent_at DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        const [[{ total }]] = await mysqlPool.query(
            'SELECT COUNT(*) AS total FROM app_whatsapp_logs'
        );

        res.json({ total, rows });
    } catch (err) {
        console.error('[WhatsApp] Erro ao buscar logs:', err);
        res.status(500).json({ error: 'Erro ao buscar histórico' });
    }
});

module.exports = router;
