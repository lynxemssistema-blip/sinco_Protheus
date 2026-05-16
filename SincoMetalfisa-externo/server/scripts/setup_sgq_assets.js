require('dotenv').config({ path: '../.env' });
const pool = require('../services/mysqlService');

async function runMigration() {
    try {
        console.log('Running SGQ Assets Migration...');
        const conn = await pool.getConnection();

        await conn.query(`
            CREATE TABLE IF NOT EXISTS sgq_assets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                patrimonio VARCHAR(100) UNIQUE,
                name VARCHAR(255) NOT NULL,
                model VARCHAR(255),
                serial_number VARCHAR(255),
                status VARCHAR(50) DEFAULT 'available', 
                calibration_validity DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS sgq_toolboxes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                employee_cpf VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS sgq_asset_toolbox (
                asset_id INT,
                toolbox_id INT,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (asset_id, toolbox_id),
                FOREIGN KEY (asset_id) REFERENCES sgq_assets(id) ON DELETE CASCADE,
                FOREIGN KEY (toolbox_id) REFERENCES sgq_toolboxes(id) ON DELETE CASCADE
            );
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS sgq_calibrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                asset_id INT,
                romaneio VARCHAR(100),
                certificate_url VARCHAR(500),
                date_sent DATE,
                date_returned DATE,
                nf_request_status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (asset_id) REFERENCES sgq_assets(id) ON DELETE CASCADE
            );
        `);

        console.log('✅ Tabelas criadas com sucesso no MySQL!');
        conn.release();
    } catch (error) {
        console.error('❌ Erro durante a migração:', error);
    } finally {
        process.exit();
    }
}

runMigration();
