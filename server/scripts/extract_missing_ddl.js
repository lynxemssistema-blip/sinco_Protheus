const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function extractDDLFromMetalfisa() {
    // Apenas leitura (READ-ONLY) em u494795077_Metalfisa
    const connMetalfisa = await mysql.createConnection({
        host: '193.203.175.68',
        user: 'u494795077_Metalfisa',
        password: '10207597Rdv*',
        database: 'u494795077_Metalfisa',
        dateStrings: true
    });

    try {
        const report = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'scratch', 'tables_comparison_report.json'), 'utf8'));
        const tablesToExtract = report.missingInSinco;

        console.log(`Extraindo DDL de ${tablesToExtract.length} tabelas do Metalfisa (somente leitura)...`);
        
        const ddlMap = {};
        for (const tbl of tablesToExtract) {
            try {
                const [res] = await connMetalfisa.query(`SHOW CREATE TABLE \`${tbl}\``);
                const createSql = res[0]['Create Table'];
                ddlMap[tbl] = createSql;
            } catch (err) {
                console.error(`Erro ao ler DDL de ${tbl}:`, err.message);
            }
        }

        fs.writeFileSync(
            path.join(__dirname, '..', '..', 'scratch', 'missing_tables_original_ddl.json'),
            JSON.stringify(ddlMap, null, 2)
        );
        console.log(`Sucesso: ${Object.keys(ddlMap).length} DDLs originais extraídos para scratch/missing_tables_original_ddl.json.`);

    } finally {
        await connMetalfisa.end();
    }
}

extractDDLFromMetalfisa().catch(console.error);
