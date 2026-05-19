const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const mysqlPool = require('../services/mysqlService');
const nodemailer = require('nodemailer');
const { getCorporateEmailTemplate } = require('../utils/emailTemplate');
const { requirePermission } = require('../middlewares/rbac');

const SMTP_CONFIG = {
    host: 'smtp.task.com.br',
    port: 587,
    secure: false,
    auth: {
        user: 'sincometal@metalfisa.com.br',
        pass: 'Pro1042@sm'
    },
    tls: { rejectUnauthorized: false }
};

(async () => {
    try {
        const conn = await mysqlPool.getConnection();
        // MySQL 5.6 does not support IF NOT EXISTS on ADD COLUMN.
        // The columns have been added manually.
        console.log('✅ [Users Service] Migration check skipped (MySQL 5.6 compatibility).');
        conn.release();
    } catch (err) { }
})();

// LIST USERS (GET /)
router.get('/', async (req, res) => {
    try {
        const { setor } = req.query;
        let query = 'SELECT idUsuario, NomeCompleto, Login, TipoUsuario, Setor, Funcao, email, aprovado, Observacoes, TemPC, fotoUsuario, telefone, whatsapp FROM usuario';
        const params = [];
        const conditions = [];

        if (setor) {
            conditions.push('Setor = ?');
            params.push(setor);
        }
        
        if (req.query.aprovado !== undefined) {
             conditions.push('aprovado = ?');
             params.push(parseInt(req.query.aprovado));
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY NomeCompleto ASC';

        const [rows] = await mysqlPool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ error: 'Erro ao listar usuários' });
    }
});

// CREATE USER (POST /)
router.post('/', requirePermission('config', 'create'), async (req, res) => {
    try {
        const { nome, login, senha, tipo, telefone, email, whatsapp } = req.body;

        if (!nome || !login || !senha || !tipo) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }

        // Check availability
        const [existingLogin] = await mysqlPool.query('SELECT idUsuario FROM usuario WHERE Login = ?', [login]);
        if (existingLogin.length > 0) {
            return res.status(409).json({ error: 'Login já cadastrado' });
        }

        if (email) {
             const [existingEmail] = await mysqlPool.query('SELECT idUsuario FROM usuario WHERE email = ?', [email]);
             if (existingEmail.length > 0) {
                 return res.status(409).json({ error: 'Este e-mail já está sendo utilizado por outro usuário no sistema.' });
             }
        }

        const hashedPwd = await bcrypt.hash(senha, 10);

        const [result] = await mysqlPool.query(
            'INSERT INTO usuario (NomeCompleto, Login, Senha, TipoUsuario, Setor, Funcao, email, aprovado, Observacoes, TemPC, fotoUsuario, telefone, whatsapp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [nome, login, hashedPwd, tipo, req.body.setor || null, req.body.funcao || null, email || null, req.body.aprovado !== undefined ? req.body.aprovado : 1, req.body.observacoes || null, req.body.tem_pc ? 1 : 0, req.body.foto || null, telefone || null, whatsapp || null]
        );

        res.json({ message: 'Usuário cadastrado com sucesso!', id: result.insertId });

    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        res.status(500).json({ error: 'Erro ao criar usuário' });
    }
});

