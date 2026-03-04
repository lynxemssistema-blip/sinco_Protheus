const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.PROTHEUS_DB_HOST,
    port: process.env.PROTHEUS_DB_PORT,
    user: process.env.PROTHEUS_DB_USER,
    password: process.env.PROTHEUS_DB_PASSWORD,
    database: process.env.PROTHEUS_DB_DATABASE,
});

// Test query for PC 003006
pool.query(`
    SELECT c7_num, c7_item, c7_produto, c7_numsc, c7_itemsc
    FROM sc7010 
    WHERE c7_num LIKE '%003006%' 
    AND (d_e_l_e_t_ = '' OR d_e_l_e_t_ = ' ')
    LIMIT 10
`).then(result => {
    console.log('🔍 Teste PC 003006:', result.rows.length, 'registros');
    console.log(result.rows);

    // Now test SC for those records
    if (result.rows.length > 0) {
        const scNum = result.rows[0].c7_numsc;
        return pool.query(`
            SELECT c1_num, c1_item, c1_produto, c1_descri
            FROM sc1010
            WHERE c1_num = $1
            AND (d_e_l_e_t_ = '' OR d_e_l_e_t_ = ' ')
        `, [scNum]);
    }
}).then(result => {
    if (result) {
        console.log('🔍 SC relacionada:', result.rows.length, 'registros');
        console.log(result.rows);
    }
    process.exit(0);
}).catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
});
