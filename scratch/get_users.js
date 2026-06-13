const mysqlPool = require('../server/services/mysqlService');

async function getUsers() {
    try {
        const [rows] = await mysqlPool.query('SELECT login, nome, ativo FROM usuario');
        console.log('Users in database:', rows);
    } catch (err) {
        console.error('Error fetching users:', err);
    }
    process.exit();
}

getUsers();
