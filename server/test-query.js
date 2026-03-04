const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

const query = `
    SELECT count(*) as total
    FROM public.sc5010 c5
    JOIN public.sc6010 c6 
        ON COALESCE(c6.d_e_l_e_t_, '') = ''
        AND TRIM(c6.c6_filial) = TRIM(c5.c5_filial)
        AND TRIM(c6.c6_num) = TRIM(c5.c5_num)
    LEFT JOIN public.sa1010 sa1
        ON COALESCE(sa1.d_e_l_e_t_, '') = ''
        AND TRIM(sa1.a1_cod) = TRIM(c5.c5_cliente)
    WHERE COALESCE(c5.d_e_l_e_t_, '') = '' AND c5.c5_tipo <> 'B' AND COALESCE(c6.d_e_l_e_t_, '') = ''
`;

pool.query(query)
    .then(res => {
        console.log('✅ Count query success!');
        console.log('Total:', res.rows[0].total);
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Query error:', err.message);
        console.error('Position:', err.position);
        process.exit(1);
    });
