
const pool = require('./services/mysqlService');
require('dotenv').config();

async function createTables() {
    console.log('Creating production control tables...');
    const conn = await pool.getConnection();
    try {
        // 1. Planning Table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS app_production_planning (
                id INT AUTO_INCREMENT PRIMARY KEY,
                op_numero VARCHAR(20) NOT NULL,
                op_item VARCHAR(10) NOT NULL,
                op_sequencia VARCHAR(10) NOT NULL,
                operacao_codigo VARCHAR(10) NOT NULL,
                data_planejada_inicio DATETIME,
                data_planejada_fim DATETIME,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY idx_op_unique (op_numero, op_item, op_sequencia, operacao_codigo)
            )
        `);
        console.log('✅ Table app_production_planning created.');

        // 2. Appointments Table (History)
        // Dropping to ensure schema update if it exists from previous step
        // In a real prod env we would ALTER, but this is dev.
        await conn.query(`DROP TABLE IF EXISTS app_production_appointments`);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS app_production_appointments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                op_numero VARCHAR(20) NOT NULL,
                op_item VARCHAR(10) NOT NULL,
                op_sequencia VARCHAR(10) NOT NULL,
                operacao_codigo VARCHAR(10) NOT NULL,
                usuario VARCHAR(100) NOT NULL,
                quantidade DECIMAL(10,2) NOT NULL,
                data_inicio DATETIME NOT NULL,
                data_fim DATETIME NOT NULL,
                observacao TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_op_hist (op_numero, op_item, op_sequencia)
            )
        `);
        console.log('✅ Table app_production_appointments created with Start/End fields.');

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        conn.release();
        process.exit();
    }
}

createTables();
