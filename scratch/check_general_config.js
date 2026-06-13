const pool = require('c:/Users/adm/Desktop/MetalFisa Anty/server/services/mysqlService');

async function check() {
    try {
        const [rows] = await pool.query('SELECT general_config FROM app_company_settings WHERE id = 1');
        console.log("=== DB Row Output ===");
        console.log(rows[0]);
        console.log("=== Decoded Config ===");
        const config = rows[0]?.general_config;
        console.log(typeof config);
        console.log(config);
        if (typeof config === 'string') {
            console.log(JSON.parse(config));
        }
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

check();
