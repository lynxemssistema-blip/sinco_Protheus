-- =====================================================
-- ÍNDICES BÁSICOS PARA MELHORAR PERFORMANCE
-- Fase 1: Quick Win (Implementar AGORA)
-- =====================================================
-- Projeto: MetalFisa Anty - Pedidos de Compra com PV
-- Data: 2026-01-20
-- Objetivo: Melhorar performance em 20-30%
-- Tempo estimado de criação: 5-15 minutos (depende do tamanho das tabelas)

-- =====================================================
-- 1. ÍNDICES EM DATA DE EMISSÃO
-- =====================================================

-- Índice para filtro por data de emissão do PV
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sc5_emissao 
ON sc5010(c5_emissao) 
WHERE d_e_l_e_t_ = '' OR d_e_l_e_t_ = ' ';

COMMENT ON INDEX idx_sc5_emissao IS 'Índice para filtro de data de emissão em Pedidos de Venda';

-- =====================================================
-- 2. ÍNDICES EM PRODUTOS
-- =====================================================

-- Índice para JOIN e filtro por produto em itens do PV
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sc6_produto 
ON sc6010(c6_produto) 
WHERE d_e_l_e_t_ = '' OR d_e_l_e_t_ = ' ';

COMMENT ON INDEX idx_sc6_produto IS 'Índice para filtro de produto em Itens de PV';

-- Índice para match de produto em Solicitações de Compra
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sc1_produto 
ON sc1010(c1_produto) 
WHERE d_e_l_e_t_ = '' OR d_e_l_e_t_ = ' ';

COMMENT ON INDEX idx_sc1_produto IS 'Índice para JOIN de produto em Solicitações de Compra';

-- =====================================================
-- 3. ÍNDICES COMPOSTOS PARA JOINS
-- =====================================================

-- Índice para JOIN PV -> Itens (mais usado)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sc6_pv_lookup 
ON sc6010(c6_filial, c6_num) 
WHERE d_e_l_e_t_ = '' OR d_e_l_e_t_ = ' ';

COMMENT ON INDEX idx_sc6_pv_lookup IS 'Índice composto para lookup de itens por PV';

-- Índice para JOIN SC -> PC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sc7_sc_lookup 
ON sc7010(c7_filial, c7_numsc, c7_itemsc) 
WHERE d_e_l_e_t_ = '' OR d_e_l_e_t_ = ' ';

COMMENT ON INDEX idx_sc7_sc_lookup IS 'Índice composto para lookup de PC por SC';

-- =====================================================
-- 4. ÍNDICE NO CAMPO DE OBSERVAÇÃO (PREPARAÇÃO)
-- =====================================================

-- Índice simples na observação (não resolve ILIKE, mas ajuda em outras queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sc1_obs_basic 
ON sc1010(c1_obs) 
WHERE d_e_l_e_t_ = '' OR d_e_l_e_t_ = ' '
  AND c1_obs IS NOT NULL 
  AND c1_obs <> '';

COMMENT ON INDEX idx_sc1_obs_basic IS 'Índice básico em observações não vazias';

-- =====================================================
-- 5. VERIFICAR ÍNDICES CRIADOS
-- =====================================================

-- Query para verificar se os índices foram criados
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexname LIKE 'idx_sc%'
  AND schemaname = 'public'
ORDER BY tablename, indexname;

-- =====================================================
-- 6. ESTATÍSTICAS DAS TABELAS
-- =====================================================

-- Atualizar estatísticas para o PostgreSQL otimizar melhor as queries
ANALYZE sc5010;
ANALYZE sc6010;
ANALYZE sc1010;
ANALYZE sc7010;
ANALYZE sb1010;
ANALYZE sa2010;

-- =====================================================
-- 7. MONITORAR PROGRESSO DA CRIAÇÃO
-- =====================================================

-- Ver índices sendo criados (se usar CONCURRENTLY)
SELECT 
    now()::TIME(0),
    query,
    state,
    wait_event_type,
    wait_event
FROM pg_stat_activity
WHERE query LIKE '%CREATE INDEX%'
  AND state <> 'idle';

-- =====================================================
-- FASE 2 (IMPLEMENTAR NA PRÓXIMA SEMANA)
-- =====================================================

-- Descomentar quando estiver pronto para Fase 2:

/*
-- Habilitar extensão para ILIKE otimizado
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índice GIN para buscas ILIKE em observação
CREATE INDEX CONCURRENTLY idx_sc1_obs_gin_trgm 
ON sc1010 USING gin(c1_obs gin_trgm_ops)
WHERE d_e_l_e_t_ = '' OR d_e_l_e_t_ = ' ';

COMMENT ON INDEX idx_sc1_obs_gin_trgm IS 'Índice GIN trigram para ILIKE em observações - FASE 2';
*/

-- =====================================================
-- ROLLBACK (SE NECESSÁRIO)
-- =====================================================

/*
-- Apenas se precisar remover os índices:
DROP INDEX CONCURRENTLY IF EXISTS idx_sc5_emissao;
DROP INDEX CONCURRENTLY IF EXISTS idx_sc6_produto;
DROP INDEX CONCURRENTLY IF EXISTS idx_sc1_produto;
DROP INDEX CONCURRENTLY IF EXISTS idx_sc6_pv_lookup;
DROP INDEX CONCURRENTLY IF EXISTS idx_sc7_sc_lookup;
DROP INDEX CONCURRENTLY IF EXISTS idx_sc1_obs_basic;
*/

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================
/*
1. CONCURRENTLY: Permite criar índices sem bloquear a tabela
   - Demora mais, mas não trava o sistema
   - Recomendado para produção

2. Se a criação falhar:
   - Remover CONCURRENTLY e tentar novamente
   - Fazer em horário de menor movimento

3. Espaço em disco:
   - Índices ocupam espaço adicional
   - Verificar espaço disponível antes

4. Performance esperada:
   - Queries com filtro de data: 50-70% mais rápido
   - Queries com filtro de produto: 40-60% mais rápido
   - JOIN PV->Itens: 30-50% mais rápido
*/
