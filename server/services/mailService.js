const nodemailer = require('nodemailer');
require('dotenv').config();

const SMTP_CONFIG = {
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 465,
    secure: process.env.SMTP_SECURE === 'true' || true,
    auth: {
        user: process.env.SMTP_USER || 'suporte@lynxems.com.br',
        pass: process.env.SMTP_PASS || '10207597Rdv*'
    },
    tls: {
        rejectUnauthorized: false
    }
};

const DEFAULT_FROM = process.env.SMTP_FROM || '"SINCO / Lynx" <suporte@lynxems.com.br>';

let cachedTransporter = null;

function getTransporter() {
    if (!cachedTransporter) {
        cachedTransporter = nodemailer.createTransport(SMTP_CONFIG);
    }
    return cachedTransporter;
}

/**
 * Envia e-mail oficial pelo Hostinger SMTP
 * @param {Object} options
 * @param {string|string[]} options.to
 * @param {string} options.subject
 * @param {string} [options.html]
 * @param {string} [options.text]
 * @param {string} [options.from]
 * @param {string|string[]} [options.cc]
 * @param {string|string[]} [options.bcc]
 * @param {Array} [options.attachments]
 * @returns {Promise<Object>}
 */
async function sendMail(options) {
    try {
        const transporter = getTransporter();
        const mailOptions = {
            from: options.from || DEFAULT_FROM,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
            cc: options.cc,
            bcc: options.bcc,
            attachments: options.attachments
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[SMTP OFICIAL] E-mail enviado para ${options.to}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`[SMTP OFICIAL] Erro ao enviar e-mail para ${options.to}:`, error.message);
        throw error;
    }
}

module.exports = {
    SMTP_CONFIG,
    DEFAULT_FROM,
    getTransporter,
    sendMail
};
