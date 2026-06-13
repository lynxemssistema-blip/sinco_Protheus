require('dotenv').config({ path: 'server/.env' });
const mysqlPool = require('../server/services/mysqlService');

async function main() {
    try {
        console.log('Using MYSQL_HOST:', process.env.MYSQL_HOST);
        const [rows] = await mysqlPool.query('SELECT id, nome, papel, system_prompt, contexto_negocio, modelo, ativo FROM pcpmetal_agentes');
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

main();
