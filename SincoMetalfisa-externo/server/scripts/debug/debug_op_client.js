const db = require('./db');

async function debug() {
    try {
        console.log('🔍 Checking columns in SC2010...');
        const res = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'sc2010' 
            AND column_name ILIKE '%nome%'
        `);
        console.log(res.rows);
    } catch (err) {
        console.error(err);
    }
}

debug();
