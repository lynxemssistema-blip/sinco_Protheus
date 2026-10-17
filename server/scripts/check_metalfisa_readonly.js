const mysql = require('mysql2/promise');

async function testAccess() {
    const conn = await mysql.createConnection({
        host: '193.203.175.68',
        user: 'u494795077_sinco',
        password: 'Sinco2026!*',
        database: 'u494795077_SINCO'
    });

    try {
        const [dbs] = await conn.query("SHOW DATABASES;");
        console.log("Databases visible:", dbs.map(d => Object.values(d)[0]));
        
        try {
            const [tables] = await conn.query("SHOW TABLES FROM `u494795077_Metalfisa`;");
            console.log("Tables in u494795077_Metalfisa count:", tables.length);
        } catch (err) {
            console.log("Access to u494795077_Metalfisa with sinco user:", err.message);
        }
    } finally {
        await conn.end();
    }
}

testAccess().catch(console.error);
