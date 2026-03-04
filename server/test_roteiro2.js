const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
});

pool.query(`
    SELECT DISTINCT g2_produto 
    FROM sg2010 
    WHERE d_e_l_e_t_ IN ('', ' ')
    LIMIT 5
`).then(result => {
    console.log('\n✅ Produtos com roteiro cadastrado:');
    result.rows.forEach(x => console.log(`  - ${x.g2_produto.trim()}`));

    if (result.rows.length > 0) {
        const prod = result.rows[0].g2_produto.trim();
        console.log(`\n🔍 Detalhes do roteiro para: ${prod}\n`);

        return pool.query(`
            SELECT g2_operac, g2_descri, g2_recurso, g2_setup, g2_tempad
            FROM sg2010
            WHERE g2_produto = $1 AND d_e_l_e_t_ IN ('', ' ')
            ORDER BY g2_operac
        `, [prod]);
    }
}).then(result => {
    if (result) {
        result.rows.forEach(r => {
            console.log(`  Op: ${r.g2_operac} - ${r.g2_descri.trim()}`);
            console.log(`      Recurso: ${r.g2_recurso.trim()} | Setup: ${r.g2_setup}min | Tempo: ${r.g2_tempad}min\n`);
        });
    }
    process.exit(0);
}).catch(err => {
    console.error('❌', err.message);
    process.exit(1);
});
