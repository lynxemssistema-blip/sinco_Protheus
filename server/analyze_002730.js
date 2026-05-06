const protheus = require('./services/protheusDB');
const mysqlPool = require('./services/mysqlService');

async function run() {
    try {
        console.log("Analyzing Order 002730...");
        
        // 1. Get items from the order where there is no balance to invoice (qtd_vendida - qtd_entregue <= 0)
        const query = `
            SELECT 
                C6.C6_ITEM as item,
                C6.C6_PRODUTO as produto,
                C6.C6_QTDVEN as qtd_vendida,
                C6.C6_QTDENT as qtd_entregue,
                (C6.C6_QTDVEN - C6.C6_QTDENT) as saldo_faturar,
                C2.C2_NUM as op,
                C2.C2_ITEM as op_item,
                C2.C2_SEQUEN as op_sequencia,
                C2.C2_QUANT as op_quant
            FROM SC6010 C6
            LEFT JOIN SC2010 C2 ON C2.C2_PEDIDO = C6.C6_NUM AND C2.C2_ITEMPV = C6.C6_ITEM AND C2.D_E_L_E_T_ = ''
            WHERE C6.C6_NUM = '002730' AND C6.D_E_L_E_T_ = ''
        `;
        const result = await protheus.query(query);
        const rows = result.rows || result;

        const itemsWithoutBalance = rows.filter(r => r.saldo_faturar <= 0 && r.op);
        
        if (itemsWithoutBalance.length > 0) {
            console.log(`Found ${itemsWithoutBalance.length} OPs with no remaining balance.`);
            
            const opList = itemsWithoutBalance.map(r => `'${r.op.trim()}'`).join(',');
            
            // 2. Fetch operations for these OPs
            const opsQuery = `
                SELECT 
                    C2.C2_NUM as op,
                    C2.C2_ITEM as op_item,
                    C2.C2_SEQUEN as op_sequencia,
                    C2.C2_PRODUTO as produto,
                    G2.G2_OPERAC as operacao_codigo,
                    G2.G2_RECURSO as recurso,
                    C2.C2_QUANT as qtd_planejada
                FROM SC2010 C2
                JOIN SG2010 G2 ON G2.G2_PRODUTO = C2.C2_PRODUTO AND G2.D_E_L_E_T_ = ''
                WHERE C2.C2_NUM IN (${opList}) AND C2.D_E_L_E_T_ = ''
            `;
            const opsResult = await protheus.query(opsQuery);
            const opsRows = opsResult.rows || opsResult;
            
            // 3. Fetch existing appointments from MySQL to see what is already pointed
            const opArray = itemsWithoutBalance.map(r => r.op.trim());
            const placeholders = opArray.map(() => '?').join(',');
            let pgQuery = `SELECT op_numero, op_item, op_sequencia, operacao_codigo, SUM(quantidade) as qtd_apontada 
                           FROM app_production_appointments 
                           WHERE op_numero IN (${placeholders})
                           GROUP BY op_numero, op_item, op_sequencia, operacao_codigo`;
                           
            const [pgResult] = await mysqlPool.query(pgQuery, opArray);
            
            const existingMap = {};
            pgResult.forEach(row => {
                const key = `${row.op_numero}_${row.op_item}_${row.op_sequencia}_${row.operacao_codigo}`;
                existingMap[key] = parseFloat(row.qtd_apontada) || 0;
            });
            
            const actions = [];
            
            opsRows.forEach(opRow => {
                const key = `${opRow.op.trim()}_${opRow.op_item.trim()}_${opRow.op_sequencia.trim()}_${opRow.operacao_codigo.trim()}`;
                const apontado = existingMap[key] || 0;
                const planejado = parseFloat(opRow.qtd_planejada);
                
                if (apontado < planejado) {
                    actions.push({
                        op: opRow.op.trim(),
                        item: opRow.op_item.trim(),
                        sequencia: opRow.op_sequencia.trim(),
                        operacao: opRow.operacao_codigo.trim(),
                        produto: opRow.produto.trim(),
                        planejado,
                        apontado,
                        falta_apontar: planejado - apontado
                    });
                }
            });
            
            console.table(actions);
            console.log(`\\nTotal de operações pendentes de baixa: ${actions.length}`);
            
            require('fs').writeFileSync('analysis_actions.json', JSON.stringify(actions, null, 2));
            console.log("Saved actions to analysis_actions.json");
            
        } else {
            console.log("No items found that meet the condition (no balance & has OP).");
        }
    } catch(err) {
        console.error(err);
    }
    process.exit(0);
}

run();
