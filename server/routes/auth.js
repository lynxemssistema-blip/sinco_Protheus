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

const rateLimit = require('express-rate-limit');

// Rate limiting para proteção contra ataques de força bruta no login (por IP e Usuário)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Janela de 15 minutos
    max: 10, // Máximo de 10 tentativas incorretas por IP e Usuário
    keyGenerator: (req) => `${req.ip}_${(req.body.login || '').trim().toLowerCase()}`,
    skipSuccessfulRequests: true,
    validate: { keyGeneratorIpFallback: false },
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas tentativas de login com erro para este usuário. Tente novamente após 15 minutos.' }
});

// Login Route
router.post('/login', loginLimiter, async (req, res) => {
    const login = (req.body.login || '').trim();
    const senha = (req.body.senha || '').trim();

    if (!login || !senha) {
        return res.status(400).json({ error: 'Login e senha são obrigatórios' });
    }

    try {
        const [rows] = await db.execute(
            'SELECT idUsuario, NomeCompleto, Login, TipoUsuario, fotoUsuario, email, aprovado, status, Senha, idFornecedor, lojaFornecedor, idCliente, lojaCliente, tipoExterno, pedidos_autorizados, IdEmpresa, is_master FROM usuario WHERE Login = ? OR LOWER(email) = LOWER(?)',
            [login, login]
        );

        console.log('[/api/auth/login] Recebido login:', login, 'Rows:', rows.length);
        if (rows.length === 0) {
            console.log('[/api/auth/login] 0 rows encontradas para:', login);
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
        }
        console.log('[/api/auth/login] Password match para', user.Login, ':', passwordMatch);

        if (passwordMatch && !isBcrypt) {
            try {
                const hashedPwd = await bcrypt.hash(senha, 10);
                await db.execute('UPDATE usuario SET Senha = ? WHERE idUsuario = ?', [hashedPwd, user.idUsuario]);
            } catch (migrationError) {
                console.warn('Falha na migração da senha para bcrypt:', migrationError.message);
            }
        }

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // Bloqueio de conta pendente ou desativada
        if (user.aprovado === 0 || user.status === '0') {
            return res.status(401).json({ error: 'Sua conta está inativa ou aguardando aprovação do Administrador.' });
        }

        // Verificação especial do Superadmin Global da Plataforma (apenas edsonmanoel2012@gmail.com / ID 37)
        const userEmailLower = (user.email || '').toLowerCase().trim();
        const userLoginLower = (user.Login || '').toLowerCase().trim();
        const isSuperAdmin = (userEmailLower === 'edsonmanoel2012@gmail.com') || (user.idUsuario === 37) || (userLoginLower === 'sinco' && user.idUsuario === 37);
        const effectiveRole = isSuperAdmin ? 'superadmin' : (user.TipoUsuario || (user.is_master === 1 ? 'master' : 'operador'));
        const effectiveIsMaster = isSuperAdmin || user.is_master === 1;
        const tenantId = user.IdEmpresa || null;

        // Buscar dados da Empresa / Tenant e Plano
        let empresaData = null;
        if (tenantId) {
            try {
                const [empRows] = await db.query(
                    'SELECT IdEmpresa, RazaoSocial, NomeFantasia, plano, status_plano, COALESCE(ativa, 1) as ativa, data_vencimento, motivo_bloqueio, trial_expira_em, limite_usuarios FROM empresa WHERE IdEmpresa = ?',
                    [tenantId]
                );
                if (empRows.length > 0) {
                    const emp = empRows[0];

                    // Bloqueio de empresa desativada ou assinatura vencida (Superadmin sempre tem acesso irrestrito)
                    const isEmpresaDesativada = emp.ativa === 0 || emp.status_plano === 'bloqueado' || emp.status_plano === 'inativo';
                    const isAssinaturaVencida = emp.data_vencimento && new Date(emp.data_vencimento) < new Date(new Date().setHours(0,0,0,0));

                    if (!isSuperAdmin && (isEmpresaDesativada || isAssinaturaVencida)) {
                        return res.status(403).json({
                            error: isAssinaturaVencida && emp.ativa !== 0 ? 'Assinatura Vencida' : 'Empresa Desativada',
                            code: 'EMPRESA_DESATIVADA',
                            message: emp.motivo_bloqueio || (isAssinaturaVencida 
                                ? `A assinatura da empresa "${emp.NomeFantasia || emp.RazaoSocial}" expirou em ${new Date(emp.data_vencimento).toLocaleDateString('pt-BR')}. Entre em contato com a administração da plataforma para renovação da mensalidade.` 
                                : `A empresa "${emp.NomeFantasia || emp.RazaoSocial}" está desativada no sistema. Entre em contato com a administração para reativar seu acesso.`),
                            empresa: {
                                id: emp.IdEmpresa,
                                nome: emp.NomeFantasia || emp.RazaoSocial,
                                vencimento: emp.data_vencimento,
                                status: emp.ativa === 0 ? 'desativada' : (isAssinaturaVencida ? 'vencida' : emp.status_plano)
                            }
                        });
                    }

                    empresaData = {
                        id: emp.IdEmpresa,
                        nomeFantasia: emp.NomeFantasia || emp.RazaoSocial,
                        razaoSocial: emp.RazaoSocial,
                        plano: emp.plano || 'pro',
                        statusPlano: emp.status_plano || 'ativo',
                        ativa: emp.ativa === 1,
                        dataVencimento: emp.data_vencimento,
                        limiteUsuarios: emp.limite_usuarios || 10,
                        trialExpiraEm: emp.trial_expira_em
                    };
                }
            } catch (e) {
                console.warn('Nota ao carregar empresa:', e.message);
            }
        }

        // Generate Token
        const token = jwt.sign(
            {
                id: user.idUsuario,
                login: user.Login,
                email: user.email,
                nome: user.NomeCompleto,
                tipo: effectiveRole,
                IdEmpresa: tenantId,
                is_master: effectiveIsMaster,
                is_superadmin: isSuperAdmin,
                idFornecedor: user.idFornecedor,
                lojaFornecedor: user.lojaFornecedor,
                idCliente: user.idCliente,
                lojaCliente: user.lojaCliente,
                tipoExterno: user.tipoExterno
            },
            SECRET_KEY,
            { expiresIn: '12h' }
        );

        res.json({
            token,
            user: {
                id: user.idUsuario,
                nome: user.NomeCompleto,
                login: user.Login,
                tipo: effectiveRole,
                fotoUsuario: user.fotoUsuario,
                email: user.email,
                IdEmpresa: tenantId,
                is_master: effectiveIsMaster,
                is_superadmin: isSuperAdmin,
                empresa: empresaData,
                idFornecedor: user.idFornecedor,
                lojaFornecedor: user.lojaFornecedor,
                idCliente: user.idCliente,
                lojaCliente: user.lojaCliente,
                tipoExterno: user.tipoExterno,
                pedidos_autorizados: user.pedidos_autorizados
            },
            empresa: empresaData
        });

    } catch (error) {
        console.error('Erro no login:', error);
        try {
            fs.appendFileSync('auth_debug.txt', new Date().toISOString() + ' | ERRO 500 LOGIN | ' + JSON.stringify(req.body) + ' | ' + error.message + '\n' + error.stack + '\n\n');
        } catch(e){}
        res.status(500).json({ error: 'Erro interno do servidor', detail: error.message });
    }
});

