require('dotenv').config();
const pool = require('./services/mysqlService');

async function checkConfig() {
    try {
        const [rows] = await pool.query("SELECT general_config FROM app_company_settings WHERE id = 1");
        console.log("Current general_config:", rows[0].general_config);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

checkConfig();
