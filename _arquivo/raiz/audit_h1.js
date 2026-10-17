/**
 * Audit script: find all occurrences of h1_descri / h1.h1_descri
 * and check if each SQL block has the corresponding LEFT JOIN sh1010 h1
 */
const fs = require('fs');
const path = require('path');

const SERVER_DIR = path.join(__dirname, 'server');
const ISSUES = [];
const OK = [];

function getAllJsFiles(dir) {
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) results.push(...getAllJsFiles(full));
        else if (entry.name.endsWith('.js')) results.push(full);
    }
    return results;
}

const files = getAllJsFiles(SERVER_DIR);

for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const relPath = path.relative(SERVER_DIR, file);

    // Find all backtick SQL blocks that contain h1_descri
    // We extract template literal strings (between backticks)
    const sqlBlockRegex = /`([^`]+)`/g;
    let match;
    let blockNum = 0;

    while ((match = sqlBlockRegex.exec(content)) !== null) {
        const block = match[1];
        blockNum++;

        const hasH1Descri = /h1_descri/i.test(block);
        const hasH1DotDescri = /h1\.h1_descri/i.test(block);
        const hasBareH1Descri = /(?<!\w)h1_descri/i.test(block) && !hasH1DotDescri;

        if (!hasH1Descri) continue;

        const hasJoinSh1010 = /JOIN public\.sh1010\s+h1\b|JOIN public\.sh1010 h1\b|LEFT JOIN sh1010 h1\b/i.test(block);
        const hasJoinSh1010AsOther = /JOIN public\.sh1010\s+(\w+)/i.exec(block);
        const hasFromSh1010 = /FROM.*sh1010/i.test(block);

        // Get line number (approximate)
        const start = match.index;
        const lineNum = content.substring(0, start).split('\n').length;

        if (hasBareH1Descri) {
            ISSUES.push({
                file: relPath,
                line: lineNum,
                type: 'BARE_H1_DESCRI',
                msg: 'Uses bare h1_descri (no table alias)',
                snippet: block.substring(0, 200).replace(/\n/g, ' ').trim()
            });
        } else if (hasH1DotDescri && !hasJoinSh1010 && !hasFromSh1010) {
            // Check if the join might be in a surrounding context (non-template-literal part)
            // Look within ±2000 chars of surrounding code
            const surrounding = content.substring(Math.max(0, match.index - 500), match.index + match[0].length + 200);
            const surroundHasJoin = /JOIN.*sh1010.*h1\b/i.test(surrounding);
            
            if (!surroundHasJoin) {
                ISSUES.push({
                    file: relPath,
                    line: lineNum,
                    type: 'MISSING_JOIN',
                    msg: 'Uses h1.h1_descri but no JOIN sh1010 h1 found in block',
                    snippet: block.substring(0, 200).replace(/\n/g, ' ').trim()
                });
            } else {
                OK.push({ file: relPath, line: lineNum, note: 'h1.h1_descri with JOIN in surrounding context' });
            }
        } else if (hasJoinSh1010) {
            // Check alias mismatch
            const aliasMatch = hasJoinSh1010AsOther;
            const usedAlias = aliasMatch ? aliasMatch[1] : 'h1';
            if (hasH1DotDescri && usedAlias !== 'h1') {
                ISSUES.push({
                    file: relPath,
                    line: lineNum,
                    type: 'ALIAS_MISMATCH',
                    msg: `JOIN uses alias "${usedAlias}" but code references h1.h1_descri`,
                    snippet: block.substring(0, 200).replace(/\n/g, ' ').trim()
                });
            } else {
                OK.push({ file: relPath, line: lineNum, note: `OK - JOIN sh1010 h1 found with h1_descri` });
            }
        }
    }
}

console.log('\n========================================');
console.log('  AUDIT RESULT: h1_descri Usage Check ');
console.log('========================================\n');

if (ISSUES.length === 0) {
    console.log('✅ NO ISSUES FOUND - All h1_descri references have proper JOINs!\n');
} else {
    console.log(`❌ FOUND ${ISSUES.length} ISSUES:\n`);
    for (const issue of ISSUES) {
        console.log(`  [${issue.type}] ${issue.file}:${issue.line}`);
        console.log(`    → ${issue.msg}`);
        console.log(`    Snippet: ${issue.snippet.substring(0, 120)}...`);
        console.log();
    }
}

console.log(`✅ ${OK.length} OK references found across ${files.length} files scanned.\n`);
