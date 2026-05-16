const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const { authenticateToken } = require('./auth'); // Assuming auth.js exports this

router.use(authenticateToken);

// Garante que a tabela exista ao carregar a rota
(async () => {
    try {
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_system_errors (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                route VARCHAR(255) NOT NULL,
                error_details TEXT,
                status ENUM('Pendente', 'Resolvido', 'Cancelado') DEFAULT 'Pendente',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                resolved_at DATETIME NULL,
                resolved_by INT NULL
            )
        `);
    } catch (e) {
        console.error('[System Errors] Erro ao criar tabela:', e.message);
    }
})();

// GET /api/system-errors
// Returns a list of system errors
router.get('/', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(`
            SELECT e.*, u.NomeCompleto AS user_name, r.NomeCompleto AS resolver_name
            FROM app_system_errors e
            LEFT JOIN usuario u ON e.user_id = u.idUsuario
            LEFT JOIN usuario r ON e.resolved_by = r.idUsuario
            ORDER BY e.created_at DESC
            LIMIT 200
        `);
        res.json(rows);
    } catch (err) {
        console.error('[System Errors] Erro ao buscar erros:', err.message);
        res.status(500).json({ error: 'Erro ao buscar histórico de erros do sistema.' });
    }
});

// PUT /api/system-errors/:id/status
// Updates the status of a specific error
router.put('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'Pendente', 'Resolvido', 'Cancelado'
        const userId = req.user.id;

        if (!['Pendente', 'Resolvido', 'Cancelado'].includes(status)) {
            return res.status(400).json({ error: 'Status inválido.' });
        }

        let resolvedAt = null;
        let resolvedBy = null;

        if (status === 'Resolvido' || status === 'Cancelado') {
            resolvedAt = new Date();
            resolvedBy = userId;
            
            await mysqlPool.query(
                `UPDATE app_system_errors SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ?`,
                [status, resolvedAt, resolvedBy, id]
            );
        } else {
            await mysqlPool.query(
                `UPDATE app_system_errors SET status = ?, resolved_at = NULL, resolved_by = NULL WHERE id = ?`,
                [status, id]
            );
        }

        res.json({ message: 'Status atualizado com sucesso.' });
    } catch (err) {
        console.error('[System Errors] Erro ao atualizar status:', err.message);
        res.status(500).json({ error: 'Erro ao atualizar status do erro.' });
    }
});

// DELETE /api/system-errors/:id
// Exclui um erro definitivamente
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await mysqlPool.query(`DELETE FROM app_system_errors WHERE id = ?`, [id]);
        res.json({ message: 'Erro excluído com sucesso.' });
    } catch (err) {
        console.error('[System Errors] Erro ao excluir erro:', err.message);
        res.status(500).json({ error: 'Erro ao excluir erro do sistema.' });
    }
});

module.exports = router;
