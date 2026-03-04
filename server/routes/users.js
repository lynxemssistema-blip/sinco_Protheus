const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');

// LIST USERS (GET /)
router.get('/', async (req, res) => {
    try {
        const { setor } = req.query;
        let query = 'SELECT idUsuario, NomeCompleto, Login, TipoUsuario, Setor, Funcao, Observacoes, TemPC, fotoUsuario, telefone FROM usuario';
        const params = [];

        if (setor) {
            query += ' WHERE Setor = ?';
            params.push(setor);
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
        const { nome, login, senha, tipo, telefone } = req.body;

        if (!nome || !login || !senha || !tipo) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }

        // Check availability
        const [existing] = await mysqlPool.query('SELECT idUsuario FROM usuario WHERE Login = ?', [login]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Login já cadastrado' });
        }

        const [result] = await mysqlPool.query(
            'INSERT INTO usuario (NomeCompleto, Login, Senha, TipoUsuario, Setor, Funcao, Observacoes, TemPC, fotoUsuario, telefone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [nome, login, senha, tipo, req.body.setor || null, req.body.funcao || null, req.body.observacoes || null, req.body.tem_pc ? 1 : 0, req.body.foto || null, telefone || null]
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
        const { nome, login, senha, tipo, telefone } = req.body;

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

        if (senha && senha.trim() !== '') {
            // Update WITH password
            await mysqlPool.query(
                'UPDATE usuario SET NomeCompleto = ?, Login = ?, Senha = ?, TipoUsuario = ?, Setor = ?, Funcao = ?, Observacoes = ?, TemPC = ?, fotoUsuario = ?, telefone = ? WHERE idUsuario = ?',
                [nome, login, senha, tipo, req.body.setor || null, req.body.funcao || null, req.body.observacoes || null, req.body.tem_pc ? 1 : 0, req.body.foto || null, telefone || null, id]
            );
        } else {
            // Update WITHOUT password
            await mysqlPool.query(
                'UPDATE usuario SET NomeCompleto = ?, Login = ?, TipoUsuario = ?, Setor = ?, Funcao = ?, Observacoes = ?, TemPC = ?, fotoUsuario = ?, telefone = ? WHERE idUsuario = ?',
                [nome, login, tipo, req.body.setor || null, req.body.funcao || null, req.body.observacoes || null, req.body.tem_pc ? 1 : 0, req.body.foto || null, telefone || null, id]
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

module.exports = router;
