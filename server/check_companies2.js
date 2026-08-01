const db = require('./db');

async function run() {
    try {
        console.log('Buscando tabelas...');
        const res = await db.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND (table_name ILIKE '%emp%' OR table_name ILIKE '%filial%' OR table_name ILIKE '%sm0%')
        `);
        
        console.log('Tabelas encontradas:');
        console.log(res.rows);
    } catch (e) {
        console.error('Erro:', e.message);
    }
    process.exit(0);
}

run();
