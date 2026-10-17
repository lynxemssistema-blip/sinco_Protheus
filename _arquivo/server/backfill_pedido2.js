const mysqlPool = require('./services/mysqlService');
const db = require('./db');

async function run() {
    try {
        console.log('Fetching missing pedidos from app_planning_history...');
        
        const [rows] = await mysqlPool.query(`
            SELECT DISTINCT op_numero, op_item, op_sequencia 
            FROM app_planning_history 
            WHERE pedido_venda IS NULL OR pedido_venda = '' OR pedido_venda = '-'
        `);

        if (rows.length === 0) {
            console.log('No missing pedidos found.');
            process.exit();
        }

        console.log(`Found ${rows.length} unique OPs to update.`);

        let updated = 0;

        for (const row of rows) {
            const { op_numero, op_item, op_sequencia } = row;
            
            // Look for the current OP first, then look for the root OP (sequen = '001')
            const query = `
                SELECT 
                    COALESCE(NULLIF(TRIM(c2.c2_pedido),''), NULLIF(TRIM(root_op.c2_pedido),'')) AS pedido_resolved
                FROM public.sc2010 c2
                LEFT JOIN public.sc2010 root_op
                    ON  root_op.c2_filial = c2.c2_filial
                    AND root_op.c2_num    = c2.c2_num
                    AND root_op.c2_item   = c2.c2_item
                    AND root_op.c2_sequen = '001'
                    AND COALESCE(root_op.d_e_l_e_t_,'') IN ('', ' ')
                WHERE TRIM(c2.c2_num) = $1 
                  AND TRIM(c2.c2_item) = $2 
                  AND TRIM(c2.c2_sequen) = $3
                  AND COALESCE(c2.d_e_l_e_t_,'') IN ('', ' ')
                LIMIT 1
            `;
            
            const pgResult = await db.query(query, [op_numero.trim(), op_item.trim(), op_sequencia.trim()]);
            
            if (pgResult.rows.length > 0) {
                let pedido = pgResult.rows[0].pedido_resolved;
                if (pedido) {
                    await mysqlPool.query(`
                        UPDATE app_planning_history 
                        SET pedido_venda = ? 
                        WHERE op_numero = ? AND op_item = ? AND op_sequencia = ?
                    `, [pedido, op_numero, op_item, op_sequencia]);
                    updated++;
                    console.log(`Updated OP ${op_numero} (Seq: ${op_sequencia}) with Pedido ${pedido}`);
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
