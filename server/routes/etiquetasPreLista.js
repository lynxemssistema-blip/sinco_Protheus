const express = require('express');
const router = express.Router();
const mysqlPool = require('../services/mysqlService');

// POST /api/faturamento/pre-etiquetas - Cria pre-etiquetas (usado pelo Tablet na expedição)
router.post('/', async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user?.IdEmpresa || 1;
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
            item.cliente || item.nome_cliente || null,
            item.cod_cliente || item.cliente_cod || null,
            item.ped_cliente || item.pedcli || null,
            item.ref_cliente || null,
            item.revisao || item.rev_cliente || null,
            item.pcp_forecast_id || null,
            item.pcp_data_entrega || null,
            item.pcp_serie_cliente || null,
            item.pcp_serie_lynx || item.pcp_serie_metalfisa || null,
            item.pcp_serie_lynx || item.pcp_serie_metalfisa || null,
            item.pcp_numero_serie || null,
            item.pcp_lote || null,
            item.pcp_numero_lote || null,
            tenantId
        ]);

        const query = `
            INSERT INTO faturamento_pre_etiquetas (
                produto_codigo, produto_descricao, pedido, item, op_num, 
                quantidade_solicitada, criado_por, cliente, cod_cliente,
                ped_cliente, ref_cliente, revisao, pcp_forecast_id,
                pcp_data_entrega, pcp_serie_cliente, pcp_serie_metalfisa, pcp_serie_lynx,
                pcp_numero_serie, pcp_lote, pcp_numero_lote, IdEmpresa
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
        const tenantId = req.tenantId || req.user?.IdEmpresa || 1;
        const [rows] = await mysqlPool.query(`
            SELECT * FROM faturamento_pre_etiquetas 
            WHERE status = 'PENDENTE' AND IdEmpresa = ?
            ORDER BY criado_em DESC
        `, [tenantId]);

        if (!rows || rows.length === 0) {
            return res.json([]);
        }

        // Enriquecer dados faltantes de pedidos (Cliente, Ref. Cliente, Revisão) direto do MySQL nativo
        try {
            const pedidos = [...new Set(rows.map(r => String(r.pedido).trim()).filter(Boolean))];
            if (pedidos.length > 0) {
                const placeholders = pedidos.map(() => '?').join(', ');
                const [protheusRows] = await mysqlPool.query(`
                    SELECT 
                        TRIM(c5.c5_num) as pedido, 
                        TRIM(c6.c6_item) as item, 
                        TRIM(c5.c5_cliente) as cliente_cod, 
                        TRIM(sa1.a1_nome) as cliente, 
                        TRIM(c6.c6_pedcli) as ped_cliente, 
                        TRIM(c6.c6_xproc1) as ref_cliente,
                        COALESCE(TRIM(c6.c6_xrevc), TRIM(c6.c6_xrevm), '') as revisao
                    FROM sc5010 c5
                    JOIN sc6010 c6 ON c6.c6_num = c5.c5_num AND COALESCE(c6.d_e_l_e_t_, '') = ''
                    LEFT JOIN sa1010 sa1 ON sa1.a1_cod = c5.c5_cliente AND sa1.a1_loja = c5.c5_lojacli AND COALESCE(sa1.d_e_l_e_t_, '') = ''
                    WHERE c5.c5_num IN (${placeholders}) 
                      AND COALESCE(c5.d_e_l_e_t_, '') = ''
                `, pedidos);

                const map = new Map();
                for (const p of protheusRows) {
                    map.set(`${p.pedido}-${p.item}`, p);
                    const intItem = String(parseInt(p.item, 10));
                    if (!map.has(`${p.pedido}-${intItem}`)) {
                        map.set(`${p.pedido}-${intItem}`, p);
                    }
                }

                const enriched = rows.map(r => {
                    const pNum = String(r.pedido).trim();
                    const iNum = String(r.item).trim();
                    const info = map.get(`${pNum}-${iNum}`) || map.get(`${pNum}-${String(parseInt(iNum, 10))}`) || {};
                    return {
                        ...r,
                        cliente: r.cliente || info.cliente || '',
                        nome_cliente: r.cliente || info.cliente || '',
                        cliente_cod: r.cod_cliente || info.cliente_cod || '',
                        cod_cliente: r.cod_cliente || info.cliente_cod || '',
                        ped_cliente: r.ped_cliente || info.ped_cliente || '',
                        ref_cliente: r.ref_cliente || info.ref_cliente || '',
                        revisao: r.revisao || info.revisao || ''
                    };
                });
                return res.json(enriched);
            }
        } catch (enrichErr) {
            console.warn("⚠️ [PreEtiquetas] Aviso ao enriquecer dados adicionais:", enrichErr.message);
        }

        res.json(rows);
    } catch (err) {
        console.error("Erro ao buscar pré-etiquetas:", err);
        res.status(500).json({ error: "Erro interno ao buscar pré-etiquetas." });
    }
});

// PUT /api/faturamento/pre-etiquetas/:id - Atualiza dados (ex: quantidade editada pela Silvia)
router.put('/:id', async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user?.IdEmpresa || 1;
        const { id } = req.params;
        const { quantidade_solicitada } = req.body;
        
        await mysqlPool.query(`
            UPDATE faturamento_pre_etiquetas 
            SET quantidade_solicitada = ? 
            WHERE id = ? AND IdEmpresa = ?
        `, [quantidade_solicitada, id, tenantId]);
        
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao atualizar pré-etiqueta:", err);
        res.status(500).json({ error: "Erro interno ao atualizar pré-etiqueta." });
    }
});

// PUT /api/faturamento/pre-etiquetas/:id/impresso - Marca como executado
router.put('/:id/impresso', async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user?.IdEmpresa || 1;
        const { id } = req.params;
        await mysqlPool.query(`
            UPDATE faturamento_pre_etiquetas 
            SET status = 'EXECUTADO' 
            WHERE id = ? AND IdEmpresa = ?
        `, [id, tenantId]);
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao marcar pré-etiqueta como impressa:", err);
        res.status(500).json({ error: "Erro interno." });
    }
});

// DELETE /api/faturamento/pre-etiquetas/:id - Marca como cancelado
router.delete('/:id', async (req, res) => {
    try {
        const tenantId = req.tenantId || req.user?.IdEmpresa || 1;
        const { id } = req.params;
        await mysqlPool.query(`
            UPDATE faturamento_pre_etiquetas 
            SET status = 'CANCELADO' 
            WHERE id = ? AND IdEmpresa = ?
        `, [id, tenantId]);
        res.json({ success: true });
    } catch (err) {
        console.error("Erro ao cancelar pré-etiqueta:", err);
        res.status(500).json({ error: "Erro interno." });
    }
});

module.exports = router;
