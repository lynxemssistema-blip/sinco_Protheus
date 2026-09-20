const mysql = require('mysql2/promise');

async function checkText() {
    const conn = await mysql.createConnection({
        host: '193.203.175.68',
        user: 'u494795077_Metalfisa',
        password: '10207597Rdv*',
        database: 'u494795077_Metalfisa'
    });

    const [cols] = await conn.query(`
        SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = 'u494795077_Metalfisa' 
          AND DATA_TYPE IN ('longtext', 'mediumtext', 'blob', 'mediumblob', 'longblob')
    `);
    console.log(`Encontradas ${cols.length} colunas longtext/blob:`);
    cols.forEach(c => console.log(` - ${c.TABLE_NAME}.${c.COLUMN_NAME} (${c.DATA_TYPE})`));

    await conn.end();
}

checkText().catch(console.error);
