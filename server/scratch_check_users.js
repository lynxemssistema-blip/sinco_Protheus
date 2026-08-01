require('dotenv').config();
const mysql = require('mysql2/promise');

async function test() {
    const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });

    const [rows] = await conn.execute(`SELECT Login, NomeCompleto FROM usuario WHERE NomeCompleto LIKE '%Edson Manoel%' OR Login LIKE '%Edson%'`);
    console.log(rows);
    
    // Test the specific join logic
    const [joinRows] = await conn.execute(`
        SELECT u.Login, u.NomeCompleto 
        FROM usuario u 
        WHERE u.NomeCompleto = 'Edson Manoel' OR u.Login = 'Edson Manoel'
    `);
    console.log("Matches for 'Edson Manoel':", joinRows);

    conn.end();
}
test();
