const db = require('./db');

async function run() {
    try {
        const res = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'se1010'
            AND column_name ILIKE '%filial%'
        `);
        console.log('Colunas de filial na SE1010:', res.rows);

        const data = await db.query(`
            SELECT DISTINCT e1_filial 
            FROM se1010
        `);
        console.log('Valores distintos em e1_filial:', data.rows);
    } catch (e) {
        console.error('Erro:', e.message);
    }
    process.exit(0);
}

run();
