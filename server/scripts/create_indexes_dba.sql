-- =============================================================
-- SCRIPT DE ÍNDICES — MetalFisa / Protheus PostgreSQL
-- Executar como DBA (owner das tabelas) no banco p12prd
-- Data: 30/04/2026
-- Objetivo: Otimizar rota /api/producao/vertical/:recurso
-- =============================================================

-- 1. sg2010: índice principal do JOIN (produto × recurso filtrado por ativo)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sg2010_produto_recurso_ativo
  ON public.sg2010 (btrim(g2_produto), btrim(g2_recurso))
  WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ');

-- 2. sc2010: filtro de produto (ILIKE %código%)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sc2010_produto_ativo
  ON public.sc2010 (btrim(c2_produto))
  WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ');

-- 3. sc2010: self-join para sequência raiz (001)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sc2010_num_item_sequen
  ON public.sc2010 (c2_num, c2_item, c2_sequen)
  WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ');

-- 4. sc2010: filtro por pedido de venda
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sc2010_pedido_ativo
  ON public.sc2010 (btrim(c2_pedido))
  WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ') AND btrim(c2_pedido) <> '';

-- 5. sh1010: JOIN de descrição do recurso
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sh1010_codigo_ativo
  ON public.sh1010 (btrim(h1_codigo))
  WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ');

-- 6. sb1010: JOIN de descrição do produto
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sb1010_cod_ativo
  ON public.sb1010 (btrim(b1_cod))
  WHERE COALESCE(d_e_l_e_t_, '') IN ('', ' ');

-- Verificação pós-criação:
-- SELECT t.relname, i.relname, ix.indisvalid, pg_size_pretty(pg_relation_size(ix.indexrelid))
-- FROM pg_class t JOIN pg_index ix ON t.oid=ix.indrelid JOIN pg_class i ON i.oid=ix.indexrelid
-- JOIN pg_namespace n ON n.oid=t.relnamespace
-- WHERE n.nspname='public' AND t.relname IN ('sc2010','sg2010','sh1010','sb1010')
--   AND i.relname LIKE 'idx_%' ORDER BY t.relname;
