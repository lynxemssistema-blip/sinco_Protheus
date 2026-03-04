
const db = require('./db');

async function checkIndexes() {
    try {
        const tables = ['sb1010', 'sb2010', 'sb1990', 'sb2990'];

        for (const table of tables) {
            console.log(`\n--- Indexes for ${table} ---`);
            const res = await db.query(`
                SELECT indexname, indexdef 
                FROM pg_indexes 
                WHERE tablename = $1
            `, [table]);

            res.rows.forEach(row => {
                console.log(`${row.indexname}: ${row.indexdef}`);
            });
        }
    } catch (err) {
        console.error("Error:", err);
    } // db pool doesn't need explicit close here as it's a global pool in db.js, but script will hang.
    // actually db.js exports a query function using a pool. We can't easily close the pool.
    // We'll just exit the process.
    setTimeout(() => process.exit(0), 2000);
}

checkIndexes();
