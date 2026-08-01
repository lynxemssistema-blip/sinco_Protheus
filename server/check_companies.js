const db = require('./db');

async function run() {
    try {
        console.log('Testando conexão e buscando tabelas SM0...');
        const res = await db.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name ILIKE '%SM0%'
        `);
        
        console.log('Tabelas encontradas:');
        console.log(res.rows);

        if (res.rows.length > 0) {
            const tableName = res.rows[0].table_name;
            const data = await db.query(`SELECT * FROM ${tableName}`);
            console.log(`\nDados da tabela ${tableName}:`);
            console.log(data.rows);
        }
    } catch (e) {
        console.error('Erro:', e.message);
    }
    process.exit(0);
}

run();
