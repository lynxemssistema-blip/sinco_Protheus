const pgDb = require('../server/db');

async function main() {
    try {
        console.log('Testing PG connection...');
        const res = await pgDb.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE LOWER(table_name) = 'sc9010' 
              AND table_schema = 'public'
        `);
        console.log('Columns in sc9010:');
        console.log(res.rows);
        process.exit(0);
    } catch (err) {
        console.error('PG Error:', err);
        process.exit(1);
    }
}

main();
