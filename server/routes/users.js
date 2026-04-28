const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const nodemailer = require('nodemailer');
const { getCorporateEmailTemplate } = require('../utils/emailTemplate');

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
        await conn.execute("ALTER TABLE usuario ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL");
        await conn.execute("ALTER TABLE usuario ADD COLUMN IF NOT EXISTS aprovado TINYINT DEFAULT 1");
        console.log('✅ [Users Service] Colunas de E-mail/Aprovação vidadadas na tabela usuario.');
        conn.release();
    } catch (err) { }
})();

// LIST USERS (GET /)
router.get('/', async (req, res) => {
    try {
        const { setor } = req.query;
        let query = 'SELECT idUsuario, NomeCompleto, Login, TipoUsuario, Setor, Funcao, email, aprovado, Observacoes, TemPC, fotoUsuario, telefone FROM usuario';
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
router.post('/', async (req, res) => {
    try {
        const { nome, login, senha, tipo, telefone, email } = req.body;

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

        const [result] = await mysqlPool.query(
            'INSERT INTO usuario (NomeCompleto, Login, Senha, TipoUsuario, Setor, Funcao, email, aprovado, Observacoes, TemPC, fotoUsuario, telefone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [nome, login, senha, tipo, req.body.setor || null, req.body.funcao || null, email || null, req.body.aprovado !== undefined ? req.body.aprovado : 1, req.body.observacoes || null, req.body.tem_pc ? 1 : 0, req.body.foto || null, telefone || null]
        );

        res.json({ message: 'Usuário cadastrado com sucesso!', id: result.insertId });

    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        res.status(500).json({ error: 'Erro ao criar usuário' });
    }
});

// UPDATE USER (PUT /:id)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, login, senha, tipo, telefone, email } = req.body;

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
            await mysqlPool.query(
                'UPDATE usuario SET NomeCompleto = ?, Login = ?, Senha = ?, TipoUsuario = ?, Setor = ?, Funcao = ?, email = ?, aprovado = ?, Observacoes = ?, TemPC = ?, fotoUsuario = ?, telefone = ? WHERE idUsuario = ?',
                [nome, login, senha, tipo, req.body.setor || null, req.body.funcao || null, email || null, aprovadoVal, req.body.observacoes || null, req.body.tem_pc ? 1 : 0, req.body.foto || null, telefone || null, id]
            );
        } else {
            // Update WITHOUT password
            await mysqlPool.query(
                'UPDATE usuario SET NomeCompleto = ?, Login = ?, TipoUsuario = ?, Setor = ?, Funcao = ?, email = ?, aprovado = ?, Observacoes = ?, TemPC = ?, fotoUsuario = ?, telefone = ? WHERE idUsuario = ?',
                [nome, login, tipo, req.body.setor || null, req.body.funcao || null, email || null, aprovadoVal, req.body.observacoes || null, req.body.tem_pc ? 1 : 0, req.body.foto || null, telefone || null, id]
            );
        }

        res.json({ message: 'Usuário atualizado com sucesso!' });

    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }
});

// DELETE USER (DELETE /:id)
router.delete('/:id', async (req, res) => {
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
router.put('/permissions/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { permissions } = req.body; // array of { page_id, can_view, can_create, can_edit, can_delete }

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

// POST /send-credentials — sends access credentials via email to selected users
router.post('/send-credentials', async (req, res) => {
    try {
        const { userIds } = req.body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ error: 'Selecione ao menos um usuário.' });
        }

        // Fetch users with their passwords (plain text stored in DB)
        const placeholders = userIds.map(() => '?').join(',');
        const [users] = await mysqlPool.query(
            `SELECT idUsuario, NomeCompleto, Login, Senha, email, TipoUsuario, Setor, Funcao 
             FROM usuario WHERE idUsuario IN (${placeholders})`,
            userIds
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'Nenhum usuário encontrado.' });
        }

        const transporter = nodemailer.createTransport(SMTP_CONFIG);
        const results = { success: [], failed: [] };

        // Determine access URL
        const serverUrl = process.env.APP_URL || 'https://metalfisa.lynxems.com.br';

        for (const user of users) {
            if (!user.email) {
                results.failed.push({ id: user.idUsuario, nome: user.NomeCompleto, reason: 'Sem e-mail cadastrado' });
                continue;
            }

            const tipoLabel = {
                'SA': 'SuperAdmin',
                'A': 'Administrador',
                'U': 'Usuário',
                'C': 'Conferente',
                'AP': 'Apontador',
                'CLI': 'Cliente'
            }[user.TipoUsuario] || user.TipoUsuario;

            const emailHtml = `
                <h2 style="color: #0284c7; margin-top: 0; font-family: 'Segoe UI', Arial, sans-serif;">Seus Dados de Acesso ao Sistema</h2>
                <p style="font-size: 15px;">Olá, <b>${user.NomeCompleto}</b>!</p>
                <p style="font-size: 15px; color: #475569;">Você está recebendo os seus dados de acesso ao <b>Sistema ERP da Metalfisa</b>. Utilize as informações abaixo para efetuar seu login:</p>
                
                <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 24px; border-radius: 12px; margin: 25px 0; border: 1px solid #bae6fd;">
                    <table style="border-collapse: collapse; width: 100%;">
                        <tr>
                            <td style="padding: 8px 0; font-size: 14px; color: #64748b; width: 120px; vertical-align: top;"><b>👤 Usuário:</b></td>
                            <td style="padding: 8px 0; font-size: 16px; color: #0f172a; font-weight: bold; font-family: 'Courier New', monospace; background: #ffffff; padding: 6px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">${user.Login}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; font-size: 14px; color: #64748b; width: 120px; vertical-align: top;"><b>🔑 Senha:</b></td>
                            <td style="padding: 8px 0; font-size: 16px; color: #0f172a; font-weight: bold; font-family: 'Courier New', monospace; background: #ffffff; padding: 6px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">${user.Senha}</td>
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
                    subject: '🔐 Seus Dados de Acesso — MetalFisa ERP',
                    html: getCorporateEmailTemplate(emailHtml)
                });

                results.success.push({ id: user.idUsuario, nome: user.NomeCompleto, email: user.email });
            } catch (emailErr) {
                console.error(`[SMTP] Erro ao enviar credenciais para ${user.email}:`, emailErr.message);
                results.failed.push({ id: user.idUsuario, nome: user.NomeCompleto, reason: emailErr.message });
            }
        }

        res.json({
            message: `Envio concluído: ${results.success.length} enviado(s), ${results.failed.length} falha(s).`,
            results
        });
    } catch (error) {
        console.error('Erro ao enviar credenciais:', error);
        res.status(500).json({ error: 'Erro ao enviar credenciais: ' + error.message });
    }
});

module.exports = router;
