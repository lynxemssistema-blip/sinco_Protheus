const db = require('./db');

async function run() {
    try {
        console.log('Buscando dados da tabela sys_company...');
        const res = await db.query(`SELECT * FROM sys_company`);
        
        console.log('Empresas encontradas:');
        console.log(res.rows);
    } catch (e) {
        console.error('Erro:', e.message);
    }
    process.exit(0);
}

run();
