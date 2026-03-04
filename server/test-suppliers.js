const { Pool } = require('pg');

(async () => {
    const pool = new Pool({
        host: 'mfprotheus.postgres.uhserver.com',
        port: 5432,
        user: 'metalfisa',
        password: 'aLb14jAzyGpuSwf',
        database: 'protheus_production'
    });

    try {
        console.log('Testing SA2010 (Suppliers):');
        const result1 = await pool.query(`
            SELECT a2_cod, a2_loja, a2_nome, a2_nreduz 
            FROM public.sa2010 
            WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ') 
              AND a2_tipo = 'J' 
              AND a2_nome ILIKE '%ALFA%' 
            LIMIT 5
        `);
        console.log('SA2010 Results:', JSON.stringify(result1.rows, null, 2));

        console.log('\nTesting SA1010 (Clients):');
        const result2 = await pool.query(`
            SELECT a1_cod, a1_loja, a1_nome, a1_nreduz 
            FROM public.sa1010 
            WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ') 
              AND a1_nome ILIKE '%ALFA%' 
            LIMIT 5
        `);
        console.log('SA1010 Results:', JSON.stringify(result2.rows, null, 2));

    } catch (err) {
        console.error('Error:', err.message);
    }

    await pool.end();
})();
