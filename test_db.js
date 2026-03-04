const db = require('./server/db');

async function check() {
    const res = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'sc6010'`);
    const cols = res.rows.map(r => r.column_name);
    console.log("SC6010:", cols.filter(c => c.includes('nota') || c.includes('fat') || c.includes('serie') || c.includes('emiss') || c.includes('doc')));

    const res2 = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'sc5010'`);
    const cols2 = res2.rows.map(r => r.column_name);
    console.log("SC5010:", cols2.filter(c => c.includes('nota') || c.includes('fat') || c.includes('serie') || c.includes('emiss') || c.includes('doc')));

    process.exit(0);
}

check();
