const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');

// Ensure the table exists on first load
// Note: We're using MySQL syntax now.
const createTableQuery = `
    CREATE TABLE IF NOT EXISTS sgq_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        sector VARCHAR(255),
        code VARCHAR(50),
        version VARCHAR(20),
        content LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
`;

// Try to create the table on start
mysqlPool.query(createTableQuery).catch(err => {
    console.error('❌ Erro ao criar tabela sgq_documents (MySQL):', err.message);
});

// CREATE or UPDATE a document
router.post('/', async (req, res) => {
    try {
        const { id, title, sector, code, version, content } = req.body;

        if (id) {
            await mysqlPool.query(
                `UPDATE sgq_documents 
                 SET title = ?, sector = ?, code = ?, version = ?, content = ?
                 WHERE id = ?`,
                [title, sector, code, version, content, id]
            );

            // fetch updated record
            const [rows] = await mysqlPool.query('SELECT * FROM sgq_documents WHERE id = ?', [id]);
            res.json(rows[0]);
        } else {
            const [result] = await mysqlPool.query(
                `INSERT INTO sgq_documents (title, sector, code, version, content)
                 VALUES (?, ?, ?, ?, ?)`,
                [title, sector, code || 'POP-MF-00X', version || '01', content]
            );

            // fetch the new record
            const [rows] = await mysqlPool.query('SELECT * FROM sgq_documents WHERE id = ?', [result.insertId]);
            res.json(rows[0]);
        }
    } catch (err) {
        console.error('❌ Erro no POST sgq_documents:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET all documents summary
router.get('/', async (req, res) => {
    try {
        // We do not send full content to make the listing fast
        const [rows] = await mysqlPool.query(
            `SELECT id, title, sector, code, version, updated_at 
             FROM sgq_documents ORDER BY updated_at DESC`
        );
        res.json(rows);
    } catch (err) {
        console.error('❌ Erro no GET sgq_documents:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET specific document with content
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query('SELECT * FROM sgq_documents WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Documento não encontrado.' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('❌ Erro no GET sgq_documents/:id:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE a document
router.delete('/:id', async (req, res) => {
    try {
        await mysqlPool.query('DELETE FROM sgq_documents WHERE id = ?', [req.params.id]);
        res.json({ message: 'Documento excluído com sucesso.' });
    } catch (err) {
        console.error('❌ Erro no DELETE sgq_documents:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