// UPDATE USER (PUT /:id)
router.put('/:id', requirePermission('config', 'edit'), async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, login, senha, tipo, telefone, email, whatsapp } = req.body;

        if (!nome || !login || !tipo) {
            return res.status(400).json({ error: 'Nome, Login e Tipo são obrigatórios' });
        }

        // Check if login is taken by ANOTHER user
        const [existing] = await mysqlPool.query(
            'SELECT idUsuario FROM usuario WHERE Login = ? AND idUsuario <> ?',
            [login, id]
        );
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Login já está em uso por outro usuário' });
        }
        
        if (email) {
            const [existingEmail] = await mysqlPool.query(
                'SELECT idUsuario FROM usuario WHERE email = ? AND idUsuario <> ?',
                [email, id]
            );
            if (existingEmail.length > 0) {
                 return res.status(409).json({ error: 'E-mail indisponível! Já foi registrado por outro membro ativo.' });
            }
        }

        const aprovadoVal = req.body.aprovado !== undefined ? req.body.aprovado : 1;

        if (senha && senha.trim() !== '') {
            // Update WITH password
            const hashedPwd = await bcrypt.hash(senha, 10);
            await mysqlPool.query(
                'UPDATE usuario SET NomeCompleto = ?, Login = ?, Senha = ?, TipoUsuario = ?, Setor = ?, Funcao = ?, email = ?, aprovado = ?, Observacoes = ?, TemPC = ?, fotoUsuario = ?, telefone = ?, whatsapp = ? WHERE idUsuario = ?',
                [nome, login, hashedPwd, tipo, req.body.setor || null, req.body.funcao || null, email || null, aprovadoVal, req.body.observacoes || null, req.body.tem_pc ? 1 : 0, req.body.foto || null, telefone || null, whatsapp || null, id]
            );
        } else {
            // Update WITHOUT password
            await mysqlPool.query(
                'UPDATE usuario SET NomeCompleto = ?, Login = ?, TipoUsuario = ?, Setor = ?, Funcao = ?, email = ?, aprovado = ?, Observacoes = ?, TemPC = ?, fotoUsuario = ?, telefone = ?, whatsapp = ? WHERE idUsuario = ?',
                [nome, login, tipo, req.body.setor || null, req.body.funcao || null, email || null, aprovadoVal, req.body.observacoes || null, req.body.tem_pc ? 1 : 0, req.body.foto || null, telefone || null, whatsapp || null, id]
            );
        }

        const loggedUserId = req.user ? req.user.id : 0;
        await mysqlPool.query(
            'INSERT INTO app_audit_logs (user_id, action, details) VALUES (?, ?, ?)',
            [loggedUserId, 'UPDATE_USER_DATA', JSON.stringify({ targetUserId: id, newRole: tipo, approved: aprovadoVal })]
        );

        res.json({ message: 'Usuário atualizado com sucesso!' });

    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).json({ error: 'Erro ao atualizar usuário: ' + error.message });
    }
});

// DELETE USER (DELETE /:id)
router.delete('/:id', requirePermission('config', 'delete'), async (req, res) => {
    try {
        const { id } = req.params;
        await mysqlPool.query('DELETE FROM usuario WHERE idUsuario = ?', [id]);
        res.json({ message: 'Usuário removido com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar usuário:', error);
        res.status(500).json({ error: 'Erro ao deletar usuário' });
    }
});

// ──── User Preferences ─────────────────────────────────────────────────────────

// GET /preferences/:key — load a preference for the authenticated user
router.get('/preferences/:key', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Usuário não autenticado' });

        const [rows] = await mysqlPool.query(
            'SELECT pref_value FROM app_user_preferences WHERE user_id = ? AND pref_key = ?',
            [userId, req.params.key]
        );

        if (rows.length === 0) return res.json({ value: null });

        try {
            res.json({ value: JSON.parse(rows[0].pref_value) });
        } catch {
            res.json({ value: rows[0].pref_value });
        }
    } catch (error) {
        console.error('Erro ao carregar preferência:', error);
        res.status(500).json({ error: 'Erro ao carregar preferência' });
    }
});

// PUT /preferences/:key — save a preference for the authenticated user
router.put('/preferences/:key', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Usuário não autenticado' });

        const value = JSON.stringify(req.body.value);

        await mysqlPool.query(
            `INSERT INTO app_user_preferences (user_id, pref_key, pref_value)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE pref_value = VALUES(pref_value)`,
            [userId, req.params.key, value]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao salvar preferência:', error);
        res.status(500).json({ error: 'Erro ao salvar preferência' });
    }
});
// ──── User Permissions (RBAC) ──────────────────────────────────────────────────

