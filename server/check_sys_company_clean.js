const db = require('./db');

async function run() {
    try {
        console.log('Buscando empresas ativas...');
        const res = await db.query(`
            SELECT m0_codigo as empresa, m0_codfil as filial, m0_nomecom as razao_social, m0_filial as nome_fantasia 
            FROM sys_company 
            WHERE d_e_l_e_t_ = ' '
            ORDER BY m0_codigo, m0_codfil
        `);
        
        console.table(res.rows);
    } catch (e) {
        console.error('Erro:', e.message);
    }
    process.exit(0);
}

run();
