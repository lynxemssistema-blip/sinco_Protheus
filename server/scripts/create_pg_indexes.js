require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../db');

async function createIndexes() {
  console.log('\n🔧 Criando índices de expressão no PostgreSQL (CONCURRENTLY)...');
  console.log('   Isso pode demorar alguns minutos — sistema continua operando normalmente.\n');

  const indexes = [
    {
      name: 'idx_sg2010_produto_recurso_ativo',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sg2010_produto_recurso_ativo
              ON public.sg2010 (btrim(g2_produto), btrim(g2_recurso))
              WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')`,
      desc: 'sg2010: produto × recurso (JOIN principal da rota vertical)'
    },
    {
      name: 'idx_sc2010_produto_ativo',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sc2010_produto_ativo
              ON public.sc2010 (btrim(c2_produto))
              WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')`,
      desc: 'sc2010: produto (filtro por produto/código)'
    },
    {
      name: 'idx_sc2010_num_item_sequen',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sc2010_num_item_sequen
              ON public.sc2010 (c2_num, c2_item, c2_sequen)
              WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')`,
      desc: 'sc2010: self-join de sequência raiz (001)'
    },
    {
      name: 'idx_sc2010_pedido_ativo',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sc2010_pedido_ativo
              ON public.sc2010 (btrim(c2_pedido))
              WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ') AND btrim(c2_pedido) <> ''`,
      desc: 'sc2010: pedido de venda (filtro por pedido)'
    },
    {
      name: 'idx_sh1010_codigo_ativo',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sh1010_codigo_ativo
              ON public.sh1010 (btrim(h1_codigo))
              WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')`,
      desc: 'sh1010: código do recurso (JOIN de descrição)'
    },
    {
      name: 'idx_sb1010_cod_ativo',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sb1010_cod_ativo
              ON public.sb1010 (btrim(b1_cod))
              WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ')`,
      desc: 'sb1010: código do produto (JOIN de descrição)'
    }
  ];

  for (const idx of indexes) {
    process.stdout.write(`  ⏳ ${idx.desc} ... `);
    const t = Date.now();
    try {
      await db.query(idx.sql);
      console.log(`✅ ${Date.now() - t}ms`);
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }
  }

  // Verificar índices criados
  console.log('\n📋 Índices ativos nas tabelas críticas:');
  const res = await db.query(`
    SELECT
      t.relname AS tabela,
      i.relname AS indice,
      pg_size_pretty(pg_relation_size(ix.indexrelid)) AS tamanho,
      ix.indisvalid AS valido
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i  ON i.oid = ix.indexrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname IN ('sc2010','sg2010','sh1010','sb1010')
      AND i.relname LIKE 'idx_%'
    ORDER BY t.relname, i.relname
  `);
  res.rows.forEach(r =>
    console.log(`  ${r.valido ? '✅' : '⏳'} ${r.tabela}.${r.indice}  (${r.tamanho})`)
  );

  console.log('\n✅ Concluído.\n');
  process.exit(0);
}

createIndexes().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
