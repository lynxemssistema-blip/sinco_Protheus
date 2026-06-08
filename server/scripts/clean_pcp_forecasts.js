const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../services/mysqlService');

(async () => {
    try {
        console.log('Starting PCP Forecast cleanup...');

        const [rows] = await db.query(`
            SELECT pedido, item, count(*) as count
            FROM app_pcp_delivery_forecasts
            GROUP BY pedido, item
            HAVING count > 1
        `);

        if (rows.length === 0) {
            console.log('No duplicates found.');
            process.exit(0);
        }

        console.log(`Found ${rows.length} items with duplicates.`);

        for (const r of rows) {
            const { pedido, item } = r;

            // Get all records for this item
            const [records] = await db.query(
                `SELECT * FROM app_pcp_delivery_forecasts WHERE pedido = ? AND item = ? ORDER BY id DESC`,
                [pedido, item]
            );

            // Find the best record to keep:
            // Prefer the one with WabTec date (if any), or just the highest ID
            let keepId = records[0].id; // default: latest
            
            for (const rec of records) {
                if (rec.data_entrega_pcp) {
                    keepId = rec.id;
                    break;
                }
            }

            // Delete the rest
            const deleteIds = records.filter(x => x.id !== keepId).map(x => x.id);

            if (deleteIds.length > 0) {
                await db.query(`DELETE FROM app_pcp_delivery_forecasts WHERE id IN (?)`, [deleteIds]);
                console.log(`Cleaned up Pedido ${pedido} Item ${item}: Kept ID ${keepId}, Deleted ${deleteIds.join(',')}`);
            }
        }

        console.log('Cleanup finished.');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
})();
