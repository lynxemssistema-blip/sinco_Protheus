const db = require('./services/mysqlService');

async function createTables() {
    try {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS app_wabtec_escopos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                projeto VARCHAR(100) NOT NULL,
                revisao VARCHAR(20) NOT NULL,
                nome_original VARCHAR(255) NOT NULL,
                caminho_arquivo VARCHAR(255) NOT NULL,
                texto_extraido LONGTEXT,
                criado_por VARCHAR(100),
                status ENUM('ATIVO', 'OBSOLETO') DEFAULT 'ATIVO',
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        
        await db.query(createTableQuery);
        console.log("✅ Tabela app_wabtec_escopos verificada/criada com sucesso.");

    } catch (error) {
        console.error("❌ Erro ao criar tabela:", error);
    } finally {
        process.exit();
    }
}

createTables();
