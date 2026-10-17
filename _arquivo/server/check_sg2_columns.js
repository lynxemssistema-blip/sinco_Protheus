const db = require('./config/database');
(async () => {
    const r = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'sg2010' AND (column_name ILIKE '%tempo%' OR column_name ILIKE '%setup%' OR column_name ILIKE '%g2_tl%') ORDER BY column_name`);
    console.log('sg2010 tempo/setup columns:', JSON.stringify(r.rows, null, 2));
    process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
