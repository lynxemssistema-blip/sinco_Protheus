require('dotenv').config();
const db = require('./services/mysqlService');

async function migrate() {
    try {
        console.log('Creating app_rh_vagas table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS app_rh_vagas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                cargo_id INT NOT NULL,
                titulo VARCHAR(255) NOT NULL,
                descricao TEXT,
                requisitos_extras TEXT,
                status VARCHAR(50) DEFAULT 'Aberta',
                data_abertura DATE,
                data_fechamento DATE NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (cargo_id) REFERENCES app_sgq_cargos_funcoes(id)
            )
        `);

        console.log('Adding vaga_id to app_rh_curriculos...');
        try {
            await db.query(`ALTER TABLE app_rh_curriculos ADD COLUMN vaga_id INT NULL`);
            await db.query(`ALTER TABLE app_rh_curriculos ADD CONSTRAINT fk_curriculo_vaga FOREIGN KEY (vaga_id) REFERENCES app_rh_vagas(id) ON DELETE SET NULL`);
        } catch (e) {
            console.log('Column vaga_id already exists or constraint already exists', e.message);
        }

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        process.exit();
    }
}
migrate();
