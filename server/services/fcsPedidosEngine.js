const db = require('../db');
const { runFcsSequencing } = require('./fcsEngine');

async function planPedidosFCS({ pedidos, data_inicio, include_saturday, clear_existing = false, sync_data_pcp = false, usuario = 'planejamento_inteligente', io = null, runId = null }) {
    if (!pedidos || !pedidos.length) throw new Error("Nenhum pedido fornecido.");
    
    let pgClient = null;
    let virtualOps = [];
    let agent_logs = [];

    try {
        pgClient = await db.connect();
        
        agent_logs.push(`Buscando OPs reais no Protheus para ${pedidos.length} item(ns) de pedido...`);
        
        // Para cada pedido, explodimos a estrutura usando CTE Recursiva
        for (let i = 0; i < pedidos.length; i++) {
            const ped = pedidos[i];
            // O /flat retorna 'codigo' para o produto e 'pcp_delivery_forecast_qtd' para qtde PCP.
            // Suportar ambos os formatos para compatibilidade.
            const produtoCodigo = (ped.produto || ped.codigo || '').trim();
            const qtd_pcp = Number(ped.qtd_pcp || ped.pcp_delivery_forecast_qtd || ped.saldo_faturar || 0);
            if (qtd_pcp <= 0) {
                agent_logs.push(`⚠️ Pedido ${ped.pedido} item ${ped.item} pulado (Qtde PCP zero).`);
                continue;
            }
            if (!produtoCodigo) {
                agent_logs.push(`⚠️ Pedido ${ped.pedido} item ${ped.item} pulado (produto não identificado).`);
                continue;
            }

            // ── Verificar se já existe OP real no Protheus para este pedido/item ──────
            // Se existir, usar a OP real — não criar OP virtual desnecessária.
            const opRealRes = await pgClient.query(
                `SELECT TRIM(c2_num) AS op_num, TRIM(c2_item) AS item_op, TRIM(c2_sequen) AS sequen,
                        TRIM(c2_produto) AS produto, c2_quant AS qtde, c2_quje AS qtde_feita
                 FROM sc2010
                 WHERE TRIM(c2_pedido) = $1
                   AND TRIM(c2_itempv) = $2
                   AND COALESCE(d_e_l_e_t_, '') IN ('', ' ')
                   AND (c2_quant - COALESCE(c2_quje, 0)) > 0.001
                 ORDER BY c2_num ASC
                 LIMIT 1`,
                [ped.pedido.trim(), ped.item.trim()]
            );

            if (opRealRes.rows.length > 0) {
                const opReal = opRealRes.rows[0];
                virtualOps.push({
                    op_num:     opReal.op_num,
                    item_op:    opReal.item_op  || '01',
                    sequen:     opReal.sequen   || '001',
                    produto:    opReal.produto  || produtoCodigo,
                    pedido:     ped.pedido,
                    itempv:     ped.item,
                    qtde:       Number(opReal.qtde)        || qtd_pcp,
                    qtde_feita: Number(opReal.qtde_feita)  || 0,
                    nivel: 0
                });
                agent_logs.push(`✅ Pedido ${ped.pedido}-${ped.item}: OP ${opReal.op_num} | Produto=${opReal.produto} | Qtd=${opReal.qtde}.`);
            } else {
                agent_logs.push(`⚠️ Pedido ${ped.pedido}-${ped.item}: nenhuma OP aberta encontrada no Protheus — item ignorado.`);
            }
        }

        if (virtualOps.length === 0) {
            throw new Error("Nenhuma OP virtual gerada. Verifique os pedidos selecionados.");
        }

        // Simular o Agente
        agent_logs.push(`Invocando motor FCS em modo Simulação com ${virtualOps.length} OPs Virtuais...`);
        const fcsResult = await runFcsSequencing({
            ops: virtualOps.map(v => v.op_num),
            opsData: virtualOps,
            simulationOnly: false, // Pedidos gravam Prev. Fat no banco
            data_inicio,
            usuario,
            include_saturday,
            clear_existing,
            sync_data_pcp,
            io,
            runId
        });

        return {
            success: true,
            message: "Planejamento de pedidos concluído.",
            agent_logs: [...agent_logs, ...(fcsResult.agent_logs || [])],
            plans: fcsResult.plans || [],
            report: fcsResult.report || null,
            total_ops: virtualOps.length
        };

    } catch (e) {
        agent_logs.push(`❌ Erro Fatal: ${e.message}`);
        return { success: false, error: e.message, agent_logs };
    } finally {
        if (pgClient) pgClient.release();
    }
}

module.exports = { planPedidosFCS };
