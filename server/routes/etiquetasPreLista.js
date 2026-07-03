const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');

// POST /api/faturamento/pre-etiquetas - Cria pre-etiquetas (usado pelo Tablet na expedição)
router.post('/', async (req, res) => {
    try {
        const { items } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "Nenhum item fornecido." });
        }

        const values = items.map(item => [
            item.produto_codigo || '',
            item.produto_descricao || '',
            item.pedido || '',
            item.item || '',
            item.op_num || null,
            item.quantidade_solicitada || 0,
            item.criado_por || 'Sistema',
            item.pcp_forecast_id || null,
            item.pcp_data_entrega || null,
            item.pcp_serie_cliente || null,
            item.pcp_serie_metalfisa || null,
            item.pcp_numero_serie || null,
            item.pcp_lote || null,
            item.pcp_numero_lote || null
        ]);

        const query = `
            INSERT INTO faturamento_pre_etiquetas (
                produto_codigo, produto_descricao, pedido, item, op_num, 
                quantidade_solicitada, criado_por, pcp_forecast_id,
                pcp_data_entrega, pcp_serie_cliente, pcp_serie_metalfisa,
                pcp_numero_serie, pcp_lote, pcp_numero_lote
            ) VALUES ?
        `;

        const [result] = await mysqlPool.query(query, [values]);

        res.json({ success: true, message: `${result.affectedRows} pré-etiquetas criadas com sucesso.` });
    } catch (err) {
        console.error("Erro ao salvar pré-etiquetas:", err);
        res.status(500).json({ error: "Erro interno ao salvar pré-etiquetas." });
    }
});

// GET /api/faturamento/pre-etiquetas/pendentes - Lista as pendentes (usado pela Silvia)
router.get('/pendentes', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(`
            SELECT * FROM faturamento_pre_etiquetas 
            WHERE status = 'PENDENTE'
            ORDER BY criado_em DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error("Erro ao buscar pré-etiquetas:", err);
        res.status(500).json({ error: "Erro interno ao buscar pré-etiquetas." });
    }
});

// PUT /api/faturamento/pre-etiquetas/:id - Atualiza dados (ex: quantidade editada pela Silvia)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { quantidade_solicitada } = req.body;
        
        await mysqlPool.query(`
            UPDATE faturamento_pre_etiquetas 
            SET quantidade_solicitada = ? 
            WHERE id = ?
        `, [quantidade_solicitada, id]);
        
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao atualizar pré-etiqueta:", err);
        res.status(500).json({ error: "Erro interno ao atualizar pré-etiqueta." });
    }
});

// PUT /api/faturamento/pre-etiquetas/:id/impresso - Marca como executado
router.put('/:id/impresso', async (req, res) => {
    try {
        const { id } = req.params;
        await mysqlPool.query(`
            UPDATE faturamento_pre_etiquetas 
            SET status = 'EXECUTADO' 
            WHERE id = ?
        `, [id]);
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao marcar pré-etiqueta como impressa:", err);
        res.status(500).json({ error: "Erro interno." });
    }
});

// DELETE /api/faturamento/pre-etiquetas/:id - Marca como cancelado
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await mysqlPool.query(`
            UPDATE faturamento_pre_etiquetas 
            SET status = 'CANCELADO' 
            WHERE id = ?
        `, [id]);
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao cancelar pré-etiqueta:", err);
        res.status(500).json({ error: "Erro interno." });
    }
});

module.exports = router;
