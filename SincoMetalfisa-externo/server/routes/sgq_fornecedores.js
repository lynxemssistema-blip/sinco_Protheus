const express = require('express');
const router = express.Router();
const db = require('../services/mysqlService');

// GET /api/sgq/fornecedores
router.get('/', async (req, res) => {
    try {
        const { search } = req.query;
        let query = 'SELECT * FROM sgq_fornecedores';
        const params = [];
        if (search) {
            query += ' WHERE nome LIKE ? OR email LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }
        query += ' ORDER BY nome ASC';
        
        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar fornecedores SGQ:', error);
        res.status(500).json({ error: 'Erro interno.' });
    }
});

// POST /api/sgq/fornecedores
router.post('/', async (req, res) => {
    try {
        const { nome, email, telefone, contato } = req.body;
        if (!nome) return res.status(400).json({ error: 'Nome do fornecedor é obrigatório.' });

        const [result] = await db.query(
            'INSERT INTO sgq_fornecedores (nome, email, telefone, contato) VALUES (?, ?, ?, ?)',
            [nome, email || '', telefone || '', contato || '']
        );
        res.status(201).json({ id: result.insertId, nome, email, telefone, contato });
    } catch (error) {
        console.error('Erro ao criar fornecedor SGQ:', error);
        res.status(500).json({ error: 'Erro interno ao criar fornecedor.' });
    }
});

module.exports = router;
