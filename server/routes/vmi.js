const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');

// ── Init tables ──────────────────────────────────────────────────────────────
async function initTables() {
    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS vmi_leituras (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            nome_arquivo    VARCHAR(255) NOT NULL,
            mes_referencia  VARCHAR(50)  NOT NULL,
            mes_label       VARCHAR(50)  DEFAULT NULL,
            sheet_name      VARCHAR(255) DEFAULT NULL,
            data_upload     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            usuario_id      INT          DEFAULT NULL,
            usuario_nome    VARCHAR(150) DEFAULT NULL,
            total_itens     INT          DEFAULT 0,
            total_pedidos   INT          DEFAULT 0,
            status          VARCHAR(20)  DEFAULT 'ativo',
            INDEX idx_mes (mes_referencia),
            INDEX idx_upload (data_upload)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS vmi_itens (
            id                  INT AUTO_INCREMENT PRIMARY KEY,
            leitura_id          INT             NOT NULL,
            codigo_produto      VARCHAR(60)     NOT NULL,
            descricao           TEXT            DEFAULT NULL,
            qtd_wk01            DECIMAL(12,3)   DEFAULT 0,
            qtd_wk02            DECIMAL(12,3)   DEFAULT 0,
            qtd_wk03            DECIMAL(12,3)   DEFAULT 0,
            qtd_wk04            DECIMAL(12,3)   DEFAULT 0,
            qtd_wk05            DECIMAL(12,3)   DEFAULT 0,
            faltantes_firmes    DECIMAL(12,3)   DEFAULT 0,
            entradas            DECIMAL(12,3)   DEFAULT 0,
            estoque_soc         DECIMAL(12,3)   DEFAULT 0,
            INDEX idx_leitura   (leitura_id),
            INDEX idx_codigo    (codigo_produto)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS vmi_itens_pedidos (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            leitura_id      INT             NOT NULL,
            item_id         INT             NOT NULL,
            numero_pedido   VARCHAR(50)     NOT NULL,
            quantidade      DECIMAL(12,3)   DEFAULT 0,
            INDEX idx_leitura (leitura_id),
            INDEX idx_item    (item_id),
            INDEX idx_pedido  (numero_pedido)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
}

initTables().catch(err => console.error('❌ VMI table init error:', err.message));

// ── POST /api/vmi/leituras  — save a reading ─────────────────────────────────
router.post('/leituras', async (req, res) => {
    const { nome_arquivo, mes_referencia, mes_label, sheet_name, itens, pedidos_identificados } = req.body;

    if (!nome_arquivo || !mes_referencia || !Array.isArray(itens)) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    const conn = await mysqlPool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Insert reading header
        const [leituraResult] = await conn.query(
            `INSERT INTO vmi_leituras
                (nome_arquivo, mes_referencia, mes_label, sheet_name, usuario_id, usuario_nome, total_itens, total_pedidos)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nome_arquivo,
                mes_referencia,
                mes_label || null,
                sheet_name || null,
                req.user?.id || req.user?.idUsuario || null,
                req.user?.nome || req.user?.NomeCompleto || null,
                itens.length,
                Array.isArray(pedidos_identificados) ? pedidos_identificados.length : 0
            ]
        );
        const leituraId = leituraResult.insertId;

        // 2. Insert items one by one, collect order quantities for bulk insert
        const orderRows = []; // [leitura_id, item_id, numero_pedido, quantidade]

        for (const item of itens) {
            const [itemResult] = await conn.query(
                `INSERT INTO vmi_itens
                    (leitura_id, codigo_produto, descricao,
                     qtd_wk01, qtd_wk02, qtd_wk03, qtd_wk04, qtd_wk05,
                     faltantes_firmes, entradas, estoque_soc)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    leituraId,
                    item.codigo_produto,
                    item.descricao || null,
                    item.qtd_wk01 || 0,
                    item.qtd_wk02 || 0,
                    item.qtd_wk03 || 0,
                    item.qtd_wk04 || 0,
                    item.qtd_wk05 || 0,
                    item.faltantes_firmes || 0,
                    item.entradas || 0,
                    item.estoque_soc || 0
                ]
            );
            const itemId = itemResult.insertId;

            for (const [numero_pedido, quantidade] of Object.entries(item.pedidos || {})) {
                if (quantidade > 0) {
                    orderRows.push([leituraId, itemId, numero_pedido, quantidade]);
                }
            }
        }

        // 3. Bulk insert order quantities
        if (orderRows.length > 0) {
            await conn.query(
                `INSERT INTO vmi_itens_pedidos (leitura_id, item_id, numero_pedido, quantidade) VALUES ?`,
                [orderRows]
            );
        }

        await conn.commit();
        res.json({ id: leituraId, message: 'Leitura salva com sucesso!' });

    } catch (err) {
        await conn.rollback();
        console.error('❌ Erro ao salvar leitura VMI:', err);
        res.status(500).json({ error: 'Erro ao salvar leitura' });
    } finally {
        conn.release();
    }
});

