const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

async function run() {
    try {
        const pool = mysql.createPool({
            host: process.env.MYSQL_HOST || 'localhost',
            user: process.env.MYSQL_USER || 'root',
            password: process.env.MYSQL_PASSWORD || '',
            database: process.env.MYSQL_DATABASE || 'app_production_planning'
        });

        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_webtech_imports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                file_name VARCHAR(255) NOT NULL,
                sheet_name VARCHAR(255) NOT NULL,
                imported_by VARCHAR(100),
                total_rows INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_webtech_imported_rows (
                id INT AUTO_INCREMENT PRIMARY KEY,
                import_id INT NOT NULL,
                po_number VARCHAR(100),
                pedido_metal VARCHAR(50),
                cod_produto VARCHAR(100),
                saldo DECIMAL(10,2),
                item_cliente VARCHAR(100),
                data_pcp_cliente DATE,
                raw_data JSON,
                FOREIGN KEY (import_id) REFERENCES app_webtech_imports(id) ON DELETE CASCADE
            )
        `);

        console.log('Tables created successfully.');
        pool.end();
    } catch (e) {
        console.error(e);
    }
}
run();
