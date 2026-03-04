const db = require('./db');

(async () => {
    try {
        console.log('--- Safer Check for value 990472344 ---');

        // 1. Check SC6 specifically for C6_PEDCLI
        try {
            const resC6 = await db.query(`
                SELECT c6_num, c6_item, c6_pedcli
                FROM public.sc6010 
                WHERE c6_num = '003121' AND c6_item = '01'
            `);
            if (resC6.rows.length > 0) {
                console.log('Row SC6 [003121][01]:');
                console.log(`   C6_PEDCLI: '${resC6.rows[0].c6_pedcli}'`);
                if (resC6.rows[0].c6_pedcli && resC6.rows[0].c6_pedcli.includes('990472344')) {
                    console.log('   ✅ MATCH FOUND IN C6_PEDCLI!');
                } else {
                    console.log('   ❌ NO MATCH in C6_PEDCLI.');
                }
            }
        } catch (e) {
            console.log('Error checking SC6.C6_PEDCLI:', e.message);
        }

        // 2. Check SC5 (Header) just in case
        try {
            // Let's guess some columns or just check C5_PEDCLI if exists
            const resCol = await db.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'sc5010' 
                AND (column_name LIKE '%cli%' OR column_name LIKE '%ped%')
            `);
            const potentialCols = resCol.rows.map(r => r.column_name);
            console.log('SC5 Potential Columns:', potentialCols);

            if (potentialCols.includes('c5_pedcli') || potentialCols.includes('c5_mennota')) { // Mennota sometimes holds stuff
                const colsToSelect = potentialCols.filter(c => c !== 'd_e_l_e_t_').join(', ');
                // Be careful with selecting too many if encoding is bad, but let's try
                // For safety just check C5_MENNOTA or C5_PEDCLI

                const query = `SELECT c5_num, ${potentialCols.includes('c5_pedcli') ? 'c5_pedcli,' : ''} c5_cliente FROM public.sc5010 WHERE c5_num = '003121'`;
                const resC5 = await db.query(query);

                if (resC5.rows.length > 0) {
                    const row = resC5.rows[0];
                    console.log(`SC5 Header for 003121:`, row);
                    // If we found it here, the user request "Ped Cliente for each item" might imply it's copied from header OR it really is on item.
                }
            }

        } catch (e) {
            console.log('Error checking SC5:', e.message);
        }

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
})();
