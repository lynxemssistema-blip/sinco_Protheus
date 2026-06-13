const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const mysqlPool = require('../server/services/mysqlService');

async function checkMaxAllowedPacket() {
    try {
        const [rows] = await mysqlPool.query("SHOW VARIABLES LIKE 'max_allowed_packet'");
        console.log('max_allowed_packet:', rows[0]);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
checkMaxAllowedPacket();