// Password Recovery Route (Inteligente: E-mail, WhatsApp ou Login)
router.post('/recuperar-senha', async (req, res) => {
    const rawContact = (req.body.email || req.body.contato || req.body.login || '').trim();
    if (!rawContact) {
        return res.status(400).json({ error: 'Informe seu E-mail, WhatsApp ou Login para recuperar o acesso.' });
    }

    try {
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawContact);
        const digitsOnly = rawContact.replace(/\D/g, '');
        const isPhone = !isEmail && digitsOnly.length >= 8 && digitsOnly.length <= 14;

        let rows = [];

        if (isEmail) {
            // Busca específica por e-mail ou login idêntico
            [rows] = await db.query(
                'SELECT idUsuario, NomeCompleto, Login, Senha, whatsapp, telefone, email, IdEmpresa FROM usuario WHERE email = ? OR Login = ? ORDER BY idUsuario DESC',
                [rawContact.toLowerCase(), rawContact.toLowerCase()]
            );
        } else if (isPhone) {
            // Busca flexível pelo final do número de telefone / WhatsApp (últimos 8 dígitos para cobrir DDD e formatos variados)
            const phoneSuffix = `%${digitsOnly.slice(-8)}%`;
            [rows] = await db.query(
                `SELECT idUsuario, NomeCompleto, Login, Senha, whatsapp, telefone, email, IdEmpresa 
                 FROM usuario 
                 WHERE (REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(whatsapp, ''), ' ', ''), '-', ''), '(', ''), ')', '') LIKE ?)
                    OR (REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(telefone, ''), ' ', ''), '-', ''), '(', ''), ')', '') LIKE ?)
                 ORDER BY idUsuario DESC`,
                [phoneSuffix, phoneSuffix]
            );
        } else {
            // Busca por login ou nome de usuário
            [rows] = await db.query(
                'SELECT idUsuario, NomeCompleto, Login, Senha, whatsapp, telefone, email, IdEmpresa FROM usuario WHERE Login = ? OR email = ? ORDER BY idUsuario DESC',
                [rawContact, rawContact]
            );
        }

        if (rows.length === 0) {
            return res.status(404).json({ 
                error: isEmail 
                    ? `Nenhum usuário encontrado com o e-mail "${rawContact}".` 
                    : isPhone 
                        ? `Nenhum usuário encontrado com o telefone/WhatsApp informado.` 
                        : `Nenhum usuário encontrado com o login "${rawContact}".` 
            });
        }

        const user = rows[0];

        // Gera nova senha temporária de 6 dígitos
        const tempPassword = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedTempPassword = await bcrypt.hash(tempPassword, 10);

        // Atualiza a senha no banco de dados
        await db.query('UPDATE usuario SET Senha = ? WHERE idUsuario = ?', [hashedTempPassword, user.idUsuario]);

        const serverUrl = process.env.APP_URL || 'https://lynxems.com.br/login';

        let sentVia = [];
        let errors = [];

        // Regra inteligente:
        // 1. Se digitou E-MAIL -> prioridade absoluta é enviar por E-mail
        // 2. Se digitou WHATSAPP -> prioridade absoluta é enviar por WhatsApp
        // 3. Se digitou LOGIN -> envia pelo canal disponível (se tiver ambos, envia em ambos)
        const shouldSendEmail = isEmail || (!isPhone && user.email);
        const shouldSendWa = isPhone || (!isEmail && (user.whatsapp || user.telefone));

        // Envio via E-mail Oficial Hostinger
        if (shouldSendEmail && user.email) {
            try {
                const { sendMail } = require('../services/mailService');
                await sendMail({
                    to: user.email,
                    subject: '🔐 Recuperação de Acesso — SINCO / Lynx ERP',
                    html: getCorporateEmailTemplate(`
                        <h2 style="color: #0284c7; margin-top: 0; font-family: 'Segoe UI', Arial, sans-serif;">Recuperação de Acesso</h2>
                        <p style="font-size: 15px;">Olá, <b>${user.NomeCompleto}</b>!</p>
                        <p style="font-size: 15px; color: #475569;">Você solicitou a recuperação da sua senha de acesso ao <b>Sistema SINCO / Lynx ERP</b>.</p>
                        
                        <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 24px; border-radius: 12px; margin: 25px 0; border: 1px solid #bae6fd;">
                            <table style="border-collapse: collapse; width: 100%;">
                                <tr>
                                    <td style="padding: 8px 0; font-size: 14px; color: #64748b; width: 140px;"><b>👤 Usuário / Login:</b></td>
                                    <td style="padding: 8px 0; font-size: 16px; color: #0f172a; font-weight: bold; font-family: 'Courier New', monospace; background: #ffffff; padding: 6px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">${user.Login}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; font-size: 14px; color: #64748b; width: 140px;"><b>🔑 Senha Temporária:</b></td>
                                    <td style="padding: 8px 0; font-size: 16px; color: #0f172a; font-weight: bold; font-family: 'Courier New', monospace; background: #ffffff; padding: 6px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">${tempPassword}</td>
                                </tr>
                            </table>
                        </div>

                        <div style="background: #f8fafc; border-radius: 10px; padding: 16px 20px; margin: 20px 0; border-left: 4px solid #0ea5e9;">
                            <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold; color: #0369a1;">🌐 Como Acessar</p>
                            <p style="margin: 0; font-size: 14px; color: #475569;">
                                Acesse pelo navegador: <a href="${serverUrl}" style="color: #0284c7; text-decoration: underline; font-weight: bold;">${serverUrl}</a>
                            </p>
                        </div>

                        <p style="font-size: 13px; color: #64748b; margin-top: 20px;">
                            Recomendamos que você altere sua senha para uma de sua preferência após efetuar o login.
                        </p>
                    `)
                });
                sentVia.push(`E-mail (${user.email})`);
            } catch (mailErr) {
                console.error('[Recuperar Senha] Erro envio e-mail:', mailErr.message);
                errors.push(`Falha no e-mail: ${mailErr.message}`);
            }
        }

        // Envio via WhatsApp
        const waContact = user.whatsapp || user.telefone || (isPhone ? rawContact : null);
        if (shouldSendWa && waContact) {
            try {
                const { sendText } = require('../services/whatsapp');
                const textMessage = `*Recuperação de Acesso*\n\nOlá, *${user.NomeCompleto}*!\nVocê solicitou a recuperação de senha do *Sistema SINCO / Lynx*.\n\n👤 *Usuário:* ${user.Login}\n🔑 *Nova Senha Temporária:* ${tempPassword}\n\n🌐 *Como Acessar:*\n${serverUrl}\n\n_Recomendamos que você altere sua senha após efetuar o login._`;
                
                await sendText(waContact, textMessage, 'Recuperação de Senha');
                sentVia.push(`WhatsApp (${waContact})`);
            } catch (waErr) {
                console.error('[Recuperar Senha] Erro envio WhatsApp:', waErr.message);
                errors.push(`Falha no WhatsApp: ${waErr.message}`);
            }
        }

        // Fallback: se o canal preferencial falhou mas o outro está disponível
        if (sentVia.length === 0) {
            if (isPhone && user.email) {
                try {
                    const { sendMail } = require('../services/mailService');
                    await sendMail({
                        to: user.email,
                        subject: '🔐 Recuperação de Acesso — SINCO / Lynx ERP',
                        html: getCorporateEmailTemplate(`<p>Olá, <b>${user.NomeCompleto}</b>! Sua nova senha temporária é <b>${tempPassword}</b> para o login <b>${user.Login}</b>.</p>`)
                    });
                    sentVia.push(`E-mail alternativo (${user.email})`);
                } catch (e) {}
            } else if (isEmail && (user.whatsapp || user.telefone)) {
                try {
                    const { sendText } = require('../services/whatsapp');
                    await sendText(user.whatsapp || user.telefone, `*SINCO:* Sua nova senha temporária é *${tempPassword}* para o usuário *${user.Login}*.`);
                    sentVia.push(`WhatsApp alternativo`);
                } catch (e) {}
            }
        }

        if (sentVia.length > 0) {
            return res.json({
                success: true,
                message: `Os dados de acesso foram enviados com sucesso via ${sentVia.join(' e ')}!`
            });
        } else {
            return res.status(500).json({
                error: 'Não foi possível entregar a nova senha no momento. Detalhes: ' + errors.join('; ')
            });
        }

    } catch (err) {
        console.error('Erro ao recuperar senha:', err);
        res.status(500).json({ error: 'Erro no servidor ao processar a recuperação de senha: ' + err.message });
    }
});

