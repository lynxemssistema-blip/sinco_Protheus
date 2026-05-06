const protheus = require('./services/protheusDB');
const mysqlPool = require('./services/mysqlService');

async function run() {
    try {
        const items = ["'71'", "'91'", "'9B'"];
        
        // Fetch operations for order 002730 and these items
        const opsQuery = `
            SELECT 
                TRIM(C2.C2_NUM) as op,
                TRIM(C2.C2_ITEM) as op_item,
                TRIM(C2.C2_SEQUEN) as op_sequencia,
                TRIM(C2.C2_PRODUTO) as produto,
                TRIM(G2.G2_OPERAC) as operacao_codigo,
                TRIM(G2.G2_RECURSO) as recurso,
                C2.C2_QUANT as qtd_planejada
            FROM SC2010 C2
            JOIN SG2010 G2 ON G2.G2_PRODUTO = C2.C2_PRODUTO AND G2.D_E_L_E_T_ = ''
            WHERE C2.C2_NUM = '002730' 
              AND C2.C2_ITEM IN (${items.join(',')}) 
              AND C2.D_E_L_E_T_ = ''
        `;
        const opsResult = await protheus.query(opsQuery);
        const opsRows = opsResult.rows;
        
        if (opsRows.length === 0) {
            console.log("Nenhuma operação encontrada para os itens 71, 91 ou 9B do pedido 002730 no Protheus.");
            process.exit(0);
        }

        const opArray = [...new Set(opsRows.map(r => r.op))];
        const placeholders = opArray.map(() => '?').join(',');
        
        let pgQuery = `SELECT op_numero, op_item, op_sequencia, operacao_codigo, SUM(quantidade) as qtd_apontada 
                       FROM app_production_appointments 
                       WHERE op_numero IN (${placeholders}) AND op_item IN ('71', '91', '9B')
                       GROUP BY op_numero, op_item, op_sequencia, operacao_codigo`;
                       
        const [pgResult] = await mysqlPool.query(pgQuery, opArray);
        
        const existingMap = {};
        pgResult.forEach(row => {
            const key = `${row.op_numero}_${row.op_item}_${row.op_sequencia}_${row.operacao_codigo}`;
            existingMap[key] = parseFloat(row.qtd_apontada) || 0;
        });
        
        const pendentes = [];
        
        opsRows.forEach(opRow => {
            const key = `${opRow.op}_${opRow.op_item}_${opRow.op_sequencia}_${opRow.operacao_codigo}`;
            const apontado = existingMap[key] || 0;
            const planejado = parseFloat(opRow.qtd_planejada);
            
            if (apontado < planejado) {
                pendentes.push({
                    item: opRow.op_item,
                    sequencia: opRow.op_sequencia,
                    produto: opRow.produto,
                    operacao: opRow.operacao_codigo,
                    recurso: opRow.recurso,
                    planejado,
                    apontado,
                    falta: planejado - apontado
                });
            }
        });
        
        console.table(pendentes);
        console.log(`\\nTotal de operações pendentes encontradas nesses 3 itens: ${pendentes.length}`);
        
    } catch(err) {
        console.error(err);
    }
    process.exit(0);
}

run();
