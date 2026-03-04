
const db = require('./db');
require('dotenv').config();

async function inspectRow() {
    console.log('Inspecting SB1010 row...');
    try {
        const res = await db.query(`
            SELECT * FROM public.sb1010 LIMIT 1
        `);
        console.log('Row Keys:', Object.keys(res.rows[0]));
        console.log('Row Data:', res.rows[0]);
    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        process.exit();
    }
}

inspectRow();
