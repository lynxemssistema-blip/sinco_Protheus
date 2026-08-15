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
        const [rows] = await conn.execute("SELECT item, classificacao FROM app_pedido_itens_classificacao WHERE pedido = '004159'");
        console.log('Classifications for order 004159:', rows);
    } catch (e) {
        console.error(e);
    } finally {
        await conn.end();
    }
}
main();
