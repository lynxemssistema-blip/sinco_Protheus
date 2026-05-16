const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const imaps = require('imap-simple');
const simpleParser = require('mailparser').simpleParser;
const mysqlPool = require('../services/mysqlService');
const { requirePermission } = require('../middlewares/rbac');
const multer = require('multer');
const { getCorporateEmailTemplate } = require('../utils/emailTemplate');

// Usaremos a memória temporária para anexos antes de disparar o SMTP
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const IMAP_CONFIG = {
    imap: {
        user: 'sincometal@metalfisa.com.br',
        password: 'Pro1042@sm',
        host: 'imap.task.com.br',
        port: 143,
        tls: false,
        authTimeout: 10000
    }
};

const SMTP_CONFIG = {
    host: 'smtp.task.com.br',
    port: 587,
    secure: false, // 587 geralmente usa STARTTLS
    auth: {
        user: 'sincometal@metalfisa.com.br',
        pass: 'Pro1042@sm'
    },
    tls: {
        rejectUnauthorized: false
    }
};

// --- MIGRATION (Auto-run) ---
(async () => {
    try {
        const conn = await mysqlPool.getConnection();
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS app_emails (
                id INT AUTO_INCREMENT PRIMARY KEY,
                uid INT NULL,
                message_id VARCHAR(255) NULL,
                folder VARCHAR(50) DEFAULT 'INBOX',
                sender_name VARCHAR(150),
                sender_email VARCHAR(150),
                recipient_email TEXT,
                subject VARCHAR(255),
                body_text LONGTEXT,
                body_html LONGTEXT,
                has_attachments BOOLEAN DEFAULT FALSE,
                date DATETIME,
                read_status BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_folder (folder),
                INDEX idx_uid (uid),
                INDEX idx_date (date)
            )
        `);
        console.log('✅ [Email Service] Tabela de Auditoria app_emails verificada/criada.');
        conn.release();
    } catch (err) {
        console.error('⚠️ [Email Service] Erro ao criar tabela app_emails:', err.message);
    }
})();

// --- ROTA: ENVIAR EMAIL (SMTP) e GRAVAR NO HISTÓRICO ---
router.post('/send', authenticateAndCheckPerm('email', 'create'), upload.array('attachments'), async (req, res) => {
    try {
        const { to, subject, html, text } = req.body;
        const files = req.files || [];

        const transporter = nodemailer.createTransport(SMTP_CONFIG);

        const mailOptions = {
            from: '"MetalFisa ERP" <sincometal@metalfisa.com.br>',
            to,
            subject: subject || 'Sem Assunto',
            text: text || '',
            html: getCorporateEmailTemplate(html || ''),
            attachments: files.map(f => ({
                filename: f.originalname,
                content: f.buffer
            }))
        };

        const info = await transporter.sendMail(mailOptions);

        // Record outgoing email in MySQL History
        await mysqlPool.execute(
            `INSERT INTO app_emails (message_id, folder, sender_name, sender_email, recipient_email, subject, body_text, body_html, has_attachments, date)
             VALUES (?, 'SENT', ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                info.messageId || null,
                'MetalFisa ERP',
                'sincometal@metalfisa.com.br',
                to,
                subject || 'Sem Assunto',
                text || '',
                html || '',
                files.length > 0 ? 1 : 0
            ]
        );

        res.json({ message: 'E-mail enviado e registrado no Histórico!', messageId: info.messageId });
    } catch (err) {
        console.error('[SMTP] Erro ao enviar e-mail:', err);
        res.status(500).json({ error: 'Erro ao enviar e-mail: ' + err.message });
    }
});

