const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
});

// Testar roteiro para produto SEG-0632
const produto = 'SEG-0632';

console.log(`\n🔍 Verificando estrutura da tabela SG2010\n`);

pool.query(`
    SELECT column_name
    FROM information_schema.columns 
    WHERE table_name = 'sg2010' 
    AND column_name LIKE 'g2_%'
    ORDER BY ordinal_position
`).then(result => {
    console.log('📋 Colunas disponíveis:');
    result.rows.forEach(col => console.log(`  ${col.column_name}`));

    console.log(`\n🔍 Testando roteiro para produto: ${produto}\n`);

    return pool.query(`
        SELECT *
        FROM sg2010 
        WHERE g2_produto = $1
        AND (d_e_l_e_t_ = '' OR d_e_l_e_t_ = ' ')
        ORDER BY g2_operac
        LIMIT 5
    `, [produto]);
}).then(result => {
    if (result.rows.length === 0) {
        console.log('❌ Nenhum roteiro encontrado para este produto');
        console.log('\n🔍 Verificando estrutura de tabela SG2...');
        return pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'sg2010' 
            ORDER BY ordinal_position 
            LIMIT 20
        `);
    } else {
        console.log(`✅ ${result.rows.length} operações encontradas:\n`);
        result.rows.forEach(row => {
            console.log(`  Operação: ${row.operacao} - ${row.descricao_operacao}`);
            console.log(`    Recurso: ${row.recurso} | Tempo: ${row.tempo_padrao}\n`);
        });
    }
}).then(result => {
    if (result) {
        console.log('\n📋 Colunas da tabela SG2010:');
        result.rows.forEach(col => {
            console.log(`  ${col.column_name} (${col.data_type})`);
        });
    }
    process.exit(0);
}).catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
});
