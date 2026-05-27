const mysqlPool = require('./services/mysqlService');
const db = require('./db');

async function run() {
    try {
        console.log('Fetching missing pedidos from app_planning_history...');
        
        // 1. Get unique OPs that need backfill
        const [rows] = await mysqlPool.query(`
            SELECT DISTINCT op_numero, op_item, op_sequencia 
            FROM app_planning_history 
            WHERE pedido_venda IS NULL OR pedido_venda = ''
        `);

        if (rows.length === 0) {
            console.log('No missing pedidos found.');
            process.exit();
        }

        console.log(`Found ${rows.length} unique OPs to update.`);

        let updated = 0;

        // 2. Process each unique OP
        for (const row of rows) {
            const { op_numero, op_item, op_sequencia } = row;
            
            // Protheus stores C2_NUM as 6 chars, C2_ITEM as 2 chars, C2_SEQUEN as 3 chars.
            // Using TRIM to be safe.
            const query = `
                SELECT C2_PEDIDO 
                FROM SC2010 
                WHERE TRIM(C2_NUM) = $1 
                  AND TRIM(C2_ITEM) = $2 
                  AND TRIM(C2_SEQUEN) = $3
                  AND D_E_L_E_T_ = ''
                LIMIT 1
            `;
            
            const pgResult = await db.query(query, [op_numero.trim(), op_item.trim(), op_sequencia.trim()]);
            
            if (pgResult.rows.length > 0) {
                let pedido = pgResult.rows[0].c2_pedido || pgResult.rows[0].C2_PEDIDO;
                pedido = pedido ? pedido.trim() : null;
                
                if (pedido) {
                    await mysqlPool.query(`
                        UPDATE app_planning_history 
                        SET pedido_venda = ? 
                        WHERE op_numero = ? AND op_item = ? AND op_sequencia = ?
                    `, [pedido, op_numero, op_item, op_sequencia]);
                    updated++;
                    console.log(`Updated OP ${op_numero} with Pedido ${pedido}`);
                }
            }
        }
        
        console.log(`Backfill complete. Updated ${updated} OPs.`);
    } catch (err) {
        console.error('Error during backfill:', err);
    }
    process.exit();
}

run();
