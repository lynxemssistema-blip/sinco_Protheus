/**
 * grant_mysql_permissions.js
 * Concede permissões INSERT/UPDATE/DELETE ao usuário ronaldo2
 * nas tabelas app_* do banco metalfisa (UOL Host)
 *
 * ATENÇÃO: Este script deve ser executado com um usuário que tenha
 * privilégios de GRANT (ex: root ou usuário admin do banco).
 * 
 * Uso: Conectar via painel UOL / phpMyAdmin e executar os GRANTs abaixo,
 *      OU rodar com credenciais de admin se disponíveis.
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

// ⚠️ Substitua pelas credenciais de ADMIN do banco UOL se disponível
// (não são as mesmas que ronaldo2 — precisa de um usuário com GRANT OPTION)
const ADMIN_CONFIG = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_ADMIN_USER || process.env.MYSQL_USER, // tente com ronaldo2 primeiro
    password: process.env.MYSQL_ADMIN_PASS || process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB || 'metalfisa',
    port: 3306,
};

const TARGET_USER = process.env.MYSQL_USER;
const TARGET_HOST = '%'; // ou '10.129.62.39' se quiser restringir

async function grantPermissions() {
    let conn;
    try {
        console.log(`🔗 Conectando ao MySQL como: ${ADMIN_CONFIG.user}@${ADMIN_CONFIG.host}`);
        conn = await mysql.createConnection(ADMIN_CONFIG);

        // Verifica permissões atuais do usuário
        const [currentGrants] = await conn.query(`SHOW GRANTS FOR '${TARGET_USER}'@'${TARGET_HOST}'`);
        console.log('\n📋 Permissões atuais do usuário:');
        currentGrants.forEach(row => console.log(' ', Object.values(row)[0]));

        // Lista de tabelas que precisam de acesso de escrita
        const tables = [
            'app_production_appointments',
            'app_production_planning',
            'app_company_settings',
        ];

        console.log('\n🔧 Concedendo permissões...');
        for (const table of tables) {
            try {
                await conn.query(
                    `GRANT SELECT, INSERT, UPDATE, DELETE ON \`${ADMIN_CONFIG.database}\`.\`${table}\` TO '${TARGET_USER}'@'${TARGET_HOST}'`
                );
                console.log(`  ✅ GRANT concedido em: ${table}`);
            } catch (err) {
                console.warn(`  ⚠️ Erro ao conceder em ${table}: ${err.message}`);
            }
        }

        await conn.query('FLUSH PRIVILEGES');
        console.log('\n✅ FLUSH PRIVILEGES executado com sucesso.');

        // Verifica novamente após o grant
        const [newGrants] = await conn.query(`SHOW GRANTS FOR '${TARGET_USER}'@'${TARGET_HOST}'`);
        console.log('\n📋 Permissões ATUALIZADAS do usuário:');
        newGrants.forEach(row => console.log(' ', Object.values(row)[0]));

    } catch (err) {
        if (err.message.includes('Access denied') || err.message.includes('GRANT OPTION')) {
            console.error('\n❌ ERRO DE PERMISSÃO:', err.message);
            console.error('\n💡 O usuário ronaldo2 não tem GRANT OPTION.');
            console.error('   Você precisa executar os seguintes comandos SQL via painel admin do UOL:');
            console.error('');
            console.error('   GRANT SELECT, INSERT, UPDATE, DELETE ON `metalfisa`.`app_production_appointments` TO \'ronaldo2\'@\'%\';');
            console.error('   GRANT SELECT, INSERT, UPDATE, DELETE ON `metalfisa`.`app_production_planning` TO \'ronaldo2\'@\'%\';');
            console.error('   GRANT SELECT, INSERT, UPDATE, DELETE ON `metalfisa`.`app_company_settings` TO \'ronaldo2\'@\'%\';');
            console.error('   FLUSH PRIVILEGES;');
        } else {
            console.error('❌ Erro:', err.message);
        }
    } finally {
        if (conn) await conn.end();
        process.exit(0);
    }
}

grantPermissions();
