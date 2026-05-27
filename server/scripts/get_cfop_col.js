const db = require('../db');

async function getCFOPCol() {
    try {
        const q = `
            SELECT column_name, table_name
            FROM information_schema.columns 
            WHERE table_name IN ('sf2010', 'sd2010')
            AND column_name LIKE '%cfop%';
        `;
        const res = await db.query(q);
        console.table(res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
getCFOPCol();
