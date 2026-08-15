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
        const [rows] = await conn.execute("SELECT Login, Senha, NomeCompleto FROM usuario LIMIT 10");
        rows.forEach(r => {
            console.log(`Login: ${r.Login} | Name: ${r.NomeCompleto} | Senha: ${r.Senha}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        await conn.end();
    }
}
main();
