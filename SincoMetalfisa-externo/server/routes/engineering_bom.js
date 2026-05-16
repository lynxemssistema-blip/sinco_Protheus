const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');

// Table Initialization
(async () => {
    try {
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_engineering_bom_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                pedido VARCHAR(20) NOT NULL,
                item VARCHAR(10) NOT NULL,
                codigo VARCHAR(30) DEFAULT NULL,
                descricao TEXT NOT NULL,
                quantidade DECIMAL(18,6) NOT NULL,
                unidade VARCHAR(10) DEFAULT 'UN',
                observacao TEXT,
                is_novo BOOLEAN DEFAULT FALSE,
                criado_por VARCHAR(100),
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_pedido_item (pedido, item)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // Migration to add observacao if it doesn't exist
        try {
            // Check if column exists first (standard MySQL compatible way)
            const [columns] = await mysqlPool.query(`
                SELECT COLUMN_NAME 
                FROM information_schema.columns 
                WHERE TABLE_SCHEMA = ? 
                AND TABLE_NAME = 'app_engineering_bom_items' 
                AND COLUMN_NAME = 'observacao'
            `, [process.env.MYSQL_DB]);

            if (columns.length === 0) {
                console.log('🔄 Adding missing column "observacao" to app_engineering_bom_items...');
                await mysqlPool.query('ALTER TABLE app_engineering_bom_items ADD COLUMN observacao TEXT AFTER unidade');
                console.log('✅ Column "observacao" added successfully');
            }
        } catch (e) {
            console.error('❌ Error in BOM migration:', e.message);
        }

        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_engineering_bom_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                pedido VARCHAR(20) NOT NULL,
                item VARCHAR(10) NOT NULL,
                acao ENUM('ADICIONAR', 'REMOVER', 'EDITAR') NOT NULL,
                detalhes TEXT,
                usuario VARCHAR(100) NOT NULL,
                data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_pedido_item_hist (pedido, item)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('✅ Engineering BOM tables initialized');
    } catch (err) {
        console.error('❌ Error initializing Engineering BOM tables:', err);
    }
})();

// Helper to log history
async function logBomHistory(pedido, item, acao, detalhes, usuario) {
    try {
        await mysqlPool.query(
            'INSERT INTO app_engineering_bom_history (pedido, item, acao, detalhes, usuario) VALUES (?, ?, ?, ?, ?)',
            [pedido, item, acao, detalhes, usuario]
        );
    } catch (err) {
        console.error('Error logging BOM history:', err);
    }
}

// GET /api/engineering-bom/:pedido/:item
router.get('/:pedido/:item', async (req, res) => {
    try {
        const { pedido, item } = req.params;
        const [rows] = await mysqlPool.query(
            'SELECT * FROM app_engineering_bom_items WHERE pedido = ? AND item = ? ORDER BY criado_em ASC',
            [pedido, item]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/engineering-bom/:pedido/:item
router.post('/:pedido/:item', async (req, res) => {
    try {
        const { pedido, item } = req.params;
        const { codigo, descricao, quantidade, unidade, observacao, is_novo, usuario } = req.body;

        const [result] = await mysqlPool.query(
            'INSERT INTO app_engineering_bom_items (pedido, item, codigo, descricao, quantidade, unidade, observacao, is_novo, criado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [pedido, item, codigo, descricao, quantidade, unidade || 'UN', observacao || null, is_novo || false, usuario]
        );

        const details = `Adicionado item: ${descricao} (${quantidade} ${unidade || 'UN'}) ${codigo ? '[' + codigo + ']' : '[NOVO]'}`;
        await logBomHistory(pedido, item, 'ADICIONAR', details, usuario);

        res.json({ success: true, id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/engineering-bom/:id
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { descricao, quantidade, unidade, observacao, usuario } = req.body;

        const [existing] = await mysqlPool.query('SELECT * FROM app_engineering_bom_items WHERE id = ?', [id]);
        if (existing.length === 0) return res.status(404).json({ error: 'Item not found' });

        const itemData = existing[0];

        await mysqlPool.query(
            'UPDATE app_engineering_bom_items SET descricao = ?, quantidade = ?, unidade = ?, observacao = ? WHERE id = ?',
            [descricao, quantidade, unidade, observacao || null, id]
        );

        const details = `Editado item ${itemData.codigo || 'Novo'}: Qtd ${itemData.quantidade} -> ${quantidade}, Desc: ${itemData.descricao} -> ${descricao}`;
        await logBomHistory(itemData.pedido, itemData.item, 'EDITAR', details, usuario);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/engineering-bom/:id
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { usuario } = req.query;

        const [existing] = await mysqlPool.query('SELECT * FROM app_engineering_bom_items WHERE id = ?', [id]);
        if (existing.length === 0) return res.status(404).json({ error: 'Item not found' });

        const itemData = existing[0];

        await mysqlPool.query('DELETE FROM app_engineering_bom_items WHERE id = ?', [id]);

        const details = `Removido item: ${itemData.descricao} (${itemData.quantidade} ${itemData.unidade})`;
        await logBomHistory(itemData.pedido, itemData.item, 'REMOVER', details, usuario || 'Sistema');

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/engineering-bom/:pedido/:item/history
router.get('/:pedido/:item/history', async (req, res) => {
    try {
        const { pedido, item } = req.params;
        const [rows] = await mysqlPool.query(
            'SELECT * FROM app_engineering_bom_history WHERE pedido = ? AND item = ? ORDER BY data_hora DESC',
            [pedido, item]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
