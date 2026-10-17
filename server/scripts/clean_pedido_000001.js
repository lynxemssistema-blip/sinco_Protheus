const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
    const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });
    console.log('Connected to DB:', process.env.MYSQL_DB);

    await conn.beginTransaction();
    try {
        // 1. Delete old/corrupted records
        await conn.query("DELETE FROM erp_ordens_producao WHERE pedido_venda = '000001' OR numero_op LIKE '%006806%' OR numero_op LIKE '000001%'");
        await conn.query("DELETE FROM sc2010 WHERE c2_pedido = '000001' OR c2_num = '006806' OR c2_num = '000001'");
        await conn.query("DELETE FROM app_pcp_delivery_forecasts WHERE pedido = '000001'");
        await conn.query("DELETE FROM erp_pedidos_itens WHERE pedido_numero = '000001'");
        await conn.query("DELETE FROM sc6010 WHERE c6_num = '000001'");
        try { await conn.query("DELETE FROM sd4010 WHERE d4_op LIKE '006806%' OR d4_op LIKE '000001%'"); } catch(_) {}
        try { await conn.query("DELETE FROM sh6010 WHERE h6_op LIKE '006806%' OR h6_op LIKE '000001%'"); } catch(_) {}

        // 2. Reinsert clean sc6010
        await conn.query(`
            INSERT INTO sc6010 (
                c6_filial, c6_num, c6_item, c6_produto, c6_um, c6_qtdven, c6_prcven, c6_valor,
                c6_qtdent, c6_entreg, c6_cli, c6_loja, c6_pedcli, c6_xrevm, c6_xproc1, c6_xrevc,
                d_e_l_e_t_, IdEmpresa
            ) VALUES
            ('0101', '000001', '01', 'MT2-0001', 'UN', 32, 10, 320, 0, '20261020', '000001', '01', '956565', '0', '', '0', '', 1),
            ('0101', '000001', '02', 'MT2-0001', 'UN', 5, 10, 50, 0, '20261029', '000001', '01', '956565', '0', '', '0', '', 1),
            ('0101', '000001', '03', 'MT2-0001', 'UN', 23, 10, 230, 0, '20261029', '000001', '01', '956565', '0', '', '0', '', 1)
        `);

        // 3. Reinsert clean erp_pedidos_itens
        await conn.query(`
            INSERT INTO erp_pedidos_itens (
                pedido_numero, item_seq, produto_codigo, quantidade, quantidade_original,
                quantidade_entregue, quantidade_saldo, preco_unitario, valor_total,
                data_entrega_prevista, status
            ) VALUES
            ('000001', '01', 'MT2-0001', 32, 32, 0, 32, 10, 320, '2026-10-20', 'aberto'),
            ('000001', '02', 'MT2-0001', 5, 5, 0, 5, 10, 50, '2026-10-29', 'aberto'),
            ('000001', '03', 'MT2-0001', 23, 23, 0, 23, 10, 230, '2026-10-29', 'aberto')
        `);

        // 4. Update erp_pedidos_venda status to 'pedido'
        await conn.query("UPDATE erp_pedidos_venda SET status = 'pedido', valor_total = 600 WHERE numero_pedido = '000001'");

        await conn.commit();
        console.log('SUCCESS: Pedido 000001 cleanly reset and restored!');
    } catch(err) {
        await conn.rollback();
        console.error('ERROR during reset:', err);
    } finally {
        await conn.end();
    }
})();
