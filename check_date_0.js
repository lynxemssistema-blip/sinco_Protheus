const db = require('./server/db');

async function checkDate0() {
    try {
        const result = await db.query(`
            SELECT c6_num, c6_item, c6_entreg 
            FROM public.sc6010 
            WHERE c6_entreg = '00000000'
            LIMIT 5
        `);
        console.log("Found 00000000:", result.rows);
    } catch (e) {
        console.error("ERROR:", e.message);
    } finally {
        process.exit();
    }
}
checkDate0();
