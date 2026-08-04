const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const mysqlPool = require('../server/services/mysqlService');

async function checkSgqPermissions() {
    try {
        console.log('--- Checking Permissions for SGQ Users ---');
        
        // 1. Get SGQ users first
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
        
        console.log(`Permissions records found: ${perms.length}\n`);
        
        // Group by user
        users.forEach(u => {
            const userPerms = perms.filter(p => p.user_id === u.idUsuario);
            console.log(`User: ${u.NomeCompleto} (Login: ${u.Login}, ID: ${u.idUsuario})`);
            if (userPerms.length > 0) {
                userPerms.forEach(p => {
                    const actions = [];
                    if (p.can_view) actions.push('VIEW');
                    if (p.can_create) actions.push('CREATE');
                    if (p.can_edit) actions.push('EDIT');
                    if (p.can_delete) actions.push('DELETE');
                    console.log(`  - Page: ${p.page_id.padEnd(25)} | Permissions: [${actions.join(', ')}]`);
                });
            } else {
                console.log('  - No specific permissions found in app_user_permissions.');
            }
            console.log('---------------------------------------------------------');
        });
        
    } catch (err) {
        console.error('Error checking permissions:', err);
    } finally {
        process.exit(0);
    }
}

checkSgqPermissions();
