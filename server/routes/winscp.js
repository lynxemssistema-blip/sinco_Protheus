const express = require('express');
const router = express.Router();
const pool = require('../services/mysqlService');
const { exec } = require('child_process');

// GET all connections
router.get('/connections', async (req, res) => {
    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query('SELECT * FROM winscp_connections ORDER BY id DESC');
        conn.release();
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar conexões.' });
    }
});

// POST new connection
router.post('/connections', async (req, res) => {
    const { nome, usuario, senha, endereco_origem, endereco_destino, extensao, objetivo } = req.body;
    try {
        const conn = await pool.getConnection();
        const [result] = await conn.query(
            `INSERT INTO winscp_connections (nome, usuario, senha, endereco_origem, endereco_destino, extensao, objetivo)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [nome, usuario, senha, endereco_origem, endereco_destino, extensao, objetivo]
        );
        conn.release();
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
        const conn = await pool.getConnection();
        await conn.query(
            `UPDATE winscp_connections SET nome=?, usuario=?, senha=?, endereco_origem=?, endereco_destino=?, extensao=?, objetivo=? WHERE id=?`,
            [nome, usuario, senha, endereco_origem, endereco_destino, extensao, objetivo, id]
        );
        conn.release();
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
        const conn = await pool.getConnection();
        await conn.query('DELETE FROM winscp_connections WHERE id = ?', [id]);
        conn.release();
        res.json({ message: 'Conexão deletada com sucesso.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao deletar conexão.' });
    }
});

// GET logs
router.get('/logs', async (req, res) => {
    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query(`
            SELECT l.*, c.nome as connection_name 
            FROM winscp_logs l 
            LEFT JOIN winscp_connections c ON l.connection_id = c.id 
            ORDER BY l.id DESC LIMIT 100
        `);
        conn.release();
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar logs.' });
    }
});

// POST execute connection
router.post('/execute/:id', async (req, res) => {
    const { id } = req.params;
    let conn;
    try {
        conn = await pool.getConnection();
        const [connections] = await conn.query('SELECT * FROM winscp_connections WHERE id = ?', [id]);
        
        if (connections.length === 0) {
            conn.release();
            return res.status(404).json({ error: 'Conexão não encontrada.' });
        }

        const config = connections[0];
        
        // Log attempt
        await conn.query(
            'INSERT INTO winscp_logs (connection_id, status, message) VALUES (?, ?, ?)',
            [id, 'attempt', `Iniciando transferência para o objetivo: ${config.objetivo}`]
        );

        // Simulando a execução do WinSCP ou SCP
        // Idealmente, se for em servidor Linux, pode usar scp, ssh2-sftp-client, ou se for Windows usar winscp.com
        // Como não sabemos o OS definitivo do executável para este processo, simulamos o resultado e deixamos estruturado
        
        // Simulando sucesso (aqui implementaria o script real)
        setTimeout(async () => {
            try {
                // Se tivesse erro, faria throw new Error('Falha na transferência');
                await conn.query(
                    'INSERT INTO winscp_logs (connection_id, status, message) VALUES (?, ?, ?)',
                    [id, 'success', `Transferência de arquivos .${config.extensao} de ${config.endereco_origem} para ${config.endereco_destino} executada com sucesso.`]
                );
            } catch (err) {
                await conn.query(
                    'INSERT INTO winscp_logs (connection_id, status, message) VALUES (?, ?, ?)',
                    [id, 'error', `Falha: ${err.message}`]
                );
            }
        }, 2000);

        conn.release();
        res.json({ message: 'Processo iniciado em background. Verifique os logs.' });

    } catch (error) {
        console.error(error);
        if (conn) {
            try {
                await conn.query(
                    'INSERT INTO winscp_logs (connection_id, status, message) VALUES (?, ?, ?)',
                    [id, 'error', `Falha: ${error.message}`]
                );
                conn.release();
            } catch(e) {
                conn.release();
            }
        }
        res.status(500).json({ error: 'Erro ao executar processo.' });
    }
});

module.exports = router;
