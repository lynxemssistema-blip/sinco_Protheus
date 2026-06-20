require('dotenv').config({ path: '../server/.env' });
const db = require('../server/db');

async function run() {
    try {
        const res = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'sc2010' AND table_schema = 'public'
            ORDER BY column_name
        `);
        console.log('SC2010 columns:');
        res.rows.forEach(r => {
            if (r.column_name.includes('ori') || r.column_name.includes('pai') || r.column_name.includes('num') || r.column_name.includes('ped') || r.column_name.includes('seq') || r.column_name.includes('item')) {
                console.log(`  ${r.column_name}: ${r.data_type}`);
            }
        });
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