// ── GET /api/vmi/leituras  — list readings ───────────────────────────────────
router.get('/leituras', async (req, res) => {
    try {
        const [rows] = await mysqlPool.query(
            `SELECT id, nome_arquivo, mes_referencia, mes_label, sheet_name,
                    data_upload, usuario_nome, total_itens, total_pedidos, status
             FROM vmi_leituras
             WHERE status = 'ativo'
             ORDER BY data_upload DESC
             LIMIT 100`
        );
        res.json(rows);
    } catch (err) {
        console.error('❌ Erro ao listar leituras VMI:', err);
        res.status(500).json({ error: 'Erro ao listar leituras' });
    }
});

// ── GET /api/vmi/leituras/:id  — reading detail ──────────────────────────────
router.get('/leituras/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [[leitura]] = await mysqlPool.query(
            'SELECT * FROM vmi_leituras WHERE id = ?', [id]
        );
        if (!leitura) return res.status(404).json({ error: 'Leitura não encontrada' });

        const [itens] = await mysqlPool.query(
            `SELECT i.id, i.codigo_produto, i.descricao,
                    i.qtd_wk01, i.qtd_wk02, i.qtd_wk03, i.qtd_wk04, i.qtd_wk05,
                    i.faltantes_firmes, i.entradas, i.estoque_soc,
                    (i.qtd_wk01 + i.qtd_wk02 + i.qtd_wk03 + i.qtd_wk04 + i.qtd_wk05) AS total_demanda
             FROM vmi_itens i
             WHERE i.leitura_id = ?
             ORDER BY total_demanda DESC, i.codigo_produto`,
            [id]
        );

        // Fetch order quantities per item
        const [pedidos] = await mysqlPool.query(
            `SELECT item_id, numero_pedido, quantidade
             FROM vmi_itens_pedidos
             WHERE leitura_id = ?
             ORDER BY numero_pedido`,
            [id]
        );

        // Group pedidos by item_id
        const pedidosByItem = {};
        for (const p of pedidos) {
            if (!pedidosByItem[p.item_id]) pedidosByItem[p.item_id] = {};
            pedidosByItem[p.item_id][p.numero_pedido] = p.quantidade;
        }

        const itensEnriched = itens.map(i => ({
            ...i,
            pedidos: pedidosByItem[i.id] || {}
        }));

        res.json({ ...leitura, itens: itensEnriched });

    } catch (err) {
        console.error('❌ Erro ao buscar leitura VMI:', err);
        res.status(500).json({ error: 'Erro ao buscar leitura' });
    }
});

// ── GET /api/vmi/estrategia/:id  — production strategy ───────────────────────
router.get('/estrategia/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [[leitura]] = await mysqlPool.query(
            'SELECT * FROM vmi_leituras WHERE id = ?', [id]
        );
        if (!leitura) return res.status(404).json({ error: 'Leitura não encontrada' });

        // All items with week quantities
        const [itens] = await mysqlPool.query(
            `SELECT id, codigo_produto, descricao,
                    qtd_wk01, qtd_wk02, qtd_wk03, qtd_wk04, qtd_wk05,
                    faltantes_firmes, entradas, estoque_soc,
                    (qtd_wk01+qtd_wk02+qtd_wk03+qtd_wk04+qtd_wk05) AS total_semanas
             FROM vmi_itens
             WHERE leitura_id = ?`,
            [id]
        );

        // Order quantities per item
        const [pedidos] = await mysqlPool.query(
            `SELECT item_id, numero_pedido, quantidade
             FROM vmi_itens_pedidos
             WHERE leitura_id = ?
             ORDER BY numero_pedido`,
            [id]
        );

        const pedidosByItem = {};
        for (const p of pedidos) {
            if (!pedidosByItem[p.item_id]) pedidosByItem[p.item_id] = [];
            pedidosByItem[p.item_id].push({ numero: p.numero_pedido, quantidade: +p.quantidade });
        }

        // Enrich each item with strategy metadata
        const itensEnriched = itens.map(item => {
            const wks = [+item.qtd_wk01, +item.qtd_wk02, +item.qtd_wk03, +item.qtd_wk04, +item.qtd_wk05];
            const wkIdx = wks.findIndex(q => q > 0); // 0-based (-1 = sem semana)
            const wkPrioritario = wkIdx === -1 ? 99 : wkIdx + 1; // 1-based WK

            const faltantes = +item.faltantes_firmes;

            // Status: critico = faltantes + urgente | atencao = faltantes ou wk01 | ok = resto
            let status;
            if (faltantes > 0 && wkPrioritario <= 2) status = 'critico';
            else if (faltantes > 0 || wkPrioritario === 1) status = 'atencao';
            else status = 'ok';

            const pedidosItem = pedidosByItem[item.id] || [];
            const totalPedidos = pedidosItem.reduce((s, p) => s + p.quantidade, 0);
            const totalGeral = Math.max(+item.total_semanas, totalPedidos);

            return {
                id: item.id,
                codigo_produto: item.codigo_produto,
                descricao: item.descricao,
                qtd_wk01: +item.qtd_wk01,
                qtd_wk02: +item.qtd_wk02,
                qtd_wk03: +item.qtd_wk03,
                qtd_wk04: +item.qtd_wk04,
                qtd_wk05: +item.qtd_wk05,
                total_semanas: +item.total_semanas,
                faltantes_firmes: faltantes,
                estoque_soc: +item.estoque_soc,
                entradas: +item.entradas,
                wk_prioritario: wkPrioritario,
                status,
                pedidos: pedidosItem,
                total_geral: totalGeral,
                // number of different orders that need this part
                num_pedidos: pedidosItem.length
            };
        });

        // Sort: status priority → WK asc → total desc
        const statusOrder = { critico: 0, atencao: 1, ok: 2 };
        itensEnriched.sort((a, b) => {
            if (statusOrder[a.status] !== statusOrder[b.status])
                return statusOrder[a.status] - statusOrder[b.status];
            if (a.wk_prioritario !== b.wk_prioritario)
                return a.wk_prioritario - b.wk_prioritario;
            return b.total_geral - a.total_geral;
        });

        // Group by WK
        const grupos = {};
        for (let w = 1; w <= 5; w++) {
            const label = `WK0${w}`;
            const items = itensEnriched.filter(i => i.wk_prioritario === w);
            if (items.length > 0) grupos[label] = items;
        }
        const semSemana = itensEnriched.filter(i => i.wk_prioritario === 99);
        if (semSemana.length > 0) grupos['SEM_SEMANA'] = semSemana;

        const resumo = {
            total_itens: itensEnriched.length,
            criticos: itensEnriched.filter(i => i.status === 'critico').length,
            atencao: itensEnriched.filter(i => i.status === 'atencao').length,
            ok: itensEnriched.filter(i => i.status === 'ok').length,
            total_pecas: itensEnriched.reduce((s, i) => s + i.total_geral, 0)
        };

        res.json({ leitura, grupos, resumo, itens: itensEnriched });

    } catch (err) {
        console.error('❌ Erro ao gerar estratégia VMI:', err);
        res.status(500).json({ error: 'Erro ao gerar estratégia' });
    }
});