// Middleware for protected routes (exporting for use in other files if needed)
const authenticateToken = (req, res, next) => {
    // Webhook da Evolution API e visualização segura de documentos possuem regras próprias ou abrem via link direto no navegador
    if (req.originalUrl.startsWith('/api/webhook') || req.originalUrl.startsWith('/api/docs/view')) {
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
            return res.status(409).json({ error: 'Desculpe, este e-mail já está sendo utilizado por outro usuário no sistema Lynx.' });
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

        res.json({ message: 'Seu usuário foi criado com sucesso! Ele foi encaminhado para a análise do Controle de Administração da Lynx.' });
    } catch (err) {
        console.error('Erro de Sign Up:', err);
        res.status(500).json({ error: 'Erro interno ao realizar cadastro.' });
    }
});

// Auto-Cadastro de Empresa SaaS com Usuário Master e 14 dias de Trial
router.post('/register-company', async (req, res) => {
    const { nome, email, senha, telefone, nomeEmpresa, cnpj, segmento } = req.body;

    if (!nome || !email || !senha || !nomeEmpresa) {
        return res.status(400).json({
            error: 'Campos obrigatórios ausentes',
            message: 'Nome do responsável, e-mail, senha e nome da empresa são obrigatórios.'
        });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanLogin = cleanEmail;

    try {
        // 1. Checar se usuário ou login já existe
        const [existingUsers] = await db.execute(
            'SELECT idUsuario FROM usuario WHERE email = ? OR Login = ?',
            [cleanEmail, cleanLogin]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                error: 'E-mail já cadastrado',
                message: 'Já existe uma conta registrada com este endereço de e-mail.'
            });
        }

        // Tratar CNPJ se informado ou manter null (permitindo múltiplos registros sem CNPJ no MySQL)
        const cleanCnpj = (cnpj && String(cnpj).trim().length > 0) ? String(cnpj).trim() : null;
        if (cleanCnpj) {
            const [existingCnpj] = await db.execute(
                'SELECT IdEmpresa FROM empresa WHERE Cnpj = ?',
                [cleanCnpj]
            );
            if (existingCnpj.length > 0) {
                return res.status(409).json({
                    error: 'CNPJ já cadastrado',
                    message: 'Já existe uma empresa cadastrada com este CNPJ.'
                });
            }
        }

        // 2. Data de expiração do trial (14 dias)
        const dataTrialExpira = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        const trialExpiraStr = dataTrialExpira.toISOString().slice(0, 19).replace('T', ' ');

        // 3. Criar registro da Empresa (Tenant)
        const [empresaResult] = await db.execute(`
            INSERT INTO empresa (
                RazaoSocial, NomeFantasia, Segmento, Cnpj, Email, Telefone,
                plano, status_plano, trial_expira_em, limite_usuarios
            ) VALUES (?, ?, ?, ?, ?, ?, 'pro', 'trial', ?, 10)
        `, [
            nomeEmpresa,
            nomeEmpresa,
            segmento || 'Indústria & Usinagem',
            cleanCnpj,
            cleanEmail,
            telefone || null,
            trialExpiraStr
        ]);

        const novaEmpresaId = empresaResult.insertId;

        // Auto-seed de templates operacionais para a nova empresa (Setores, Recursos e Cores de Aço)
        try {
            const { seedCompanyDefaults } = require('../services/tenantSeedService');
            await seedCompanyDefaults(novaEmpresaId);
            console.log(`✅ [AUTH] Templates e padrão de cores de aço inicializados para a nova empresa ID ${novaEmpresaId}.`);
        } catch (seedErr) {
            console.warn(`⚠️ [AUTH] Falha ao executar seed para nova empresa ID ${novaEmpresaId}:`, seedErr.message);
        }

        // 4. Criar o Usuário Master vinculado à Empresa com acesso irrestrito a todos os módulos
        const hashedPwd = await bcrypt.hash(senha, 10);
        const [userResult] = await db.execute(`
            INSERT INTO usuario (
                NomeCompleto, Login, Senha, email, telefone,
                TipoUsuario, is_master, IdEmpresa, aprovado, status,
                MapaProducao, Romaneio, OrdemServico, SolidWorks,
                GerenciamentoProducao, VisaoGeralProducao, Comercial, Financeiro,
                Teste, Expedicao
            ) VALUES (?, ?, ?, ?, ?, 'master', 1, ?, 1, '1', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)
        `, [
            nome,
            cleanLogin,
            hashedPwd,
            cleanEmail,
            telefone || null,
            novaEmpresaId
        ]);

        const novoUsuarioId = userResult.insertId;

        // 5. Gerar token JWT de acesso imediato com privilégios Master
        const token = jwt.sign(
            {
                id: novoUsuarioId,
                login: cleanLogin,
                email: cleanEmail,
                nome: nome,
                tipo: 'master',
                TipoUsuario: 'master',
                IdEmpresa: novaEmpresaId,
                is_master: true,
                isMaster: true,
                is_admin: true,
                isAdmin: true,
                is_superadmin: false
            },
            SECRET_KEY,
            { expiresIn: '12h' }
        );

        res.status(201).json({
            message: 'Empresa cadastrada com sucesso! Bem-vindo ao SINCO SaaS.',
            token,
            user: {
                id: novoUsuarioId,
                nome: nome,
                login: cleanLogin,
                email: cleanEmail,
                tipo: 'master',
                TipoUsuario: 'master',
                IdEmpresa: novaEmpresaId,
                is_master: true,
                isMaster: true,
                is_admin: true,
                isAdmin: true,
                is_superadmin: false,
                aprovado: 1
            },
            empresa: {
                id: novaEmpresaId,
                nomeFantasia: nomeEmpresa,
                plano: 'pro',
                statusPlano: 'trial',
                limiteUsuarios: 10,
                trialExpiraEm: trialExpiraStr
            }
        });

    } catch (err) {
        console.error('Erro no auto-cadastro de empresa:', err);
        res.status(500).json({
            error: 'Erro no servidor',
            message: 'Não foi possível concluir o cadastro da empresa: ' + err.message
        });
    }
});

