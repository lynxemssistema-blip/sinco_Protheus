const db = require('../db');

async function run() {
    try {
        console.log('--- DIAGNÓSTICO PROFUNDO DAS OPS DO ITEM 06 DO PEDIDO 004618 ---');
        
        // Fazer SELECT cru na SC2010 para c2_num = '004618' e c2_item = '06'
        const res = await db.query(`
            SELECT 
                c2_num, c2_item, c2_sequen, c2_produto, c2_quant, c2_quje, c2_datpri, c2_datprf, c2_pedido, c2_itempv, d_e_l_e_t_
            FROM public.sc2010
            WHERE c2_num = '004618' AND c2_item = '06'
        `);
        console.log('Registros brutos encontrados na SC2010:');
        console.table(res.rows);

    } catch (err) {
        console.error('Erro no diagnóstico:', err);
    }
}
run();
