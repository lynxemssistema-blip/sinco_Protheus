require('dotenv').config({ path: 'server/.env' });
const mysqlPool = require('../server/services/mysqlService');

async function listUsers() {
    try {
        const [rows] = await mysqlPool.query("SELECT Login, Senha, TipoUsuario, aprovado FROM usuario WHERE Login IN ('ROBSON', 'VALDIR', 'WALTER')");
        console.log('Users Passwords:', rows);
    } catch (err) {
        console.error('Error:', err);
    }
    process.exit();
}

listUsers();