/**
 * POST /api/auth/register-with-code
 * Cadastro direto de colaborador através do Código de Segurança fornecido pelo Master (expira em 30min)
 */
router.post('/register-with-code', async (req, res) => {
    const { nome, email, senha, telefone, codigo_seguranca } = req.body;

    if (!nome || !email || !senha || !codigo_seguranca) {
        return res.status(400).json({
            error: 'Campos obrigatórios ausentes',
            message: 'Nome, e-mail, senha e código de segurança são obrigatórios.'
        });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanLogin = cleanEmail;
    const cleanCode = String(codigo_seguranca).trim();

    try {
        // 1. Buscar convite pelo código (token) e checar expiração com NOW() do banco
        const [conviteRows] = await db.query(
            'SELECT id, IdEmpresa, email, tipo_usuario, status, expira_em, (expira_em < NOW()) as expirou FROM empresa_convites WHERE token = ?',
            [cleanCode]
        );

        if (conviteRows.length === 0) {
            return res.status(400).json({
                error: 'Código inválido',
                message: 'Código de segurança incorreto. Verifique o código recebido pelo WhatsApp ou solicite um novo ao Master da empresa.'
            });
        }

        const convite = conviteRows[0];

        // 2. Verificar se já foi aceito
        if (convite.status === 'aceito') {
            return res.status(400).json({
                error: 'Código já utilizado',
                message: 'Este código de segurança já foi utilizado anteriormente. Solicite um novo código ao Master da sua empresa.'
            });
        }

        // 3. Verificar validade de 30 minutos
        if (convite.expirou === 1 || convite.expirou === true || convite.status === 'expirado') {
            await db.execute('UPDATE empresa_convites SET status = "expirado" WHERE id = ?', [convite.id]);
            return res.status(410).json({
                error: 'Código expirado',
                message: 'Este código de segurança expirou. Os códigos de acesso têm validade máxima de 30 minutos. Peça para o Master da empresa gerar um novo código.'
            });
        }

        // 4. Checar se usuário já existe
        const [existingUsers] = await db.execute(
            'SELECT idUsuario FROM usuario WHERE email = ? OR Login = ?',
            [cleanEmail, cleanLogin]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                error: 'E-mail já cadastrado',
                message: 'Já existe um usuário cadastrado com este e-mail no sistema.'
            });
        }

        // 5. Buscar dados da Empresa associada
        const [empRows] = await db.query(
            'SELECT IdEmpresa, RazaoSocial, NomeFantasia, plano, status_plano FROM empresa WHERE IdEmpresa = ?',
            [convite.IdEmpresa]
        );

        const empresa = empRows[0] || {
            IdEmpresa: convite.IdEmpresa,
            NomeFantasia: 'Minha Empresa'
        };

        // 6. Cadastrar o colaborador já APROVADO e associado à empresa
        const hashedPwd = await bcrypt.hash(senha, 10);
        const role = convite.tipo_usuario || 'operador';

        const [userResult] = await db.execute(`
            INSERT INTO usuario (
                NomeCompleto, Login, Senha, email, telefone,
                TipoUsuario, is_master, IdEmpresa, aprovado, status
            ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 1, '1')
        `, [
            nome,
            cleanLogin,
            hashedPwd,
            cleanEmail,
            telefone || null,
            role,
            convite.IdEmpresa
        ]);

        const novoUsuarioId = userResult.insertId;

        // 7. Marcar código como aceito
        await db.execute('UPDATE empresa_convites SET status = "aceito" WHERE id = ?', [convite.id]);

        // 8. Gerar Token JWT de acesso imediato
        const token = jwt.sign(
            {
                id: novoUsuarioId,
                login: cleanLogin,
                email: cleanEmail,
                nome: nome,
                tipo: role,
                TipoUsuario: role,
                IdEmpresa: convite.IdEmpresa,
                is_master: false,
                is_superadmin: false
            },
            SECRET_KEY,
            { expiresIn: '12h' }
        );

        res.status(201).json({
            message: `Cadastro realizado com sucesso! Você já está vinculado à empresa ${empresa.NomeFantasia || empresa.RazaoSocial}.`,
            token,
            user: {
                id: novoUsuarioId,
                nome: nome,
                login: cleanLogin,
                email: cleanEmail,
                tipo: role,
                TipoUsuario: role,
                IdEmpresa: convite.IdEmpresa,
                is_master: false,
                is_superadmin: false,
                aprovado: 1
            },
            empresa: {
                id: convite.IdEmpresa,
                nomeFantasia: empresa.NomeFantasia || empresa.RazaoSocial
            }
        });

    } catch (err) {
        console.error('Erro no cadastro com código de segurança:', err);
        res.status(500).json({
            error: 'Erro no servidor',
            message: 'Não foi possível concluir seu cadastro: ' + err.message
        });
    }
});

