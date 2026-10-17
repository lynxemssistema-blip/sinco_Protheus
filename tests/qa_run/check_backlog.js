const db = require('../../server/services/mysqlService');

async function check() {
    console.log('🔍 [1] Verificando tabelas órfãs VMI / Wabtec em u494795077_SINCO...');
    const [rows] = await db.query(`
        SELECT table_name, table_rows, ROUND((data_length + index_length) / 1024, 2) AS size_kb 
        FROM information_schema.tables 
        WHERE table_schema = 'u494795077_SINCO' 
          AND (table_name LIKE '%vmi%' OR table_name LIKE '%wabtec%')
        ORDER BY table_name
    `);
    console.log(`Tabelas encontradas (${rows.length}):`);
    console.table(rows);
    process.exit(0);
}

check().catch(err => {
    console.error('Erro na consulta:', err);
    process.exit(1);
});
