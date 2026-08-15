require('dotenv').config({ path: 'c:/Users/lynx/Documents/MetalFisa Anty/server/.env' });
const mysql = require('mysql2/promise');

async function main() {
    const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });

    try {
        const [rows] = await conn.execute("SELECT op_numero, prioridade FROM app_op_priorities WHERE op_numero LIKE '004159%'");
        console.log('Priorities for order 004159 items:', rows);
    } catch (e) {
        console.error(e);
    } finally {
        await conn.end();
    }
}
main();
