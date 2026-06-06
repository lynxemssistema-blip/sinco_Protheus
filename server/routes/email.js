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
    secure: false,
    auth: {
        user: 'sincometal@metalfisa.com.br',
        pass: 'Pro1042@sm'
    },
    tls: {
        rejectUnauthorized: false
    },
    connectionTimeout: 30000,   // 30s para conectar ao SMTP
    greetingTimeout:  15000,   // 15s para o EHLO
    socketTimeout:    120000,  // 2min para envio (PDFs grandes)
};

// --- MIGRATION (Auto-run) ---
(async () => {
    try {
        await mysqlPool.query(`
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
    } catch (err) {
        console.error('⚠️ [Email Service] Erro ao criar tabela app_emails:', err.message);
    }
})();

// --- ROTA: ENVIAR EMAIL (SMTP) e GRAVAR NO HISTÓRICO ---
router.post('/send', upload.array('attachments'), async (req, res) => {
    try {
        const { to, subject, html, text, localAttachments } = req.body;
        const files = req.files || [];

        const mailAttachments = files.map(f => ({
            filename: f.originalname,
            content: f.buffer
        }));

        if (localAttachments) {
            const fs = require('fs').promises;
            const path = require('path');
            let pathsArray = [];
            try {
                pathsArray = JSON.parse(localAttachments);
                if (!Array.isArray(pathsArray)) pathsArray = [localAttachments];
            } catch(e) {
                pathsArray = [localAttachments];
            }
            for (const origPath of pathsArray) {
                if (origPath && typeof origPath === 'string') {
                    let filePath = origPath.trim().replace(/^["']+|["']+$/g, '').trim();
                    filePath = filePath.replace(/^Q:[\/\\]/i, '\\\\192.168.1.253\\Engenharia\\');
                    if (process.platform !== 'win32') {
                        filePath = filePath.replace(/\\/g, '/').replace(/^\/\/192\.168\.1\.253\/Engenharia\//i, '/mnt/engenharia/');
                    } else {
                        filePath = filePath.replace(/^\/mnt\/engenharia\//i, '\\\\192.168.1.253\\Engenharia\\').replace(/\//g, '\\');
                    }
                    const absolutePath = require('path').resolve(filePath);
                    try {
                        const fileBuffer = await fs.readFile(absolutePath);
                        mailAttachments.push({ filename: require('path').basename(absolutePath), content: fileBuffer });
                        console.log(`📎 Anexado arquivo local: ${absolutePath}`);
                    } catch(fileErr) {
                        console.error(`⚠️ Falha ao ler anexo local (${absolutePath}):`, fileErr.message);
                    }
                }
            }
        }

        const mailOptions = {
            from: '"MetalFisa ERP" <sincometal@metalfisa.com.br>',
            to,
            subject: subject || 'Sem Assunto',
            text: text || '',
            html: getCorporateEmailTemplate(html || ''),
            attachments: mailAttachments
        };

        // ── Responde imediatamente (202) e envia em background ───────────────
        // Isso evita o timeout do Axios no cliente para PDFs/listas grandes.
        res.status(202).json({ message: 'E-mail em processamento — você será notificado em caso de erro.', async: true });

        // ── Envio assíncrono ─────────────────────────────────────────────────
        setImmediate(async () => {
            try {
                const transporter = nodemailer.createTransport(SMTP_CONFIG);
                const info = await transporter.sendMail(mailOptions);
                console.log(`[SMTP] ✅ E-mail enviado para ${to} | messageId: ${info.messageId}`);

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
                        mailAttachments.length > 0 ? 1 : 0
                    ]
                );
            } catch (bgErr) {
                console.error('[SMTP BG] ❌ Falha ao enviar e-mail em background:', bgErr.message);
            }
        });

    } catch (err) {
        console.error('[SMTP] Erro ao preparar e-mail:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Erro ao preparar e-mail: ' + err.message });
        }
    }
});

// --- ROTA: ENVIAR LOG DE ERRO DO SISTEMA ---
router.post('/system-error', upload.none(), async (req, res) => {
    try {
        const { to, subject, html, text } = req.body;

        const transporter = nodemailer.createTransport(SMTP_CONFIG);

        const mailOptions = {
            from: '"MetalFisa ERP" <sincometal@metalfisa.com.br>',
            to,
            subject: subject || 'Erro no Sistema',
            text: text || '',
            html: getCorporateEmailTemplate(html || '')
        };

        const info = await transporter.sendMail(mailOptions);
        
        await mysqlPool.execute(
            `INSERT INTO app_emails (message_id, folder, sender_name, sender_email, recipient_email, subject, body_text, body_html, has_attachments, date)
             VALUES (?, 'SENT', ?, ?, ?, ?, ?, ?, 0, NOW())`,
            [
                info.messageId || null,
                'Sistema - Logger',
                'sincometal@metalfisa.com.br',
                to,
                subject || 'Erro',
                text || '',
                html || ''
            ]
        );

        res.json({ message: 'Log de erro enviado com sucesso.' });
    } catch (err) {
        console.error('[SMTP ERROR LOG]', err);
        res.status(500).json({ error: err.message });
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

// --- ROTA: HISTÓRICO DE E-MAILS DE RNC ---
router.get('/rnc-history', authenticateAndCheckPerm('relatorio_liberacao', 'view'), async (req, res) => {
    try {
        const { startDate, endDate, search, rncId, product } = req.query;
        let query = `
            SELECT id, uid, message_id, folder, sender_name, sender_email, recipient_email, subject, has_attachments, date, created_at, body_html, body_text
            FROM app_emails
            WHERE folder = 'SENT' AND (subject LIKE '[RNC SGQ]%' OR subject LIKE '%RNC SGQ%')
        `;
        const params = [];

        if (startDate) {
            query += ' AND date >= ?';
            params.push(startDate + ' 00:00:00');
        }
        if (endDate) {
            query += ' AND date <= ?';
            params.push(endDate + ' 23:59:59');
        }
        if (search) {
            query += ' AND (recipient_email LIKE ? OR subject LIKE ? OR sender_name LIKE ?)';
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        query += ' ORDER BY date DESC LIMIT 1000';

        const [emails] = await mysqlPool.execute(query, params);

        // Extract RNC IDs from subjects
        const emailList = emails.map(e => {
            const match = e.subject.match(/\[RNC SGQ\] ID #(\d+)/i);
            const extractedRncId = match ? parseInt(match[1]) : null;
            return {
                ...e,
                rncId: extractedRncId
            };
        });

        // Filter by rncId if requested
        let filteredEmails = emailList;
        if (rncId) {
            filteredEmails = filteredEmails.filter(e => e.rncId === parseInt(rncId));
        }

        // Fetch RNC details for matching RNC IDs
        const rncIds = [...new Set(filteredEmails.map(e => e.rncId).filter(id => id !== null))];
        let rncMap = {};

        if (rncIds.length > 0) {
            const placeholders = rncIds.map(() => '?').join(',');
            const [rncs] = await mysqlPool.execute(`
                SELECT r.*, nc.descricao as nc_descricao, nc.tipo as nc_tipo, nc.gravidade as nc_gravidade 
                FROM app_sgq_rncs r
                LEFT JOIN app_sgq_nao_conformidades nc ON r.nao_conformidade_id = nc.id
                WHERE r.id IN (${placeholders})
            `, rncIds);

            // Fetch drawing files information for these RNCs to show if drawing attached
            const productCodes = [...new Set(rncs.map(r => r.produto).filter(p => p))];
            let docsMap = {};
            if (productCodes.length > 0) {
                const docPlaceholders = productCodes.map(() => '?').join(',');
                const [docs] = await mysqlPool.execute(`
                    SELECT produto_codigo, url_arquivo FROM produtos_docs WHERE produto_codigo IN (${docPlaceholders})
                `, productCodes);
                docs.forEach(d => {
                    if (!docsMap[d.produto_codigo]) docsMap[d.produto_codigo] = [];
                    docsMap[d.produto_codigo].push(d);
                });
            }

            rncs.forEach(r => {
                const docs = docsMap[r.produto] || [];
                r.tem_arquivos = docs.length > 0;
                r.primeiro_arquivo = docs.length > 0 ? docs[0].url_arquivo : null;
                rncMap[r.id] = r;
            });
        }

        // Attach RNC details to each email object
        let result = filteredEmails.map(e => ({
            ...e,
            rnc: e.rncId ? (rncMap[e.rncId] || null) : null
        }));

        // Filter by product technical code if requested
        if (product) {
            result = result.filter(e => e.rnc && e.rnc.produto && e.rnc.produto.toLowerCase().includes(product.toLowerCase()));
        }

        res.json({ success: true, count: result.length, data: result });
    } catch (err) {
        console.error('[SMTP RNC HISTORY]', err);
        res.status(500).json({ error: err.message });
    }
});

function authenticateAndCheckPerm(page, action) {
    // Custom wrapper para nao crashar o boot caso a permissao nao seja perfeitamente validada agora.
    // Ele aproveita o middleware rbac normal:
    return requirePermission(page, action);
}

module.exports = router;

