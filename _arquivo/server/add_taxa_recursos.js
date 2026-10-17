require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });

    const columns = [
        { name: 'taxa_setup_min', ddl: 'ADD COLUMN taxa_setup_min DECIMAL(10,4) DEFAULT 1' },
        { name: 'taxa_padrao_min', ddl: 'ADD COLUMN taxa_padrao_min DECIMAL(10,4) DEFAULT 1' }
    ];

    for (const col of columns) {
        try {
            await pool.query(`ALTER TABLE app_recursos_capacidade ${col.ddl};`);
            console.log(`Column ${col.name} added successfully`);
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log(`Column ${col.name} already exists`);
            } else {
                console.error(e);
            }
        }
    }
    process.exit(0);
}
run();
