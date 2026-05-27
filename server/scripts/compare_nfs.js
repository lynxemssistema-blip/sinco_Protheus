const db = require('../db');

async function compare() {
    try {
        const q = `SELECT * FROM SF2010 WHERE F2_DOC IN ('000042767', '000042813') AND F2_SERIE = '1  '`;
        const res = await db.query(q);
        const diff = {};
        const colNames = Object.keys(res.rows[0]);
        for (const col of colNames) {
            if (res.rows[0][col] !== res.rows[1][col]) {
                diff[col] = {
                    '42767 (Excluded)': res.rows[0][col],
                    '42813 (Included)': res.rows[1][col]
                };
            }
        }
        console.table(diff);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
compare();
