
const { Client } = require('pg');
require('dotenv').config({ path: '../.env' }); // Adjust path if needed

const client = new Client({
    host: process.env.PG_HOST,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    port: process.env.PG_PORT,
});

async function checkIndexes() {
    try {
        await client.connect();
        const tables = ['sb1010', 'sb2010', 'sb1990', 'sb2990'];

        for (const table of tables) {
            console.log(`\n--- Indexes for ${table} ---`);
            const res = await client.query(`
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
    } finally {
        await client.end();
    }
}

checkIndexes();
