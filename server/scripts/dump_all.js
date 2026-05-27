const db = require('../db');

async function dumpAll() {
    try {
        const q = `SELECT * FROM SF2010 WHERE F2_DOC = '000042767' AND F2_SERIE = '1  '`;
        const res = await db.query(q);
        const row = res.rows[0];
        const out = {};
        for (let k in row) {
            if (row[k] !== null && row[k] !== '' && row[k] !== ' ' && row[k] !== '   ' && row[k] !== '        ' && row[k] !== 0) {
                out[k] = row[k];
            }
        }
        console.log(out);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
dumpAll();
