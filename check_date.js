const db = require('./server/db');

async function checkDate() {
    try {
        const result = await db.query(`
            SELECT c6_num, c6_item, c6_entreg 
            FROM public.sc6010 
            WHERE c6_entreg = '00000000' OR c6_entreg = '        ' OR c6_entreg NOT SIMILAR TO '20[0-9]{6}' 
            LIMIT 5
        `);
        console.log("Found:", result.rows);
    } catch (e) {
        console.error("ERROR:", e.message);
    } finally {
        process.exit();
    }
}
checkDate();
