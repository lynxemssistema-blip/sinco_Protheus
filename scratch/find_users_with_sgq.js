const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const mysqlPool = require('../server/services/mysqlService');

async function findUsersWithSgq() {
    try {
        console.log('--- Finding Users with SGQ Profile ---');
        
        const [rows] = await mysqlPool.query(
            "SELECT idUsuario, NomeCompleto, Login, TipoUsuario, Setor, Funcao, aprovado FROM usuario WHERE UPPER(TRIM(TipoUsuario)) = 'SGQ'"
        );
        
        console.log(`Users found: ${rows.length}`);
        if (rows.length > 0) {
            console.log(JSON.stringify(rows, null, 2));
        } else {
            console.log('No users found in database with TipoUsuario = SGQ');
        }
        
    } catch (err) {
        console.error('Error finding users:', err);
    } finally {
        process.exit(0);
    }
}

findUsersWithSgq();
