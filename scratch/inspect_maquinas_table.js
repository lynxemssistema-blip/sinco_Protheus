require('dotenv').config({ path: './server/.env' });
const mysqlPool = require('../server/services/mysqlService');

async function inspect() {
    try {
        const [rows] = await mysqlPool.query('SELECT id, nome, status, status_operacional, tag_identificacao FROM pcp_manutencao_maquinas');
        console.log('Maquinas cadastradas:', rows);
        process.exit(0);
    } catch (e) {
        console.error('Error inspecting:', e);
        process.exit(1);
    }
}

inspect();
