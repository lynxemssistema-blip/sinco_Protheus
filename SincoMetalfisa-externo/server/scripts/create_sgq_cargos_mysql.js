const pool = require('../services/mysqlService');

async function createTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_sgq_cargos_funcoes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                denominacao VARCHAR(255) NOT NULL,
                codigo_interno VARCHAR(50),
                cbo VARCHAR(50),
                atividades LONGTEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `);
        console.log("MySQL table app_sgq_cargos_funcoes created successfully");
    } catch (e) {
        console.error("Error creating table: ", e);
    } finally {
        process.exit(0);
    }
}

createTable();
