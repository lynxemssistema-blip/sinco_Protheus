const db = require('../db');

async function getD2Cols() {
    try {
        const q = `
            SELECT column_name
            FROM information_schema.columns 
            WHERE table_name = 'sd2010'
            AND column_name LIKE 'd2_cf%';
        `;
        const res = await db.query(q);
        console.table(res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
getD2Cols();
