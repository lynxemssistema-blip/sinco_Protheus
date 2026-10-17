require('dotenv').config();
const pool = require('./services/mysqlService');

async function checkSchema() {
    try {
        const [rows] = await pool.query("DESCRIBE app_company_settings");
        console.table(rows);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

checkSchema();
