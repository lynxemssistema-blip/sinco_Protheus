const express = require('express');
const router = express.Router();
const pool = require('../services/mysqlService');

// Criar nova auditoria
router.post('/', async (req, res) => {
    try {
        const { pedido_compra, numero_nf, chave_acesso, fornecedor_nome, fornecedor_cnpj, status, usuario, itens } = req.body;

        const [result] = await pool.query(
            `INSERT INTO nfe_auditorias 
            (pedido_compra, numero_nf, chave_acesso, fornecedor_nome, fornecedor_cnpj, status, usuario) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [pedido_compra, numero_nf, chave_acesso, fornecedor_nome, fornecedor_cnpj, status, usuario]
        );

        const id_auditoria = result.insertId;

        for (const item of itens) {
            await pool.query(
                `INSERT INTO nfe_auditoria_itens 
                (id_auditoria, item_xml, cprod_xml, qtd_xml, vlr_xml, cprod_protheus, qtd_protheus, vlr_protheus, status, detalhe_divergencia) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id_auditoria, item.item_xml, item.cprod_xml, item.qtd_xml, item.vlr_xml, item.cprod_protheus, item.qtd_protheus, item.vlr_protheus, item.status, item.detalhe_divergencia]
            );
        }

        res.status(201).json({ id: id_auditoria, message: 'Auditoria salva com sucesso.' });
    } catch (error) {
        console.error('Erro ao salvar auditoria:', error);
        res.status(500).json({ error: 'Erro ao salvar auditoria.' });
    }
});

// Listar auditorias
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM nfe_auditorias ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        console.error('Erro ao listar auditorias:', error);
        res.status(500).json({ error: 'Erro ao listar auditorias.' });
    }
});

// Obter auditoria específica
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [auditoria] = await pool.query('SELECT * FROM nfe_auditorias WHERE id = ?', [id]);
        if (auditoria.length === 0) return res.status(404).json({ error: 'Auditoria não encontrada.' });

        const [itens] = await pool.query('SELECT * FROM nfe_auditoria_itens WHERE id_auditoria = ?', [id]);
        res.json({ ...auditoria[0], itens });
    } catch (error) {
        console.error('Erro ao buscar auditoria:', error);
        res.status(500).json({ error: 'Erro ao buscar auditoria.' });
    }
});

module.exports = router;
