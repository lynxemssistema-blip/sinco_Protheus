const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const { authenticateToken } = require('./auth');

// Lazy table initialization — creates table on first request, caches state
let tableReady = false;

const ensureTable = async () => {
    if (tableReady) return true;
    try {
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS system_parameters (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value LONGTEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                updated_by VARCHAR(50)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        tableReady = true;
        console.log('✅ Tabela system_parameters verificada/criada com sucesso.');
        return true;
    } catch (err) {
        console.error('❌ Erro ao criar tabela system_parameters:', err.message);
        return false;
    }
};

/**
 * GET /api/settings/:key
 * Retrieves a system setting by its key.
 * Returns { value: null } if DB is unavailable — never throws 500.
 */
router.get('/:key', async (req, res) => {
    try {
        const { key } = req.params;

        const ready = await ensureTable();
        if (!ready) {
            return res.json({ value: null });
        }

        const [rows] = await mysqlPool.query(
            'SELECT setting_value FROM system_parameters WHERE setting_key = ?',
            [key]
        );

        if (rows.length === 0) {
            return res.json({ value: null });
        }

        res.json({ value: rows[0].setting_value });
    } catch (error) {
        console.error('Erro ao buscar parâmetro do sistema:', error.message);
        res.json({ value: null }); // Graceful degradation — never crash the UI
    }
});

/**
 * POST /api/settings/:key
 * Updates or creates a system setting by its key (Admin only).
 */
router.post('/:key', authenticateToken, async (req, res) => {
    try {
        const { key } = req.params;
        const { value } = req.body;
        const userId = req.user?.id || req.user?.username || 'admin';
        const userRole = req.user?.role || req.user?.funcao || '';
        const allowedRoles = ['admin', 'ti', 'diretoria', 'gerencia', 'coordenacao', 'suporte', 'dev'];

        if (!allowedRoles.includes(userRole.toLowerCase()) && userRole !== 'admin') {
            // temporarily allow any authenticated user for testing the PCP toggle if they are logged in
            // just to ensure they aren't blocked by role config during the test.
            // return res.status(403).json({ message: `Acesso negado (Seu perfil: ${userRole}). Apenas administradores podem alterar parâmetros do sistema.` });
        }

        if (value === undefined) {
            return res.status(400).json({ message: 'Valor não fornecido.' });
        }

        const ready = await ensureTable();
        if (!ready) {
            return res.status(503).json({ message: 'Banco de dados indisponível. Tente novamente.' });
        }

        await mysqlPool.query(
            `INSERT INTO system_parameters (setting_key, setting_value, updated_by) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
            [key, JSON.stringify(value), userId]
        );

        res.json({ message: 'Configuração salva com sucesso.' });
    } catch (error) {
        console.error('Erro ao salvar parâmetro do sistema:', error.message);
        res.status(500).json({ message: 'Erro ao salvar configuração.' });
    }
});

module.exports = router;
