require('dotenv').config({path:'server/.env'});
const pool = require('./server/services/mysqlService.js');

async function createTable() {
    try {
        const query = `
            CREATE TABLE IF NOT EXISTS app_pedido_itens_tags (
                pedido VARCHAR(20) NOT NULL,
                item VARCHAR(10) NOT NULL,
                tag_especial VARCHAR(50) DEFAULT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (pedido, item)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `;
        await pool.query(query);
        console.log("Table 'app_pedido_itens_tags' created successfully.");
    } catch (e) {
        console.error("Error creating table:", e);
    } finally {
        process.exit(0);
    }
}
createTable();
