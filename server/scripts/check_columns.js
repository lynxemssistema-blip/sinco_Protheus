const mysql = require('mysql2/promise');
(async () => {
    try {
        const pool = mysql.createPool({
            host: 'metalfisa.mysql.uhserver.com',
            user: 'ronaldo2',
            password: 'jHAzhFG848@yN@U',
            database: 'metalfisa'
        });
        const [rows] = await pool.query("SHOW COLUMNS FROM usuario");
        console.log('Columns:', rows);
        pool.end();
    } catch(e) { console.error(e); }
})();
