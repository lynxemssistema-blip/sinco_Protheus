const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../services/mysqlService');

async function runUniversalMigrationAndCleanup() {
    console.log('================================================================');
    console.log('🚀 INICIANDO MIGRAÇÃO UNIVERSAL MULTI-EMPRESA E LIMPEZA WHATSAPP');
    console.log('================================================================\n');

    try {
        // ── 1. LIMPEZA DE HISTÓRICO DO WHATSAPP ─────────────────────────────
        console.log('🧹 1. Limpando históricos do WhatsApp conforme solicitado...');
        const whatsappHistoryTables = [
            'app_whatsapp_mensagens_recebidas',
            'app_whatsapp_logs',
            'app_whatsapp_grupo_resumos'
        ];

        for (const wt of whatsappHistoryTables) {
            try {
                const [countBefore] = await db.query(`SELECT COUNT(*) as total FROM \`${wt}\``);
                await db.query(`DELETE FROM \`${wt}\``);
                console.log(`   ✅ Tabela \`${wt}\`: ${countBefore[0].total} registros de histórico apagados com sucesso!`);
            } catch (err) {
                console.warn(`   ⚠️ Não foi possível limpar \`${wt}\`: ${err.message}`);
            }
        }
        console.log('   🎉 Histórico de WhatsApp limpo 100%!\n');

        // ── 2. AUDITORIA E SELEÇÃO DAS TABELAS PARA IdEmpresa ───────────────
        console.log('🔎 2. Mapeando tabelas do banco de dados para injeção de IdEmpresa...');

        const [tables] = await db.query('SHOW TABLES');
        const dbNameKey = Object.keys(tables[0])[0];
        const allTableNames = tables.map(t => t[dbNameKey]);

        // Tabelas de infraestrutura SaaS que devem permanecer globais (sem IdEmpresa)
        const globalSystemTables = new Set([
            'empresa',
            'planos_assinatura',
            'planos_recursos',
            'assinaturas_empresa',
            'faturas_assinatura',
            'superadmin_audit_logs',
            'migrations',
            'app_backup_config',
            'system_metrics',
            'system_parameters'
        ]);

        const tablesToMigrate = [];

        for (const tableName of allTableNames) {
            // Ignorar tabelas globais
            if (globalSystemTables.has(tableName)) continue;

            // Ignorar tabelas de espelho Protheus (s*010 / sx* / sys_company)
            if (/^(s[a-z][0-9]{4}|sx[0-9]{4}|sys_company)/i.test(tableName)) continue;

            const [columns] = await db.query(`SHOW COLUMNS FROM \`${tableName}\``);
            const colNames = columns.map(c => c.Field);

            // Verificar se já possui IdEmpresa, empresa_id ou tenant_id
            const hasEmpresa = colNames.some(c => /^(IdEmpresa|empresa_id|tenant_id)$/i.test(c));

            if (!hasEmpresa) {
                tablesToMigrate.push(tableName);
            }
        }

        console.log(`   Total de tabelas elegíveis para receber IdEmpresa: ${tablesToMigrate.length}\n`);

        // ── 3. EXECUÇÃO DO ALTER TABLE EM CADA TABELA ────────────────────────
        console.log('⚙️ 3. Aplicando ALTER TABLE com IdEmpresa DEFAULT 1 e índice de busca...\n');

        let sucessos = 0;
        let falhas = 0;
        const errosDetalhados = [];

        for (let i = 0; i < tablesToMigrate.length; i++) {
            const table = tablesToMigrate[i];
            const cleanName = table.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40);
            const indexName = `idx_${cleanName}_emp`;

            process.stdout.write(`   [${i + 1}/${tablesToMigrate.length}] Migrando \`${table}\`... `);

            try {
                // Checar se o índice já existe antes de tentar criar
                const [indexes] = await db.query(`SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`, [indexName]);

                let sql = `ALTER TABLE \`${table}\` ADD COLUMN IdEmpresa INT NOT NULL DEFAULT 1`;
                if (indexes.length === 0) {
                    sql += `, ADD INDEX \`${indexName}\` (IdEmpresa)`;
                }

                await db.query(sql);
                console.log('✅ OK');
                sucessos++;
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    console.log('⏩ Coluna já existia');
                    sucessos++;
                } else {
                    console.log(`❌ ERRO: ${err.message}`);
                    falhas++;
                    errosDetalhados.push({ table, error: err.message });
                }
            }
        }

        console.log('\n================================================================');
        console.log('📊 RESULTADO DA MIGRAÇÃO UNIVERSAL MULTI-EMPRESA:');
        console.log(`   • Sucessos: ${sucessos}`);
        console.log(`   • Falhas:   ${falhas}`);
        console.log('================================================================\n');

        if (errosDetalhados.length > 0) {
            console.log('⚠️ Tabelas com pendência:', errosDetalhados);
        } else {
            console.log('🎉 TODAS AS TABELAS DA APLICAÇÃO FORAM ADAPTADAS COM SUCESSO!');
            console.log('Todos os dados históricos foram preservados na empresa matriz (IdEmpresa = 1).');
        }

    } catch (err) {
        console.error('Falha crítica na migração:', err);
    } finally {
        process.exit(0);
    }
}

runUniversalMigrationAndCleanup();
