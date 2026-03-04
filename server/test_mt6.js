const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
});

const produto = 'MT6-3803';

console.log(`\n🔍 Verificando roteiro para: ${produto}\n`);

pool.query(`
    SELECT g2_operac, g2_descri, g2_recurso, g2_setup, g2_tempad
    FROM sg2010
    WHERE TRIM(g2_produto) = $1
    AND (d_e_l_e_t_ = '' OR d_e_l_e_t_ = ' ')
    ORDER BY g2_operac
`, [produto]).then(result => {
    if (result.rows.length === 0) {
        console.log('❌ Produto não tem roteiro cadastrado');
        console.log('\n🔍 Buscando produtos similares com roteiro...');

        return pool.query(`
            SELECT DISTINCT TRIM(g2_produto) as produto
            FROM sg2010
            WHERE TRIM(g2_produto) LIKE 'MT6%'
            AND (d_e_l_e_t_ = '' OR d_e_l_e_t_ = ' ')
            LIMIT 10
        `);
    } else {
        console.log(`✅ ${result.rows.length} operações encontradas:\n`);
        result.rows.forEach(r => {
            console.log(`  ${r.g2_operac} - ${r.g2_descri.trim()}`);
            console.log(`      Recurso: ${r.g2_recurso.trim()} | Setup: ${r.g2_setup} | Tempo: ${r.g2_tempad}\n`);
        });
    }
}).then(result => {
    if (result) {
        console.log('\n📋 Produtos MT6 com roteiro:');
        result.rows.forEach(r => console.log(`  - ${r.produto}`));
    }
    process.exit(0);
}).catch(err => {
    console.error('❌', err.message);
    process.exit(1);
});
