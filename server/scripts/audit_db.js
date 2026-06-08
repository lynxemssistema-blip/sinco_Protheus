const mysql = require('mysql2/promise');

async function run() {
    const conn = await mysql.createConnection({
        host: 'metalfisa.mysql.uhserver.com',
        user: 'ronaldo2',
        password: 'jHAzhFG848@yN@U',
        database: 'metalfisa'
    });

    // All tables with row counts and sizes
    const [tables] = await conn.query(`
        SELECT 
            TABLE_NAME, TABLE_ROWS, 
            ROUND(DATA_LENGTH/1024/1024, 2) AS data_mb,
            ROUND(INDEX_LENGTH/1024/1024, 2) AS index_mb,
            ENGINE
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = 'metalfisa'
        ORDER BY DATA_LENGTH DESC
    `);

    console.log('=== TABLES ===');
    console.log(JSON.stringify(tables, null, 2));

    // All existing indexes
    const [indexes] = await conn.query(`
        SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, NON_UNIQUE, SEQ_IN_INDEX
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = 'metalfisa'
        ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
    `);

    console.log('=== EXISTING INDEXES ===');
    console.log(JSON.stringify(indexes, null, 2));

    // All columns per table (for index planning)
    const [columns] = await conn.query(`
        SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_KEY
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = 'metalfisa'
        ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);

    console.log('=== COLUMNS ===');
    console.log(JSON.stringify(columns, null, 2));

    await conn.end();
    console.log('=== DONE ===');
}

run().catch(console.error);
