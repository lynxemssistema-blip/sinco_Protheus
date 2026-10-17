const db = require('./db');

const tables = ['sc5010', 'sc6010', 'sc2010', 'sb1010', 'sg1010', 'sg2010'];

(async () => {
    try {
        for (const table of tables) {
            console.log(`\n--- Columns for ${table} ---`);
            const res = await db.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = $1 
                ORDER BY column_name;
            `, [table]);

            // Filter distinct names to keep output short (case sensitivity might duplicate in some DBs but Postgres info schema is standard)
            // Just printing names
            const columns = res.rows.map(r => r.column_name);
            console.log(columns.join(', '));
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
})();
