const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');

router.use((req, res, next) => {
    console.log(`📋 [ALMOXARIFADO ROUTER] Hit: ${req.method} ${req.url}`);
    next();
});

// GET /api/almoxarifado/solicitacoes
router.get('/solicitacoes', async (req, res) => {
    try {
        const { status, op, pedido } = req.query;
        let query = 'SELECT * FROM app_solicitacoes_almoxarifado WHERE 1=1';
        const params = [];

        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        if (op) {
            query += ' AND op = ?';
            params.push(String(op).trim().padStart(6, '0'));
        }
        if (pedido) {
            query += ' AND pedido = ?';
            params.push(String(pedido).trim().padStart(6, '0'));
        }

        query += ' ORDER BY created_at DESC LIMIT 100';

        const [rows] = await mysqlPool.execute(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/almoxarifado/solicitacoes
router.post('/solicitacoes', async (req, res) => {
    const conn = await mysqlPool.getConnection();
    try {
        await conn.beginTransaction();

        const {
            pedido, op, operacao, operacao_descricao,
            solicitante, departamento, itens
        } = req.body;

        // Gerar numero sequencial
        const year = new Date().getFullYear();
        const [last] = await conn.execute('SELECT id FROM app_solicitacoes_almoxarifado ORDER BY id DESC LIMIT 1');
        const nextId = (last[0]?.id || 0) + 1;
        const numero = `SA-${year}-${String(nextId).padStart(4, '0')}`;

        // Insert Header
        const [result] = await conn.execute(`
            INSERT INTO app_solicitacoes_almoxarifado 
            (numero, data_solicitacao, pedido, op, operacao, operacao_descricao, solicitante, departamento, status)
            VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?, 'PENDENTE')
        `, [numero, pedido, op, operacao, operacao_descricao, solicitante, departamento]);

        const solicitacaoId = result.insertId;

        // Insert Items (batch)
        if (itens && itens.length > 0) {
            const placeholders = itens.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
            const values = itens.flatMap(item => [solicitacaoId, item.codigo, item.descricao, item.tipo, item.qtd, item.almoxarifado]);
            await conn.execute(
                `INSERT INTO app_solicitacoes_almoxarifado_itens (solicitacao_id, material_codigo, material_descricao, material_tipo, qtd_solicitada, almoxarifado) VALUES ${placeholders}`,
                values
            );
        }

        await conn.commit();
        res.json({ message: 'Solicitação criada', id: solicitacaoId, numero });

    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// PUT /api/almoxarifado/solicitacoes/:id/entregar
router.put('/solicitacoes/:id/entregar', async (req, res) => {
    try {
        const { usuario } = req.body;
        await mysqlPool.execute(`
            UPDATE app_solicitacoes_almoxarifado 
            SET status = 'ENTREGUE', data_entregue = NOW(), usuario_entrega = ?
            WHERE id = ?
        `, [usuario, req.params.id]);

        // Também atualizar itens
        await mysqlPool.execute(`
            UPDATE app_solicitacoes_almoxarifado_itens
            SET qtd_entregue = qtd_solicitada 
            WHERE solicitacao_id = ?
        `, [req.params.id]);

        res.json({ message: 'Solicitação marcada como entregue' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
