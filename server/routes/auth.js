const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');
const fs = require('fs');
require('dotenv').config();
const { getCorporateEmailTemplate } = require('../utils/emailTemplate');

const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY) {
    console.error('FATAL ERROR: JWT_SECRET is not defined in the environment.');
    process.exit(1);
}

const dbConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB,
    port: 3306
};

// Login Route
router.post('/login', async (req, res) => {
    const { login, senha } = req.body;

    if (!login || !senha) {
        return res.status(400).json({ error: 'Login e senha são obrigatórios' });
    }

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);

        // Query user from database - PLAIN TEXT PASSWORD as per request
        const [rows] = await connection.execute(
            'SELECT idUsuario, NomeCompleto, Login, TipoUsuario, fotoUsuario, email, aprovado FROM usuario WHERE Login = ? AND Senha = ?',
            [login, senha]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const user = rows[0];

        // Bloqueio de self-registration pending
        if (user.aprovado === 0) {
            return res.status(401).json({ error: 'Sua conta está em Análise. Aguarde a aprovação do Administrador para acessar o sistema.' });
        }

        // Generate Token
        const token = jwt.sign(
            { id: user.idUsuario, login: user.Login, nome: user.NomeCompleto, tipo: user.TipoUsuario },
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
                email: user.email
            }
        });

    } catch (error) {
        console.error('Erro no login:', error);
        try {
            fs.appendFileSync('auth_debug.txt', new Date().toISOString() + ' | ERRO 500 LOGIN | ' + JSON.stringify(req.body) + ' | ' + error.message + '\n' + error.stack + '\n\n');
        } catch(e){}
        res.status(500).json({ error: 'Erro interno do servidor', detail: error.message });
    } finally {
        if (connection) await connection.end();
    }
});

// Password Recovery Route
router.post('/recuperar-senha', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'O E-mail é obrigatório' });

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute('SELECT NomeCompleto, Login, Senha FROM usuario WHERE email = ?', [email]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Nenhum usuário encontrado com este e-mail no sistema.' });
        }

        const user = rows[0];

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
            to: email,
            subject: 'Recuperação de Acesso - MetalFisa ERP',
            html: getCorporateEmailTemplate(`
                <h2 style="color: #0284c7; margin-top: 0; font-family: Arial, sans-serif;">Recuperação de Acesso</h2>
                <p>Olá, <b>${user.NomeCompleto}</b>!</p>
                <p>Você solicitou a recuperação de acesso ao Sistema ERP da Metalfisa. Seguem seus dados de login atualizados:</p>
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 10px 0; font-size: 16px;"><b>Usuário:</b> ${user.Login}</p>
                    <p style="margin: 0; font-size: 16px;"><b>Senha:</b> ${user.Senha}</p>
                </div>
                <p style="font-size: 14px;">Recomendamos que você guarde sua senha em um local seguro e exclua esta mensagem caso ninguém a tenha solicitado.</p>
            `)
        });

        res.json({ message: 'Os dados de acesso foram enviados para o seu e-mail!' });
    } catch (err) {
        console.error('Erro ao recuperar senha SMTP:', err);
        res.status(500).json({ error: 'Erro no servidor de E-mail ao disparar recuperação.' });
    } finally {
        if (connection) await connection.end();
    }
});

// Middleware for protected routes (exporting for use in other files if needed)
const authenticateToken = (req, res, next) => {
    // Bypass auth for document visualization and VMI model download
    if (
        req.originalUrl.startsWith('/api/docs/view') || 
        req.path === '/docs/view' ||
        req.originalUrl.startsWith('/api/vmi/modelo')
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

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        
        // Verifica Unicidade
        const [existingEmail] = await connection.execute(
            'SELECT idUsuario FROM usuario WHERE email = ? AND idUsuario <> ?',
            [email, req.user.id]
        );
        
        if (existingEmail.length > 0) {
            return res.status(409).json({ error: 'Desculpe, este e-mail já está sendo utilizado por outro usuário no sistema Metalfisa.' });
        }

        await connection.execute('UPDATE usuario SET email = ? WHERE idUsuario = ?', [email, req.user.id]);
        
        res.json({ message: 'E-mail cadastrado com sucesso! Acesso Liberado.' });
    } catch (err) {
        console.error('Erro ao registrar e-mail obrigatorio:', err);
        res.status(500).json({ error: 'Erro no servidor ao validar o e-mail.' });
    } finally {
        if (connection) await connection.end();
    }
});

// Self-Registration Route (Criar Conta Pelo Login)
router.post('/register', async (req, res) => {
    const { nome, email, login, senha } = req.body;
    if (!nome || !email || !login || !senha) {
        return res.status(400).json({ error: 'Todos os campos de cadastro são requeridos.' });
    }

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        
        // Check availability
        const [existingLogin] = await connection.execute('SELECT idUsuario FROM usuario WHERE Login = ?', [login]);
        if (existingLogin.length > 0) return res.status(409).json({ error: 'Infelizmente o nome de usuário (Login) escolhido já está registrado.' });

        const [existingEmail] = await connection.execute('SELECT idUsuario FROM usuario WHERE email = ?', [email]);
        if (existingEmail.length > 0) return res.status(409).json({ error: 'Este endereço de E-mail já está em uso em nossa base.' });

        // Insert as pending (aprovado = 0) with a standard role
        await connection.execute(
            'INSERT INTO usuario (NomeCompleto, Login, Senha, email, aprovado, TipoUsuario) VALUES (?, ?, ?, ?, 0, "Basico")',
            [nome, login, senha, email]
        );

        res.json({ message: 'Seu usuário foi criado com sucesso! Ele foi encaminhado para a análise do Controle de Administração da Metalfisa.' });
    } catch (err) {
        console.error('Erro de Sign Up:', err);
        res.status(500).json({ error: 'Erro interno ao realizar cadastro.' });
    } finally {
        if (connection) await connection.end();
    }
});

module.exports = router;
module.exports.authenticateToken = authenticateToken;
