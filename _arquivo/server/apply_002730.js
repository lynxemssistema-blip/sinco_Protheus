const fs = require('fs');
const mysqlPool = require('./services/mysqlService');

async function apply() {
    try {
        const actions = JSON.parse(fs.readFileSync('analysis_actions.json', 'utf8'));
        console.log(`Aplicando ${actions.length} apontamentos pendentes para o pedido 002730...`);
        
        let inserted = 0;
        for (const a of actions) {
            if (a.falta_apontar <= 0) continue;
            
            // Format dates as YYYY-MM-DD HH:mm:ss for MySQL
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 19).replace('T', ' ');

            const insertQuery = `
                INSERT INTO app_production_appointments 
                (op_numero, op_item, op_sequencia, operacao_codigo, quantidade, data_inicio, data_fim, usuario, observacao, conferencia_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OK')
            `;
            const params = [
                a.op, 
                a.item, 
                a.sequencia, 
                a.operacao, 
                a.falta_apontar, 
                dateStr, 
                dateStr, 
                'ADMIN', // Usuario padrao para esse teste
                'Baixa automatica (pedido 002730 sem saldo a faturar)'
            ];
            
            await mysqlPool.query(insertQuery, params);
            inserted++;
        }
        
        console.log(`✅ Sucesso! Foram inseridos ${inserted} apontamentos.`);
    } catch (e) {
        console.error("❌ Erro ao aplicar baixas:", e);
    }
    process.exit(0);
}

apply();
