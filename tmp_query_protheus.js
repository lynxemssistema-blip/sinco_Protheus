const { Client } = require('pg');

const pgProtheus = {
    host: '192.168.1.61', port: 5432,
    user: 'sinco2', password: 'sinco25', database: 'p12prd'
};

async function queryProtheus(sql, params) {
    const client = new Client(pgProtheus);
    await client.connect();
    try {
        const res = await client.query(sql, params);
        return res.rows;
    } finally {
        await client.end();
    }
}

async function run() {
    const codigo = 'MT4-31191';
    
    console.log('Querying SG1 (ARVORE)...', codigo);
    const sg1 = await queryProtheus(`
        SELECT TRIM(g1_comp) as comp, g1_quant as qt
        FROM public.sg1010
        WHERE TRIM(g1_cod) = $1 AND d_e_l_e_t_ = ' '
    `, [codigo]);
    console.log('SG1 Results:', sg1);

    console.log('Querying SG2 (OPERACOES)...', codigo);
    const sg2 = await queryProtheus(`
        SELECT TRIM(g2_operac) as op, TRIM(g2_descri) as desc
        FROM public.sg2010
        WHERE TRIM(g2_produto) = $1 AND d_e_l_e_t_ = ' '
    `, [codigo]);
    console.log('SG2 Results:', sg2);
    
    console.log('Querying SG1 with LIKE...');
    const sg1_like = await queryProtheus(`
        SELECT TRIM(g1_cod) as cod, TRIM(g1_comp) as comp
        FROM public.sg1010
        WHERE g1_cod LIKE '%MT4-31191%' AND d_e_l_e_t_ = ' '
    `, []);
    console.log('SG1 LIKE Results:', sg1_like);
}

run().catch(console.error);
