/**
 * MIGRAÇÃO: Planejamento Sequencial v2
 * - Adiciona colunas de auditoria em app_production_planning
 * - Cria tabela app_planning_history (histórico imutável de versões)
 *
 * Execução: node server/migrate_planning_v2.js
 * Seguro para rodar mais de uma vez (idempotente).
 */

const pool = require('./services/mysqlService');
require('dotenv').config();

// Helper: tenta adicionar coluna, ignora se já existe
async function addColumnSafe(conn, table, column, definition) {
    try {
        await conn.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`  ✅ Coluna ${column} adicionada em ${table}`);
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log(`  ⚠️  Coluna ${column} já existe em ${table} — ignorando`);
        } else {
            throw e;
        }
    }
}

// Helper: tenta adicionar índice, ignora se já existe
async function addIndexSafe(conn, table, indexName, definition) {
    try {
        await conn.execute(`ALTER TABLE ${table} ADD INDEX ${indexName} (${definition})`);
        console.log(`  ✅ Índice ${indexName} adicionado em ${table}`);
    } catch (e) {
        if (e.code === 'ER_DUP_KEYNAME') {
            console.log(`  ⚠️  Índice ${indexName} já existe em ${table} — ignorando`);
        } else {
            throw e;
        }
    }
}

async function runMigration() {
    const conn = await pool.getConnection();
    console.log('\n🚀 Iniciando migração v2 — Planejamento Sequencial\n');

    try {
        await conn.beginTransaction();

        // ─────────────────────────────────────────────────────────────────
        // STEP 1: Adicionar colunas de auditoria em app_production_planning
        // ─────────────────────────────────────────────────────────────────
        console.log('📋 STEP 1: Alterando tabela app_production_planning...');

        // lote_id pode já existir (adicionado pelo update_db.js anterior)
        await addColumnSafe(conn, 'app_production_planning', 'lote_id',
            `VARCHAR(80) NULL COMMENT 'ID do lote de planejamento gerado no backend'`);

        await addColumnSafe(conn, 'app_production_planning', 'usuario_planejador',
            `VARCHAR(100) NULL COMMENT 'Login do usuário que realizou o planejamento'`);

        await addColumnSafe(conn, 'app_production_planning', 'observacao_lote',
            `TEXT NULL COMMENT 'Observação livre informada ao confirmar o salvamento'`);

        await addColumnSafe(conn, 'app_production_planning', 'duracao_dias',
            `INT NULL COMMENT 'Duração em dias configurada no modal no momento do salvamento'`);

        await addColumnSafe(conn, 'app_production_planning', 'modo_calculo',
            `ENUM('backward','forward') NULL COMMENT 'Direção do cálculo: backward=regressivo, forward=progressivo'`);

        await addColumnSafe(conn, 'app_production_planning', 'criado_em',
            `DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp de criação do registro'`);

        // Índices adicionais para consultas de auditoria
        await addIndexSafe(conn, 'app_production_planning', 'idx_lote_id', 'lote_id');
        await addIndexSafe(conn, 'app_production_planning', 'idx_usuario_plan', 'usuario_planejador');
        await addIndexSafe(conn, 'app_production_planning', 'idx_criado_em', 'criado_em');

        // ─────────────────────────────────────────────────────────────────
        // STEP 2: Criar tabela app_planning_history (histórico imutável)
        // ─────────────────────────────────────────────────────────────────
        console.log('\n📋 STEP 2: Criando tabela app_planning_history...');

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS app_planning_history (
                id                  INT AUTO_INCREMENT PRIMARY KEY,
                lote_id             VARCHAR(80) NOT NULL         COMMENT 'ID do lote (agrupa todas as operações de um salvamento)',
                op_numero           VARCHAR(20) NOT NULL          COMMENT 'Número da OP',
                op_item             VARCHAR(10) NOT NULL          COMMENT 'Item da OP',
                op_sequencia        VARCHAR(10) NOT NULL          COMMENT 'Sequência da operação',
                operacao_codigo     VARCHAR(10) NOT NULL          COMMENT 'Código da operação/recurso',
                recurso_code        VARCHAR(30) NULL              COMMENT 'Código do recurso (CT) agrupador',
                recurso_desc        VARCHAR(200) NULL             COMMENT 'Descrição do recurso/operação',
                data_inicio         DATETIME NOT NULL             COMMENT 'Data/hora de início planejada',
                data_fim            DATETIME NOT NULL             COMMENT 'Data/hora de fim planejada',
                duracao_dias        INT NULL                      COMMENT 'Duração configurada em dias',
                modo_calculo        ENUM('backward','forward') NULL COMMENT 'Direção do cálculo aplicada',
                usuario_planejador  VARCHAR(100) NULL             COMMENT 'Login do usuário responsável',
                observacao          TEXT NULL                     COMMENT 'Observação livre do planejador',
                criado_em           DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp imutável de criação',

                INDEX idx_hist_op       (op_numero),
                INDEX idx_hist_lote     (lote_id),
                INDEX idx_hist_usuario  (usuario_planejador),
                INDEX idx_hist_data     (criado_em),
                INDEX idx_hist_op_lote  (op_numero, lote_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
              COMMENT='Histórico imutável de versões de planejamento sequencial por lote'
        `);
        console.log('  ✅ Tabela app_planning_history criada (ou já existia)');

        // ─────────────────────────────────────────────────────────────────
        // STEP 3: Popular lote_id nos registros existentes sem lote
        // ─────────────────────────────────────────────────────────────────
        console.log('\n📋 STEP 3: Corrigindo registros antigos sem lote_id...');
        const [nullLotes] = await conn.execute(
            `SELECT COUNT(*) as total FROM app_production_planning WHERE lote_id IS NULL OR lote_id = ''`
        );
        const semLote = nullLotes[0].total;
        if (semLote > 0) {
            await conn.execute(`
                UPDATE app_production_planning
                SET lote_id = CONCAT('LOTE-MIGRADO-', op_numero),
                    usuario_planejador = 'sistema_migracao',
                    criado_em = COALESCE(updated_at, NOW())
                WHERE lote_id IS NULL OR lote_id = ''
            `);
            console.log(`  ✅ ${semLote} registros antigos atualizados com lote_id de migração`);
        } else {
            console.log('  ✅ Nenhum registro sem lote_id encontrado');
        }

        await conn.commit();
        console.log('\n✅ Migração v2 concluída com sucesso!\n');

    } catch (err) {
        await conn.rollback();
        console.error('\n❌ ERRO na migração — rollback realizado:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        conn.release();
        process.exit(0);
    }
}

runMigration();
