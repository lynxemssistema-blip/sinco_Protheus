const mysql = require('../services/mysqlService');

async function check() {
    const [itens] = await mysql.query(`
        SELECT pedido_numero, item_seq, produto_codigo, quantidade 
        FROM erp_pedidos_itens 
        WHERE pedido_numero IN ('1', '000001')
    `);
    console.log('--- ITENS PEDIDO 000001 ---', itens);

    for (const it of itens) {
        console.log(`\n========================================`);
        console.log(`PRODUTO: ${it.produto_codigo} (${it.descricao})`);
        console.log(`========================================`);

        // Check BOM erp_estruturas_bom
        const [bomMy] = await mysql.query(`
            SELECT * FROM erp_estruturas_bom WHERE produto_pai_codigo = ?
        `, [it.produto_codigo]);
        console.log(`BOM erp_estruturas_bom (${bomMy.length}):`, bomMy);

        // Check BOM sg1010
        const [bomSg1] = await mysql.query(`
            SELECT g1_cod, g1_comp, g1_quant, g1_trt, g1_revini, g1_revfim 
            FROM sg1010 
            WHERE g1_cod = ? AND d_e_l_e_t_ = ''
        `, [it.produto_codigo]);
        console.log(`BOM sg1010 (${bomSg1.length}):`, bomSg1);

        // For each component in erp_estruturas_bom or sg1010, check if component has children!
        const allComps = [...bomMy.map(b => b.produto_filho_codigo), ...bomSg1.map(b => b.g1_comp.trim())];
        for (const compCode of allComps) {
            const [subBomMy] = await mysql.query(`
                SELECT * FROM erp_estruturas_bom WHERE produto_pai_codigo = ?
            `, [compCode]);
            console.log(`   --> Sub-BOM erp_estruturas_bom for ${compCode} (${subBomMy.length}):`, subBomMy);

            const [subBomSg1] = await mysql.query(`
                SELECT g1_cod, g1_comp, g1_quant, g1_trt 
                FROM sg1010 
                WHERE g1_cod = ? AND d_e_l_e_t_ = ''
            `, [compCode]);
            console.log(`   --> Sub-BOM sg1010 for component ${compCode} (${subBomSg1.length}):`, subBomSg1);
        }
    }

    console.log('\n--- ROTEIROS DE OPERACOES PARA MT2-0001, MT2-0002, MT2-0003 ---');
    const [rotMy] = await mysql.query(`
        SELECT * FROM erp_roteiros_operacoes WHERE codigo_produto IN ('MT2-0001', 'MT2-0002', 'MT2-0003')
    `);
    console.log('erp_roteiros_operacoes:', rotMy);
    const [rotSg2] = await mysql.query(`
        SELECT * FROM sg2010 WHERE g2_produto IN ('MT2-0001', 'MT2-0002', 'MT2-0003') AND d_e_l_e_t_ = ''
    `);
    console.log('sg2010:', rotSg2);

    // Also check what ops currently exist in erp_ordens_producao_operacoes and sh6010!
    const [opsGerais] = await mysql.query(`
        SELECT * FROM erp_ordens_producao_operacoes WHERE numero_op LIKE '000001%'
    `);
    console.log('erp_ordens_producao_operacoes para 000001%:', opsGerais);

    const [sh6] = await mysql.query(`
        SELECT * FROM sh6010 WHERE h6_op LIKE '000001%'
    `);
    console.log('sh6010 para 000001%:', sh6);

    const [materiais] = await mysql.query(`
        SELECT * FROM erp_ordens_producao_materiais WHERE numero_op LIKE '000001%'
    `);
    console.log('erp_ordens_producao_materiais para 000001%:', materiais);

    const [sd4] = await mysql.query(`
        SELECT * FROM sd4010 WHERE d4_op LIKE '000001%'
    `);
    console.log('sd4010 para 000001%:', sd4);

    const [ops] = await mysql.query(`
        SELECT * FROM erp_ordens_producao WHERE numero_op LIKE '000001%' OR pedido_venda IN ('1', '000001')
    `);
    console.log('erp_ordens_producao:', ops);

    process.exit(0);
}

check().catch(err => {
    console.error(err);
    process.exit(1);
});
