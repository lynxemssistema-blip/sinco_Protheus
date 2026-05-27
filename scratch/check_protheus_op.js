const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../server/.env') });
const pg = require('../server/db');

async function check() {
    try {
        const result = await pg.query(`
            SELECT *
            FROM public.sc2010
            WHERE c2_num LIKE '%005879%'
            LIMIT 5
        `);
        console.log('sc2010 records for 005879:', JSON.stringify(result.rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
