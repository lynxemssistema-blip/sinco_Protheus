require('dotenv').config({ path: '../server/.env' });
const db = require('../server/db');

async function analise() {
  try {
    // 1. Pedido de venda (SC5/SC6)
    const sc6 = await db.query(`
      SELECT 
        TRIM(c6.c6_num)     AS pedido,
        TRIM(c6.c6_item)    AS item_pv,
        TRIM(c6.c6_produto) AS produto_pv,
        TRIM(c6.c6_descri)  AS descricao,
        c6.c6_qtdven::numeric AS qtd_vendida,
        c6.c6_qtdent::numeric AS qtd_entregue,
        TRIM(c6.c6_entreg)  AS data_entrega_raw,
        COALESCE(c6.d_e_l_e_t_, '') AS deletado
      FROM public.sc6010 c6
      WHERE TRIM(c6.c6_num) = '003731'
    `);
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  📋 PEDIDO DE VENDA SC6 — 003731');
    console.log('═══════════════════════════════════════════════════');
    console.table(sc6.rows);

    // 2. Todas as OPs do pedido (via c2_pedido direto)
    const ops_diretas = await db.query(`
      SELECT 
        TRIM(c2.c2_num)    AS op,
        TRIM(c2.c2_item)   AS item_op,
        TRIM(c2.c2_sequen) AS sequen,
        TRIM(c2.c2_produto) AS produto,
        TRIM(b1.b1_desc)   AS desc_produto,
        c2.c2_quant::numeric AS qtd_op,
        TRIM(c2.c2_status) AS status,
        TRIM(c2.c2_pedido) AS pedido_c2,
        TRIM(c2.c2_itempv) AS item_pv,
        COALESCE(c2.d_e_l_e_t_, '') AS deletado
      FROM public.sc2010 c2
      LEFT JOIN public.sb1010 b1
        ON TRIM(b1.b1_cod) = TRIM(c2.c2_produto) AND COALESCE(b1.d_e_l_e_t_, '') = ''
      WHERE TRIM(c2.c2_pedido) = '003731'
         OR (TRIM(c2.c2_obs) ILIKE '%003731%' AND TRIM(c2.c2_obs) <> '')
      ORDER BY c2.c2_num, c2.c2_item, c2.c2_sequen
    `);
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  🏭 OPs VINCULADAS AO PEDIDO 003731 (via c2_pedido)');
    console.log('═══════════════════════════════════════════════════');
    console.table(ops_diretas.rows);

    // 3. Roteiro de cada OP encontrada (SG2010)
    const opNums = [...new Set(ops_diretas.rows.map(r => r.op))];
    const produtos = [...new Set(ops_diretas.rows.map(r => r.produto))];

    if (produtos.length > 0) {
      const roteiros = await db.query(`
        SELECT 
          TRIM(g2.g2_produto)  AS produto,
          TRIM(g2.g2_codigo)   AS codigo_roteiro,
          TRIM(g2.g2_recurso)  AS recurso,
          TRIM(g2.g2_operac)   AS operacao_seq,
          TRIM(h1.h1_descri)   AS desc_recurso,
          COALESCE(g2.d_e_l_e_t_, '') AS deletado
        FROM public.sg2010 g2
        LEFT JOIN public.sh1010 h1
          ON TRIM(h1.h1_codigo) = TRIM(g2.g2_recurso)
          AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
        WHERE TRIM(g2.g2_produto) = ANY($1)
          AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
        ORDER BY g2.g2_produto, g2.g2_operac
      `, [produtos]);

      console.log('\n═══════════════════════════════════════════════════');
      console.log('  🔄 ROTEIRO DE FABRICAÇÃO DOS PRODUTOS (SG2010)');
      console.log('═══════════════════════════════════════════════════');
      console.table(roteiros.rows);
    }

    // 4. Resumo executivo
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  📊 RESUMO EXECUTIVO');
    console.log('═══════════════════════════════════════════════════');
    console.log(`  Pedido 003731:`);
    sc6.rows.forEach(r => {
      const entrega = r.data_entrega_raw ? `${r.data_entrega_raw.slice(6,8)}/${r.data_entrega_raw.slice(4,6)}/${r.data_entrega_raw.slice(0,4)}` : 'sem data';
      console.log(`    Item ${r.item_pv}: ${r.produto_pv} — ${r.descricao}`);
      console.log(`      Qtd Vendida: ${r.qtd_vendida} | Qtd Entregue: ${r.qtd_entregue} | Entrega: ${entrega}`);
    });
    console.log(`\n  OPs geradas: ${opNums.join(', ') || 'Nenhuma'}`);
    console.log(`  Total de sub-OPs/linhas: ${ops_diretas.rows.length}`);

    const recursos = [...new Set(
      (await db.query(`
        SELECT DISTINCT TRIM(g2.g2_recurso) AS recurso, TRIM(h1.h1_descri) AS desc_recurso
        FROM public.sg2010 g2
        LEFT JOIN public.sh1010 h1 ON TRIM(h1.h1_codigo) = TRIM(g2.g2_recurso)
        WHERE TRIM(g2.g2_produto) = ANY($1)
          AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
      `, [produtos])).rows.map(r => `${r.recurso} (${r.desc_recurso || '?'})`)
    )];
    console.log(`  Recursos/Setores do roteiro: ${recursos.join(', ')}`);

  } catch (err) {
    console.error('❌ Erro:', err.message);
  } finally {
    process.exit(0);
  }
}

analise();
