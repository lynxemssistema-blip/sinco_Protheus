const pool = require('./services/mysqlService');

async function run() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_calendario_atividades (
                id INT AUTO_INCREMENT PRIMARY KEY,
                idRemetente INT UNSIGNED NOT NULL,
                idDestinatario INT UNSIGNED NOT NULL,
                texto TEXT NOT NULL,
                data_atividade DATE NOT NULL,
                concluido TINYINT(1) DEFAULT 0,
                data_conclusao DATETIME DEFAULT NULL,
                criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_dest_data (idDestinatario, data_atividade),
                INDEX idx_rem_data (idRemetente, data_atividade)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('Tabela app_calendario_atividades verificada/criada com sucesso.');
    } catch (err) {
        console.error('Erro ao criar tabela:', err);
    } finally {
        process.exit(0);
    }
}
run();
