const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
require('dotenv').config();

// Conexão direta por request (não usa o pool compartilhado que pode ficar em bad state)
async function getConn() {
    return mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB,
        connectTimeout: 8000,
        charset: 'utf8mb4',
    });
}

// Listar auditorias
router.get('/', async (req, res) => {
    let conn;
    try {
        conn = await getConn();
        const [rows] = await conn.query(`
            SELECT a.*,
                   COUNT(i.id) as total_itens,
                   SUM(CASE WHEN i.status LIKE '%✅%' THEN 1 ELSE 0 END) as itens_conformes,
                   SUM(CASE WHEN i.status LIKE '%❌%' THEN 1 ELSE 0 END) as itens_divergentes
            FROM nfe_auditorias a
            LEFT JOIN nfe_auditoria_itens i ON a.id = i.id_auditoria
            GROUP BY a.id
            ORDER BY a.created_at DESC
        `);
        res.json({ data: rows, offline: false });
    } catch (error) {
        console.warn('[auditoria-pc] DB indisponivel:', error.code || error.message);
        res.json({ data: [], offline: true, reason: error.code || 'DB_ERROR' });
    } finally {
        if (conn) conn.end().catch(() => {});
    }
});

// Criar nova auditoria
router.post('/', async (req, res) => {
    const { pedido_compra, numero_nf, chave_acesso, fornecedor_nome, fornecedor_cnpj, status, usuario, itens } = req.body;
    let conn;
    try {
        conn = await getConn();
        await conn.beginTransaction();

        const [result] = await conn.query(
            `INSERT INTO nfe_auditorias 
            (pedido_compra, numero_nf, chave_acesso, fornecedor_nome, fornecedor_cnpj, status, usuario) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [pedido_compra, numero_nf, chave_acesso, fornecedor_nome, fornecedor_cnpj, status, usuario]
        );

        const id_auditoria = result.insertId;

        for (const item of itens) {
            await conn.query(
                `INSERT INTO nfe_auditoria_itens 
                (id_auditoria, item_xml, cprod_xml, qtd_xml, vlr_xml, cprod_protheus, qtd_protheus, vlr_protheus, status, detalhe_divergencia) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id_auditoria, item.item_xml, item.cprod_xml, item.qtd_xml, item.vlr_xml,
                 item.cprod_protheus, item.qtd_protheus, item.vlr_protheus, item.status, item.detalhe_divergencia]
            );
        }

        await conn.commit();
        res.status(201).json({ id: id_auditoria, message: 'Auditoria salva com sucesso.' });
    } catch (error) {
        if (conn) { try { await conn.rollback(); } catch (_) {} }
        console.error('Erro ao salvar auditoria:', error);
        res.status(500).json({ error: 'Erro ao salvar auditoria.' });
    } finally {
        if (conn) conn.end().catch(() => {});
    }
});

// Obter auditoria específica
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    let conn;
    try {
        conn = await getConn();
        const [auditoria] = await conn.query('SELECT * FROM nfe_auditorias WHERE id = ?', [id]);
        if (auditoria.length === 0) return res.status(404).json({ error: 'Auditoria não encontrada.' });

        const [itens] = await conn.query('SELECT * FROM nfe_auditoria_itens WHERE id_auditoria = ?', [id]);
        res.json({ ...auditoria[0], itens });
    } catch (error) {
        console.error('Erro ao buscar auditoria:', error);
        res.status(500).json({ error: 'Erro ao buscar auditoria.' });
    } finally {
        if (conn) conn.end().catch(() => {});
    }
});

module.exports = router;
