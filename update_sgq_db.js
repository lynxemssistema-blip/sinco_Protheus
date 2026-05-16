const db = require('./server/services/mysqlService');

async function run() {
    try {
        await db.query("ALTER TABLE sgq_romaneios_items ADD COLUMN status VARCHAR(50) DEFAULT 'enviado'");
        await db.query("ALTER TABLE sgq_romaneios_items ADD COLUMN data_retorno DATETIME");
        await db.query("ALTER TABLE sgq_romaneios_items ADD COLUMN certificado_url TEXT");
        console.log('Columns added successfully');
    } catch(e) {
        console.log('Error adding columns:', e.message);
    }
    process.exit();
}

run();
