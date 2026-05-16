const db = require('./db');

async function debug() {
    try {
        console.log('🔍 Inspecting SG2010 columns for Sequence...');
        const res = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'sg2010' 
            ORDER BY column_name
        `);
        console.log(res.rows.map(c => c.column_name));

        console.log('🔍 Sample Data SG2010...');
        const sample = await db.query(`
            SELECT * FROM public.sg2010 LIMIT 5
        `);
        console.log(sample.rows);

    } catch (err) {
        console.error(err);
    }
}

debug();
