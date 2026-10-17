const mysql = require('../services/mysqlService');

async function main() {
    const [r1] = await mysql.query(`
        SELECT * FROM erp_roteiros_operacoes WHERE codigo_produto IN ('MT2-0001', 'MT2-0002', 'MT2-0003')
    `);
    console.log('--- erp_roteiros_operacoes ---');
    console.log(r1);

    const [r2] = await mysql.query(`
        SELECT g2_produto, g2_codigo, g2_operac, g2_recurso, g2_setup, g2_tempad, g2_descri 
        FROM sg2010 
        WHERE g2_produto IN ('MT2-0001', 'MT2-0002', 'MT2-0003') AND d_e_l_e_t_ = ''
    `);
    console.log('--- sg2010 ---');
    console.log(r2);

    const [allRoteiros] = await mysql.query(`
        SELECT * FROM erp_roteiros_operacoes
    `);
    console.log('--- ALL erp_roteiros_operacoes ---');
    console.log(allRoteiros);

    const [allSg2] = await mysql.query(`
        SELECT g2_produto, g2_codigo, g2_operac, g2_recurso, g2_setup, g2_tempad, g2_descri 
        FROM sg2010 
        WHERE d_e_l_e_t_ = ''
    `);
    console.log('--- ALL sg2010 (sample 20) ---');
    console.log(allSg2.slice(0, 20));

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
