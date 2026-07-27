const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');
const db = require('../db');

// Cria a tabela se não existir
const initTable = async () => {
    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS app_montagem_solicitacoes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            op_numero VARCHAR(20) NOT NULL,
            op_produto VARCHAR(50),
            op_descricao VARCHAR(200),
            item_codigo VARCHAR(50),
            item_descricao VARCHAR(200),
            item_quantidade DECIMAL(10,3) DEFAULT 1,
            origem_selecao ENUM('OP','LIVRE') DEFAULT 'LIVRE',
            status ENUM('PENDENTE','EM_ANDAMENTO','ENTREGUE','CANCELADO') DEFAULT 'PENDENTE',
            solicitador_id INT NOT NULL,
            solicitador_nome VARCHAR(100) NOT NULL,
            obs_solicitador TEXT,
            entregador_id INT,
            entregador_nome VARCHAR(100),
            obs_entregador TEXT,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            entregue_em DATETIME
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
};
initTable().catch(e => console.error('[Montagem] Erro ao criar tabela:', e.message));

// GET /api/montagem/solicitacoes
router.get('/solicitacoes', async (req, res) => {
    try {
        const { status, op, item } = req.query;
        let where = '1=1';
        const params = [];
        if (status && status !== 'TODOS') { where += ' AND s.status = ?'; params.push(status); }
        if (op)   { where += ' AND s.op_numero LIKE ?';    params.push(`%${op}%`); }
        if (item) { where += ' AND (s.item_codigo LIKE ? OR s.item_descricao LIKE ?)'; params.push(`%${item}%`, `%${item}%`); }

        const [rows] = await mysqlPool.query(`
            SELECT * FROM app_montagem_solicitacoes s
            WHERE ${where}
            ORDER BY FIELD(s.status,'PENDENTE','EM_ANDAMENTO','ENTREGUE','CANCELADO'), s.criado_em DESC
        `, params);
        res.json(rows);
    } catch (err) {
        console.error('[Montagem] Erro ao listar:', err);
        res.status(500).json({ error: 'Erro ao listar solicitações' });
    }
});

// GET /api/montagem/buscar-por-produto/:codigo — retorna OPs que contêm o produto
router.get('/buscar-por-produto/:codigo', async (req, res) => {
    try {
        const codigo = req.params.codigo.trim().toUpperCase();
        const { rows } = await db.query(`
            SELECT
                TRIM(c2.c2_num)     AS op_numero,
                TRIM(c2.c2_item)    AS op_item,
                TRIM(c2.c2_produto) AS produto,
                TRIM(b1.b1_desc)    AS descricao,
                TRIM(COALESCE(b1.b1_um, ''))   AS unidade,
                TRIM(COALESCE(b1.b1_tipo, '')) AS tipo,
                c2.c2_quant         AS quantidade,
                c2.c2_quje          AS qtd_entregue,
                TRIM(c2.c2_datprf)  AS data_entrega,
                TRIM(c2.c2_pedido)  AS pedido
            FROM public.sc2010 c2
            LEFT JOIN public.sb1010 b1
                ON TRIM(b1.b1_cod) = TRIM(c2.c2_produto)
                AND COALESCE(b1.d_e_l_e_t_, '') = ''
            WHERE TRIM(c2.c2_produto) ILIKE $1
              AND COALESCE(c2.d_e_l_e_t_, '') = ''
            ORDER BY c2.c2_num DESC
            LIMIT 50
        `, [`%${codigo}%`]);

        const parseDateProth = (d) => {
            if (!d || d.length !== 8) return null;
            return `${d.slice(6,8)}/${d.slice(4,6)}/${d.slice(0,4)}`;
        };

        res.json(rows.map(r => ({
            op_numero: r.op_numero,
            op_item: r.op_item,
            produto: r.produto,
            descricao: r.descricao || r.produto,
            unidade: r.unidade,
            tipo: r.tipo,
            pedido: r.pedido,
            quantidade: parseFloat(r.quantidade) || 0,
            qtd_entregue: parseFloat(r.qtd_entregue) || 0,
            data_entrega: parseDateProth(r.data_entrega),
        })));
    } catch (err) {
        console.error('[Montagem] Erro ao buscar por produto:', err);
        res.status(500).json({ error: 'Erro ao buscar produto' });
    }
});

// GET /api/montagem/op/:numero — busca dados da OP no Protheus
router.get('/op/:numero', async (req, res) => {
    try {
        const num = req.params.numero.trim().padStart(6, '0');
        const { rows } = await db.query(`
            SELECT
                TRIM(c2.c2_num)      AS op_numero,
                TRIM(c2.c2_item)     AS op_item,
                TRIM(c2.c2_produto)  AS produto,
                TRIM(b1.b1_desc)     AS descricao,
                TRIM(COALESCE(b1.b1_um,''))   AS unidade,
                TRIM(COALESCE(b1.b1_tipo,'')) AS tipo,
                c2.c2_quant          AS quantidade,
                c2.c2_quje           AS qtd_entregue,
                TRIM(c2.c2_datprf)   AS data_entrega,
                TRIM(c2.c2_pedido)   AS pedido
            FROM public.sc2010 c2
            LEFT JOIN public.sb1010 b1
                ON TRIM(b1.b1_cod) = TRIM(c2.c2_produto)
                AND COALESCE(b1.d_e_l_e_t_, '') = ''
            WHERE TRIM(c2.c2_num) = $1
              AND COALESCE(c2.d_e_l_e_t_, '') = ''
            ORDER BY c2.c2_item
        `, [num]);

        if (rows.length === 0) return res.status(404).json({ error: 'OP não encontrada' });

        const parseDateProth = (d) => {
            if (!d || d.length !== 8) return null;
            return `${d.slice(6,8)}/${d.slice(4,6)}/${d.slice(0,4)}`;
        };

        const op = rows[0];
        res.json({
            op_numero: op.op_numero,
            produto: op.produto,
            descricao: op.descricao || op.produto,
            unidade: op.unidade,
            tipo: op.tipo,
            quantidade: parseFloat(op.quantidade) || 0,
            qtd_entregue: parseFloat(op.qtd_entregue) || 0,
            data_entrega: parseDateProth(op.data_entrega),
            pedido: op.pedido,
            itens: rows.map(r => ({ item: r.op_item, produto: r.produto, descricao: r.descricao, quantidade: parseFloat(r.quantidade) || 0 }))
        });
    } catch (err) {
        console.error('[Montagem] Erro ao buscar OP:', err);
        res.status(500).json({ error: 'Erro ao buscar OP' });
    }
});

