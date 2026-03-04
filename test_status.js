const db = require('./server/db');
(async () => {
    try {
        const res = await db.query(`
            SELECT b1_cod, b1_msblql, b1_ativo 
            FROM public.sb1010 
            WHERE COALESCE(d_e_l_e_t_, '') <> '*'
            LIMIT 10
        `);
        console.log("Top 10 records:", res.rows);

        const res2 = await db.query(`
            SELECT b1_cod, b1_msblql, b1_ativo 
            FROM public.sb1010 
            WHERE TRIM(b1_cod) IN ('MT5-22053', 'MT5-22050', 'MT5-22051', 'MT5-22047')
            AND COALESCE(d_e_l_e_t_, '') <> '*'
        `);
        console.log("Specific items:", res2.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
})();
