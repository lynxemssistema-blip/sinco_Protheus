const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');

// Initialize table
(async () => {
    try {
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_engineering_timesheets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                pedido VARCHAR(50) NOT NULL,
                item VARCHAR(20) NOT NULL,
                usuario VARCHAR(100) NOT NULL,
                start_time DATETIME NOT NULL,
                end_time DATETIME DEFAULT NULL,
                duration_seconds INT DEFAULT 0,
                entry_type ENUM('AUTO', 'MANUAL') DEFAULT 'AUTO',
                obs TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_pedido_item (pedido, item),
                INDEX idx_usuario (usuario)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ [DB] Tabela app_engineering_timesheets verificada.');
    } catch (err) {
        console.error('❌ Erro ao criar tabela app_engineering_timesheets:', err);
    }
})();

// GET active timer for current user
router.get('/active', async (req, res) => {
    try {
        const userName = req.user?.nome || req.user?.login;
        if (!userName) return res.status(401).json({ error: 'Usuário não autenticado' });

        const [rows] = await mysqlPool.query(
            `SELECT * FROM app_engineering_timesheets 
             WHERE usuario = ? AND end_time IS NULL AND entry_type = 'AUTO' 
             ORDER BY start_time DESC LIMIT 1`,
            [userName]
        );

        if (rows.length > 0) {
            return res.json({ activeTimer: rows[0] });
        }
        res.json({ activeTimer: null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET timesheets for a specific order/item
router.get('/:pedido/:item', async (req, res) => {
    try {
        const { pedido, item } = req.params;
        const [rows] = await mysqlPool.query(
            `SELECT * FROM app_engineering_timesheets 
             WHERE pedido = ? AND item = ?
             ORDER BY start_time DESC`,
            [pedido, item]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST Start timer
router.post('/start', async (req, res) => {
    try {
        const { pedido, item } = req.body;
        const userName = req.user?.nome || req.user?.login;
        if (!userName || !pedido || !item) {
            return res.status(400).json({ error: 'Parâmetros inválidos' });
        }

        // Auto-stop any existing open timer for this user
        const [activeRows] = await mysqlPool.query(
            `SELECT id, start_time FROM app_engineering_timesheets 
             WHERE usuario = ? AND end_time IS NULL AND entry_type = 'AUTO'`,
            [userName]
        );

        if (activeRows.length > 0) {
            for (const row of activeRows) {
                const openId = row.id;
                // Calculate diff
                await mysqlPool.query(
                    `UPDATE app_engineering_timesheets 
                     SET end_time = NOW(), 
                         duration_seconds = TIMESTAMPDIFF(SECOND, start_time, NOW()) 
                     WHERE id = ?`,
                    [openId]
                );
            }
        }

        // Start new timer
        const [result] = await mysqlPool.query(
            `INSERT INTO app_engineering_timesheets (pedido, item, usuario, start_time, entry_type) 
             VALUES (?, ?, ?, NOW(), 'AUTO')`,
            [pedido, item, userName]
        );

        res.json({ message: 'Cronômetro iniciado', id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST Stop timer
router.post('/stop', async (req, res) => {
    try {
        const { id } = req.body;
        const userName = req.user?.nome || req.user?.login;
        if (!id) return res.status(400).json({ error: 'ID do apontamento necessário' });

        await mysqlPool.query(
            `UPDATE app_engineering_timesheets 
             SET end_time = NOW(), 
                 duration_seconds = TIMESTAMPDIFF(SECOND, start_time, NOW()) 
             WHERE id = ? AND end_time IS NULL AND usuario = ?`,
            [id, userName]
        );

        res.json({ message: 'Cronômetro parado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST Manual entry
router.post('/manual', async (req, res) => {
    try {
        const { pedido, item, date, hours, obs } = req.body;
        const userName = req.user?.nome || req.user?.login;
        
        if (!userName || !pedido || !item || !date || !hours) {
            return res.status(400).json({ error: 'Preencha todos os campos obrigatórios' });
        }

        // For manual, we can simulate start_time = date, end_time = date + hours
        // and just set the exact duration_seconds
        const durationSeconds = Math.round(parseFloat(hours) * 3600);
        
        // Let's treat the 'date' as YYYY-MM-DD
        const startTimeStr = `${date} 08:00:00`; // arbitary time just to have it
        const [result] = await mysqlPool.query(
            `INSERT INTO app_engineering_timesheets (pedido, item, usuario, start_time, end_time, duration_seconds, entry_type, obs) 
             VALUES (?, ?, ?, ?, DATE_ADD(?, INTERVAL ? SECOND), ?, 'MANUAL', ?)`,
            [pedido, item, userName, startTimeStr, startTimeStr, durationSeconds, durationSeconds, obs || null]
        );

        res.json({ message: 'Apontamento manual criado', id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE entry (security check: only user or admin can delete)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await mysqlPool.query('DELETE FROM app_engineering_timesheets WHERE id = ?', [id]);
        res.json({ message: 'Apontamento excluído' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
