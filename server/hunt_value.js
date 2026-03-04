const db = require('./db');

(async () => {
    try {
        console.log('--- Hunting for value 990472344 in Order 003121 Item 01 ---');

        // Fetch the specific row
        const res = await db.query(`
            SELECT *
            FROM public.sc6010 
            WHERE c6_num = '003121' AND c6_item = '01' AND d_e_l_e_t_ = ' '
        `);

        if (res.rows.length === 0) {
            console.log('❌ Row not found!');
            process.exit();
        }

        const row = res.rows[0];
        console.log('Row found. Checking columns...');

        let found = false;
        for (const [col, val] of Object.entries(row)) {
            const valStr = String(val).trim();
            if (valStr.includes('990472344')) {
                console.log(`✅ FOUND in column: [${col}] = '${valStr}'`);
                found = true;
            }
        }

        if (!found) {
            console.log('❌ Value 990472344 NOT found in any column of this row.');
            // Dump potential candidate columns just in case
            console.log('Potential candidate values:', {
                c6_pedcli: row.c6_pedcli,
                c6_numcli: row.c6_numcli, // may not exist
                c6_cli: row.c6_cli,
                c6_nota: row.c6_nota
            });
        }

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
})();
