const pool = require('./services/mysqlService');

async function checkSchema() {
    try {
        const [rows] = await pool.query('DESCRIBE app_company_settings');
        console.log(rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
