const mysql = require('./server/services/mysqlService');
async function run() {
    try {
        const [rows] = await mysql.query('DESCRIBE ordemservico');
        console.log(rows.map(r => r.Field).join(', '));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
