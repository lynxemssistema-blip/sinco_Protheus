const db = require('../services/mysqlService');

async function createTable() {
    try {
        console.log("🔗 Criando a tabela app_rh_curriculos na UOL Host...");

        await db.query(`
            CREATE TABLE IF NOT EXISTS app_rh_curriculos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                cargo_id INT NOT NULL,
                nome_candidato VARCHAR(255) NOT NULL,
                telefone VARCHAR(50),
                email VARCHAR(150),
                file_path VARCHAR(500),
                curriculo_texto LONGTEXT,
                resumo_ai TEXT,
                status VARCHAR(50) DEFAULT 'Em Avaliação',
                comentarios TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (cargo_id) REFERENCES app_sgq_cargos_funcoes(id) ON DELETE CASCADE
            )
        `);

        console.log('✅ Tabela app_rh_curriculos criada com sucesso.');
    } catch (e) {
        console.error('❌ Erro na criacao da tabela app_rh_curriculos:', e);
    } finally {
        process.exit();
    }
}

createTable();
