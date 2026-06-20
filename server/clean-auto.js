const mysqlPool = require('./services/mysqlService');

(async () => {
    try {
        const [rows] = await mysqlPool.query("SELECT usuario, COUNT(*) as qtd FROM app_production_appointments WHERE usuario LIKE '%AUTO%' GROUP BY usuario ORDER BY qtd DESC");
        console.log('--- Apontamentos Automáticos Encontrados ---');
        console.table(rows);
        
        if (rows.length > 0) {
            const [result] = await mysqlPool.query("DELETE FROM app_production_appointments WHERE usuario LIKE '%AUTO%'");
            console.log(`✅ Sucesso: ${result.affectedRows} apontamentos automáticos foram excluídos!`);
        } else {
            console.log('Nenhum apontamento com usuário AUTO encontrado.');
        }

        // Também limpar da tabela de conferência se houver
        const [confRows] = await mysqlPool.query("SELECT conferido_por, COUNT(*) as qtd FROM app_conferencia_historico WHERE conferido_por LIKE '%AUTO%' GROUP BY conferido_por");
        if (confRows.length > 0) {
            const [result] = await mysqlPool.query("DELETE FROM app_conferencia_historico WHERE conferido_por LIKE '%AUTO%'");
            console.log(`✅ Sucesso: ${result.affectedRows} conferências automáticas excluídas!`);
        }

        // Almoxarifado
        const [almoRows] = await mysqlPool.query("SELECT usuario_entrega, COUNT(*) as qtd FROM app_solicitacoes_almoxarifado WHERE usuario_entrega = 'APONTAMENTO_AUTO' GROUP BY usuario_entrega");
        if (almoRows.length > 0) {
            const [result] = await mysqlPool.query("UPDATE app_solicitacoes_almoxarifado SET status = 'PENDENTE', data_entregue = NULL, usuario_entrega = NULL WHERE usuario_entrega = 'APONTAMENTO_AUTO'");
            console.log(`✅ Sucesso: ${result.affectedRows} baixas de almoxarifado revertidas para PENDENTE!`);
        }

        process.exit(0);
    } catch(e) {
        console.error('Erro:', e);
        process.exit(1);
    }
})();
