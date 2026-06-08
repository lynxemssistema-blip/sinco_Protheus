const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../services/mysqlService');

(async () => {
    try {
        const [imports] = await db.query('SELECT * FROM app_wabtec_imports ORDER BY id DESC LIMIT 5');
        console.log('Lotes recentes:', imports);
        
        const [rows] = await db.query('SELECT count(*) as c FROM app_wabtec_imported_rows');
        console.log('Total rows:', rows[0].c);
        
        if (imports.length > 0) {
            const [loteRows] = await db.query('SELECT count(*) as c FROM app_wabtec_imported_rows WHERE import_id = ?', [imports[0].id]);
            console.log(`Rows in latest lote (${imports[0].id}):`, loteRows[0].c);
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
})();
