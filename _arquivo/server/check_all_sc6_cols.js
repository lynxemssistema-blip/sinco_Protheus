const db = require('./db');

async function checkAllColumns() {
    try {
        const result = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'sc6010'
            ORDER BY column_name
        `);
        console.log('All SC6010 Fields:');
        console.table(result.rows);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

checkAllColumns();
