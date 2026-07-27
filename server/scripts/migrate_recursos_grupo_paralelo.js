/**
 * MIGRAÇÃO: Grupo Paralelo de Recursos
 * - Adiciona coluna grupo_paralelo em app_recursos_capacidade
 *
 * Contexto: tela de configuração (Configurações → PCP Refinado → Capacidade
 * de Recursos) passa a permitir marcar recursos que devem SEMPRE compartilhar
 * a mesma janela de datas no Planejamento Sequencial (equivalente ao botão
 * "unir" do modal, só que pré-configurado uma vez em vez de aplicado
 * manualmente a cada OP). Recursos com o mesmo grupo_paralelo (não nulo) e
 * adjacentes na sequência são automaticamente unidos ao abrir o modal.
 *
 * Execução: node server/scripts/migrate_recursos_grupo_paralelo.js
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
    console.log('\n🚀 Iniciando migração — grupo_paralelo em app_recursos_capacidade\n');

    try {
        await addColumnSafe(conn, 'app_recursos_capacidade', 'grupo_paralelo',
            `VARCHAR(50) NULL COMMENT 'Nome do grupo de recursos que compartilham a mesma janela de datas no Planejamento Sequencial (auto-unir)'`);

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
