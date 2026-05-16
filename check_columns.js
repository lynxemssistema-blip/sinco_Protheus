const db = require('./server/services/mysqlService');

async function run() {
    try {
        const [rows] = await db.query("DESCRIBE sgq_romaneios_items");
        console.log(rows);
    } catch(e) {
        console.log('Error:', e.message);
    }
    process.exit();
}

run();
