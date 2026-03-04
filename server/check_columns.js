
const db = require('./db');
require('dotenv').config();

async function checkColumns() {
    console.log('Checking SB1010 columns...');
    try {
        const res = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'sb1010' 
            AND column_name ILIKE '%desenho%'
        `);
        console.log('Found Columns:', res.rows);

        // Also check for 'rev' just in case
        const resRev = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'sb1010' 
            AND column_name ILIKE '%rev%'
        `);
        console.log('Found Rev Columns:', resRev.rows);

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        // We don't want to hang
        process.exit();
    }
}

checkColumns();
