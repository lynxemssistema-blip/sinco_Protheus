const fs = require('fs');
const path = require('path');

const file = path.join('c:/Users/lynx/Documents/MetalFisa Anty/server/routes/reports.js');
let content = fs.readFileSync(file, 'utf8');

const newEndpoint = \
// GET /api/reports/sales-planning/master-sheet
router.get('/sales-planning/master-sheet', async (req, res) => {
    try {
        const { rows } = await fetchSalesPlanningData(req.query, { page: 1, limit: 5000 });

        let capacidadeMap = {};
        try {
            const [capRows] = await mysqlPool.query('SELECT recurso_codigo, tempo_padrao_minutos FROM app_recursos_capacidade');
            capRows.forEach(r => { capacidadeMap[r.recurso_codigo] = parseFloat(r.tempo_padrao_minutos) || 0; });
        } catch (e) {
            console.warn('[MasterSheet] Could not load app_recursos_capacidade:', e.message);
        }

        let recursoNomeMap = {};
        try {
            const sh1 = await db.query(
                "SELECT TRIM(h1_codigo) as cod, TRIM(h1_descri) as nome FROM sh1010 WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ') AND TRIM(h1_codigo) <> ''"
            );
            sh1.rows.forEach(r => { recursoNomeMap[r.cod] = r.nome ? \\ - \\ : r.cod; });
        } catch (e) {}

        const allItems = rows.flatMap(o => (o.itens || []).map(it => ({ ...it, order: o })));
        const uniqueProducts = [...new Set(allItems.map(it => it.produto.trim()))];

        let bomMap = {};
        if (uniqueProducts.length > 0) {
            const bomRows = await db.query(
                \WITH RECURSIVE bom AS (
                    SELECT TRIM(g1_cod) AS raiz, TRIM(g1_comp) AS comp, g1_quant::numeric AS quant, 1 AS nivel
                    FROM sg1010
                    WHERE TRIM(g1_cod) = ANY(::text[]) AND COALESCE(d_e_l_e_t_, '') = ''
                    UNION ALL
                    SELECT bom.raiz, TRIM(sg1.g1_comp), bom.quant * sg1.g1_quant::numeric, bom.nivel + 1
                    FROM sg1010 sg1
                    JOIN bom ON TRIM(sg1.g1_cod) = bom.comp
                    WHERE COALESCE(sg1.d_e_l_e_t_, '') = '' AND bom.nivel < 15
                )
                SELECT raiz, comp, SUM(quant) AS quant_total FROM bom GROUP BY raiz, comp\,
                [uniqueProducts]
            );
            bomRows.rows.forEach(r => {
                if (!bomMap[r.raiz]) bomMap[r.raiz] = [];
                bomMap[r.raiz].push({ comp: r.comp, quant: parseFloat(r.quant_total) || 0 });
            });
        }

        const allCodesSet = new Set(uniqueProducts);
        Object.values(bomMap).forEach(comps => comps.forEach(c => allCodesSet.add(c.comp)));
        const allCodesArr = [...allCodesSet];

        let routingMap  = {};
        let allRecursos = [];
        if (allCodesArr.length > 0) {
            const routingRows = await db.query(
                \SELECT TRIM(g2_produto) as produto, TRIM(g2_recurso) as recurso,
                        g2_tempad::numeric as tempad, GREATEST(g2_lotepad::numeric, 1) as lotepad, g2_setup::numeric as setup
                 FROM sg2010
                 WHERE TRIM(g2_produto) = ANY(::text[]) AND d_e_l_e_t_ = ''
                 ORDER BY g2_produto, g2_recurso, g2_operac\,
                [allCodesArr]
            );
            routingRows.rows.forEach(r => {
                const cod = r.produto, rec = r.recurso;
                const tempad = Number(r.tempad), lote = Math.max(Number(r.lotepad) || 1, 1), setup = Number(r.setup) || 0;
                const tPeca = Number.isFinite(tempad / lote) ? tempad / lote : 0;
                if (!routingMap[cod]) routingMap[cod] = {};
                if (!routingMap[cod][rec]) routingMap[cod][rec] = { tempo_peca: 0, setup: 0 };
                routingMap[cod][rec].tempo_peca += tPeca;
                routingMap[cod][rec].setup += setup;
            });
            const recursoSet = new Set();
            routingRows.rows.forEach(r => { if (r.recurso) recursoSet.add(r.recurso); });
            allRecursos = [...recursoSet].sort();
        }

        const masterSheet = {
            resumo: [],
            pedidos: [],
            itens: [],
            carga: [],
            recursos: allRecursos,
            recursoNomeMap: recursoNomeMap
        };

        const resumoMap = new Map();
        const yieldToEventLoop = () => new Promise(resolve => setImmediate(resolve));
        const BATCH_SIZE = 50;
        const totalOrders = rows.length;

        for (let batchStart = 0; batchStart < totalOrders; batchStart += BATCH_SIZE) {
            const batch = rows.slice(batchStart, Math.min(batchStart + BATCH_SIZE, totalOrders));

            for (const order of batch) {
                const orderCarga = {};
                let pcpInicio = null;
                let pcpFim = null;
                let itemCount = (order.itens || []).length;
                let somaQtd = 0;

                (order.itens || []).forEach(item => {
                    const qtdFaturar = parseFloat(item.qtd_faturar) || 0;
                    somaQtd += parseFloat(item.qtd) || 0;

                    if (item.data_pcp) {
                        let d;
                        if (item.data_pcp.length === 8 && !item.data_pcp.includes('-')) {
                            d = new Date(item.data_pcp.substring(0, 4) + '-' + item.data_pcp.substring(4, 6) + '-' + item.data_pcp.substring(6, 8) + 'T00:00:00');
                        } else {
                            d = new Date(item.data_pcp);
                        }
                        if (!isNaN(d.getTime())) {
                            if (!pcpInicio || d < pcpInicio) pcpInicio = d;
                            if (!pcpFim || d > pcpFim) pcpFim = d;
                        }
                    }

                    const prod = item.produto ? item.produto.trim() : '';
                    if (prod) {
                        if (!resumoMap.has(prod)) {
                            resumoMap.set(prod, { produto: prod, descricao: item.descricao, um: item.um, qtd_total: 0 });
                        }
                        resumoMap.get(prod).qtd_total += qtdFaturar;
                    }

                    masterSheet.itens.push({
                        pedido: order.pedido,
                        emissao: order.emissao,
                        cliente: order.cliente,
                        item: item.item,
                        produto: item.produto,
                        tipo: item.tipo,
                        descricao: item.descricao,
                        um: item.um,
                        qtd: item.qtd,
                        qtd_entreg: item.qtd_entreg,
                        qtd_faturar: qtdFaturar,
                        data_pcp: item.data_pcp,
                        qtde_pcp: item.qtde_pcp,
                        entrega: item.entrega,
                        op: item.op,
                        ped_cli: item.ped_cli
                    });

                    if (qtdFaturar > 0) {
                        const minByRec = calcCargaRecurso(item.produto.trim(), qtdFaturar, routingMap, bomMap, capacidadeMap);
                        const cargaRow = {
                            pedido: order.pedido,
                            emissao: order.emissao,
                            cliente: order.cliente,
                            item: item.item,
                            produto: item.produto,
                            descricao: item.descricao,
                            qtd_faturar: qtdFaturar,
                            entrega: item.entrega,
                            data_pcp: item.data_pcp,
                            qtde_pcp: item.qtde_pcp
                        };
                        allRecursos.forEach(r => {
                            cargaRow['rec_' + r] = minByRec['rec_' + r] || 0;
                            const k = 'rec_' + r;
                            orderCarga[k] = (orderCarga[k] || 0) + (minByRec[k] || 0);
                        });
                        masterSheet.carga.push(cargaRow);
                    }
                });

                const pedidoRow = {
                    pedido: order.pedido,
                    emissao: order.emissao,
                    cliente: order.cliente,
                    status: order.status,
                    itens_count: itemCount,
                    soma_qtd: somaQtd,
                    proxima_entrega: order.proxima_entrega,
                    pcp_inicio: pcpInicio ? pcpInicio.toISOString().split('T')[0] : null,
                    pcp_fim: pcpFim ? pcpFim.toISOString().split('T')[0] : null
                };
                
                allRecursos.forEach(r => {
                    const min = orderCarga['rec_' + r] || 0;
                    pedidoRow['rec_' + r] = min > 0 ? (min / 50) : 0;
                });
                masterSheet.pedidos.push(pedidoRow);
            }
            await yieldToEventLoop();
        }

        masterSheet.resumo = Array.from(resumoMap.values()).sort((a, b) => a.produto.localeCompare(b.produto));

        res.json(masterSheet);
    } catch (error) {
        console.error('[MasterSheet] Error:', error);
        res.status(500).json({ error: error.message });
    }
});
\n\nmodule.exports = router;
\;

content = content.replace('module.exports = router;', newEndpoint);
fs.writeFileSync(file, content, 'utf8');
