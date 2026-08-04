const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const mysqlPool = require('../server/services/mysqlService');

async function checkSgqPermissions() {
    try {
        console.log('--- Summary of Permissions for SGQ Users ---');
        
        // 1. Get SGQ users
        const [users] = await mysqlPool.query(
            "SELECT idUsuario, NomeCompleto, Login FROM usuario WHERE UPPER(TRIM(TipoUsuario)) = 'SGQ'"
        );
        
        if (users.length === 0) {
            console.log('No SGQ users found.');
            return;
        }

        const userIds = users.map(u => u.idUsuario);
        const placeholders = userIds.map(() => '?').join(',');
        
        // 2. Query permissions
        const [perms] = await mysqlPool.query(
            `SELECT p.user_id, p.page_id, p.can_view, p.can_create, p.can_edit, p.can_delete 
             FROM app_user_permissions p 
             WHERE p.user_id IN (${placeholders})`,
            userIds
        );
        
        users.forEach(u => {
            const userPerms = perms.filter(p => p.user_id === u.idUsuario);
            console.log(`\nUser: ${u.NomeCompleto} (Login: ${u.Login}, ID: ${u.idUsuario})`);
            
            if (userPerms.length === 0) {
                console.log('  - No explicit permissions defined.');
                return;
            }
            
            const writeAccess = [];
            const readOnlyAccess = [];
            
            userPerms.forEach(p => {
                const writeActions = [];
                if (p.can_create) writeActions.push('CREATE');
                if (p.can_edit) writeActions.push('EDIT');
                if (p.can_delete) writeActions.push('DELETE');
                
                if (writeActions.length > 0) {
                    writeAccess.push(`${p.page_id} [${writeActions.join(', ')}]`);
                } else if (p.can_view) {
                    readOnlyAccess.push(p.page_id);
                }
            });
            
            console.log(`  - Write/Manage Access (${writeAccess.length} pages):`);
            if (writeAccess.length > 0) {
                writeAccess.forEach(wa => console.log(`    * ${wa}`));
            } else {
                console.log('    (None)');
            }
            
            console.log(`  - Read-Only/View Access (${readOnlyAccess.length} pages):`);
            if (readOnlyAccess.length > 0) {
                console.log(`    * [${readOnlyAccess.join(', ')}]`);
            } else {
                console.log('    (None)');
            }
        });
        
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit(0);
    }
}

checkSgqPermissions();
