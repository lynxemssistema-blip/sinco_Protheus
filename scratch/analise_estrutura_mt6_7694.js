require('dotenv').config({ path: '../server/.env' });
const db = require('../server/db');

async function analise() {
  try {
    const produto = 'MT6-7694';

    // 1. Verificar produto no SB1
    const sb1 = await db.query(`
      SELECT 
        TRIM(b1_cod)   AS codigo,
        TRIM(b1_desc)  AS descricao,
        TRIM(b1_tipo)  AS tipo,
        TRIM(b1_um)    AS unidade,
        TRIM(b1_grupo) AS grupo,
        COALESCE(d_e_l_e_t_, '') AS deletado
      FROM public.sb1010
      WHERE TRIM(b1_cod) = $1
    `, [produto]);
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  🗂️  CADASTRO DO PRODUTO — SB1010');
    console.log('═══════════════════════════════════════════════════');
    console.table(sb1.rows);

    // 2. Verificar BOM na SG1010 (estrutura do produto)
    const sg1 = await db.query(`
      SELECT 
        TRIM(g1_cod)     AS produto_pai,
        TRIM(g1_comp)    AS componente,
        TRIM(b1.b1_desc) AS desc_componente,
        g1_quant::numeric AS quantidade,
        TRIM(g1_revfim)  AS revisao,
        COALESCE(g1.d_e_l_e_t_, '') AS deletado
      FROM public.sg1010 g1
      LEFT JOIN public.sb1010 b1
        ON TRIM(b1.b1_cod) = TRIM(g1.g1_comp)
        AND COALESCE(b1.d_e_l_e_t_, '') = ''
      WHERE TRIM(g1.g1_cod) = $1
      ORDER BY g1.g1_comp
    `, [produto]);
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  📐 ESTRUTURA / BOM — SG1010 (produto pai = MT6-7694)');
    console.log('═══════════════════════════════════════════════════');
    if (sg1.rows.length === 0) {
      console.log('  ⚠️  NENHUMA ESTRUTURA ENCONTRADA para MT6-7694 na SG1010!');
    } else {
      console.table(sg1.rows);
    }

    // 3. Verificar se existe como componente de outro produto
    const como_comp = await db.query(`
      SELECT 
        TRIM(g1_cod)  AS produto_pai,
        TRIM(g1_comp) AS este_produto_e_componente_de
      FROM public.sg1010
      WHERE TRIM(g1_comp) = $1
        AND COALESCE(d_e_l_e_t_, '') = ''
      LIMIT 5
    `, [produto]);
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  🔗 MT6-7694 é componente DE algum outro produto?');
    console.log('═══════════════════════════════════════════════════');
    if (como_comp.rows.length === 0) {
      console.log('  ℹ️  Não é componente de nenhum outro produto.');
    } else {
      console.table(como_comp.rows);
    }

    // 4. Verificar sub-OPs da OP 005909
    const sub_ops = await db.query(`
      SELECT 
        TRIM(c2.c2_num)    AS op,
        TRIM(c2.c2_item)   AS item,
        TRIM(c2.c2_sequen) AS sequen,
        TRIM(c2.c2_produto) AS produto,
        TRIM(b1.b1_desc)   AS descricao,
        c2.c2_quant::numeric AS qtd,
        TRIM(c2.c2_status) AS status,
        COALESCE(c2.d_e_l_e_t_, '') AS deletado
      FROM public.sc2010 c2
      LEFT JOIN public.sb1010 b1
        ON TRIM(b1.b1_cod) = TRIM(c2.c2_produto) AND COALESCE(b1.d_e_l_e_t_, '') = ''
      WHERE TRIM(c2.c2_num) = '005909'
      ORDER BY c2.c2_item, c2.c2_sequen
    `);
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  🏭 TODAS AS LINHAS DA OP 005909 (SC2010)');
    console.log('═══════════════════════════════════════════════════');
    console.table(sub_ops.rows);

    // 5. Roteiro do produto
    const roteiro = await db.query(`
      SELECT 
        TRIM(g2.g2_produto)  AS produto,
        TRIM(g2.g2_codigo)   AS codigo_rot,
        TRIM(g2.g2_operac)   AS seq_operacao,
        TRIM(g2.g2_recurso)  AS recurso,
        TRIM(h1.h1_descri)   AS desc_recurso,
        COALESCE(g2.d_e_l_e_t_, '') AS deletado
      FROM public.sg2010 g2
      LEFT JOIN public.sh1010 h1
        ON TRIM(h1.h1_codigo) = TRIM(g2.g2_recurso)
        AND COALESCE(h1.d_e_l_e_t_, '') IN ('', ' ')
      WHERE TRIM(g2.g2_produto) = $1
      ORDER BY g2.g2_operac
    `, [produto]);
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  🔄 ROTEIRO DE FABRICAÇÃO — SG2010');
    console.log('═══════════════════════════════════════════════════');
    if (roteiro.rows.length === 0) {
      console.log('  ⚠️  NENHUM ROTEIRO CADASTRADO para MT6-7694 na SG2010!');
    } else {
      console.table(roteiro.rows);
    }

  } catch (err) {
    console.error('❌ Erro:', err.message);
  } finally {
    process.exit(0);
  }
}

analise();
