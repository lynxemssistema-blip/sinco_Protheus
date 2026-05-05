-- =============================================================================
-- SCRIPT DE ÍNDICES DE PERFORMANCE — MetalFisa Anty
-- Executar no banco PostgreSQL (Protheus) com usuário DBA
-- Todos os índices usam CONCURRENTLY — não bloqueiam leitura/escrita em produção
-- =============================================================================

-- PASSO 1: Habilitar extensão trigrama (para buscas ILIKE com %)
-- Executar UMA VEZ por banco
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- sc5010 — Pedidos de Venda (tabela raiz de quase todas as queries)
-- =============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sc5010_emissao_num
    ON public.sc5010(c5_emissao DESC, c5_num DESC)
    WHERE COALESCE(d_e_l_e_t_, '') = '';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sc5010_cliente
    ON public.sc5010(c5_cliente, c5_lojacli)
    WHERE COALESCE(d_e_l_e_t_, '') = '';

-- =============================================================================
-- sc6010 — Itens do Pedido (JOIN mais frequente)
-- =============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sc6010_num_filial
    ON public.sc6010(c6_num, c6_filial)
    WHERE COALESCE(d_e_l_e_t_, '') = '';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sc6010_produto_trgm
    ON public.sc6010 USING gin(c6_produto gin_trgm_ops);

-- =============================================================================
-- sc2010 — Ordens de Produção
-- =============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sc2010_pedido_item
    ON public.sc2010(c2_pedido, c2_itempv)
    WHERE COALESCE(d_e_l_e_t_, '') = '';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sc2010_num_trim
    ON public.sc2010(TRIM(c2_num))
    WHERE COALESCE(d_e_l_e_t_, '') = '';

-- =============================================================================
-- sg1010 — Estrutura BOM (JOIN recursivo em producao/ordens)
-- =============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sg1010_cod_trim
    ON public.sg1010(TRIM(g1_cod))
    WHERE COALESCE(d_e_l_e_t_, '') <> '*';

-- =============================================================================
-- sg2010 — Roteiro de Produção
-- =============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sg2010_produto_trim
    ON public.sg2010(TRIM(g2_produto))
    WHERE COALESCE(d_e_l_e_t_, '') <> '*';

-- =============================================================================
-- sb1010 — Cadastro de Produtos
-- =============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sb1010_cod
    ON public.sb1010(b1_cod)
    WHERE COALESCE(d_e_l_e_t_, '') = '';

-- =============================================================================
-- sa1010 — Clientes (busca por nome com ILIKE)
-- =============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sa1010_nome_trgm
    ON public.sa1010 USING gin(a1_nome gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sa1010_cod_loja
    ON public.sa1010(a1_cod, a1_loja)
    WHERE COALESCE(d_e_l_e_t_, '') = '';

-- =============================================================================
-- sz0010 — Restrições (usado no /flat de pedidos)
-- =============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sz0010_produto_trim
    ON public.sz0010(TRIM(z0_produto))
    WHERE COALESCE(d_e_l_e_t_, '') <> '*' AND z0_status = 'P';

-- =============================================================================
-- sd2010 / sf2010 — Notas Fiscais (enrichment de pedidos)
-- =============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sd2010_pedido
    ON public.sd2010(d2_pedido)
    WHERE COALESCE(d_e_l_e_t_, '') = '';

-- =============================================================================
-- VERIFICAR ÍNDICES CRIADOS
-- =============================================================================
-- SELECT schemaname, tablename, indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;
