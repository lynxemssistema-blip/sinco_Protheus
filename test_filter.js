require('dotenv').config({ path: './server/.env' });
const { Pool } = require('pg');

const pool = new Pool({
    host: '192.168.1.61',
    port: 5432,
    user: 'sinco2',
    password: 'sinco25',
    database: 'p12prd'
});

async function testPedidoFilters() {
    try {
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🔬 TESTING c5_tipo and c5_liberok filters');
        console.log('═══════════════════════════════════════════════════════════\n');

        // Check pedido 003717 status
        console.log('1. Checking pedido 003717 in sc5010...');
        const r1 = await pool.query(`
            SELECT c5_num, c5_tipo, c5_liberok, c5_cliente
            FROM sc5010
            WHERE c5_num = '003717'
              AND COALESCE(d_e_l_e_t_, '') IN ('', ' ')
        `);
        if (r1.rows.length > 0) {
            console.log(`   Pedido: ${r1.rows[0].c5_num}`);
            console.log(`   Tipo: '${r1.rows[0].c5_tipo}' ${r1.rows[0].c5_tipo === 'B' ? '❌ (ORÇAMENTO - SERÁ FILTRADO!)' : '✅'}`);
            console.log(`   Liberado: '${r1.rows[0].c5_liberok}' ${r1.rows[0].c5_liberok === 'S' ? '❌ (FINALIZADO - SERÁ FILTRADO!)' : '✅'}`);
        } else {
            console.log(`   ❌ Pedido not found in sc5010!`);
        }

        // Test query WITHOUT c5 filters
        console.log('\n2. Testing query WITHOUT c5_tipo and c5_liberok filters...');
        const r2 = await pool.query(`
            SELECT COUNT(*) as count
            FROM sc2010 c2
            JOIN sg2010 g2 ON btrim(g2.g2_produto) = btrim(c2.c2_produto) AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN sc2010 root_op ON root_op.c2_num = c2.c2_num AND root_op.c2_item = c2.c2_item AND root_op.c2_sequen = '001' AND COALESCE(root_op.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN sc5010 c5 ON c5.c5_filial = c2.c2_filial AND c5.c5_num = (CASE WHEN btrim(c2.c2_pedido) <> '' THEN btrim(c2.c2_pedido) ELSE btrim(root_op.c2_pedido) END) AND COALESCE(c5.d_e_l_e_t_, '') IN ('', ' ')
            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
              AND c2.c2_num LIKE '%5027%'
              AND (TRIM(c2.c2_pedido) ILIKE '%3717%' OR TRIM(root_op.c2_pedido) ILIKE '%3717%')
        `);
        console.log(`   Result: ${r2.rows[0].count} rows (WITHOUT c5 filters)`);

        // Test query WITH c5 filters
        console.log('\n3. Testing query WITH c5_tipo and c5_liberok filters...');
        const r3 = await pool.query(`
            SELECT COUNT(*) as count
            FROM sc2010 c2
            JOIN sg2010 g2 ON btrim(g2.g2_produto) = btrim(c2.c2_produto) AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN sc2010 root_op ON root_op.c2_num = c2.c2_num AND root_op.c2_item = c2.c2_item AND root_op.c2_sequen = '001' AND COALESCE(root_op.d_e_l_e_t_, '') IN ('', ' ')
            LEFT JOIN sc5010 c5 ON c5.c5_filial = c2.c2_filial AND c5.c5_num = (CASE WHEN btrim(c2.c2_pedido) <> '' THEN btrim(c2.c2_pedido) ELSE btrim(root_op.c2_pedido) END) AND COALESCE(c5.d_e_l_e_t_, '') IN ('', ' ')
            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
              AND (c5.c5_tipo IS NULL OR c5.c5_tipo <> 'B')
              AND (c5.c5_liberok IS NULL OR c5.c5_liberok <> 'S')
              AND c2.c2_num LIKE '%5027%'
              AND (TRIM(c2.c2_pedido) ILIKE '%3717%' OR TRIM(root_op.c2_pedido) ILIKE '%3717%')
        `);
        console.log(`   Result: ${r3.rows[0].count} rows (WITH c5 filters)`)

            ;

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🎯 CONCLUSION');
        console.log('═══════════════════════════════════════════════════════════');

        if (r2.rows[0].count > 0 && r3.rows[0].count === 0) {
            console.log('❌ PROBLEM FOUND: Pedido is being filtered out by c5_tipo or c5_liberok!');
            if (r1.rows.length > 0) {
                if (r1.rows[0].c5_tipo === 'B') {
                    console.log('   Reason: c5_tipo = "B" (Budget/Orçamento)');
                }
                if (r1.rows[0].c5_liberok === 'S') {
                    console.log('   Reason: c5_liberok = "S" (Finalized/Liberado)');
                }
            }
        } else if (r3.rows[0].count > 0) {
            console.log('✅ Query works! The filter should be returning results.');
        }

        console.log('\n');

        await pool.end();
        process.exit(0);

    } catch (err) {
        console.error('❌ ERROR:', err.message);
        console.error(err);
        await pool.end();
        process.exit(1);
    }
}

testPedidoFilters();
