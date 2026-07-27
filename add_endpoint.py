import sys

with open('c:/Users/lynx/Documents/MetalFisa Anty/server/routes/reports.js', 'r', encoding='utf-8') as f:
    content = f.read()

new_endpoint = '''
// GET /api/reports/sales-planning/master-sheet
router.get('/sales-planning/master-sheet', async (req, res) => {
    try {
        const { rows, capacidadeMap, recursoNomeMap, allRecursos, bomMap, routingMap } = await loadSalesPlanningDependencies(req.query);

        // Estruturas de retorno
        const masterSheet = {
            resumo: [],
            pedidos: [],
            itens: [],
            carga: [],
            recursos: allRecursos,
            recursoNomeMap: recursoNomeMap
        };

        const resumoMap = new Map();
        
        // Utilitário para batch
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

                    // Atualiza PCP
                    if (item.data_pcp) {
                        const d = new Date(item.data_pcp);
                        if (!isNaN(d.getTime())) {
                            if (!pcpInicio || d < pcpInicio) pcpInicio = d;
                            if (!pcpFim || d > pcpFim) pcpFim = d;
                        }
                    }

                    // Resumo
                    const prod = item.produto ? item.produto.trim() : '';
                    if (prod) {
                        if (!resumoMap.has(prod)) {
                            resumoMap.set(prod, { produto: prod, descricao: item.descricao, um: item.um, qtd_total: 0 });
                        }
                        resumoMap.get(prod).qtd_total += qtdFaturar;
                    }

                    // Carga do Item (Itens Detalhados)
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

                    // Carga Expandida
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
                            cargaRow[ec_] = minByRec[ec_] || 0;
                            const k = ec_;
                            orderCarga[k] = (orderCarga[k] || 0) + (minByRec[k] || 0);
                        });
                        masterSheet.carga.push(cargaRow);
                    }
                });

                // Adiciona Pedido
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
                
                // Converte minutos para horas produtivas (regra dos 50 min/h)
                allRecursos.forEach(r => {
                    const min = orderCarga[ec_] || 0;
                    pedidoRow[ec_] = min > 0 ? (min / 50) : 0;
                });
                masterSheet.pedidos.push(pedidoRow);
            }

            await yieldToEventLoop();
        }

        masterSheet.resumo = Array.from(resumoMap.values()).sort((a, b) => a.produto.localeCompare(b.produto));

        res.json(masterSheet);
    } catch (error) {
        console.error('[Excel/MasterSheet] Error:', error);
        res.status(500).json({ error: error.message });
    }
});
'''

# Find the module.exports = router; to insert before it
content = content.replace('module.exports = router;', new_endpoint + '\\nmodule.exports = router;')

with open('c:/Users/lynx/Documents/MetalFisa Anty/server/routes/reports.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Endpoint appended successfully")
