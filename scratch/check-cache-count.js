const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const mysqlPool = require('../server/services/mysqlService');

async function checkRows() {
    try {
        const [rows] = await mysqlPool.query('SELECT COUNT(*) AS count FROM app_recursos_ocupacao_diaria');
        console.log('Current rows in app_recursos_ocupacao_diaria:', rows[0].count);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
checkRows();
