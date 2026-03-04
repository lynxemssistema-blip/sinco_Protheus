
const pool = require('./services/mysqlService');
require('dotenv').config();

async function createTable() {
    console.log('Creating app_production_appointments table...');
    const conn = await pool.getConnection();
    try {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS app_production_appointments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                op_numero VARCHAR(20) NOT NULL,
                op_item VARCHAR(10) NOT NULL,
                op_sequencia VARCHAR(10) NOT NULL,
                operacao_codigo VARCHAR(10) NOT NULL,
                quantidade DECIMAL(10,2) NOT NULL,
                usuario VARCHAR(100),
                observacao TEXT,
                data_apontamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_op (op_numero, op_item, op_sequencia)
            )
        `);
        console.log('✅ Table app_production_appointments created/verified.');
    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        conn.release();
        process.exit();
    }
}

createTable();
