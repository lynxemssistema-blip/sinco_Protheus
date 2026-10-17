const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function checkViewsAndCode() {
    const connMetalfisa = await mysql.createConnection({
        host: '193.203.175.68',
        user: 'u494795077_Metalfisa',
        password: '10207597Rdv*',
        database: 'u494795077_Metalfisa',
        dateStrings: true
    });

    const connSinco = await mysql.createConnection({
        host: '193.203.175.68',
        user: 'u494795077_sinco',
        password: 'Sinco2026!*',
        database: 'u494795077_SINCO',
        dateStrings: true
    });

    try {
        const [metaViewsRows] = await connMetalfisa.query("SHOW FULL TABLES WHERE Table_type = 'VIEW'");
        const metaViews = metaViewsRows.map(r => Object.values(r)[0]);

        const [sincoViewsRows] = await connSinco.query("SHOW FULL TABLES WHERE Table_type = 'VIEW'");
        const sincoViews = new Set(sincoViewsRows.map(r => Object.values(r)[0]));

        console.log(`Views no Metalfisa: ${metaViews.length}`);
        console.log(`Views no SINCO: ${sincoViews.size}`);

        const missingViews = metaViews.filter(v => !sincoViews.has(v));
        console.log(`Views ausentes no SINCO: ${missingViews.length}`);

        // Scan whole server and client for references to ANY missing tables or views
        const missingObjects = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'scratch', 'tables_comparison_report.json'), 'utf8')).missingInSinco;
        const allMissing = [...missingObjects, ...missingViews];

        // Read all js, jsx, ts, tsx in server/ and client/src/
        function getFiles(dir, exts = ['.js', '.jsx']) {
            let res = [];
            for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                    if (item.name !== 'node_modules' && item.name !== '.git' && item.name !== 'dist' && item.name !== 'build') {
                        res = res.concat(getFiles(fullPath, exts));
                    }
                } else if (exts.some(ext => item.name.endsWith(ext))) {
                    res.push(fullPath);
                }
            }
            return res;
        }

        const serverFiles = getFiles(path.join(__dirname, '..'));
        const clientFiles = getFiles(path.join(__dirname, '..', '..', 'client', 'src'));
        const allFiles = [...serverFiles, ...clientFiles];

        console.log(`Varrendo ${allFiles.length} arquivos de código no server e client/src...`);

        const foundReferences = {};

        for (const file of allFiles) {
            const content = fs.readFileSync(file, 'utf8');
            for (const obj of allMissing) {
                // Procurar referências exatas da palavra
                const regex = new RegExp(`\\b${obj}\\b`, 'i');
                if (regex.test(content)) {
                    // Ignorar os próprios scripts de comparação e migrations antigas
                    if (file.includes('compare_metalfisa') || file.includes('check_dropped_in_code')) continue;
                    if (!foundReferences[obj]) foundReferences[obj] = [];
                    foundReferences[obj].push(path.relative(path.join(__dirname, '..', '..'), file));
                }
            }
        }

        console.log('\n--- OBJETOS AUSENTES QUE SÃO REFERENCIADOS NO SISTEMA ---');
        console.log(JSON.stringify(foundReferences, null, 2));

    } finally {
        await connMetalfisa.end();
        await connSinco.end();
    }
}

checkViewsAndCode().catch(console.error);
