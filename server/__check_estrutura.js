const pool = require('./services/mysqlService');

async function main() {
    // Check materialprocessofabricacao
    const [mp] = await pool.query('DESCRIBE materialprocessofabricacao');
    console.log('materialprocessofabricacao cols:', mp.map(c => c.Field).join(', '));

    // Check ordemservicoitem structure
    const [osi] = await pool.query(`
        SELECT i.IdOrdemServico, i.IdOrdemServicoItem, i.Nivel, i.CodMatFabricante, 
               i.DescResumo, i.QtdeTotal, i.qtde, i.Unidade, i.TxtTipoDesenho, i.ProdutoPrincipal
        FROM ordemservicoitem i 
        WHERE i.IdOrdemServico = (SELECT IdOrdemServico FROM ordemservicoitem LIMIT 1)
        ORDER BY i.Nivel, i.IdOrdemServicoItem
        LIMIT 10
    `);
    console.log('ordemservicoitem sample:', JSON.stringify(osi, null, 2));

    // Check how production ops relate to products
    const [prod] = await pool.query(`
        SELECT op, item_op, sequen, cod_produto_op, desc_produto, pedido_venda 
        FROM view_producao_dashboard 
        LIMIT 3
    `).catch(() => pool.query('SHOW TABLES LIKE "%producao%"'));
    console.log('producao sample:', JSON.stringify(prod, null, 2));

    process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
