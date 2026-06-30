const express = require('express');
const router = express.Router();
const mysql = require('../services/mysqlService');
const protheus = require('../db');
const { initInactiveOrdersTables } = require('../util/pedidoFilterHelper');

// Initialize tables on first load
initInactiveOrdersTables();

// Obter a configuração global (Mostrar ou ocultar)
router.get('/settings', async (req, res) => {
    try {
        const [rows] = await mysql.query(
            "SELECT setting_value FROM app_settings WHERE setting_key = 'hide_inactive_orders'"
        );
        let hideInactive = true;
        if (rows.length > 0) {
            hideInactive = rows[0].setting_value === 'true';
        }
        res.json({ hideInactive });
    } catch (err) {
        console.error('Erro ao buscar settings:', err);
        res.status(500).json({ error: 'Erro ao buscar settings.' });
    }
});

// Atualizar configuração global
router.post('/settings', async (req, res) => {
    const { hideInactive } = req.body;
    try {
        await mysql.query(
            "INSERT INTO app_settings (setting_key, setting_value) VALUES ('hide_inactive_orders', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
            [String(hideInactive), String(hideInactive)]
        );
        res.json({ success: true, hideInactive });
    } catch (err) {
        console.error('Erro ao atualizar settings:', err);
        res.status(500).json({ error: 'Erro ao atualizar settings.' });
    }
});

// Listar pedidos e o status local
router.get('/list', async (req, res) => {
    try {
        // Busca do MySQL os inativos
        const [inativos] = await mysql.query("SELECT pedido_numero FROM app_pedidos_inativos");
        const inativosSet = new Set(inativos.map(i => i.pedido_numero.trim()));

        const searchQuery = req.query.q || '';
        let sql = `
            SELECT
                TRIM(c5.c5_num) AS pedido,
                TRIM(c5.c5_cliente) AS cliente_cod,
                TRIM(sa1.a1_nome) AS cliente_nome,
                c5.c5_emissao AS emissao
            FROM sc5010 c5
            LEFT JOIN sa1010 sa1 ON sa1.a1_cod = c5.c5_cliente AND COALESCE(sa1.d_e_l_e_t_, '') = ''
            WHERE COALESCE(c5.d_e_l_e_t_, '') = ''
        `;

        const params = [];
        if (searchQuery) {
            sql += ` AND (c5.c5_num ILIKE $1 OR sa1.a1_nome ILIKE $1) `;
            params.push(`%${searchQuery}%`);
        }

        sql += ` ORDER BY c5.c5_emissao DESC LIMIT 1000`;

        let pedidos = [];
        try {
            const result = await protheus.query(sql, params);
            pedidos = result.rows.map(row => ({
                pedido: row.pedido,
                cliente_nome: row.cliente_nome,
                emissao: row.emissao,
                ativo: !inativosSet.has(row.pedido)
            }));
        } catch (pgErr) {
            // Protheus unavailable (common in dev environment) — return inactive list only
            console.warn('[pedidos-status/list] Protheus indisponível:', pgErr.message);
            pedidos = Array.from(inativosSet).map(pedido => ({
                pedido,
                cliente_nome: '',
                emissao: '',
                ativo: false,
            }));
        }

        res.json(pedidos);
    } catch (err) {
        console.error('Erro ao listar pedidos_status:', err);
        res.status(500).json({ error: 'Erro ao listar pedidos' });
    }
});

// Ativar/Desativar pedido
router.post('/toggle', async (req, res) => {
    const { pedido, ativo } = req.body;
    try {
        if (ativo) {
            // Se quer ATIVAR, deletamos da tabela inativos
            await mysql.query("DELETE FROM app_pedidos_inativos WHERE pedido_numero = ?", [pedido.trim()]);
        } else {
            // Se quer DESATIVAR, inserimos na tabela inativos
            await mysql.query("INSERT IGNORE INTO app_pedidos_inativos (pedido_numero, usuario) VALUES (?, ?)", [pedido.trim(), 'Sistema']);
        }
        res.json({ success: true, pedido, ativo });
    } catch (err) {
        console.error('Erro ao alternar status do pedido:', err);
        res.status(500).json({ error: 'Erro ao alternar status' });
    }
});

module.exports = router;
