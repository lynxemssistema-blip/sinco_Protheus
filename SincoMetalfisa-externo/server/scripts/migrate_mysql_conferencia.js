const mysqlPool = require('../services/mysqlService');

async function run() {
    try {
        console.log("Adding columns to app_production_appointments...");

        // MySQL ALTER TABLE multiple ADD columns
        await mysqlPool.query(`
            ALTER TABLE app_production_appointments 
            ADD COLUMN conferencia_status VARCHAR(50) DEFAULT 'OK',
            ADD COLUMN conferido_por VARCHAR(100),
            ADD COLUMN conferido_em DATETIME,
            ADD COLUMN conferencia_obs TEXT,
            ADD COLUMN conferencia_fotos TEXT;
        `);
        console.log("Columns added successfully!");
    } catch (e) {
        // Ignorar se a coluna já existe (MySQL errno 1060)
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log("Colunas já existem. Ignorando erro.");
        } else {
            console.error("Migration error:", e);
        }
    } finally {
        process.exit(0);
    }
}

run();
