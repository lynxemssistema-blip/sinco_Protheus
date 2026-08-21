const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');

// Table Initialization
(async () => {
    try {
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_produto_estados (
                codigo_produto VARCHAR(50) PRIMARY KEY,
                estado ENUM('NOVO', 'REVISAO', 'NORMAL', 'RESTRICAO') DEFAULT 'NORMAL',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                updated_by VARCHAR(100)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_produto_estados_historico (
                id INT AUTO_INCREMENT PRIMARY KEY,
                codigo_produto VARCHAR(50) NOT NULL,
                estado_anterior ENUM('NOVO', 'REVISAO', 'NORMAL', 'RESTRICAO'),
                estado_novo ENUM('NOVO', 'REVISAO', 'NORMAL', 'RESTRICAO') NOT NULL,
                acao VARCHAR(100) NOT NULL,
                usuario VARCHAR(100) NOT NULL,
                data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_prod_hist (codigo_produto),
                INDEX idx_data_hist (data_hora)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Safely alter existing tables to support RESTRICAO
        try {
            await mysqlPool.query(`ALTER TABLE app_produto_estados MODIFY COLUMN estado ENUM('NOVO', 'REVISAO', 'NORMAL', 'RESTRICAO') DEFAULT 'NORMAL'`);
        } catch (e) {}
        try {
            await mysqlPool.query(`ALTER TABLE app_produto_estados_historico MODIFY COLUMN estado_anterior ENUM('NOVO', 'REVISAO', 'NORMAL', 'RESTRICAO')`);
            await mysqlPool.query(`ALTER TABLE app_produto_estados_historico MODIFY COLUMN estado_novo ENUM('NOVO', 'REVISAO', 'NORMAL', 'RESTRICAO') NOT NULL`);
        } catch (e) {}

        console.log('✅ Product Status tables initialized');
    } catch (err) {
        console.error('❌ Error initializing Product Status tables:', err);
    }
})();

// GET /api/product-status/:codigo - Returns the current status of a product
router.get('/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params;
        const [rows] = await mysqlPool.query('SELECT estado, updated_at, updated_by FROM app_produto_estados WHERE codigo_produto = ?', [codigo]);
        
        if (rows.length === 0) {
            return res.json({ estado: 'NORMAL' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('❌ Error getting product status:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/product-status/:codigo - Update the product status manually
router.post('/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params;
        const { estado, usuario, acao = 'MARCACAO_MANUAL' } = req.body;

        if (!['NOVO', 'REVISAO', 'NORMAL', 'RESTRICAO'].includes(estado)) {
            return res.status(400).json({ error: 'Estado inválido' });
        }
        if (!usuario) {
            return res.status(400).json({ error: 'Usuário é obrigatório' });
        }

        // Get previous state
        const [prevRows] = await mysqlPool.query('SELECT estado FROM app_produto_estados WHERE codigo_produto = ?', [codigo]);
        const estado_anterior = prevRows.length > 0 ? prevRows[0].estado : 'NORMAL';

        // Update or Insert state
        await mysqlPool.query(`
            INSERT INTO app_produto_estados (codigo_produto, estado, updated_by) 
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE estado = ?, updated_by = ?
        `, [codigo, estado, usuario, estado, usuario]);

        // Insert into history
        await mysqlPool.query(`
            INSERT INTO app_produto_estados_historico (codigo_produto, estado_anterior, estado_novo, acao, usuario)
            VALUES (?, ?, ?, ?, ?)
        `, [codigo, estado_anterior, estado, acao, usuario]);

        res.json({ success: true, estado });
    } catch (err) {
        console.error('❌ Error updating product status:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/product-status/:codigo/history - Get the status history of a product
router.get('/:codigo/history', async (req, res) => {
    try {
        const { codigo } = req.params;
        const [rows] = await mysqlPool.query(
            'SELECT * FROM app_produto_estados_historico WHERE codigo_produto = ? ORDER BY data_hora DESC', 
            [codigo]
        );
        res.json(rows);
    } catch (err) {
        console.error('❌ Error getting product status history:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/product-status/batch/get - Get statuses for multiple products
router.post('/batch/get', async (req, res) => {
    try {
        const { codigos } = req.body;
        if (!Array.isArray(codigos) || codigos.length === 0) {
            return res.json({});
        }

        const placeholders = codigos.map(() => '?').join(',');
        const [rows] = await mysqlPool.query(
            `SELECT codigo_produto, estado FROM app_produto_estados WHERE codigo_produto IN (${placeholders})`,
            codigos
        );

        const result = {};
        rows.forEach(r => {
            result[r.codigo_produto] = r.estado;
        });

        res.json(result);
    } catch (err) {
        console.error('❌ Error in batch get status:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/product-status/batch/update - Update status for multiple products
router.post('/batch/update', async (req, res) => {
    try {
        const { codigos, estado, usuario, acao = 'MARCACAO_MANUAL_LOTE' } = req.body;
        
        if (!Array.isArray(codigos) || codigos.length === 0) {
            return res.json({ success: true, count: 0 });
        }
        if (!['NOVO', 'REVISAO', 'NORMAL', 'RESTRICAO'].includes(estado)) {
            return res.status(400).json({ error: 'Estado inválido' });
        }
        if (!usuario) {
            return res.status(400).json({ error: 'Usuário é obrigatório' });
        }

        const placeholders = codigos.map(() => '?').join(',');
        
        // 1. Get current states for history mapping
        const [prevRows] = await mysqlPool.query(
            `SELECT codigo_produto, estado FROM app_produto_estados WHERE codigo_produto IN (${placeholders})`,
            codigos
        );
        
        const prevStates = {};
        prevRows.forEach(r => prevStates[r.codigo_produto] = r.estado);

        // 2. Insert into History (only if changed or if we want to log anyway. We will log for all requested)
        const historyValues = [];
        const updateValues = [];

        for (const cod of codigos) {
            const estado_anterior = prevStates[cod] || 'NORMAL';
            historyValues.push([cod, estado_anterior, estado, acao, usuario]);
            // For the ON DUPLICATE KEY UPDATE values
            updateValues.push([cod, estado, usuario]);
        }

        // 3. Batch insert/update states
        // MySQL doesn't support multiple ON DUPLICATE KEY values directly in a simple array without some formatting
        // Actually, we can use INSERT ... VALUES (...), (...) ON DUPLICATE KEY UPDATE estado=VALUES(estado), updated_by=VALUES(updated_by)
        
        const insertPlaceholders = codigos.map(() => '(?, ?, ?)').join(',');
        const flatUpdateValues = updateValues.flat();

        if (flatUpdateValues.length > 0) {
            await mysqlPool.query(`
                INSERT INTO app_produto_estados (codigo_produto, estado, updated_by)
                VALUES ${insertPlaceholders}
                ON DUPLICATE KEY UPDATE estado = VALUES(estado), updated_by = VALUES(updated_by)
            `, flatUpdateValues);

            // 4. Batch insert history
            await mysqlPool.query(`
                INSERT INTO app_produto_estados_historico (codigo_produto, estado_anterior, estado_novo, acao, usuario)
                VALUES ?
            `, [historyValues]);
        }

        res.json({ success: true, count: codigos.length });
    } catch (err) {
        console.error('❌ Error in batch update status:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
