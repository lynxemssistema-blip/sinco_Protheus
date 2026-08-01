require('dotenv').config();
const mysql = require('mysql2/promise');
(async () => {
    try {
        const pool = mysql.createPool({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASS,
            database: process.env.MYSQL_DB
        });
        
        console.log('Testing audit log insert...');
        const id = 34;
        const tipo = 'AP';
        const aprovadoVal = 1;
        const loggedUserId = 1;

        await pool.query(
            'INSERT INTO app_audit_logs (user_id, action, details) VALUES (?, ?, ?)',
            [loggedUserId, 'UPDATE_USER_DATA', JSON.stringify({ targetUserId: id, newRole: tipo, approved: aprovadoVal })]
        );
        console.log('Audit log success');
        pool.end();
    } catch(e) { console.error('ERROR CATCHED:', e.message); pool.end(); }
})();