// Endpoint para validar a sessão atual e dados do Tenant
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const [userRows] = await db.execute(
            'SELECT idUsuario, NomeCompleto, Login, email, TipoUsuario, IdEmpresa, is_master FROM usuario WHERE idUsuario = ?',
            [req.user.id]
        );

        if (userRows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const user = userRows[0];
        const userEmailLower = (user.email || user.Login || '').toLowerCase().trim();
        const isSuperAdmin = (userEmailLower === 'edsonmanoel2012@gmail.com') || (user.TipoUsuario === 'superadmin') || (user.TipoUsuario === 'SA') || (user.idUsuario === 37);
        const effectiveRole = isSuperAdmin ? 'superadmin' : (user.TipoUsuario || 'operador');
        const effectiveIsMaster = isSuperAdmin || user.is_master === 1;
        const tenantId = user.IdEmpresa || 1;

        let empresaData = {
            id: tenantId,
            nomeFantasia: 'Empresa Principal',
            plano: 'enterprise',
            statusPlano: 'ativo',
            limiteUsuarios: 9999,
            trialExpiraEm: null
        };

        try {
            const [empRows] = await db.query(
                'SELECT IdEmpresa, RazaoSocial, NomeFantasia, plano, status_plano, trial_expira_em, limite_usuarios FROM empresa WHERE IdEmpresa = ?',
                [tenantId]
            );
            if (empRows.length > 0) {
                const emp = empRows[0];
                empresaData = {
                    id: emp.IdEmpresa,
                    nomeFantasia: emp.NomeFantasia || emp.RazaoSocial,
                    razaoSocial: emp.RazaoSocial,
                    plano: emp.plano || 'pro',
                    statusPlano: emp.status_plano || 'ativo',
                    limiteUsuarios: emp.limite_usuarios || 10,
                    trialExpiraEm: emp.trial_expira_em
                };
            }
        } catch (e) {}

        res.json({
            user: {
                id: user.idUsuario,
                nome: user.NomeCompleto,
                login: user.Login,
                email: user.email,
                tipo: effectiveRole,
                IdEmpresa: tenantId,
                is_master: effectiveIsMaster,
                is_superadmin: isSuperAdmin
            },
            empresa: empresaData
        });
    } catch (err) {
        console.error('Erro no /me:', err);
        res.status(500).json({ error: 'Erro ao verificar sessão' });
    }
});

module.exports = router;
module.exports.authenticateToken = authenticateToken;

