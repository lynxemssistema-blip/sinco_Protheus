/**
 * MIGRAÇÃO: Ordem de Recurso no Planejamento Sequencial
 * - Adiciona coluna ordem_recurso em app_production_planning
 *
 * Contexto: a ordem em que os recursos aparecem no modal de Planejamento
 * Sequencial (ProductionMacroModal) era guardada apenas como um JSON solto
 * em app_planning_lotes.ordem_recursos, desacoplado da operação em si.
 * Isso fazia a sequência (e, por tabela, as datas recalculadas a partir
 * dela) se perderem sempre que a leitura dessa preferência falhava.
 *
 * Com esta coluna, a posição do recurso na sequência fica amarrada ao
 * próprio registro de planejamento da operação — a mesma linha que já
 * guarda data_planejada_inicio/fim — eliminando essa dependência frágil.
 *
 * Execução: node server/scripts/migrate_planning_ordem_recurso.js
 * Seguro para rodar mais de uma vez (idempotente).
 */

const pool = require('../services/mysqlService');
require('dotenv').config();

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

async function runMigration() {
    const conn = await pool.getConnection();
    console.log('\n🚀 Iniciando migração — ordem_recurso em app_production_planning\n');

    try {
        await addColumnSafe(conn, 'app_production_planning', 'ordem_recurso',
            `INT NULL COMMENT 'Posição do recurso na sequência definida pelo usuário no Planejamento Sequencial'`);

        console.log('\n✅ Migração concluída com sucesso!\n');
    } catch (err) {
        console.error('\n❌ ERRO na migração:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        conn.release();
        process.exit(0);
    }
}

runMigration();
