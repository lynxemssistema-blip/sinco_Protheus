const db = require('./db');
async function run() {
    try {
        const res = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'sb1010' AND column_name LIKE '%rev%'`);
        console.log("Cols:", res.rows);
    } catch(e) { console.error(e); }
    process.exit();
}
run();
