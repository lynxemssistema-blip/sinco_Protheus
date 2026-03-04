require('dotenv').config();
const { Pool } = require('pg');

(async () => {
    const pool = new Pool({
        host: process.env.PGHOST,
        port: process.env.PGPORT,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE
    });

    try {
        console.log('========================================');
        console.log('Investigação: Pedido 3663 - Item 1 sem OP');
        console.log('========================================\n');

        // Query 1: Dados do pedido SC6010
        console.log('1. DADOS DO PEDIDO (SC6010):');
        const pedido = await pool.query(`
            SELECT 
                c6_num as pedido, 
                c6_item as item, 
                c6_produto as produto, 
                c6_descri as descricao, 
                c6_op as op,
                c6_qtdven as qtd
            FROM public.sc6010 
            WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ') 
              AND c6_num = '003663' 
            ORDER BY c6_item
        `);
        console.log(JSON.stringify(pedido.rows, null, 2));

        // Query 2: Verificar OPs relacionadas ao pedido
        console.log('\n2. OPs RELACIONADAS (SC2010):');
        const ops = await pool.query(`
            SELECT 
                c2_num as op,
                c2_item as item,
                c2_sequen as sequencia,
                c2_produto as produto,
                c2_pedido as pedido,
                c2_itempv as item_pedido,
                c2_quant as quantidade
            FROM public.sc2010 
            WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ') 
              AND (c2_pedido = '003663' OR c2_num IN ('003663', '004974'))
            ORDER BY c2_pedido, c2_itempv
        `);
        console.log(JSON.stringify(ops.rows, null, 2));

        // Query 3: Verificar se existe OP 004974
        console.log('\n3. DETALHES DA OP 004974:');
        const op004974 = await pool.query(`
            SELECT 
                c2_num as op,
                c2_item as item,
                c2_sequen as sequencia,
                c2_produto as produto,
                c2_pedido as pedido,
                c2_itempv as item_pedido,
                c2_quant as quantidade
            FROM public.sc2010 
            WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ') 
              AND c2_num = '004974'
        `);
        console.log(JSON.stringify(op004974.rows, null, 2));

        console.log('\n========================================');
        console.log('ANÁLISE:');
        console.log('========================================');

        const item1 = pedido.rows.find(r => r.item === '01');
        const item2 = pedido.rows.find(r => r.item === '02');

        console.log(`✓ Item 1: OP = "${item1?.op || 'VAZIO'}" (Esperado: 004974)`);
        console.log(`✓ Item 2: OP = "${item2?.op || 'VAZIO'}" (Esperado: 003663)`);

        if (!item1?.op || item1.op.trim() === '') {
            console.log('\n⚠️ PROBLEMA IDENTIFICADO:');
            console.log('Item 1 do pedido 003663 não tem OP preenchida no campo c6_op');
            console.log('Possíveis causas:');
            console.log('1. Campo c6_op não foi atualizado no Protheus quando OP foi criada');
            console.log('2. OP 004974 existe mas não está vinculada ao pedido no SC6');
            console.log('3. Processo de vínculo OP->Pedido não foi executado');
        }

    } catch (err) {
        console.error('Erro:', err.message);
    }

    await pool.end();
})();
