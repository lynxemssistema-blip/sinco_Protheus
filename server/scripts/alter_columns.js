const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
    const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });
    console.log('Modifying column sizes...');
    try {
        await conn.query("ALTER TABLE sc6010 MODIFY c6_item VARCHAR(6) NOT NULL DEFAULT ''");
        await conn.query("ALTER TABLE sc2010 MODIFY c2_item VARCHAR(6) NOT NULL DEFAULT ''");
        await conn.query("ALTER TABLE sc2010 MODIFY c2_itempv VARCHAR(6) NOT NULL DEFAULT ''");
        console.log('SUCCESS: Column sizes widened to VARCHAR(6)!');
    } catch (err) {
        console.error('Error modifying column sizes:', err.message);
    } finally {
        await conn.end();
    }
})();
