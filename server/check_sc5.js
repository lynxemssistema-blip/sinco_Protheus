require('dotenv').config();
const db = require('./db');

async function test() {
    try {
        const r1 = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sc5010'");
        const scjCols = r1.rows.map(x => x.column_name).filter(c => c.includes('obs') || c.includes('men') || c.includes('nota'));
        console.log("SC5 observation columns:", scjCols);
    } catch (e) {
        console.log("SC5 table check failed:", e.message);
    }
    process.exit(0);
}
test();
