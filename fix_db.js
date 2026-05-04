const mysqlPool = require('./server/services/mysqlService');

async function fixDb() {
    try {
        console.log("Describing tables...");
        const [ordens] = await mysqlPool.query("DESCRIBE pcp_manutencao_ordens");
        const [materiais] = await mysqlPool.query("DESCRIBE pcp_manutencao_materiais");
        const [checklists] = await mysqlPool.query("DESCRIBE pcp_manutencao_checklists_diarios");
        const [maquinas] = await mysqlPool.query("DESCRIBE pcp_manutencao_maquinas");
        
        console.log("pcp_manutencao_ordens fotos:", ordens.find(c => c.Field === 'fotos')?.Type);
        console.log("pcp_manutencao_ordens fotos_execucao:", ordens.find(c => c.Field === 'fotos_execucao')?.Type);
        console.log("pcp_manutencao_materiais foto:", materiais.find(c => c.Field === 'foto')?.Type);
        console.log("pcp_manutencao_checklists_diarios respostas:", checklists.find(c => c.Field === 'respostas')?.Type);
        console.log("pcp_manutencao_maquinas fotos:", maquinas.find(c => c.Field === 'fotos')?.Type);
        
        console.log("\nAltering tables to LONGTEXT...");
        await mysqlPool.query("ALTER TABLE pcp_manutencao_ordens MODIFY fotos LONGTEXT");
        await mysqlPool.query("ALTER TABLE pcp_manutencao_ordens MODIFY fotos_execucao LONGTEXT");
        await mysqlPool.query("ALTER TABLE pcp_manutencao_materiais MODIFY foto LONGTEXT");
        await mysqlPool.query("ALTER TABLE pcp_manutencao_checklists_diarios MODIFY respostas LONGTEXT");
        await mysqlPool.query("ALTER TABLE pcp_manutencao_maquinas MODIFY fotos LONGTEXT");
        
        console.log("Done!");
    } catch(e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

fixDb();
