const { Pool } = require('pg');
require('dotenv').config();

const db = new Pool();

(async () => {
    try {
        console.log('Fetching sg2010 V2 sample...');
        const res = await db.query(`
      SELECT g2_operac, g2_recurso, g2_codigo, g2_descri
      FROM sg2010
      WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')
      AND g2_recurso IS NOT NULL
      AND trim(g2_recurso) <> ''
      LIMIT 20
    `);
        console.table(res.rows);

        console.log('\nUnique G2_RECURSO:');
        const dist = await db.query(`
      SELECT DISTINCT g2_recurso, count(*) 
      FROM sg2010 
      WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')
      GROUP BY g2_recurso
      ORDER BY g2_recurso
      LIMIT 20
    `);
        console.table(dist.rows);

    } catch (err) {
        console.error(err);
    } finally {
        db.end();
    }
})();
