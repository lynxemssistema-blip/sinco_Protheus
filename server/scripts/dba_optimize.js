/**
 * MetalFisa — Script de Otimização DBA
 * Baseado no audit real: MySQL 5.6.26, InnoDB
 * Executar em horário de baixa carga (fora expediente)
 */
const mysqlPool = require('../services/mysqlService');

async function runDBAOptimizations() {
    const conn = await mysqlPool.getConnection();
    const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

    try {
        // =====================================================================
        // BLOCO 1: ÍNDICES CRÍTICOS FALTANTES
        // =====================================================================
        log('>> BLOCO 1: Criando índices críticos...');

        const indexes = [
            // app_pcp_historico_revisao — 576k rows, ZERO índices → full scan em toda query
            // Padrão de acesso: WHERE op_numero = ? ORDER BY data_alteracao DESC
            // Índice composto: (op_numero, data_alteracao) cobre a query com range scan
            {
                table: 'app_pcp_historico_revisao',
                name:  'idx_hist_op_data',
                cols:  '(op_numero(30), data_alteracao)',
                reason: '576k rows sem índice — full scan de 72MB em cada consulta de histórico'
            },
            // Lookup por usuário para auditoria
            {
                table: 'app_pcp_historico_revisao',
                name:  'idx_hist_usuario',
                cols:  '(usuario(30), data_alteracao)',
                reason: 'Queries de auditoria por usuário'
            },
            // produtos_docs — 30k rows, url_arquivo TEXT sem índice
            // Substituir TEXT por VARCHAR(500) permite índice normal
            {
                table: 'produtos_docs',
                name:  'idx_pdocs_produto',
                cols:  '(produto_codigo(50))',
                reason: '30k rows — lookup por produto sem índice'
            },
            // app_pcp_delivery_forecasts — 20k rows
            {
                table: 'app_pcp_delivery_forecasts',
                name:  'idx_forecast_op_item',
                cols:  '(op_numero(20), op_item(10))',
                reason: 'Lookup primário sem índice composto'
            },
            // material — 18k rows com longblob (Imagem)
            // O longblob no meio da linha fragmenta os pages do InnoDB
            // Índice por código acelera lookups sem tocar no blob
            {
                table: 'material',
                name:  'idx_material_codigo',
                cols:  '(Codigo(50))',
                reason: 'Lookup por código sem índice — força scan em tabela com LONGBLOB'
            },
        ];

        for (const idx of indexes) {
            try {
                await conn.query(`ALTER TABLE \`${idx.table}\` ADD INDEX \`${idx.name}\` ${idx.cols}`);
                log(`  ✅ ${idx.table}.${idx.name} criado — ${idx.reason}`);
            } catch (e) {
                if (e.code === 'ER_DUP_KEYNAME') {
                    log(`  ⏭️  ${idx.table}.${idx.name} já existe`);
                } else {
                    log(`  ❌ ${idx.table}.${idx.name} ERRO: ${e.message}`);
                }
            }
        }

        // =====================================================================
        // BLOCO 2: MIGRAR TEXT → VARCHAR(500) onde viável
        // TEXT impede uso eficiente no sort_buffer e tmp_table_size
        // VARCHAR(500) → pode ser usado em índices e sort in-memory
        // =====================================================================
        log('\n>> BLOCO 2: Otimizando tipos de coluna TEXT → VARCHAR...');

        const textMigrations = [
            // Historico: mudou_de e mudou_para nunca deveriam exceder 500 chars
            // "Inicio: 2024-01-01 | Fim: 2024-01-31" = ~45 chars típico
            { table: 'app_pcp_historico_revisao', col: 'mudou_de',   type: 'VARCHAR(1000)' },
            { table: 'app_pcp_historico_revisao', col: 'mudou_para', type: 'VARCHAR(1000)' },
            // url_arquivo: URLs não chegam perto de 65k chars (TEXT default)
            { table: 'produtos_docs', col: 'url_arquivo', type: 'VARCHAR(1000)' },
            // observacao: textos curtos de planejamento
            { table: 'app_pcp_delivery_forecasts', col: 'observacao', type: 'VARCHAR(2000)' },
            { table: 'app_planning_history',        col: 'observacao', type: 'VARCHAR(2000)' },
        ];

        for (const m of textMigrations) {
            try {
                // Verifica se já foi migrado
                const [[col]] = await conn.query(
                    `SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
                     FROM information_schema.COLUMNS 
                     WHERE TABLE_SCHEMA='metalfisa' AND TABLE_NAME=? AND COLUMN_NAME=?`,
                    [m.table, m.col]
                );
                if (col && col.DATA_TYPE !== 'text') {
                    log(`  ⏭️  ${m.table}.${m.col} já é ${col.DATA_TYPE}(${col.CHARACTER_MAXIMUM_LENGTH})`);
                    continue;
                }
                await conn.query(`ALTER TABLE \`${m.table}\` MODIFY COLUMN \`${m.col}\` ${m.type}`);
                log(`  ✅ ${m.table}.${m.col} TEXT → ${m.type}`);
            } catch (e) {
                log(`  ❌ ${m.table}.${m.col} ERRO: ${e.message}`);
            }
        }

        // =====================================================================
        // BLOCO 3: RECOMENDAÇÕES DE VARIÁVEIS (não podem ser alteradas via SQL
        // em ambientes shared hosting — documentadas para o suporte UOL)
        // =====================================================================
        log('\n>> BLOCO 3: Verificando variáveis configuráveis via SESSION...');

        // Estas variáveis podem ser setadas por sessão — aplicar nas queries pesadas
        const sessionVars = [
            ['tmp_table_size',     64 * 1024 * 1024],  // 64MB — atual: 16MB
            ['max_heap_table_size', 64 * 1024 * 1024], // 64MB — atual: 4MB
            ['sort_buffer_size',    4 * 1024 * 1024],  // 4MB  — atual: 1MB
            ['join_buffer_size',    2 * 1024 * 1024],  // 2MB  — atual: 128KB
            ['read_rnd_buffer_size', 1 * 1024 * 1024], // 1MB  — atual: 512KB
        ];

        for (const [varName, value] of sessionVars) {
            try {
                await conn.query(`SET SESSION ${varName} = ?`, [value]);
                log(`  ✅ SESSION ${varName} = ${Math.round(value/1024/1024)}MB`);
            } catch (e) {
                log(`  ⚠️  ${varName}: ${e.message} (pode não ter permissão em shared hosting)`);
            }
        }

        // Verificar se a configuração foi aceita
        const [sessionCheck] = await conn.query(`SHOW SESSION VARIABLES WHERE Variable_name IN ('tmp_table_size','max_heap_table_size','sort_buffer_size')`);
        log('\n  SESSION vars atuais:');
        sessionCheck.forEach(v => log(`    ${v.Variable_name.padEnd(30)} = ${(v.Value/1024/1024).toFixed(1)}MB`));

        // =====================================================================
        // BLOCO 4: ANÁLISE DO QUERY CACHE
        // =====================================================================
        log('\n>> BLOCO 4: Análise do Query Cache...');
        const [qc] = await conn.query(`SHOW STATUS WHERE Variable_name LIKE 'Qcache%'`);
        const qcMap = Object.fromEntries(qc.map(r => [r.Variable_name, Number(r.Value)]));
        const hitRatio = qcMap['Qcache_hits'] / (qcMap['Qcache_hits'] + qcMap['Qcache_inserts'] + qcMap['Qcache_not_cached']);
        const prune_ratio = qcMap['Qcache_lowmem_prunes'] / qcMap['Qcache_inserts'];

        log(`  Hit ratio: ${(hitRatio * 100).toFixed(1)}%`);
        log(`  Prune/Insert ratio: ${(prune_ratio * 100).toFixed(1)}% — ${prune_ratio > 0.3 ? '❌ CRÍTICO — cache muito pequeno ou queries muito mutáveis' : '✅ OK'}`);
        log(`  Recomendação: ${prune_ratio > 0.5 ? 'DESATIVAR query_cache (query_cache_type=0) — thrashing prejudica writes' : 'Aumentar query_cache_size para 128MB'}`);

        // =====================================================================
        // BLOCO 5: EXPLAIN nas queries mais pesadas
        // =====================================================================
        log('\n>> BLOCO 5: EXPLAIN nas queries críticas...');

        const explains = [
            {
                name: 'Histórico por OP (GET /historico)',
                sql: `SELECT id, op_numero, operacao_codigo, usuario, data_alteracao, mudou_de, mudou_para, origem 
                      FROM app_pcp_historico_revisao ORDER BY data_alteracao DESC LIMIT 200`
            },
            {
                name: 'Planning por op_numero IN chunk',
                sql: `SELECT op_numero, op_item, op_sequencia, operacao_codigo, data_planejada_inicio, data_planejada_fim 
                      FROM app_production_planning WHERE op_numero IN ('000001','000002','000003')`
            },
        ];

        for (const ex of explains) {
            try {
                const [rows] = await conn.query(`EXPLAIN ${ex.sql}`);
                log(`\n  EXPLAIN: ${ex.name}`);
                rows.forEach(r => {
                    const issues = [];
                    if (r.type === 'ALL') issues.push('⚠️  FULL TABLE SCAN');
                    if (!r.key) issues.push('⚠️  SEM ÍNDICE');
                    if (r.Extra?.includes('filesort')) issues.push('⚠️  FILESORT (ORDER BY sem índice)');
                    if (r.Extra?.includes('temporary')) issues.push('⚠️  TMP TABLE');
                    log(`    table=${r.table} | type=${r.type} | key=${r.key||'NULL'} | rows=${r.rows} | Extra=${r.Extra||'-'} ${issues.join(' ')}`);
                });
            } catch (e) {
                log(`  ❌ EXPLAIN falhou: ${e.message}`);
            }
        }

        log('\n✅ DBA Optimization Script concluído.');

    } finally {
        conn.release();
        process.exit(0);
    }
}

runDBAOptimizations().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
