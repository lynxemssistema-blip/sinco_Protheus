const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysqlPool = require('../services/mysqlService');

async function main() {
    try {
        const TARGET_ID = 224; // Pedro Henrique Bernardo
        const SOURCE_ID = 221; // Arthur Gabriel (perfil PCP de referencia)

        const [existing] = await mysqlPool.query(
            'SELECT COUNT(*) as cnt FROM app_user_permissions WHERE user_id = ?',
            [TARGET_ID]
        );
        if (existing[0].cnt > 0) {
            console.log(`Usuario ${TARGET_ID} ja possui ${existing[0].cnt} permissoes. Abortando para evitar duplicidade.`);
            process.exit(1);
        }

        const [sourcePerms] = await mysqlPool.query(
            'SELECT page_id, can_view, can_create, can_edit, can_delete FROM app_user_permissions WHERE user_id = ?',
            [SOURCE_ID]
        );

        if (sourcePerms.length === 0) {
            console.log('Usuario de referencia nao possui permissoes. Nada a copiar.');
            process.exit(1);
        }

        const values = sourcePerms.map(p => [TARGET_ID, p.page_id, p.can_view, p.can_create, p.can_edit, p.can_delete]);

        await mysqlPool.query(
            'INSERT INTO app_user_permissions (user_id, page_id, can_view, can_create, can_edit, can_delete) VALUES ?',
            [values]
        );

        console.log(`Copiadas ${values.length} permissoes de user_id=${SOURCE_ID} para user_id=${TARGET_ID}.`);

        const [check] = await mysqlPool.query('SELECT COUNT(*) as cnt FROM app_user_permissions WHERE user_id = ?', [TARGET_ID]);
        console.log(`Verificacao: user_id=${TARGET_ID} agora possui ${check[0].cnt} permissoes.`);
    } catch (err) {
        console.error('Erro:', err);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}
main();
