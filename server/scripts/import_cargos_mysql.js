// server/scripts/import_cargos_mysql.js
const fs = require('fs');
const path = require('path');
const db = require('../services/mysqlService');

async function importCargos() {
    const jsonPath = path.join(__dirname, 'cargos.json');
    if (!fs.existsSync(jsonPath)) {
        console.error('File cargos.json not found');
        process.exit(1);
    }
    
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`Starting import of ${data.length} records...`);
    
    let inserted = 0;
    
    for (const cargo of data) {
        try {
            await db.query(`
                INSERT INTO app_sgq_cargos_funcoes (denominacao, codigo_interno, cbo, atividades)
                VALUES (?, ?, ?, ?)
            `, [
                cargo.denominacao || '',
                cargo.codigo_interno || null,
                cargo.cbo || null,
                JSON.stringify(cargo.atividades || [])
            ]);
            inserted++;
        } catch (err) {
            console.error(`Error inserting ${cargo.denominacao}: `, err.message);
        }
    }
    
    console.log(`Import complete. ${inserted} records inserted successfully.`);
    process.exit(0);
}

importCargos();
