const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server/.env') });

const db = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

(async () => {
    try {
        console.log('Fetching sg2010 sample...');
        const res = await db.query(`
            SELECT g2_operac, g2_recurs, g2_descri, g2_codigo
            FROM sg2010 
            WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')
              AND g2_operac IS NOT NULL
              AND trim(g2_operac) <> ''
            LIMIT 20
        `);
        console.table(res.rows);

        console.log('\nChecking unique Resources (MO...):');
        const resDistinct = await db.query(`
            SELECT DISTINCT g2_recurs, count(*) 
            FROM sg2010 
            WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')
            GROUP BY g2_recurs
            ORDER BY g2_recurs
            LIMIT 20
        `);
        console.table(resDistinct.rows);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await db.end();
    }
})();
