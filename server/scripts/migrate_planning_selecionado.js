/**
 * MIGRAÇÃO: Persistir seleção (ativo/inativo) de recurso no Planejamento Sequencial
 * - Adiciona coluna selecionado em app_production_planning
 *
 * Contexto: no modal de Planejamento Sequencial (ProductionMacroModal), cada
 * recurso tem um checkbox que marca se ele participa do cálculo da cascata
 * (equivalente a "ativo" para aquele planejamento). Hoje esse estado é sempre
 * resetado para marcado ao reabrir o modal — não é lembrado. Com esta coluna,
 * o estado do checkbox fica salvo junto com a operação.
 *
 * Execução: node server/scripts/migrate_planning_selecionado.js
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
    console.log('\n🚀 Iniciando migração — selecionado em app_production_planning\n');

    try {
        await addColumnSafe(conn, 'app_production_planning', 'selecionado',
            `TINYINT(1) NULL DEFAULT 1 COMMENT 'Se o recurso está marcado/ativo no Planejamento Sequencial (checkbox). NULL = nunca definido, tratar como ativo.'`);

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
