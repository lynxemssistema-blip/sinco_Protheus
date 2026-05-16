/**
 * Migration: Create app_rh_vagas table and add vaga_id column to app_rh_curriculos
 * Run: node server/scripts/migrate_rh_vagas.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function migrate() {
    const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB,
        port: 3306
    });

    console.log('✅ Connected to MySQL:', process.env.MYSQL_HOST);

    // 1. Create app_rh_vagas table
    console.log('📦 Creating app_rh_vagas table...');
    await conn.query(`
        CREATE TABLE IF NOT EXISTS app_rh_vagas (
            id INT AUTO_INCREMENT PRIMARY KEY,
            titulo VARCHAR(255) NOT NULL,
            cargo_id INT NOT NULL,
            descricao TEXT,
            requisitos_extras TEXT,
            status ENUM('Aberta', 'Pausada', 'Fechada') DEFAULT 'Aberta',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (cargo_id) REFERENCES app_sgq_cargos_funcoes(id) ON DELETE CASCADE
        )
    `);
    console.log('✅ app_rh_vagas table OK');

    // 2. Add vaga_id column to app_rh_curriculos (if not exists)
    console.log('📦 Checking vaga_id column on app_rh_curriculos...');
    const [cols] = await conn.query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'app_rh_curriculos' AND COLUMN_NAME = 'vaga_id'
    `, [process.env.MYSQL_DB]);

    if (cols.length === 0) {
        await conn.query(`
            ALTER TABLE app_rh_curriculos 
            ADD COLUMN vaga_id INT NULL DEFAULT NULL,
            ADD CONSTRAINT fk_curriculo_vaga FOREIGN KEY (vaga_id) REFERENCES app_rh_vagas(id) ON DELETE SET NULL
        `);
        console.log('✅ vaga_id column added to app_rh_curriculos');
    } else {
        console.log('⏭️  vaga_id column already exists, skipping.');
    }

    console.log('\n🎉 Migration completed successfully!');
    await conn.end();
}

migrate().catch(err => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
});
