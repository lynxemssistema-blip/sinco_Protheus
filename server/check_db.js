require('dotenv').config();
const mysql = require('mysql2/promise');
async function test() {
    console.log("Iniciando...");
    const pool = mysql.createPool({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
    try {
        const [rows] = await pool.execute("DESCRIBE usuario;");
        console.log("Campos em usuario:");
        rows.forEach(r => console.log(r.Field, r.Type));
    } catch(e) { console.error(e); }
    process.exit();
}
test();
