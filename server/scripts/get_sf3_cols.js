const db = require('../db');

async function getSF3() {
    try {
        const q = `
            SELECT column_name
            FROM information_schema.columns 
            WHERE table_name = 'sf3010'
            AND column_name LIKE '%canc%';
        `;
        const res = await db.query(q);
        console.table(res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
getSF3();
