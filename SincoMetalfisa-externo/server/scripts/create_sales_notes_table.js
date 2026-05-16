const pool = require('../services/mysqlService');

async function createSalesNotesTable() {
    try {
        console.log('Creating app_sales_notes table...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_sales_notes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_number VARCHAR(20) NOT NULL,
                item_number VARCHAR(10),
                product_code VARCHAR(30),
                note_text TEXT NOT NULL,
                category VARCHAR(50),
                created_by VARCHAR(100),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_resolved BOOLEAN DEFAULT FALSE,
                resolved_by VARCHAR(100),
                resolved_at DATETIME,
                INDEX idx_order (order_number)
            )
        `);

        console.log('✅ Table app_sales_notes created successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating table:', error);
        process.exit(1);
    }
}

createSalesNotesTable();
