const db = require('./db');

(async () => {
    try {
        console.log('--- Inspecting SC2 Columns for Customer Order ---');

        const res = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'sc2010' 
            AND (column_name LIKE '%cli%' OR column_name LIKE '%ped%')
            ORDER BY column_name
        `);

        console.table(res.rows);
    } catch (err) {
        console.error(err.message);
    } finally {
        process.exit();
    }
})();
