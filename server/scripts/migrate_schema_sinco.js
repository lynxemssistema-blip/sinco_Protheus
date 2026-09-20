const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const srcConfig = {
    host: process.env.MYSQL_HOST || '193.203.175.68',
    user: process.env.MYSQL_USER || 'u494795077_Metalfisa',
    password: process.env.MYSQL_PASS || '10207597Rdv*',
    database: process.env.MYSQL_DB || 'u494795077_Metalfisa',
    dateStrings: true,
    connectTimeout: 20000
};

const destConfig = {
    host: '193.203.175.68',
    user: 'u494795077_sinco',
    password: 'Sinco2026!*',
    database: 'u494795077_SINCO',
    dateStrings: true,
    multipleStatements: true,
    connectTimeout: 20000
};

async function migrateSchema() {
    console.log('🚀 Iniciando migração de estrutura para u494795077_SINCO...');
    console.log(`Origem : ${srcConfig.user}@${srcConfig.host} / ${srcConfig.database}`);
    console.log(`Destino: ${destConfig.user}@${destConfig.host} / ${destConfig.database}\n`);

    const srcConn = await mysql.createConnection(srcConfig);
    const destConn = await mysql.createConnection(destConfig);

    try {
        await destConn.query('SET FOREIGN_KEY_CHECKS=0;');

        // 1. Obter todas as tabelas e views da origem
        const [tables] = await srcConn.query('SHOW FULL TABLES');
        
        const baseTables = [];
        const views = [];

        for (const row of tables) {
            const rowKeys = Object.keys(row);
            const tableName = row[rowKeys[0]];
            const tableType = row['Table_type'];
            if (tableType === 'VIEW') {
                views.push(tableName);
            } else {
                baseTables.push(tableName);
            }
        }

        console.log(`📋 Total encontrado na origem: ${baseTables.length} tabelas base e ${views.length} views.\n`);

        // 2. Criar Tabelas Base (Vazias)
        console.log('📦 --- CRIANDO TABELAS BASE ---');
        let tablesCreated = 0;
        let tablesSkipped = 0;

        for (let i = 0; i < baseTables.length; i++) {
            const table = baseTables[i];
            try {
                const [createRows] = await srcConn.query(`SHOW CREATE TABLE \`${table}\``);
                let createSql = createRows[0]['Create Table'];

                // Remove AUTO_INCREMENT inicial para resetar contador em tabelas vazias
                createSql = createSql.replace(/AUTO_INCREMENT=\d+\s*/gi, '');

                await destConn.query(`DROP TABLE IF EXISTS \`${table}\``);
                await destConn.query(createSql);
                tablesCreated++;
                if ((i + 1) % 25 === 0 || (i + 1) === baseTables.length) {
                    console.log(`  Progresso: [${i + 1}/${baseTables.length}] tabelas criadas.`);
                }
            } catch (err) {
                console.error(`  ❌ Erro ao criar tabela ${table}:`, err.message);
                tablesSkipped++;
            }
        }

        // 3. Criar Views
        console.log('\n👁️ --- CRIANDO VIEWS ---');
        let viewsCreated = 0;
        let viewsSkipped = 0;

        for (let i = 0; i < views.length; i++) {
            const view = views[i];
            try {
                const [createRows] = await srcConn.query(`SHOW CREATE TABLE \`${view}\``);
                let createSql = createRows[0]['Create View'] || createRows[0]['Create Table'];

                // Substitui referências explícitas ao schema antigo pelo novo
                createSql = createSql.replace(/`u494795077_Metalfisa`/gi, '`u494795077_SINCO`');
                createSql = createSql.replace(/u494795077_Metalfisa\./gi, '`u494795077_SINCO`.');

                // Remove DEFINER para que o owner seja o usuário da conexão atual
                createSql = createSql.replace(/ALGORITHM=\w+\s+DEFINER=`[^`]+`@`[^`]+`\s+SQL SECURITY \w+/gi, '');
                createSql = createSql.replace(/DEFINER=`[^`]+`@`[^`]+`/gi, '');

                await destConn.query(`DROP VIEW IF EXISTS \`${view}\``);
                await destConn.query(createSql);
                viewsCreated++;
            } catch (err) {
                console.warn(`  ⚠️ Aviso ao criar view ${view}:`, err.message);
                viewsSkipped++;
            }
        }
        console.log(`  Views criadas: ${viewsCreated} / ${views.length} (com erros/alertas: ${viewsSkipped})`);

        // 4. Criar Usuário Administrador Inicial (sinco / sinco)
        console.log('\n👤 --- CRIANDO USUÁRIO ADMINISTRADOR INICIAL ---');
        const hashedPassword = await bcrypt.hash('sinco', 10);
        
        await destConn.query(`DELETE FROM usuario WHERE Login = 'sinco'`);
        await destConn.query(`
            INSERT INTO usuario (
                NomeCompleto, Login, Senha, TipoUsuario, aprovado, status,
                txtCorte, txtDobra, txtSolda, txtPintura, txtMontagem, txtAlmoxarifado,
                GerenciamentoProducao, VisaoGeralProducao, Comercial, Financeiro, Expedicao,
                DataCadastro
            ) VALUES (
                'Administrador SINCO', 'sinco', ?, 'A', 1, '1',
                '1', '1', '1', '1', '1', '1',
                '1', '1', '1', '1', '1',
                NOW()
            )
        `, [hashedPassword]);
        console.log('✅ Usuário "sinco" criado com sucesso (Senha criptografada bcrypt: "sinco", Perfil: "A", Aprovado: 1).');

        await destConn.query('SET FOREIGN_KEY_CHECKS=1;');

        // 5. Auditoria final
        const [destTables] = await destConn.query('SHOW FULL TABLES');
        console.log(`\n🎉 MIGRAÇÃO CONCLUÍDA! Total de objetos em u494795077_SINCO: ${destTables.length}`);

    } catch (err) {
        console.error('❌ Erro fatal durante a migração:', err);
    } finally {
        await srcConn.end();
        await destConn.end();
    }
}

migrateSchema();
