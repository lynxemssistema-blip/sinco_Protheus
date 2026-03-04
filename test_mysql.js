const pool = require('./server/services/mysqlService');

async function testConnection() {
    try {
        const [rows] = await pool.query('SHOW TABLES LIKE "app_pcp_delivery_forecasts"');
        if (rows.length > 0) {
            console.log('✅ Table app_pcp_delivery_forecasts exists.');
            const [columns] = await pool.query('DESCRIBE app_pcp_delivery_forecasts');
            console.log('Table structure:', columns);
        } else {
            console.log('❌ Table app_pcp_delivery_forecasts does NOT exist.');
        }
        process.exit(0);
    } catch (err) {
        console.error('❌ Database error:', err.message);
        process.exit(1);
    }
}

testConnection();
