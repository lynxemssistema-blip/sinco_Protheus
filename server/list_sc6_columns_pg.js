const db = require('./db');
require('dotenv').config();

async function listColumns() {
    try {
        console.log('--- COLUMNS OF PUBLIC.SC6010 (Postgres) ---');
        const res = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sc6010' ORDER BY column_name");

        res.rows.forEach(row => {
            console.log(row.column_name);
        });

    } catch (error) {
        console.error('Error:', error);
    }
}

listColumns();
