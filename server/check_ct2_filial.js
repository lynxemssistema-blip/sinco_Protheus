const db = require('./db');
async function run() {
    try {
        const res = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'ct2010'
            AND column_name ILIKE '%filial%'
        `);
        console.log('Colunas de filial na CT2010:', res.rows);
    } catch (e) {
        console.error('Erro:', e.message);
    }
    process.exit(0);
}
run();
