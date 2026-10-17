require('dotenv').config();
const db = require('./db');

async function test() {
    try {
        const r1 = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'scj010'");
        const scjCols = r1.rows.map(x => x.column_name).filter(c => c.includes('obs') || c.includes('men') || c.includes('nota'));
        console.log("SCJ observation columns:", scjCols);
    } catch (e) {
        console.log("SCJ table check failed:", e.message);
    }
    process.exit(0);
}
test();
