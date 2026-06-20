const db = require('./db');
const mysql = require('./services/mysqlService');

(async () => {
    try {
        console.log("=== PROTHEUS OPs ===");
        const res = await db.query(`
            SELECT c2.c2_num, c2.c2_item, c2.c2_sequen, c2.c2_pedido, c2.c2_itempv, TRIM(c2.c2_produto) as prod 
            FROM public.sc2010 c2 
            WHERE c2.c2_pedido = '004155' 
            LIMIT 5
        `);
        console.table(res.rows);

        console.log("=== APPOINTMENTS ===");
        const [rows] = await mysql.query(`
            SELECT op_numero, SUM(quantidade) as total
            FROM app_production_appointments
            WHERE op_numero LIKE '004155%'
            GROUP BY op_numero
        `);
        console.table(rows);

        process.exit(0);
    } catch(e) { console.error(e); process.exit(1); }
})();
