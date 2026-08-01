const db = require('./db');

async function run() {
    try {
        const res = await db.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND (table_name ILIKE 'SE1%' OR table_name ILIKE 'SE2%' OR table_name ILIKE 'SE5%')
            ORDER BY table_name
        `);
        
        console.log('Tabelas encontradas:', res.rows);
    } catch (e) {
        console.error('Erro:', e.message);
    }
    process.exit(0);
}

run();
