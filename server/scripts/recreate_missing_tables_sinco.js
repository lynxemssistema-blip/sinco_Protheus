const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function recreateTables() {
    const rawDDL = JSON.parse(
        fs.readFileSync(path.join(__dirname, '..', '..', 'scratch', 'missing_tables_original_ddl.json'), 'utf8')
    );

    // Conectar EXCLUSIVAMENTE ao banco SINCO
    const connSinco = await mysql.createConnection({
        host: '193.203.175.68',
        user: 'u494795077_sinco',
        password: 'Sinco2026!*',
        database: 'u494795077_SINCO',
        dateStrings: true
    });

    console.log('⚡ Conectado exclusivamente ao banco u494795077_SINCO.');
    console.log(`Iniciando criação adaptada Multi-Tenant para ${Object.keys(rawDDL).length} tabelas...\n`);

    const results = {
        created: [],
        alreadyExisted: [],
        errors: []
    };

    try {
        for (const [tblName, ddl] of Object.entries(rawDDL)) {
            try {
                // 1. Limpar AUTO_INCREMENT inicial
                let cleanDDL = ddl.replace(/AUTO_INCREMENT=\d+\s*/gi, '');
                
                // 2. Garantir CREATE TABLE IF NOT EXISTS
                cleanDDL = cleanDDL.replace(/^CREATE TABLE\s+`?(\w+)`?/i, 'CREATE TABLE IF NOT EXISTS `$1`');

                // 3. Verificar e injetar IdEmpresa se não existir
                const hasIdEmpresa = /`IdEmpresa`/i.test(cleanDDL);

                if (!hasIdEmpresa) {
                    // Inserir antes da PRIMARY KEY ou fechamento da tabela
                    const pkMatch = cleanDDL.match(/,\s*PRIMARY KEY/i);
                    if (pkMatch) {
                        cleanDDL = cleanDDL.replace(
                            /,\s*PRIMARY KEY/i,
                            ',\n  `IdEmpresa` int(11) NOT NULL DEFAULT 1,\n  KEY `idx_' + tblName.substring(0, 20) + '_emp` (`IdEmpresa`),\n  PRIMARY KEY'
                        );
                    } else {
                        // Se não tiver primary key explícita, insere antes do último parêntese
                        const lastParen = cleanDDL.lastIndexOf(')');
                        cleanDDL = cleanDDL.substring(0, lastParen) + 
                            ',\n  `IdEmpresa` int(11) NOT NULL DEFAULT 1,\n  KEY `idx_' + tblName.substring(0, 20) + '_emp` (`IdEmpresa`)\n' + 
                            cleanDDL.substring(lastParen);
                    }
                } else {
                    // Já tem IdEmpresa, garantir índice se não houver
                    if (!/KEY.*`IdEmpresa`/i.test(cleanDDL)) {
                        const pkMatch = cleanDDL.match(/,\s*PRIMARY KEY/i);
                        if (pkMatch) {
                            cleanDDL = cleanDDL.replace(
                                /,\s*PRIMARY KEY/i,
                                ',\n  KEY `idx_' + tblName.substring(0, 20) + '_emp` (`IdEmpresa`),\n  PRIMARY KEY'
                            );
                        }
                    }
                }

                // Executar DDL no SINCO
                await connSinco.query(cleanDDL);
                results.created.push(tblName);
                console.log(`✅ [SINCO] Tabela ${tblName.padEnd(35)} criada/garantida com Multiempresa (IdEmpresa).`);

            } catch (err) {
                console.error(`❌ [SINCO] Erro ao criar ${tblName}:`, err.message);
                results.errors.push({ table: tblName, error: err.message });
            }
        }

        console.log(`\n🎉 Processamento concluído!`);
        console.log(`Total criadas/garantidas no SINCO: ${results.created.length}`);
        console.log(`Total erros: ${results.errors.length}`);

        fs.writeFileSync(
            path.join(__dirname, '..', '..', 'scratch', 'recreate_tables_results.json'),
            JSON.stringify(results, null, 2)
        );

    } finally {
        await connSinco.end();
    }
}

recreateTables().catch(console.error);
