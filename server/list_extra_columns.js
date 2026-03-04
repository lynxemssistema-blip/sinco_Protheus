const db = require('./db');
require('dotenv').config();

async function listMoreColumns() {
    try {
        console.log('--- COLUMNS OF PUBLIC.SB1010 ---');
        const resSB1 = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sb1010' ORDER BY column_name");
        resSB1.rows.forEach(r => console.log(r.column_name));

        console.log('--- COLUMNS OF PUBLIC.SA7010 ---');
        const resSA7 = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sa7010' ORDER BY column_name");
        resSA7.rows.forEach(r => console.log(r.column_name));

    } catch (error) {
        console.error('Error:', error);
    }
}

listMoreColumns();
