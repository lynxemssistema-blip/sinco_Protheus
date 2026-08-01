const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../services/mysqlService');
const nodemailer = require('nodemailer');
const fs = require('fs');
require('dotenv').config();
const { getCorporateEmailTemplate } = require('../utils/emailTemplate');

const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY) {
    console.error('FATAL ERROR: JWT_SECRET is not defined in the environment.');
    process.exit(1);
}

// Login Route
router.post('/login', async (req, res) => {
    const { login, senha } = req.body;

    if (!login || !senha) {
        return res.status(400).json({ error: 'Login e senha são obrigatórios' });
    }

    try {
        const [rows] = await db.execute(
            'SELECT idUsuario, NomeCompleto, Login, TipoUsuario, fotoUsuario, email, aprovado, Senha, idFornecedor, lojaFornecedor, idCliente, lojaCliente, tipoExterno, pedidos_autorizados FROM usuario WHERE Login = ?',
            [login]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const user = rows[0];

        // Check password
        const isBcrypt = user.Senha && (user.Senha.startsWith('$2b$') || user.Senha.startsWith('$2a$'));
        let passwordMatch = false;

        if (isBcrypt) {
            passwordMatch = await bcrypt.compare(senha, user.Senha);
        } else {
            passwordMatch = (senha === user.Senha);
            
            if (passwordMatch) {
                try {
                    const hashedPwd = await bcrypt.hash(senha, 10);
                    await db.execute('UPDATE usuario SET Senha = ? WHERE idUsuario = ?', [hashedPwd, user.idUsuario]);
                } catch (migrationError) {
                    console.warn('Falha na migração da senha para bcrypt (provavelmente a coluna Senha é muito curta):', migrationError.message);
                }
            }
        }

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // Bloqueio de self-registration pending
        if (user.aprovado === 0) {
            return res.status(401).json({ error: 'Sua conta está em Análise. Aguarde a aprovação do Administrador para acessar o sistema.' });
        }

        // Generate Token
        const token = jwt.sign(
            { id: user.idUsuario, login: user.Login, nome: user.NomeCompleto, tipo: user.TipoUsuario, idFornecedor: user.idFornecedor, lojaFornecedor: user.lojaFornecedor, idCliente: user.idCliente, lojaCliente: user.lojaCliente, tipoExterno: user.tipoExterno },
            SECRET_KEY,
            { expiresIn: '8h' }
        );

        res.json({
            token,
            user: {
                id: user.idUsuario,
                nome: user.NomeCompleto,
                login: user.Login,
                tipo: user.TipoUsuario,
                fotoUsuario: user.fotoUsuario,
                email: user.email,
                idFornecedor: user.idFornecedor,
                lojaFornecedor: user.lojaFornecedor,
                idCliente: user.idCliente,
                lojaCliente: user.lojaCliente,
                tipoExterno: user.tipoExterno,
                pedidos_autorizados: user.pedidos_autorizados
            }
        });

    } catch (error) {
        console.error('Erro no login:', error);
        try {
            fs.appendFileSync('auth_debug.txt', new Date().toISOString() + ' | ERRO 500 LOGIN | ' + JSON.stringify(req.body) + ' | ' + error.message + '\n' + error.stack + '\n\n');
        } catch(e){}
        res.status(500).json({ error: 'Erro interno do servidor', detail: error.message });
    }
});

// Password Recovery Route
router.post('/recuperar-senha', async (req, res) => {
    const { email } = req.body; // 'email' parameter acts as generic contact info (email or phone) from frontend
    if (!email) return res.status(400).json({ error: 'O E-mail ou WhatsApp é obrigatório' });

    try {
        // Clean phone number if it looks like one (keep only numbers)
        const isPhone = /^[0-9()\-\s+]+$/.test(email) && email.replace(/\D/g, '').length >= 10;
        const cleanContact = isPhone ? email.replace(/\D/g, '') : email;

        let rows = [];
        if (isPhone) {
            // Find by whatsapp (removing non-digits from DB column just to match safely, or simply match right-padded/unpadded)
            [rows] = await db.execute('SELECT idUsuario, NomeCompleto, Login, Senha, whatsapp, email FROM usuario WHERE whatsapp LIKE ? OR telefone LIKE ?', [`%${cleanContact.slice(-8)}%`, `%${cleanContact.slice(-8)}%`]);
        } else {
            [rows] = await db.execute('SELECT idUsuario, NomeCompleto, Login, Senha, whatsapp, email FROM usuario WHERE email = ?', [email]);
        }
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Nenhum usuário encontrado com este contato no sistema.' });
        }

        const user = rows[0];

        // Generate temporary password
        const tempPassword = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit PIN
        const hashedTempPassword = await bcrypt.hash(tempPassword, 10);

        // Update DB with hashed temp password
        const targetUserId = user.idUsuario || (user.Login ? await db.execute('SELECT idUsuario FROM usuario WHERE Login = ?', [user.Login]).then(res => res[0][0].idUsuario) : null);
        await db.execute('UPDATE usuario SET Senha = ? WHERE idUsuario = ?', [hashedTempPassword, targetUserId]);

        // Send via WhatsApp if matched phone, otherwise via Email
        if (isPhone && user.whatsapp) {
            const { sendText } = require('../services/whatsapp');
            const serverUrl = process.env.APP_URL || 'http://192.168.1.77:3001/login';
            const textMessage = `*Recuperação de Acesso*\n\nOlá, *${user.NomeCompleto}*!\nVocê solicitou a recuperação de senha do *Sistema ERP da Metalfisa*.\n\n👤 *Usuário:* ${user.Login}\n🔑 *Nova Senha Temporária:* ${tempPassword}\n\n🌐 *Como Acessar*\n${serverUrl}\n\n_Recomendamos que você altere sua senha após o primeiro login._`;
            
            try {
                await sendText(user.whatsapp, textMessage, 'Recuperação de Acesso via Login');
                res.json({ message: 'Os dados de acesso foram enviados para o seu WhatsApp!' });
            } catch (err) {
                console.error('Erro WhatsApp recovery:', err);
                return res.status(500).json({ error: 'Erro ao disparar mensagem para seu WhatsApp.' });
            }
        } else {
            const transporter = nodemailer.createTransport({
                host: 'smtp.task.com.br',
                port: 587,
                secure: false, 
                auth: {
                    user: 'sincometal@metalfisa.com.br',
                    pass: 'Pro1042@sm'
                },
                tls: { rejectUnauthorized: false }
            });

            await transporter.sendMail({
                from: '"MetalFisa ERP" <sincometal@metalfisa.com.br>',
                to: user.email || email,
                subject: 'Recuperação de Acesso - MetalFisa ERP',
                html: getCorporateEmailTemplate(`
                    <h2 style="color: #0284c7; margin-top: 0; font-family: Arial, sans-serif;">Recuperação de Acesso</h2>
                    <p>Olá, <b>${user.NomeCompleto}</b>!</p>
                    <p>Você solicitou a recuperação de acesso ao Sistema ERP da Metalfisa. Foi gerada uma senha temporária para você:</p>
                    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e2e8f0;">
                        <p style="margin: 0 0 10px 0; font-size: 16px;"><b>Usuário:</b> ${user.Login}</p>
                        <p style="margin: 0; font-size: 16px;"><b>Senha Temporária:</b> ${tempPassword}</p>
                    </div>
                    <p style="font-size: 14px;">Recomendamos que você acesse o sistema e altere esta senha imediatamente.</p>
                `)
            });

            res.json({ message: 'Os dados de acesso foram enviados para o seu E-mail!' });
        }
    } catch (err) {
        console.error('Erro ao recuperar senha:', err);
        res.status(500).json({ error: 'Erro no servidor ao processar a recuperação de senha.' });
    }
});

