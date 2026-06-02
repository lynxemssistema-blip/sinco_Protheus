const { getPostgresPool } = require('./db');

async function run() {
    const pool = getPostgresPool();
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND (table_name LIKE 's%' OR table_name LIKE 'c%')
        `);
        console.log("Tables:");
        console.log(res.rows.map(r => r.table_name).join(', '));
        
        // check columns of sc2010
        const cols = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'sc2010' 
              AND column_name LIKE '%dat%'
        `);
        console.log("\nSC2010 Date cols:");
        console.log(cols.rows.map(r => r.column_name).join(', '));

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        process.exit(0);
    }
}
run();
