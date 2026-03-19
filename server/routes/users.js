const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');

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

module.exports = router;
