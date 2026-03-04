-- =====================================================
-- GUIA RÁPIDO - APLICAR ÍNDICES FASE 1
-- =====================================================
-- Execute este script no PostgreSQL para melhorar a performance
-- Tempo estimado: 5-15 minutos
-- 
-- MÉTODO 1: Via psql
-- psql -h 192.168.1.61 -U sinco2 -d p12prd -f indices_fase1.sql
--
-- MÉTODO 2: Via pgAdmin/DBeaver
-- Copie e cole o conteúdo completo de indices_fase1.sql
-- =====================================================

-- Verificar conexão
SELECT current_database(), current_user, version();

-- Verificar tamanho das tabelas antes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename IN ('sc5010', 'sc6010', 'sc1010', 'sc7010', 'sb1010', 'sa2010')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- =====================================================
-- CRIAR ÍNDICES (copiar de indices_fase1.sql)
-- =====================================================

\echo 'Criando índices... Aguarde...'

-- [COLE AQUI O CONTEÚDO DE indices_fase1.sql]
-- ou use: \i 'caminho/para/indices_fase1.sql'

-- =====================================================
-- VERIFICAR ÍNDICES CRIADOS
-- =====================================================

\echo 'Verificando índices criados...'

SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size,
    idx_scan as index_scans
FROM pg_indexes
JOIN pg_stat_user_indexes USING (schemaname, tablename, indexname)
WHERE indexname LIKE 'idx_sc%'
  AND schemaname = 'public'
ORDER BY tablename, indexname;

-- =====================================================
-- ATUALIZAR ESTATÍSTICAS
-- =====================================================

\echo 'Atualizando estatísticas das tabelas...'

ANALYZE sc5010;
ANALYZE sc6010;
ANALYZE sc1010;
ANALYZE sc7010;
ANALYZE sb1010;
ANALYZE sa2010;

\echo 'Concluído!'

-- =====================================================
-- TESTAR SE ÍNDICES ESTÃO SENDO USADOS
-- =====================================================

\echo 'Testando uso dos índices...'

-- Teste 1: Índice de data
EXPLAIN ANALYZE
SELECT * FROM sc5010
WHERE c5_emissao >= '20240101'
  AND (d_e_l_e_t_ = '' OR d_e_l_e_t_ = ' ')
LIMIT 10;
-- Deve mostrar "Index Scan using idx_sc5_emissao"

-- Teste 2: Índice de produto
EXPLAIN ANALYZE
SELECT * FROM sc6010
WHERE c6_produto = '010101'
  AND (d_e_l_e_t_ = '' OR d_e_l_e_t_ = ' ')
LIMIT 10;
-- Deve mostrar "Index Scan using idx_sc6_produto"

-- Teste 3: Índice composto
EXPLAIN ANALYZE
SELECT * FROM sc6010
WHERE c6_filial = '01' AND c6_num = '001234'
  AND (d_e_l_e_t_ = '' OR d_e_l_e_t_ = ' ')
LIMIT 10;
-- Deve mostrar "Index Scan using idx_sc6_pv_lookup"

\echo 'Testes concluídos. Verifique os planos de execução acima.'
