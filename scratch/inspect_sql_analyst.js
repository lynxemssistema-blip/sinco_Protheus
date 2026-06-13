require('dotenv').config({ path: 'server/.env' });
const mysqlPool = require('../server/services/mysqlService');

async function main() {
    try {
        const [rows] = await mysqlPool.query("SELECT id, nome, papel, system_prompt, contexto_negocio FROM pcpmetal_agentes WHERE papel = 'analista_sql'");
        console.log('SQL ANALYST PROMPT:');
        console.log(rows[0].system_prompt);
        console.log('\nCONTEXTO NEGOCIO:');
        console.log(rows[0].contexto_negocio);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

main();