// Middleware for protected routes (exporting for use in other files if needed)
const authenticateToken = (req, res, next) => {
    // Bypass auth for document visualization, VMI model download, and webhooks
    if (
        req.originalUrl.startsWith('/api/docs/view') || 
        req.path === '/docs/view' ||
        req.originalUrl.startsWith('/api/vmi/modelo') ||
        req.originalUrl.startsWith('/api/webhook')
    ) {
        return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        // Fallback: check query parameter for cases where header cannot be sent
        if (req.query && req.query.token) {
            jwt.verify(req.query.token, SECRET_KEY, (err, user) => {
                if (err) {
                    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
                    return res.status(401).json({ error: 'Sessão inválida', code });
                }
                req.user = user;
                return next();
            });
            return;
        }
        return res.status(401).json({ error: 'Token não fornecido', code: 'TOKEN_MISSING' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
            return res.status(401).json({ error: 'Sessão inválida', code });
        }
        req.user = user;
        next();
    });
};

// Route for Updating Required Email (After User is Logged In but needs to unblock navigation)
router.post('/update-email', authenticateToken, async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'O E-mail é obrigatório para prosseguir.' });

    try {
        // Verifica Unicidade
        const [existingEmail] = await db.execute(
            'SELECT idUsuario FROM usuario WHERE email = ? AND idUsuario <> ?',
            [email, req.user.id]
        );
        
        if (existingEmail.length > 0) {
            return res.status(409).json({ error: 'Desculpe, este e-mail já está sendo utilizado por outro usuário no sistema Metalfisa.' });
        }

        await db.execute('UPDATE usuario SET email = ? WHERE idUsuario = ?', [email, req.user.id]);
        
        res.json({ message: 'E-mail cadastrado com sucesso! Acesso Liberado.' });
    } catch (err) {
        console.error('Erro ao registrar e-mail obrigatorio:', err);
        res.status(500).json({ error: 'Erro no servidor ao validar o e-mail.' });
    }
});

// Self-Registration Route (Criar Conta Pelo Login)
router.post('/register', async (req, res) => {
    const { nome, email, login, senha } = req.body;
    if (!nome || !email || !login || !senha) {
        return res.status(400).json({ error: 'Todos os campos de cadastro são requeridos.' });
    }

    try {
        // Check availability
        const [existingLogin] = await db.execute('SELECT idUsuario FROM usuario WHERE Login = ?', [login]);
        if (existingLogin.length > 0) return res.status(409).json({ error: 'Infelizmente o nome de usuário (Login) escolhido já está registrado.' });

        const [existingEmail] = await db.execute('SELECT idUsuario FROM usuario WHERE email = ?', [email]);
        if (existingEmail.length > 0) return res.status(409).json({ error: 'Este endereço de E-mail já está em uso em nossa base.' });

        const hashedPwd = await bcrypt.hash(senha, 10);

        // Insert as pending (aprovado = 0) with a standard role
        await db.execute(
            'INSERT INTO usuario (NomeCompleto, Login, Senha, email, aprovado, TipoUsuario) VALUES (?, ?, ?, ?, 0, "Basico")',
            [nome, login, hashedPwd, email]
        );

        res.json({ message: 'Seu usuário foi criado com sucesso! Ele foi encaminhado para a análise do Controle de Administração da Metalfisa.' });
    } catch (err) {
        console.error('Erro de Sign Up:', err);
        res.status(500).json({ error: 'Erro interno ao realizar cadastro.' });
    }
});

module.exports = router;
module.exports.authenticateToken = authenticateToken;
