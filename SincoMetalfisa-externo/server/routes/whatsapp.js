const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');

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

module.exports = router;
