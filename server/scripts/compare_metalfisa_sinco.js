const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function compareTables() {
    // 1. Conexão READ-ONLY com Metalfisa (APENAS para listar tabelas e ler CREATE TABLE)
    const connMetalfisa = await mysql.createConnection({
        host: '193.203.175.68',
        user: 'u494795077_Metalfisa',
        password: '10207597Rdv*',
        database: 'u494795077_Metalfisa',
        dateStrings: true
    });

    // 2. Conexão com SINCO
    const connSinco = await mysql.createConnection({
        host: '193.203.175.68',
        user: 'u494795077_sinco',
        password: 'Sinco2026!*',
        database: 'u494795077_SINCO',
        dateStrings: true
    });

    try {
        const [metaTablesRows] = await connMetalfisa.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
        const metaTables = metaTablesRows.map(r => Object.values(r)[0]);

        const [sincoTablesRows] = await connSinco.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
        const sincoTables = new Set(sincoTablesRows.map(r => Object.values(r)[0]));

        console.log(`Total tabelas BASE no Metalfisa (referência): ${metaTables.length}`);
        console.log(`Total tabelas BASE no SINCO (atual): ${sincoTables.size}`);

        const missingInSinco = metaTables.filter(t => !sincoTables.has(t));
        console.log(`\nTabelas existentes no Metalfisa mas AUSENTES no SINCO: ${missingInSinco.length}`);

        // Agora vamos verificar quais dessas tabelas ausentes são realmente chamadas nas rotas ativas do server
        const routesDir = path.join(__dirname, '..', 'routes');
        const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
        
        let allCode = '';
        for (const f of routeFiles) {
            allCode += fs.readFileSync(path.join(routesDir, f), 'utf8') + '\n';
        }

        const actuallyUsedMissing = [];
        const unusedMissing = [];

        for (const t of missingInSinco) {
            // regex simples para procurar pelo nome da tabela
            const regex = new RegExp(`\\b${t}\\b`, 'i');
            if (regex.test(allCode)) {
                actuallyUsedMissing.push(t);
            } else {
                unusedMissing.push(t);
            }
        }

        console.log('\n--- TABELAS QUE FALTAM NO SINCO E SÃO USADAS NO CÓDIGO DO APP ---');
        console.log(actuallyUsedMissing);

        console.log('\n--- TABELAS QUE FALTAM NO SINCO MAS NÃO SÃO USADAS NAS ROTAS DO APP ---');
        console.log(unusedMissing);

        // Salvar relatório para análise
        fs.writeFileSync(
            path.join(__dirname, '..', '..', 'scratch', 'tables_comparison_report.json'),
            JSON.stringify({
                totalMetalfisa: metaTables.length,
                totalSinco: sincoTables.size,
                missingInSinco,
                actuallyUsedMissing,
                unusedMissing
            }, null, 2)
        );

    } finally {
        await connMetalfisa.end();
        await connSinco.end();
    }
}

compareTables().catch(console.error);