// GET /my-permissions — load permissions for the currently authenticated user
router.get('/my-permissions', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Usuário não autenticado' });

        const [rows] = await mysqlPool.query(
            'SELECT page_id, can_view, can_create, can_edit, can_delete FROM app_user_permissions WHERE user_id = ?',
            [userId]
        );
        res.json(rows);
    } catch (error) {
        console.error('Erro ao carregar permissões:', error);
        res.status(500).json({ error: 'Erro ao carregar permissões' });
    }
});

// GET /permissions/:userId — admin loads permissions for a specific user
router.get('/permissions/:userId', async (req, res) => {
    try {
        if (req.params.userId.startsWith('PROFILE_')) {
            return res.json([]);
        }
        
        const [rows] = await mysqlPool.query(
            'SELECT page_id, can_view, can_create, can_edit, can_delete FROM app_user_permissions WHERE user_id = ?',
            [req.params.userId]
        );
        res.json(rows);
    } catch (error) {
        console.error('Erro ao carregar permissões do usuário:', error);
        res.status(500).json({ error: 'Erro ao carregar permissões' });
    }
});

// PUT /permissions/:userId — admin bulk-saves permissions for a user
router.put('/permissions/:userId', requirePermission('config', 'edit'), async (req, res) => {
    try {
        const { userId } = req.params;
        const { permissions } = req.body; // array of { page_id, can_view, can_create, can_edit, can_delete }
        const loggedUserId = req.user ? req.user.id : 0;

        if (!Array.isArray(permissions)) {
            return res.status(400).json({ error: 'permissions deve ser um array' });
        }

        // Atomic: delete all existing then insert new
        const conn = await mysqlPool.getConnection();
        try {
            await conn.beginTransaction();
            if (userId.startsWith('PROFILE_')) {
                const profileType = userId.split('_')[1];
                const [targetUsers] = await conn.query('SELECT idUsuario FROM usuario WHERE TipoUsuario = ? AND aprovado = 1', [profileType]);
                
                if (targetUsers.length > 0) {
                    const userIds = targetUsers.map(u => u.idUsuario);
                    await conn.query('DELETE FROM app_user_permissions WHERE user_id IN (?)', [userIds]);

                    if (permissions.length > 0) {
                        const values = [];
                        for (const u of userIds) {
                            for (const p of permissions) {
                                values.push([
                                    u,
                                    p.page_id,
                                    p.can_view ? 1 : 0,
                                    p.can_create ? 1 : 0,
                                    p.can_edit ? 1 : 0,
                                    p.can_delete ? 1 : 0
                                ]);
                            }
                        }
                        await conn.query(
                            'INSERT INTO app_user_permissions (user_id, page_id, can_view, can_create, can_edit, can_delete) VALUES ?',
                            [values]
                        );
                    }
                }
                
                // Audit Log for profile update
                await conn.query(
                    'INSERT INTO app_audit_logs (user_id, action, details) VALUES (?, ?, ?)',
                    [loggedUserId, 'UPDATE_PROFILE_PERMISSIONS', JSON.stringify({ profileType, permissionsCount: permissions.length })]
                );
            } else {
                await conn.query('DELETE FROM app_user_permissions WHERE user_id = ?', [userId]);

                if (permissions.length > 0) {
                    const values = permissions.map(p => [
                        parseInt(userId),
                        p.page_id,
                        p.can_view ? 1 : 0,
                        p.can_create ? 1 : 0,
                        p.can_edit ? 1 : 0,
                        p.can_delete ? 1 : 0
                    ]);
                    await conn.query(
                        'INSERT INTO app_user_permissions (user_id, page_id, can_view, can_create, can_edit, can_delete) VALUES ?',
                        [values]
                    );
                }

                // Audit Log for user update
                await conn.query(
                    'INSERT INTO app_audit_logs (user_id, action, details) VALUES (?, ?, ?)',
                    [loggedUserId, 'UPDATE_USER_PERMISSIONS', JSON.stringify({ targetUserId: userId, permissionsCount: permissions.length })]
                );
            }

            await conn.commit();
            res.json({ success: true });
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Erro ao salvar permissões:', error);
        res.status(500).json({ error: 'Erro ao salvar permissões' });
    }
});

// ──── Send Credentials Email ───────────────────────────────────────────────────

// POST /send-credentials — sends access credentials via email or whatsapp to selected users
router.post('/send-credentials', requirePermission('config', 'edit'), async (req, res) => {
    try {
        const { userIds, method = 'email', passwordDisplay } = req.body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ error: 'Selecione ao menos um usuário.' });
        }

        const placeholders = userIds.map(() => '?').join(',');
        const [users] = await mysqlPool.query(
            `SELECT idUsuario, NomeCompleto, Login, email, whatsapp, TipoUsuario, Setor, Funcao 
             FROM usuario WHERE idUsuario IN (${placeholders})`,
            userIds
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'Nenhum usuário encontrado.' });
        }

        const results = { success: [], failed: [] };
        const serverUrl = process.env.APP_URL || 'http://192.168.1.77:3001/login';

        for (const user of users) {
            // Check delivery method contact info first to avoid resetting password if it will fail
            if (method === 'whatsapp' && !user.whatsapp) {
                results.failed.push({ id: user.idUsuario, nome: user.NomeCompleto, reason: 'Sem WhatsApp cadastrado' });
                continue;
            }
            if (method === 'email' && !user.email) {
                results.failed.push({ id: user.idUsuario, nome: user.NomeCompleto, reason: 'Sem e-mail cadastrado' });
                continue;
            }

            // Generate or use provided password
            const newPassword = passwordDisplay && passwordDisplay.trim() !== '' 
                ? passwordDisplay.trim() 
                : Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit random password

            // Hash and update the password in DB
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await mysqlPool.query('UPDATE usuario SET Senha = ? WHERE idUsuario = ?', [hashedPassword, user.idUsuario]);

            const tipoLabel = {
                'SA': 'SuperAdmin',
                'A': 'Administrador',
                'U': 'Usuário',
                'C': 'Conferente',
                'AP': 'Apontador',
                'CLI': 'Cliente'
            }[user.TipoUsuario] || user.TipoUsuario;

            if (method === 'whatsapp') {
                const { sendText } = require('../services/whatsapp');
                const textMessage = `*Seus Dados de Acesso ao Sistema*\n\nOlá, *${user.NomeCompleto}*!\nSua senha do *ERP da Metalfisa* foi redefinida.\n\n👤 *Usuário:* ${user.Login}\n🔑 *Senha:* ${newPassword}\n\n🌐 *Como Acessar*\nAbra o navegador e acesse: ${serverUrl}\n\n⚠️ _Importante: Estas credenciais são pessoais e intransferíveis._`;

                try {
                    const waResults = await sendText(user.whatsapp, textMessage, 'Recuperação de Senha');
                    const waRes = waResults[0];

                    if (waRes && waRes.ok) {
                        results.success.push({ id: user.idUsuario, nome: user.NomeCompleto, whatsapp: user.whatsapp });
                    } else {
                        const errReason = waRes ? JSON.stringify(waRes.error) : 'Unknown Error';
                        results.failed.push({ id: user.idUsuario, nome: user.NomeCompleto, reason: errReason });
                    }
                } catch (whatsErr) {
                    console.error(`[WhatsApp] Erro ao enviar para ${user.whatsapp}:`, whatsErr.message);
                    results.failed.push({ id: user.idUsuario, nome: user.NomeCompleto, reason: whatsErr.message });
                }
            } else {
                const transporter = nodemailer.createTransport(SMTP_CONFIG);
                const emailHtml = `
                    <h2 style="color: #0284c7; margin-top: 0; font-family: 'Segoe UI', Arial, sans-serif;">Recuperação de Senha</h2>
                    <p style="font-size: 15px;">Olá, <b>${user.NomeCompleto}</b>!</p>
                    <p style="font-size: 15px; color: #475569;">Sua senha de acesso ao <b>Sistema ERP da Metalfisa</b> foi redefinida. Utilize as novas informações abaixo para efetuar seu login:</p>
                    
                    <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 24px; border-radius: 12px; margin: 25px 0; border: 1px solid #bae6fd;">
                        <table style="border-collapse: collapse; width: 100%;">
                            <tr>
                                <td style="padding: 8px 0; font-size: 14px; color: #64748b; width: 120px; vertical-align: top;"><b>👤 Usuário:</b></td>
                                <td style="padding: 8px 0; font-size: 16px; color: #0f172a; font-weight: bold; font-family: 'Courier New', monospace; background: #ffffff; padding: 6px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">${user.Login}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-size: 14px; color: #64748b; width: 120px; vertical-align: top;"><b>🔑 Nova Senha:</b></td>
                                <td style="padding: 8px 0; font-size: 16px; color: #0f172a; font-weight: bold; font-family: 'Courier New', monospace; background: #ffffff; padding: 6px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">${newPassword}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-size: 14px; color: #64748b; width: 120px;"><b>🏷️ Perfil:</b></td>
                                <td style="padding: 8px 0; font-size: 14px; color: #334155;">${tipoLabel}</td>
                            </tr>
                            ${user.Setor ? `
                            <tr>
                                <td style="padding: 8px 0; font-size: 14px; color: #64748b; width: 120px;"><b>🏢 Setor:</b></td>
                                <td style="padding: 8px 0; font-size: 14px; color: #334155;">${user.Setor}${user.Funcao ? ` — ${user.Funcao}` : ''}</td>
                            </tr>
                            ` : ''}
                        </table>
                    </div>

                    <div style="background: #f8fafc; border-radius: 10px; padding: 16px 20px; margin: 20px 0; border-left: 4px solid #0ea5e9;">
                        <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold; color: #0369a1;">🌐 Como Acessar</p>
                        <p style="margin: 0; font-size: 14px; color: #475569;">
                            Abra o navegador e acesse: <a href="${serverUrl}" style="color: #0284c7; text-decoration: underline; font-weight: bold;">${serverUrl}</a>
                        </p>
                    </div>

                    <div style="background: #fffbeb; border-radius: 8px; padding: 14px 18px; margin-top: 20px; border: 1px solid #fde68a;">
                        <p style="margin: 0; font-size: 13px; color: #92400e;">
                            ⚠️ <b>Importante:</b> Estas credenciais são pessoais e intransferíveis. Por segurança, recomendamos que você exclua este e-mail após anotar seus dados ou guarde-o em local seguro.
                        </p>
                    </div>
                `;

                try {
                    await transporter.sendMail({
                        from: '"MetalFisa ERP" <sincometal@metalfisa.com.br>',
                        to: user.email,
                        subject: '🔐 Nova Senha de Acesso — MetalFisa ERP',
                        html: getCorporateEmailTemplate(emailHtml)
                    });

                    results.success.push({ id: user.idUsuario, nome: user.NomeCompleto, email: user.email });
                } catch (emailErr) {
                    console.error(`[SMTP] Erro ao enviar credenciais para ${user.email}:`, emailErr.message);
                    results.failed.push({ id: user.idUsuario, nome: user.NomeCompleto, reason: emailErr.message });
                }
            }
        }

        res.json({
            message: `Redefinição concluída: ${results.success.length} enviado(s), ${results.failed.length} falha(s).`,
            results
        });
    } catch (error) {
        console.error('Erro ao enviar credenciais:', error);
        res.status(500).json({ error: 'Erro ao redefinir e enviar credenciais: ' + error.message });
    }
});

module.exports = router;
