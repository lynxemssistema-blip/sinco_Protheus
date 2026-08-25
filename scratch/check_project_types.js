const mysql = require('../server/node_modules/mysql2/promise');
require('dotenv').config({ path: '../server/.env' });

async function run() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASS,
            database: process.env.MYSQL_DB,
        });

        console.log('Connected to MySQL.');

        // Get counts by project type
        const [counts] = await connection.query('SELECT project_type, COUNT(*) as qty FROM app_sales_order_item_notes GROUP BY project_type');
        console.log('\nCounts by Project Type:');
        console.log(counts);

        // Let's print a few rows where project_type is not null or empty
        const [rows] = await connection.query('SELECT pedido, item, project_type FROM app_sales_order_item_notes WHERE project_type IS NOT NULL AND project_type != "" LIMIT 10');
        console.log('\nSome rows with project_type:');
        console.log(rows);

        await connection.end();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
