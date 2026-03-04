const db = require('./server/db');
(async () => {
    try {
        const res = await db.query(`
            SELECT b1_ativo, COUNT(*) 
            FROM public.sb1010 
            GROUP BY b1_ativo
        `);
        console.log("b1_ativo values:", res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
})();
