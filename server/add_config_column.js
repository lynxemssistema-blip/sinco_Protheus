require('dotenv').config();
const pool = require('./services/mysqlService');

async function addColumn() {
    try {
        await pool.query("ALTER TABLE app_company_settings ADD COLUMN general_config TEXT DEFAULT NULL;");
        console.log("Column added successfully!");
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log("Column already exists.");
        } else {
            console.error(e);
        }
    }
    process.exit(0);
}

addColumn();