// --- ROTA: LER E SINCRONIZAR A CAIXA DE ENTRADA (IMAP) ---
router.get('/inbox', authenticateAndCheckPerm('email', 'read'), async (req, res) => {
    try {
        const connection = await imaps.connect(IMAP_CONFIG);
        await connection.openBox('INBOX');

        // Fetch unseen or recent emails (Last 3 days or fetch UID)
        const fetchOptions = {
            bodies: [''], // Fetch entire raw message
            struct: true,
            markSeen: false
        };

        // Get max UID from our Database to only fetch new ones
        const [dbRows] = await mysqlPool.query("SELECT MAX(uid) as maxUid FROM app_emails WHERE folder = 'INBOX'");
        const maxDbUid = dbRows[0].maxUid || 0;

        // Search logic: messages with UID > maxDbUid
        const searchCriteria = [['UID', (maxDbUid + 1) + ':*']];
        let newMessages = [];

        try {
            newMessages = await connection.search(searchCriteria, fetchOptions);
        } catch (e) {
            console.warn('[IMAP] Sem novas mensagens na varredura incrementada.');
        }

        for (const msg of newMessages) {
            try {
                const uid = msg.attributes.uid;
                const date = msg.attributes.date;
                
                // Extrai todo o corpo bruto do array msg.parts
                const rawPart = msg.parts.find(p => p.which === '');
                if (!rawPart || !rawPart.body) continue;
                
                let parsed;
                try {
                    parsed = await simpleParser(rawPart.body);
                } catch(e) { continue; } // ignore unparseable 

                if (!parsed) continue;

                // Extract Fields
                const subject = parsed.subject || '(Sem Assunto)';
                const senderEmail = parsed.from?.value[0]?.address || '';
                const senderName = parsed.from?.value[0]?.name || senderEmail;
                const messageId = parsed.messageId;
                const bodyText = parsed.text || '';
                const bodyHtml = parsed.html || '';
                const hasAttachments = parsed.attachments?.length > 0 ? 1 : 0;
                
                // Avoid Database Duplicates manually
                const [dup] = await mysqlPool.execute("SELECT id FROM app_emails WHERE uid = ? AND folder = 'INBOX'", [uid]);
                if (dup.length === 0) {
                     await mysqlPool.execute(
                        `INSERT INTO app_emails (uid, message_id, folder, sender_name, sender_email, subject, body_text, body_html, has_attachments, date, read_status)
                         VALUES (?, ?, 'INBOX', ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [uid, messageId, senderName, senderEmail, subject, bodyText, bodyHtml, hasAttachments, new Date(date), 0]
                    );
                }
            } catch(e) {
                console.error('[IMAP-PARSE] Erro ao extrair mensagem individual UID', msg.attributes?.uid, e.message);
            }
        }
        
        connection.end();

        // Finalmente, retorna os e-mails mais recentes direto do Histórico Local (Auditoria)
        const [history] = await mysqlPool.execute(
            `SELECT id, uid, folder, sender_name, sender_email, recipient_email, subject, has_attachments, date, read_status, created_at 
             FROM app_emails 
             ORDER BY date DESC LIMIT 60`
        );
        
        res.json({ success: true, count: history.length, data: history });
    } catch (err) {
        console.error('[IMAP ERROR]', err);
        // Em caso de falha de conexão do IMAP, retorne o Cache do MySQL de qualquer forma
        const [history] = await mysqlPool.execute(`SELECT id, uid, folder, sender_name, sender_email, recipient_email, subject, has_attachments, date, read_status, created_at FROM app_emails ORDER BY date DESC LIMIT 60`);
        res.json({ success: false, error: 'Falha ao sincronizar com servidor IMAP Task. Exibindo Cópia Local. ' + err.message, data: history });
    }
});

// --- ROTA: LER E-MAIL ESPECÍFICO (CORPO html/text) ---
router.get('/message/:id', authenticateAndCheckPerm('email', 'read'), async (req, res) => {
    try {
        const [rows] = await mysqlPool.execute("SELECT * FROM app_emails WHERE id = ?", [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'E-mail não encontrado no histórico' });
        
        // Marca como lido
        if (!rows[0].read_status && rows[0].folder === 'INBOX') {
             await mysqlPool.execute("UPDATE app_emails SET read_status = 1 WHERE id = ?", [req.params.id]);
             rows[0].read_status = 1;
        }

        res.json(rows[0]);
    } catch(err) {
        res.status(500).json({error: err.message});
    }
});

function authenticateAndCheckPerm(page, action) {
    // Custom wrapper para nao crashar o boot caso a permissao nao seja perfeitamente validada agora.
    // Ele aproveita o middleware rbac normal:
    return requirePermission(page, action);
}

module.exports = router;
