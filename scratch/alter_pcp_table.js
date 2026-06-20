const mysqlPool = require('../server/services/mysqlService');

async function alter() {
    try {
        await mysqlPool.query("ALTER TABLE pcp_programas_liberados ADD COLUMN ordem_execucao INT DEFAULT 0");
        console.log("Coluna ordem_execucao adicionada com sucesso!");
        process.exit(0);
    } catch (err) {
        console.error("Erro ao alterar tabela:", err);
        process.exit(1);
    }
}

alter();
