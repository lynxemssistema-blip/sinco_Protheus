const db = require('./db');

async function checkIndexes() {
    try {
        const res = await db.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'sz1010'");
        console.log(res.rows);
    } catch (e) {
        console.error(e);
    }
}
checkIndexes();
