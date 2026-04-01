const fs = require('fs');
const path = require('path');
const db = require('../services/mysqlService');

const TARGET_DIRS = [
    path.join(__dirname, '..', 'routes'),
    path.join(__dirname, '..', 'services')
];

// Padrões de tabelas do Protheus comuns na MetalFisa
// SC2, SC5, SC6, SB1, SCJ, SF2, SD3, SD1, SG1, SG2, etc.
const TABLE_PATTERN = /\b(SC[1-9]|SB[0-9]|SD[1-9]|SF[1-9]|SG[1-9]|SH[1-9]|SZ[0-9])010\b/i;
// Regex muito básica para pegar blocos com SELECT/UPDATE/INSERT seguido por tabelas de 6 chars.
// Vamos extrair todas as chamadas db.query( ... ) ou const query = \`...\`;
const QUERY_REGEX = /(?:db\.query\s*\(\s*|const\s+\w+\s*=\s*)([`'"])([\s\S]*?)(SELECT|UPDATE|INSERT|DELETE|EXEC)[\s\S]*?\1/gi;

async function extractSqls() {
    let extractedCount = 0;

    for (const dir of TARGET_DIRS) {
        if (!fs.existsSync(dir)) continue;

        const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
        for (const file of files) {
            const filePath = path.join(dir, file);
            const content = fs.readFileSync(filePath, 'utf-8');

            // Find all backtick/quote strings that have SQL keywords
            let match;
            while ((match = QUERY_REGEX.exec(content)) !== null) {
                const fullString = match[2] + match[3] + content.slice(match.index + match[0].length).split(match[1])[0];
                
                // Extra verification: does it actually look like a protheus query? (mentions SC2010, SB1010...)
                if (TABLE_PATTERN.test(fullString) && fullString.trim().length > 20) {
                    const cleanSql = fullString.trim();
                    const relativePath = path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/');
                    
                    try {
                        await db.execute(
                            `INSERT INTO app_protheus_query_catalog (file_source, sql_content, description) VALUES (?, ?, ?)`,
                            [relativePath, cleanSql, 'Extraído automaticamente do código fonte Backend Node.js.']
                        );
                        extractedCount++;
                    } catch (e) {
                        console.error('Erro salvando sql de', relativePath, e.message);
                    }
                }
            }
        }
    }

    console.log(`✅ Extração concluída! Foram mapeadas e extraídas ${extractedCount} consultas no banco de dados Protheus.`);
    process.exit(0);
}

extractSqls().catch(e => {
    console.error('Falha geral:', e);
    process.exit(1);
});
