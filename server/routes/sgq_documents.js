const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');

// Ensure the table exists on first load
// Note: We're using MySQL syntax now.
const createDocsTableQuery = `
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

const createSectorsTableQuery = `
    CREATE TABLE IF NOT EXISTS sgq_sectors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        position INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`;

const defaultSectors = ['Geral', 'Administrativo', 'Almoxarifado', 'Comercial', 'Engenharia', 'Produção', 'PCP', 'Qualidade', 'RH'];

async function initTables() {
    try {
        await mysqlPool.query(createDocsTableQuery);
        await mysqlPool.query(createSectorsTableQuery);
        // Seed defaults only if table is empty
        const [rows] = await mysqlPool.query('SELECT COUNT(*) as cnt FROM sgq_sectors');
        if (rows[0].cnt === 0) {
            for (let i = 0; i < defaultSectors.length; i++) {
                await mysqlPool.query(
                    'INSERT IGNORE INTO sgq_sectors (name, position) VALUES (?, ?)',
                    [defaultSectors[i], i]
                );
            }
        }
    } catch (err) {
        console.error('❌ Erro ao inicializar tabelas SGQ:', err.message);
    }
}

initTables();

// --- SECTORS ROUTES ---

// GET all sectors
router.get('/sectors', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query('SELECT * FROM sgq_sectors ORDER BY position, id');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST - create or rename sector
router.post('/sectors', async (req, res) => {
    try {
        const { id, name } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Nome inválido.' });
        if (id) {
            await mysqlPool.query('UPDATE sgq_sectors SET name = ? WHERE id = ?', [name.trim(), id]);
            const [rows] = await mysqlPool.query('SELECT * FROM sgq_sectors WHERE id = ?', [id]);
            res.json(rows[0]);
        } else {
            const [maxPos] = await mysqlPool.query('SELECT COALESCE(MAX(position),0)+1 as pos FROM sgq_sectors');
            const [result] = await mysqlPool.query(
                'INSERT INTO sgq_sectors (name, position) VALUES (?, ?)',
                [name.trim(), maxPos[0].pos]
            );
            const [rows] = await mysqlPool.query('SELECT * FROM sgq_sectors WHERE id = ?', [result.insertId]);
            res.json(rows[0]);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE a sector
router.delete('/sectors/:id', async (req, res) => {
    try {
        await mysqlPool.query('DELETE FROM sgq_sectors WHERE id = ?', [req.params.id]);
        res.json({ message: 'Setor excluído.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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
