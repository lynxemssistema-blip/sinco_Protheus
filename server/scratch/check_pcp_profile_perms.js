const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysqlPool = require('../services/mysqlService');

async function main() {
    try {
        // Check permissions stored on other PCP users (profile-wide)
        const [pcpUsers] = await mysqlPool.query(
            "SELECT idUsuario, NomeCompleto, Login, aprovado FROM usuario WHERE TipoUsuario = 'PCP'"
        );
        console.log('Usuarios com TipoUsuario=PCP:', pcpUsers.map(u => `${u.NomeCompleto} (id=${u.idUsuario}, aprovado=${u.aprovado})`));

        const ids = pcpUsers.map(u => u.idUsuario);
        if (ids.length) {
            const [perms] = await mysqlPool.query(
                `SELECT user_id, page_id, can_view, can_create, can_edit, can_delete FROM app_user_permissions WHERE user_id IN (${ids.map(() => '?').join(',')})`,
                ids
            );
            console.log('\nPermissoes explicitas encontradas para usuarios PCP:', perms.length);
            perms.forEach(p => console.log(' ', p));
        }
    } catch (err) {
        console.error('Erro:', err);
    } finally {
        process.exit(0);
    }
}
main();
