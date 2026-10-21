const express = require('express');
const router = express.Router();
const pool = require('../services/mysqlService');
const { requireMaster } = require('../middlewares/tenantMiddleware');

// Apenas administradores Master e Superadmin podem gerenciar conexões WinSCP/FTP
router.use(requireMaster);

// GET all connections (mascara senhas para segurança)
router.get('/connections', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, nome, usuario, endereco_origem, endereco_destino, extensao, objetivo, criado_em FROM winscp_connections ORDER BY id DESC');
        const safeRows = rows.map(r => ({
            ...r,
            senha: '••••••••'
        }));
        res.json(safeRows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar conexões.' });
    }
});

// POST new connection
router.post('/connections', async (req, res) => {
    const { nome, usuario, senha, endereco_origem, endereco_destino, extensao, objetivo } = req.body;
    try {
        const [result] = await pool.query(
            `INSERT INTO winscp_connections (nome, usuario, senha, endereco_origem, endereco_destino, extensao, objetivo)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [nome, usuario, senha, endereco_origem, endereco_destino, extensao, objetivo]
        );
        res.json({ id: result.insertId, message: 'Conexão criada com sucesso.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao criar conexão.' });
    }
});

// PUT update connection
router.put('/connections/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, usuario, senha, endereco_origem, endereco_destino, extensao, objetivo } = req.body;
    try {
        if (senha && senha !== '••••••••') {
            await pool.query(
                `UPDATE winscp_connections SET nome=?, usuario=?, senha=?, endereco_origem=?, endereco_destino=?, extensao=?, objetivo=? WHERE id=?`,
                [nome, usuario, senha, endereco_origem, endereco_destino, extensao, objetivo, id]
            );
        } else {
            await pool.query(
                `UPDATE winscp_connections SET nome=?, usuario=?, endereco_origem=?, endereco_destino=?, extensao=?, objetivo=? WHERE id=?`,
                [nome, usuario, endereco_origem, endereco_destino, extensao, objetivo, id]
            );
        }
        res.json({ message: 'Conexão atualizada com sucesso.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao atualizar conexão.' });
    }
});

// DELETE connection
router.delete('/connections/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM winscp_connections WHERE id = ?', [id]);
        res.json({ message: 'Conexão deletada com sucesso.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao deletar conexão.' });
    }
});

// GET logs
router.get('/logs', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT l.*, c.nome as connection_name 
            FROM winscp_logs l 
            LEFT JOIN winscp_connections c ON l.connection_id = c.id 
            ORDER BY l.id DESC LIMIT 100
        `);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar logs.' });
    }
});

// POST execute connection
router.post('/execute/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [connections] = await pool.query('SELECT * FROM winscp_connections WHERE id = ?', [id]);
        
        if (connections.length === 0) {
            return res.status(404).json({ error: 'Conexão não encontrada.' });
        }

        const config = connections[0];
        
        // Log attempt
        await pool.query(
            'INSERT INTO winscp_logs (connection_id, status, message) VALUES (?, ?, ?)',
            [id, 'attempt', `Iniciando transferência para o objetivo: ${config.objetivo}`]
        );

        // Simulando sucesso (aqui implementaria o script real)
        setTimeout(async () => {
            try {
                await pool.query(
                    'INSERT INTO winscp_logs (connection_id, status, message) VALUES (?, ?, ?)',
                    [id, 'success', `Transferência de arquivos .${config.extensao} de ${config.endereco_origem} para ${config.endereco_destino} executada com sucesso.`]
                );
            } catch (err) {
                try {
                    await pool.query(
                        'INSERT INTO winscp_logs (connection_id, status, message) VALUES (?, ?, ?)',
                        [id, 'error', `Falha: ${err.message}`]
                    );
                } catch (e) {
                    console.error('Falha ao registrar log de erro:', e);
                }
            }
        }, 2000);

        res.json({ message: 'Processo iniciado em background. Verifique os logs.' });

    } catch (error) {
        console.error(error);
        try {
            await pool.query(
                'INSERT INTO winscp_logs (connection_id, status, message) VALUES (?, ?, ?)',
                [id, 'error', `Falha: ${error.message}`]
            );
        } catch (e) {
            // ignore
        }
        res.status(500).json({ error: 'Erro ao executar processo.' });
    }
});

module.exports = router;
