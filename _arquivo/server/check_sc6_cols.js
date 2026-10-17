const db = require('./db');

async function checkColumns() {
    try {
        const result = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'sc6010' 
            AND column_name LIKE 'c6_qtd%'
        `);
        console.log('SC6010 Quantity Fields:');
        console.table(result.rows);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

checkColumns();
