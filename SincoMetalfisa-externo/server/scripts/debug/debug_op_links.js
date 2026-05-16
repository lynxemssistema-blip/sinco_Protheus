const db = require('./db');

async function debugLinks() {
    try {
        console.log("Checking columns for OP Number 004991...");
        const res = await db.query(`
            SELECT c2_num, c2_item, c2_sequen, c2_produto, c2_pedido, c2_itempv
            FROM public.sc2010 
            WHERE TRIM(c2_num) = '004991'
        `);
        console.log(`Total rows: ${res.rows.length}`);
        if (res.rows.length > 0) {
            console.log("Sample User (Parent - 001):", res.rows.find(r => r.c2_sequen === '001'));
            console.log("Sample Child (007):", res.rows.find(r => r.c2_sequen === '007'));
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

debugLinks();
