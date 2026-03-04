
const mysqlPool = require('./server/services/mysqlService');

async function checkSchema() {
    try {
        const [rows] = await mysqlPool.query('DESCRIBE usuario');
        console.log('User Table Schema:', rows);
    } catch (err) {
        console.error('Error:', err);
    }
    process.exit();
}

checkSchema();