// GET /api/montagem/op/:numero/componentes — BOM da OP
router.get('/op/:numero/componentes', async (req, res) => {
    try {
        const num = req.params.numero.trim().padStart(6, '0');

        // Pega o produto principal da OP
        const opRes = await db.query(`
            SELECT TRIM(c2_produto) AS produto FROM public.sc2010
            WHERE TRIM(c2_num) = $1 AND COALESCE(d_e_l_e_t_, '') = ''
            LIMIT 1
        `, [num]);

        if (opRes.rows.length === 0) return res.status(404).json({ error: 'OP não encontrada' });

        const produto = opRes.rows[0].produto;

        const { rows } = await db.query(`
            SELECT
                TRIM(g1.g1_comp)    AS codigo,
                TRIM(b1.b1_desc)    AS descricao,
                CAST(REPLACE(CAST(g1.g1_quant AS TEXT), ',', '.') AS NUMERIC) AS quantidade,
                TRIM(COALESCE(b1.b1_um, '')) AS unidade
            FROM public.sg1010 g1
            LEFT JOIN public.sb1010 b1
                ON TRIM(b1.b1_cod) = TRIM(g1.g1_comp)
                AND COALESCE(b1.d_e_l_e_t_, '') = ''
            WHERE TRIM(g1.g1_cod) = $1
              AND COALESCE(g1.d_e_l_e_t_, '') = ''
            ORDER BY g1.g1_comp
        `, [produto]);

        res.json(rows);
    } catch (err) {
        console.error('[Montagem] Erro ao buscar componentes:', err);
        res.status(500).json({ error: 'Erro ao buscar componentes da OP' });
    }
});

// POST /api/montagem/solicitacoes — criar
router.post('/solicitacoes', async (req, res) => {
    try {
        const {
            op_numero, op_produto, op_descricao,
            item_codigo, item_descricao, item_quantidade,
            origem_selecao, obs_solicitador,
            solicitador_id, solicitador_nome
        } = req.body;

        if (!op_numero || !solicitador_id) {
            return res.status(400).json({ error: 'op_numero e solicitador_id são obrigatórios' });
        }

        const [result] = await mysqlPool.query(`
            INSERT INTO app_montagem_solicitacoes
                (op_numero, op_produto, op_descricao, item_codigo, item_descricao,
                 item_quantidade, origem_selecao, obs_solicitador, solicitador_id, solicitador_nome)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            op_numero, op_produto || null, op_descricao || null,
            item_codigo || null, item_descricao || null,
            parseFloat(item_quantidade) || 1,
            origem_selecao || 'LIVRE',
            obs_solicitador || null,
            solicitador_id, solicitador_nome
        ]);

        res.json({ success: true, id: result.insertId });
    } catch (err) {
        console.error('[Montagem] Erro ao criar:', err);
        res.status(500).json({ error: 'Erro ao criar solicitação' });
    }
});

// PATCH /api/montagem/solicitacoes/:id/status — atualizar status
router.patch('/solicitacoes/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, obs_entregador, entregador_id, entregador_nome, obs_solicitador } = req.body;

        const updates = ['status = ?', 'atualizado_em = NOW()'];
        const params = [status];

        if (status === 'ENTREGUE') {
            updates.push('entregue_em = NOW()');
            if (entregador_id)   { updates.push('entregador_id = ?');   params.push(entregador_id); }
            if (entregador_nome) { updates.push('entregador_nome = ?'); params.push(entregador_nome); }
            if (obs_entregador !== undefined) { updates.push('obs_entregador = ?'); params.push(obs_entregador); }
        }
        if (obs_solicitador !== undefined) { updates.push('obs_solicitador = ?'); params.push(obs_solicitador); }

        params.push(id);
        await mysqlPool.query(`UPDATE app_montagem_solicitacoes SET ${updates.join(', ')} WHERE id = ?`, params);
        res.json({ success: true });
    } catch (err) {
        console.error('[Montagem] Erro ao atualizar status:', err);
        res.status(500).json({ error: 'Erro ao atualizar solicitação' });
    }
});

// DELETE /api/montagem/solicitacoes/:id — cancelar
router.delete('/solicitacoes/:id', async (req, res) => {
    try {
        await mysqlPool.query(
            `UPDATE app_montagem_solicitacoes SET status = 'CANCELADO' WHERE id = ?`,
            [req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[Montagem] Erro ao cancelar:', err);
        res.status(500).json({ error: 'Erro ao cancelar solicitação' });
    }
});

module.exports = router;
