require('dotenv').config();
const pool = require('./services/mysqlService');

async function enableSetting() {
    try {
        const config = JSON.stringify({ show_purchase_values: true });
        await pool.execute("UPDATE app_company_settings SET general_config=? WHERE id=1", [config]);
        console.log("Updated general_config to:", config);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

enableSetting();
