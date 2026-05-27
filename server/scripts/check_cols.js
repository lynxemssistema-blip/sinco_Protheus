const db = require('../db');

async function checkCols() {
    try {
        const q = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'sf2010' 
            AND (column_name LIKE '%canc%' OR column_name LIKE '%stat%' OR column_name LIKE '%sit%');
        `;
        const res = await db.query(q);
        console.table(res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkCols();
