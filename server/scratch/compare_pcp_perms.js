const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysqlPool = require('../services/mysqlService');

async function main() {
    try {
        const [users] = await mysqlPool.query(
            "SELECT idUsuario, NomeCompleto FROM usuario WHERE idUsuario IN (221, 222)"
        );
        for (const u of users) {
            const [perms] = await mysqlPool.query(
                'SELECT page_id, can_view, can_create, can_edit, can_delete FROM app_user_permissions WHERE user_id = ? ORDER BY page_id',
                [u.idUsuario]
            );
            console.log(`\n${u.NomeCompleto} (id=${u.idUsuario}) - ${perms.length} paginas:`);
            perms.forEach(p => {
                const a = [];
                if (p.can_view) a.push('V');
                if (p.can_create) a.push('C');
                if (p.can_edit) a.push('E');
                if (p.can_delete) a.push('D');
                console.log(`  ${p.page_id.padEnd(30)} [${a.join('')}]`);
            });
        }
    } catch (err) {
        console.error('Erro:', err);
    } finally {
        process.exit(0);
    }
}
main();
