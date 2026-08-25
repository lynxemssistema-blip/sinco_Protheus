const pool = require('../server/services/mysqlService');

async function checkDb() {
    try {
        const [rows] = await pool.query("SELECT pedido, item, updated_at, updated_by, pcp_notes, designer_notes FROM app_sales_order_item_notes WHERE pedido = '004945'");
        console.log('Notes for 004945:', rows);
        
        process.exit(0);
    } catch(e) {
        console.error('Error connecting to MySQL', e);
        process.exit(1);
    }
}
checkDb();
