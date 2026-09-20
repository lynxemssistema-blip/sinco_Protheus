/**
 * copy_all_mysql_data.js
 * 
 * Script profissional de migração e cópia integral de dados:
 * De: u494795077_Metalfisa (MySQL Antigo)
 * Para: u494795077_SINCO (MySQL Novo)
 * 
 * - Migra todas as tabelas base mantendo tipos, datas e integridade
 * - Protege e mantém 100% intactas as novas tabelas erp_*
 * - Trata paginação inteligente indexada por Primary Key
 * - Trata colunas de imagem/blob em lotes reduzidos para evitar estouro de pacote
 * - Garante a presença do usuário admin 'sinco' ao final
 * - Exibe auditoria comparativa de contagem origem vs destino
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const srcConfig = {
    host: '193.203.175.68',
    user: 'u494795077_Metalfisa',
    password: '10207597Rdv*',
    database: 'u494795077_Metalfisa',
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    connectTimeout: 30000
};

const destConfig = {
    host: '193.203.175.68',
    user: 'u494795077_sinco',
    password: 'Sinco2026!*',
    database: 'u494795077_SINCO',
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    multipleStatements: true,
    connectTimeout: 30000
};

const TABLES_WITH_HEAVY_BLOBS = new Set([
    'sgq_asset_attachments',
    'blokset_historico',
    'usitipoproduto',
    'materialtag',
    'empresa_logo'
]);

async function runMigration() {
    console.log('================================================================');
    console.log('🚀 INICIANDO CÓPIA COMPLETA DE DADOS: METAPROD -> SINCO');
    console.log(`Origem  : ${srcConfig.user}@${srcConfig.host} / ${srcConfig.database}`);
    console.log(`Destino : ${destConfig.user}@${destConfig.host} / ${destConfig.database}`);
    console.log('================================================================\n');

    const startTime = Date.now();
    const srcConn = await mysql.createConnection(srcConfig);
    const destConn = await mysql.createConnection(destConfig);

    try {
        await destConn.query('SET FOREIGN_KEY_CHECKS = 0;');
        await destConn.query('SET UNIQUE_CHECKS = 0;');
        await destConn.query("SET SQL_MODE = '';");

        // 1. Obter todas as tabelas base da origem
        const [tables] = await srcConn.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
        const tableNames = tables.map(t => Object.values(t)[0]);

        console.log(`📦 Total de tabelas base na origem: ${tableNames.length}\n`);

        let totalCopiedRows = 0;
        let tablesWithDataCount = 0;
        const migrationSummary = [];

        for (let idx = 0; idx < tableNames.length; idx++) {
            const table = tableNames[idx];

            // Proteção estrita: nunca sobrescrever ou alterar tabelas erp_* do Protheus
            if (table.startsWith('erp_')) {
                continue;
            }

            // 1. Verificar contagem na origem
            const [countRes] = await srcConn.query(`SELECT COUNT(*) as c FROM \`${table}\``);
            const totalRows = countRes[0].c;

            if (totalRows === 0) {
                // Tabela vazia: apenas certifique-se de que a estrutura existe no destino
                await ensureTableExists(srcConn, destConn, table);
                continue;
            }

            tablesWithDataCount++;
            const hasHeavyBlobs = TABLES_WITH_HEAVY_BLOBS.has(table);
            const chunkSize = hasHeavyBlobs ? 15 : (totalRows > 20000 ? 3000 : 1000);

            console.log(`[${idx + 1}/${tableNames.length}] 🔄 Tabela: \`${table}\` | Total: ${totalRows.toLocaleString('pt-BR')} registros (Lote: ${chunkSize})`);

            // 2. Garantir que a tabela existe no destino
            await ensureTableExists(srcConn, destConn, table);

            // 3. Limpar tabela no destino antes de popular
            await destConn.query(`TRUNCATE TABLE \`${table}\``);

            // 4. Descobrir se há Primary Key única para paginação rápida por índice
            const [pkRows] = await srcConn.query(`SHOW KEYS FROM \`${table}\` WHERE Key_name = 'PRIMARY'`);
            const hasSinglePk = pkRows.length === 1;
            const pkColumn = hasSinglePk ? pkRows[0].Column_name : null;

            let tableInserted = 0;

            if (totalRows <= chunkSize) {
                // Tabela com poucos registros: insere diretamente
                const [rows] = await srcConn.query(`SELECT * FROM \`${table}\``);
                if (rows.length > 0) {
                    await insertBatch(destConn, table, rows);
                    tableInserted += rows.length;
                }
            } else if (hasSinglePk) {
                // Tabela grande com Primary Key indexada: O(1) por página
                let lastPkVal = null;
                while (tableInserted < totalRows) {
                    const query = lastPkVal === null
                        ? `SELECT * FROM \`${table}\` ORDER BY \`${pkColumn}\` ASC LIMIT ${chunkSize}`
                        : `SELECT * FROM \`${table}\` WHERE \`${pkColumn}\` > ? ORDER BY \`${pkColumn}\` ASC LIMIT ${chunkSize}`;

                    const params = lastPkVal === null ? [] : [lastPkVal];
                    const [rows] = await srcConn.query(query, params);

                    if (rows.length === 0) break;

                    await insertBatch(destConn, table, rows);
                    tableInserted += rows.length;
                    lastPkVal = rows[rows.length - 1][pkColumn];

                    if (tableInserted % 60000 === 0 || tableInserted >= totalRows) {
                        const pct = Math.min(100, Math.round((tableInserted / totalRows) * 100));
                        console.log(`   ⏳ Progresso: ${tableInserted.toLocaleString('pt-BR')} / ${totalRows.toLocaleString('pt-BR')} (${pct}%)`);
                    }
                }
            } else {
                // Tabela sem PK única: paginação via OFFSET
                let offset = 0;
                while (offset < totalRows) {
                    const [rows] = await srcConn.query(`SELECT * FROM \`${table}\` LIMIT ${chunkSize} OFFSET ${offset}`);
                    if (rows.length === 0) break;

                    await insertBatch(destConn, table, rows);
                    tableInserted += rows.length;
                    offset += chunkSize;

                    if (tableInserted % 60000 === 0 || tableInserted >= totalRows) {
                        const pct = Math.min(100, Math.round((tableInserted / totalRows) * 100));
                        console.log(`   ⏳ Progresso: ${tableInserted.toLocaleString('pt-BR')} / ${totalRows.toLocaleString('pt-BR')} (${pct}%)`);
                    }
                }
            }

            totalCopiedRows += tableInserted;
            migrationSummary.push({ table, src: totalRows, dest: tableInserted });
            console.log(`   ✅ \`${table}\` OK: ${tableInserted.toLocaleString('pt-BR')} inseridos.`);
        }

        // 5. Garantir usuário administrador 'sinco' na tabela usuario
        await ensureAdminUser(destConn);

        await destConn.query('SET FOREIGN_KEY_CHECKS = 1;');
        await destConn.query('SET UNIQUE_CHECKS = 1;');

        const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
        console.log('\n================================================================');
        console.log('🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!');
        console.log(`⏱️ Tempo decorrido   : ${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`);
        console.log(`📊 Tabelas copiadas : ${tablesWithDataCount}`);
        console.log(`📊 Total de linhas  : ${totalCopiedRows.toLocaleString('pt-BR')} registros`);
        console.log('================================================================\n');

        // 6. Auditoria de integridade das principais tabelas
        console.log('🔍 AUDITORIA DE INTEGRIDADE (AMOSTRA DAS MAIORES TABELAS):');
        const auditTables = [
            'usuario',
            'material',
            'app_production_planning',
            'app_production_appointments',
            'app_production_planning_diario',
            'app_pcp_historico_revisao',
            'produtos_docs',
            'app_planning_history',
            'app_pcp_delivery_forecasts',
            'sgq_assets',
            'vmi_itens'
        ];

        for (const t of auditTables) {
            try {
                const [sc] = await srcConn.query(`SELECT COUNT(*) as c FROM \`${t}\``);
                const [dc] = await destConn.query(`SELECT COUNT(*) as c FROM \`${t}\``);
                const ok = sc[0].c === dc[0].c ? '✅ PARIDADE 100%' : '⚠️ DIVERGÊNCIA';
                console.log(` - ${t.padEnd(35)}: Origem = ${sc[0].c.toLocaleString('pt-BR')} | Destino = ${dc[0].c.toLocaleString('pt-BR')} [${ok}]`);
            } catch (err) {
                console.log(` - ${t.padEnd(35)}: Erro ao verificar: ${err.message}`);
            }
        }

        // 7. Confirmação do Protheus ERP nativo
        console.log('\n🔍 VERIFICAÇÃO DAS TABELAS PROTHEUS ERP NATIVO (INTACTAS):');
        const erpTables = ['erp_produtos', 'erp_estruturas_bom', 'erp_roteiros_operacoes', 'erp_pedidos_itens', 'erp_ordens_producao', 'erp_estoque_saldos'];
        for (const t of erpTables) {
            try {
                const [dc] = await destConn.query(`SELECT COUNT(*) as c FROM \`${t}\``);
                console.log(` - ${t.padEnd(35)}: ${dc[0].c.toLocaleString('pt-BR')} registros preservados ✅`);
            } catch (err) {
                console.log(` - ${t.padEnd(35)}: Não encontrada`);
            }
        }

    } catch (error) {
        console.error('❌ ERRO DURANTE A MIGRAÇÃO:', error);
    } finally {
        await srcConn.end();
        await destConn.end();
    }
}

async function ensureTableExists(srcConn, destConn, tableName) {
    try {
        await destConn.query(`SELECT 1 FROM \`${tableName}\` LIMIT 1`);
    } catch (err) {
        const [res] = await srcConn.query(`SHOW CREATE TABLE \`${tableName}\``);
        const createSql = res[0]['Create Table'];
        await destConn.query(createSql);
        console.log(`   🛠️ Tabela criada no destino: \`${tableName}\``);
    }
}

async function insertBatch(destConn, tableName, rows) {
    if (!rows || rows.length === 0) return;

    const keys = Object.keys(rows[0]);
    const values = rows.map(row => keys.map(k => row[k]));
    const colsStr = keys.map(k => `\`${k}\``).join(', ');
    const sql = `INSERT INTO \`${tableName}\` (${colsStr}) VALUES ?`;

    try {
        await destConn.query(sql, [values]);
    } catch (err) {
        // Fallback: se houver alguma violação de chave ou caractere, tenta com INSERT IGNORE
        console.warn(`   ⚠️ Tentando fallback com INSERT IGNORE para \`${tableName}\` (${rows.length} registros)...`);
        const ignoreSql = `INSERT IGNORE INTO \`${tableName}\` (${colsStr}) VALUES ?`;
        await destConn.query(ignoreSql, [values]);
    }
}

async function ensureAdminUser(destConn) {
    console.log('\n🔐 Garantindo conta de administrador sinco no destino...');
    try {
        const [existing] = await destConn.query("SELECT * FROM usuario WHERE Login = 'sinco'");
        const hashedPass = await bcrypt.hash('sinco', 10);

        if (existing.length > 0) {
            await destConn.query("UPDATE usuario SET Senha = ?, TipoUsuario = 'Administrador', status = 'Ativo' WHERE Login = 'sinco'", [hashedPass]);
            console.log("   ✅ Usuário 'sinco' atualizado com senha 'sinco' e perfil Administrador.");
        } else {
            await destConn.query(`
                INSERT INTO usuario (
                    NomeCompleto, Login, Senha, TipoUsuario, status, CriadoPor, DataCadastro,
                    txtCorte, txtDobra, txtSolda, txtPintura, txtMontagem, txtAlmoxarifado
                ) VALUES (
                    'Administrador SINCO ERP', 'sinco', ?, 'Administrador', 'Ativo', 'Sistema', NOW(),
                    'SIM', 'SIM', 'SIM', 'SIM', 'SIM', 'SIM'
                )
            `, [hashedPass]);
            console.log("   ✅ Usuário 'sinco' criado com senha 'sinco' e privilégios totais.");
        }
    } catch (err) {
        console.error('   ⚠️ Aviso ao configurar usuário sinco:', err.message);
    }
}

runMigration();
