const mysql = require('mysql2/promise');
(async () => {
    try {
        const pool = mysql.createPool({
            host: 'metalfisa.mysql.uhserver.com',
            user: 'ronaldo2',
            password: 'jHAzhFG848@yN@U',
            database: 'metalfisa'
        });
        const [rows] = await pool.query("SELECT * FROM usuario WHERE idUsuario = 34");
        console.log('User 34:', rows);
        pool.end();
    } catch(e) { console.error(e); }
})();