// ── DELETE /api/vmi/leituras/:id  — soft delete ──────────────────────────────
router.delete('/leituras/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await mysqlPool.query(
            `UPDATE vmi_leituras SET status = 'excluido' WHERE id = ?`, [id]
        );
        res.json({ message: 'Leitura removida.' });
    } catch (err) {
        console.error('❌ Erro ao remover leitura VMI:', err);
        res.status(500).json({ error: 'Erro ao remover leitura' });
    }
});

// ── GET /api/vmi/comparativo  — compare two readings ─────────────────────────
router.get('/comparativo', async (req, res) => {
    const { id_anterior, id_atual } = req.query;
    if (!id_anterior || !id_atual) {
        return res.status(400).json({ error: 'Informe id_anterior e id_atual' });
    }
    try {
        // Items that appear in current but not in previous (new demand)
        const [novosDemanda] = await mysqlPool.query(
            `SELECT a.codigo_produto, a.descricao,
                    0 AS demanda_anterior,
                    (a.qtd_wk01+a.qtd_wk02+a.qtd_wk03+a.qtd_wk04+a.qtd_wk05) AS demanda_atual,
                    'novo' AS situacao
             FROM vmi_itens a
             WHERE a.leitura_id = ?
               AND a.codigo_produto NOT IN (
                   SELECT codigo_produto FROM vmi_itens WHERE leitura_id = ?
               )`,
            [id_atual, id_anterior]
        );

        // Items in both — compare total demand
        const [comparados] = await mysqlPool.query(
            `SELECT a.codigo_produto, a.descricao,
                    (b.qtd_wk01+b.qtd_wk02+b.qtd_wk03+b.qtd_wk04+b.qtd_wk05) AS demanda_anterior,
                    (a.qtd_wk01+a.qtd_wk02+a.qtd_wk03+a.qtd_wk04+a.qtd_wk05) AS demanda_atual,
                    CASE
                        WHEN (a.qtd_wk01+a.qtd_wk02+a.qtd_wk03+a.qtd_wk04+a.qtd_wk05) >
                             (b.qtd_wk01+b.qtd_wk02+b.qtd_wk03+b.qtd_wk04+b.qtd_wk05) THEN 'aumentou'
                        WHEN (a.qtd_wk01+a.qtd_wk02+a.qtd_wk03+a.qtd_wk04+a.qtd_wk05) <
                             (b.qtd_wk01+b.qtd_wk02+b.qtd_wk03+b.qtd_wk04+b.qtd_wk05) THEN 'diminuiu'
                        ELSE 'igual'
                    END AS situacao
             FROM vmi_itens a
             JOIN vmi_itens b ON b.codigo_produto = a.codigo_produto AND b.leitura_id = ?
             WHERE a.leitura_id = ?
             ORDER BY demanda_atual DESC`,
            [id_anterior, id_atual]
        );

        res.json({ novos: novosDemanda, comparados });

    } catch (err) {
        console.error('❌ Erro no comparativo VMI:', err);
        res.status(500).json({ error: 'Erro no comparativo' });
    }
});

module.exports = router;
