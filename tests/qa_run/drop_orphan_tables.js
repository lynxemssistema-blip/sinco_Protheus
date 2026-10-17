const fs = require('fs');
const path = require('path');
const db = require('../../server/services/mysqlService');

const tables = [
    'app_demanda_vmi',
    'app_demanda_vmi_datas',
    'app_demanda_vmi_entregas_log',
    'app_demanda_vmi_lotes',
    'app_demanda_vmi_map',
    'app_demanda_vmi_pedidos_cache',
    'app_vmi_criticos_itens',
    'app_vmi_criticos_versoes',
    'app_vmi_oc_itens',
    'app_vmi_oc_lotes',
    'app_vmi_pedidos',
    'app_vmi_pedidos_lotes',
    'app_wabtec_bom',
    'app_wabtec_escopos',
    'app_wabtec_estruturas',
    'app_wabtec_imported_rows',
    'app_wabtec_imports',
    'app_wabtec_lotes',
    'app_wabtec_solicitacoes_compras',
    'vmi_itens',
    'vmi_itens_pedidos',
    'vmi_leituras'
];

async function run() {
    console.log('📦 [1/3] Iniciando backup DDL das 22 tabelas órfãs VMI / Wabtec...');
    const backupDir = path.resolve(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupFile = path.join(backupDir, 'backup_tabelas_orfas_vmi_wabtec.sql');

    let sqlDump = `-- BACKUP DDL - TABELAS ÓRFÃS DESCONTINUADAS (VMI / WABTEC)\n`;
    sqlDump += `-- Data: ${new Date().toISOString()}\n`;
    sqlDump += `-- Banco: u494795077_SINCO (Hostinger)\n\n`;

    for (const tbl of tables) {
        try {
            const [rows] = await db.query(`SHOW CREATE TABLE \`${tbl}\``);
            if (rows.length > 0) {
                const createSql = rows[0]['Create Table'];
                sqlDump += `DROP TABLE IF EXISTS \`${tbl}\`;\n`;
                sqlDump += `${createSql};\n\n`;
                console.log(`   💾 DDL extraído com sucesso: ${tbl}`);
            }
        } catch (e) {
            console.warn(`   ⚠️ Tabela ${tbl} não localizada ou já removida:`, e.message);
        }
    }

    fs.writeFileSync(backupFile, sqlDump, 'utf8');
    console.log(`✅ Backup DDL salvo com sucesso em: ${backupFile}\n`);

    console.log('🗑️ [2/3] Executando DROP TABLE nas tabelas órfãs...');
    for (const tbl of tables) {
        try {
            await db.query(`DROP TABLE IF EXISTS \`${tbl}\``);
            console.log(`   ✅ Tabela eliminada: ${tbl}`);
        } catch (e) {
            console.error(`   ❌ Falha ao eliminar ${tbl}:`, e.message);
        }
    }

    console.log('\n🔍 [3/3] Verificando se restou alguma tabela órfã no MySQL...');
    const [remaining] = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'u494795077_SINCO' 
          AND (table_name LIKE '%vmi%' OR table_name LIKE '%wabtec%')
    `);

    if (remaining.length === 0) {
        console.log('🎉 SUCESSO ABSOLUTO! 0 tabelas órfãs restantes em u494795077_SINCO.');
    } else {
        console.warn(`⚠️ Atenção: ${remaining.length} tabelas ainda encontradas:`, remaining.map(r => r.table_name));
    }

    process.exit(0);
}

run().catch(err => {
    console.error('Erro na execução:', err);
    process.exit(1);
});
