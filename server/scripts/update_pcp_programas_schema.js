const mysqlPool = require('../services/mysqlService');

async function main() {
    try {
        console.log("Iniciando migração do esquema de pcp_programas...");

        // 1. Adicionar chapas_planejadas na tabela pcp_programas_liberados
        console.log("Verificando se chapas_planejadas já existe na tabela pcp_programas_liberados...");
        const [columns] = await mysqlPool.query("SHOW COLUMNS FROM pcp_programas_liberados LIKE 'chapas_planejadas'");
        if (columns.length === 0) {
            console.log("Adicionando coluna 'chapas_planejadas' à tabela pcp_programas_liberados...");
            await mysqlPool.query("ALTER TABLE pcp_programas_liberados ADD COLUMN chapas_planejadas TEXT NULL AFTER quantidade_vezes");
            console.log("Coluna 'chapas_planejadas' adicionada com sucesso!");
        } else {
            console.log("Coluna 'chapas_planejadas' já existe.");
        }

        // 2. Alterar chapa_numero em pcp_programas_execucoes para VARCHAR(100)
        console.log("Alterando chapa_numero em pcp_programas_execucoes para VARCHAR(100)...");
        await mysqlPool.query("ALTER TABLE pcp_programas_execucoes MODIFY COLUMN chapa_numero VARCHAR(100) NOT NULL");
        console.log("Coluna chapa_numero em pcp_programas_execucoes alterada com sucesso!");

        // 3. Alterar chapa_numero em pcp_programas_paradas para VARCHAR(100)
        console.log("Alterando chapa_numero em pcp_programas_paradas para VARCHAR(100)...");
        await mysqlPool.query("ALTER TABLE pcp_programas_paradas MODIFY COLUMN chapa_numero VARCHAR(100) NOT NULL");
        console.log("Coluna chapa_numero em pcp_programas_paradas alterada com sucesso!");

        console.log("✅ Migração do esquema pcp_programas concluída com sucesso!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Erro durante a migração do banco de dados:", err);
        process.exit(1);
    }
}

main();
