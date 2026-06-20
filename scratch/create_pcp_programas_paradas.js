const mysqlPool = require('../server/services/mysqlService');

async function main() {
    try {
        console.log("Iniciando criação da tabela pcp_programas_paradas...");
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS pcp_programas_paradas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                programa_id INT NOT NULL,
                chapa_numero INT NOT NULL,
                usuario_apontamento VARCHAR(100) NOT NULL,
                data_inicio DATETIME NOT NULL,
                data_fim DATETIME NULL,
                tempo_segundos INT DEFAULT 0,
                motivo VARCHAR(255) NOT NULL,
                observacoes TEXT NULL,
                status VARCHAR(50) DEFAULT 'EM_ANDAMENTO', -- 'EM_ANDAMENTO', 'CONCLUIDA'
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (programa_id) REFERENCES pcp_programas_liberados(id) ON DELETE CASCADE
            )
        `);
        console.log("Tabela pcp_programas_paradas criada ou já existente com sucesso!");
        process.exit(0);
    } catch (err) {
        console.error("Erro ao criar tabela:", err);
        process.exit(1);
    }
}

main();
