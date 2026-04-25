require('dotenv').config();
const mysql = require('./server/services/mysqlService');

async function run() {
    try {
        await mysql.query(`
            CREATE TABLE IF NOT EXISTS app_settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value VARCHAR(255) NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ app_settings created');

        await mysql.query(`
            CREATE TABLE IF NOT EXISTS app_pedidos_inativos (
                pedido_numero VARCHAR(20) PRIMARY KEY,
                data_desativacao DATETIME DEFAULT CURRENT_TIMESTAMP,
                usuario VARCHAR(100)
            );
        `);
        console.log('✅ app_pedidos_inativos created');
        
        // Insert default setting
        await mysql.query(`
            INSERT IGNORE INTO app_settings (setting_key, setting_value) 
            VALUES ('hide_inactive_orders', 'true');
        `);
        console.log('✅ default setting inserted');
        
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
    process.exit(0);
}

run();
