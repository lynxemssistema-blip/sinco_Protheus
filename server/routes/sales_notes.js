const express = require('express');
const router = express.Router();
const pool = require('../services/mysqlService');
const db = require('../db'); // Postgres (Protheus)

// GET Notes for specific Orders (or Global)
router.get('/', async (req, res) => {
    try {
        const { orders, item, enrich } = req.query;
        let query = `SELECT * FROM app_sales_notes n WHERE 1=1`;
        const params = [];

        if (orders) {
            const orderList = orders.split(',').map(o => o.trim());
            if (orderList.length > 0) {
                query += ` AND n.order_number IN (${orderList.map(() => '?').join(',')})`;
                params.push(...orderList);
            }
        }

        if (item) {
            query += ` AND n.item_number = ?`;
            params.push(item);
        }

        query += ` ORDER BY n.created_at ASC`;

        const [notes] = await pool.query(query, params);

        // Enrichment with Protheus Data (Postgres)
        if (enrich === 'true' && notes.length > 0) {
            const uniqueOrders = [...new Set(notes.map(n => n.order_number))];

            // To prevent massive params, simple chunking or just limit if needed. 
            // Usually notes volume is manageable.
            if (uniqueOrders.length > 0) {
                const placeholders = uniqueOrders.map((_, i) => `$${i + 1}`).join(',');
                const pgQuery = `
                    SELECT 
                        c5.c5_num as pedido, 
                        sa1.a1_nome as cliente,
                        TO_CHAR(TO_DATE(c5.c5_emissao, 'YYYYMMDD'), 'DD/MM/YY') AS emissao
                    FROM sc5010 c5
                    LEFT JOIN sa1010 sa1 ON sa1.a1_cod = c5.c5_cliente AND COALESCE(sa1.d_e_l_e_t_, '') = ''
                    WHERE c5.c5_num IN (${placeholders}) 
                    AND COALESCE(c5.d_e_l_e_t_, '') = ''
                `;

                try {
                    const pgRes = await db.query(pgQuery, uniqueOrders);
                    const orderMap = {};
                    pgRes.rows.forEach(row => {
                        // Ensure key is trimmed to match
                        orderMap[row.pedido.trim()] = row;
                    });

                    // Attach info to notes
                    notes.forEach(note => {
                        const orderNum = note.order_number;
                        if (orderMap[orderNum]) {
                            note.client_name = orderMap[orderNum].cliente;
                            note.order_emission = orderMap[orderNum].emissao;
                        }
                    });
                } catch (pgErr) {
                    console.error('Error enriching notes with Protheus data:', pgErr);
                }
            }
        }

        res.json(notes);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST New Note
router.post('/', async (req, res) => {
    try {
        const { order_number, item_number, product_code, note_text, category, created_by } = req.body;

        if (!order_number || !note_text) {
            return res.status(400).json({ error: 'Order and Note Text are required' });
        }

        const [result] = await pool.execute(`
            INSERT INTO app_sales_notes 
            (order_number, item_number, product_code, note_text, category, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [order_number, item_number || null, product_code || null, note_text, category || 'Geral', created_by || 'Sistema']);

        res.json({ id: result.insertId, message: 'Nota criada com sucesso' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE Note
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM app_sales_notes WHERE id = ?', [id]);
        res.json({ message: 'Nota excluída' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// PUT Update Note (Text or Generic)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { note_text, is_resolved } = req.body;

        // Build dynamic query
        let fields = [];
        let params = [];

        if (note_text !== undefined) {
            fields.push('note_text = ?');
            params.push(note_text);
        }

        if (is_resolved !== undefined) {
            fields.push('is_resolved = ?');
            params.push(is_resolved);
            if (is_resolved) {
                fields.push('resolved_at = NOW()');
            } else {
                fields.push('resolved_at = NULL');
                fields.push('resolved_by = NULL');
            }
        }

        params.push(id);

        if (fields.length === 0) return res.json({ message: 'Nada a atualizar' });

        await pool.execute(`UPDATE app_sales_notes SET ${fields.join(', ')} WHERE id = ?`, params);
        res.json({ message: 'Nota atualizada' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// PUT Resolve Note (Legacy/specific)
router.put('/:id/resolve', async (req, res) => {
    try {
        const { id } = req.params;
        const { resolved_by } = req.body;

        await pool.execute(`
            UPDATE app_sales_notes 
            SET is_resolved = TRUE, resolved_by = ?, resolved_at = NOW()
            WHERE id = ?
        `, [resolved_by || 'Sistema', id]);

        res.json({ message: 'Nota resolvida' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
