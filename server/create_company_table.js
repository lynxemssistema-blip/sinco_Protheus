
const pool = require('./services/mysqlService');
require('dotenv').config();

async function createTable() {
    console.log('Creating app_company_settings table...');
    const conn = await pool.getConnection();
    try {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS app_company_settings (
                id INT PRIMARY KEY DEFAULT 1,
                cnpj VARCHAR(20),
                razao_social VARCHAR(255),
                endereco VARCHAR(255),
                bairro VARCHAR(100),
                cidade VARCHAR(100),
                uf VARCHAR(2),
                cep VARCHAR(10),
                telefone VARCHAR(20),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        // Ensure the singleton row exists
        await conn.query(`
            INSERT IGNORE INTO app_company_settings (id, razao_social) VALUES (1, 'Minha Empresa')
        `);
        console.log('✅ Table app_company_settings created/verified.');
    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        conn.release();
        process.exit();
    }
}

createTable();
