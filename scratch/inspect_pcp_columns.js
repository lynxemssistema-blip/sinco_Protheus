const mysqlPool = require('../server/services/mysqlService');

async function inspect() {
    try {
        const [rows] = await mysqlPool.query("DESCRIBE pcp_programas_liberados");
        console.log("Colunas da tabela pcp_programas_liberados:");
        console.table(rows);
        process.exit(0);
    } catch (err) {
        console.error("Erro ao inspecionar tabela:", err);
        process.exit(1);
    }
}

inspect();
