const pool = require('./server/services/mysqlService');

async function run() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_recursos_capacidade (
                recurso_codigo VARCHAR(50) PRIMARY KEY,
                tempo_padrao_minutos DECIMAL(10,2) DEFAULT 0,
                capacidade_diaria_minutos INT DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log("Table created successfully");
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
run();
