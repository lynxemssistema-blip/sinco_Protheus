const db = require('./server/db');

async function check() {
    try {
        const res = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sc5010'");
        const columns = res.rows.map(r => r.column_name);
        const observ = columns.filter(c => c.includes('mensag') || c.includes('mennota') || c.includes('observ'));
        console.log("Found observation columns:", observ);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
check();
