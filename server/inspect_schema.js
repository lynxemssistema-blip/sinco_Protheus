const { Pool } = require('pg');
require('dotenv').config();

const db = new Pool();

(async () => {
    try {
        const res = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sg2010'
      ORDER BY column_name
    `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        db.end();
    }
})();
