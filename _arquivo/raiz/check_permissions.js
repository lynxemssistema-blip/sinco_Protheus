require('dotenv').config({path:'server/.env'});
const pool = require('./server/services/mysqlService.js');

async function run() {
    try {
        const [users] = await pool.query(`SELECT idUsuario, NomeCompleto, email, TipoUsuario, status, aprovado FROM usuario WHERE NomeCompleto LIKE '%Bruno%' OR NomeCompleto LIKE '%Marques%'`);
        console.log("Users found:", users);

        for (const u of users) {
            const [perms] = await pool.query(`SELECT * FROM app_user_permissions WHERE user_id = ?`, [u.idUsuario]);
            console.log(`Permissions for ${u.NomeCompleto}:`, perms);
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
