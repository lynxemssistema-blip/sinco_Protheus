const mysql = require('mysql2/promise');

async function migrateProtheusTables() {
    const conn = await mysql.createConnection({
        host: '193.203.175.68',
        user: 'u494795077_sinco',
        password: 'Sinco2026!*',
        database: 'u494795077_SINCO',
        dateStrings: true
    });

    console.log('⚡ Conectado ao u494795077_SINCO. Iniciando migração multiempresa para as tabelas ERP/Protheus...');

    const tablesToMigrate = [
        'sa1010', 'sa2010', 'sa5010', 
        'sb1010', 'sb1990', 'sb2010', 'sb2990', 'sb5010', 
        'sc1010', 'sc2010', 'sc5010', 'sc6010', 'sc7010', 
        'sd1010', 'sd2010', 'sd3010', 'sd4010', 
        'se2010', 'sf1010', 'sf2010', 'sf4010', 
        'sg1010', 'sg2010', 'sh6010', 
        'sx5010', 'sz0010', 'sz1010', 'sys_company'
    ];

    let success = 0;
    let errors = 0;

    for (const tbl of tablesToMigrate) {
        try {
            // Verificar se já tem a coluna
            const [cols] = await conn.query(`
                SELECT COLUMN_NAME 
                FROM information_schema.columns 
                WHERE TABLE_SCHEMA = 'u494795077_SINCO' 
                  AND TABLE_NAME = ? 
                  AND LOWER(COLUMN_NAME) = 'idempresa'
            `, [tbl]);

            if (cols.length > 0) {
                console.log(`⏩ ${tbl.padEnd(15)} já possui IdEmpresa.`);
                success++;
                continue;
            }

            console.log(`⏳ Alterando ${tbl}...`);
            await conn.query(`
                ALTER TABLE \`${tbl}\` 
                ADD COLUMN \`IdEmpresa\` INT NOT NULL DEFAULT 1,
                ADD INDEX \`idx_${tbl}_emp\` (\`IdEmpresa\`)
            `);
            console.log(`✅ ${tbl.padEnd(15)} migrada com sucesso (IdEmpresa DEFAULT 1 + INDEX).`);
            success++;
        } catch (err) {
            console.error(`❌ Erro em ${tbl}:`, err.message);
            errors++;
        }
    }

    console.log(`\n🎉 Migração ERP Protheus finalizada! Sucessos: ${success}, Erros: ${errors}`);
    await conn.end();
}

migrateProtheusTables().catch(console.error);
