const db = require('./db');

(async () => {
    try {
        console.log('--- Inspecting SC6 Columns for Customer Order ---');

        // Query to get column names of SC6010
        const res = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'sc6010' 
            AND (column_name LIKE '%cli%' OR column_name LIKE '%ped%')
            ORDER BY column_name
        `);

        console.table(res.rows);

        // Also let's inspect the content of 003121 items to see if we spot the data
        console.log('\n--- Content Sample (Order 003121) ---');
        const content = await db.query(`
            SELECT c6_num, c6_item, c6_produto, c6_pedcli, c6_cli, c6_numcli 
            FROM public.sc6010 
            WHERE c6_num = '003121'
        `);
        // I am guessing names c6_pedcli, c6_cli, c6_numcli to see if they exist/carry data. 
        // If the SQL errors, the first part (schema search) will still have run (hopefully).
        // Actually, safer to just run the schema search first. 

    } catch (err) {
        console.error(err.message);
    } finally {
        process.exit();
    }
})();
