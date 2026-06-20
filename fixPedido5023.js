require('dotenv').config({ path: './server/.env' });
const mysqlPool = require('./server/services/mysqlService');
const pgDb = require('./server/db');

async function fix() {
    try {
        const pedido = '005023';
        const pgClient = await pgDb.connect();
        const { rows } = await pgClient.query(
            "SELECT TRIM(c6_item) as item, (COALESCE(c6_qtdven::numeric, 0) - COALESCE(c6_qtdent::numeric, 0)) as saldo_fat FROM sc6010 WHERE c6_num = $1 AND COALESCE(d_e_l_e_t_, '') = ''",
            [pedido]
        );
        pgClient.release();

        console.log('PostgreSQL items for 5023:', rows);

        for (const row of rows) {
            const { item, saldo_fat } = row;
            const finalItem = String(item).padStart(2, '0');
            const [existing] = await mysqlPool.query('SELECT id FROM app_pcp_delivery_forecasts WHERE pedido = ? AND item = ?', [pedido, finalItem]);
            
            if (existing.length > 0) {
                console.log(`Updating item ${finalItem} with saldo ${saldo_fat} in ${existing.length} records...`);
                await mysqlPool.query(
                    'UPDATE app_pcp_delivery_forecasts SET quantidade_pcp = ? WHERE pedido = ? AND item = ?',
                    [saldo_fat, pedido, finalItem]
                );
            } else {
                console.log(`Item ${finalItem} not found in MySQL app_pcp_delivery_forecasts.`);
            }
        }
        console.log('Update complete!');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

fix();
