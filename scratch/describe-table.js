const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const mysqlPool = require('../server/services/mysqlService');

async function run() {
    try {
        const [rows] = await mysqlPool.query('DESCRIBE app_recursos_ocupacao_diaria');
        console.log(rows);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
run();
