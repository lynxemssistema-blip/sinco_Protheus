const db = require('./db');

async function debug() {
    try {
        console.log('🔍 Inspecting SG2010 for MT3-14441...');
        const res = await db.query(`
            SELECT g2_codigo, g2_operac, g2_produto, g2_descri
            FROM public.sg2010 
            WHERE g2_produto LIKE '%MT3-14441%'
            ORDER BY g2_codigo
        `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    }
}

debug();
