const pool = require('../services/mysqlService');

async function migrate() {
    console.log('🔄 Verificando e adicionando colunas de revisão e desenho...');

    // 1. erp_produtos
    const [prodCols] = await pool.query('DESCRIBE erp_produtos');
    const existingProdCols = prodCols.map(c => c.Field);
    if (!existingProdCols.includes('b1_xrevm')) {
        await pool.query("ALTER TABLE erp_produtos ADD COLUMN b1_xrevm VARCHAR(20) DEFAULT '0'");
        console.log('✅ Adicionada coluna erp_produtos.b1_xrevm');
    }
    if (!existingProdCols.includes('b1_xproc1')) {
        await pool.query("ALTER TABLE erp_produtos ADD COLUMN b1_xproc1 VARCHAR(50) DEFAULT ''");
        console.log('✅ Adicionada coluna erp_produtos.b1_xproc1');
    }
    if (!existingProdCols.includes('b1_xrevc')) {
        await pool.query("ALTER TABLE erp_produtos ADD COLUMN b1_xrevc VARCHAR(20) DEFAULT '0'");
        console.log('✅ Adicionada coluna erp_produtos.b1_xrevc');
    }

    // Set default '0' for existing products if blank
    await pool.query("UPDATE erp_produtos SET b1_xrevm = '0' WHERE b1_xrevm IS NULL OR b1_xrevm = ''");
    await pool.query("UPDATE erp_produtos SET b1_xrevc = '0' WHERE b1_xrevc IS NULL OR b1_xrevc = ''");

    // 2. sb1010
    const [sb1Cols] = await pool.query('DESCRIBE sb1010');
    const existingSb1Cols = sb1Cols.map(c => c.Field);
    if (!existingSb1Cols.includes('b1_xrevm')) {
        await pool.query("ALTER TABLE sb1010 ADD COLUMN b1_xrevm VARCHAR(20) DEFAULT '0'");
    }
    if (!existingSb1Cols.includes('b1_xproc1')) {
        await pool.query("ALTER TABLE sb1010 ADD COLUMN b1_xproc1 VARCHAR(50) DEFAULT ''");
    }
    if (!existingSb1Cols.includes('b1_xrevc')) {
        await pool.query("ALTER TABLE sb1010 ADD COLUMN b1_xrevc VARCHAR(20) DEFAULT '0'");
    }
    await pool.query("UPDATE sb1010 SET b1_xrevm = '0' WHERE b1_xrevm IS NULL OR b1_xrevm = ''");
    await pool.query("UPDATE sb1010 SET b1_xrevc = '0' WHERE b1_xrevc IS NULL OR b1_xrevc = ''");

    // 3. erp_pedidos_itens
    const [itCols] = await pool.query('DESCRIBE erp_pedidos_itens');
    const existingItCols = itCols.map(c => c.Field);
    if (!existingItCols.includes('pedido_cliente')) {
        await pool.query("ALTER TABLE erp_pedidos_itens ADD COLUMN pedido_cliente VARCHAR(50) NULL");
        console.log('✅ Adicionada coluna erp_pedidos_itens.pedido_cliente');
    }
    if (!existingItCols.includes('c6_xrevm')) {
        await pool.query("ALTER TABLE erp_pedidos_itens ADD COLUMN c6_xrevm VARCHAR(20) DEFAULT '0'");
        console.log('✅ Adicionada coluna erp_pedidos_itens.c6_xrevm');
    }
    if (!existingItCols.includes('c6_xproc1')) {
        await pool.query("ALTER TABLE erp_pedidos_itens ADD COLUMN c6_xproc1 VARCHAR(50) DEFAULT ''");
        console.log('✅ Adicionada coluna erp_pedidos_itens.c6_xproc1');
    }
    if (!existingItCols.includes('c6_xrevc')) {
        await pool.query("ALTER TABLE erp_pedidos_itens ADD COLUMN c6_xrevc VARCHAR(20) DEFAULT '0'");
        console.log('✅ Adicionada coluna erp_pedidos_itens.c6_xrevc');
    }

    // Populate erp_pedidos_itens with pedido_cliente from erp_pedidos_venda
    await pool.query(`
        UPDATE erp_pedidos_itens it
        INNER JOIN erp_pedidos_venda pv ON pv.numero_pedido = it.pedido_numero
        SET it.pedido_cliente = pv.pedido_cliente
        WHERE (it.pedido_cliente IS NULL OR it.pedido_cliente = '') AND pv.pedido_cliente IS NOT NULL
    `);

    // 4. sc6010
    await pool.query(`
        UPDATE sc6010 c6
        INNER JOIN erp_pedidos_venda pv ON (pv.numero_pedido = c6.c6_num OR CAST(pv.numero_pedido AS UNSIGNED) = CAST(c6.c6_num AS UNSIGNED))
        SET c6.c6_pedcli = pv.pedido_cliente
        WHERE (c6.c6_pedcli IS NULL OR c6.c6_pedcli = '') AND pv.pedido_cliente IS NOT NULL AND pv.pedido_cliente <> ''
    `);

    // Update revisions and drawing in sc6010 from sb1010 / erp_produtos
    await pool.query(`
        UPDATE sc6010 c6
        INNER JOIN erp_produtos p ON p.codigo = c6.c6_produto
        SET 
            c6.c6_xrevm = COALESCE(NULLIF(p.b1_xrevm, ''), '0'),
            c6.c6_xproc1 = COALESCE(p.b1_xproc1, ''),
            c6.c6_xrevc = COALESCE(NULLIF(p.b1_xrevc, ''), '0')
        WHERE c6.d_e_l_e_t_ = ''
    `);

    console.log('🎉 Migração e sincronização de campos concluída com sucesso!');
}

if (require.main === module) {
    migrate()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Erro na migração:', err);
            process.exit(1);
        });
}

module.exports = { migrate };
