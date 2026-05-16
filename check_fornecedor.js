const db = require('./server/services/mysqlService');

async function run() {
    try {
        const [rows] = await db.query("SHOW TABLES LIKE '%fornecedor%'");
        console.log(rows);
    } catch(e) {
        console.log('Error:', e.message);
    }
    process.exit();
}

run();
