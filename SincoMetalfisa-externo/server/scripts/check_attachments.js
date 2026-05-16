const mysql = require('mysql2/promise');
require('dotenv').config({path: './server/.env'});

async function run() {
    const db = await mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });

    const [rows] = await db.query('SELECT id, asset_id, file_type, mime_type, original_name, is_main FROM sgq_asset_attachments');
    console.log(rows);
    process.exit(0);
}

run().catch(console.error);
