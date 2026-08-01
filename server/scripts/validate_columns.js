require('dotenv').config();
/**
 * MetalFisa — Deep SQL Column Validator
 * Extrai todas as colunas referenciadas nas queries SQL dos arquivos de rota
 * e cruza com o schema real do banco MySQL para detectar nomes errados.
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '..', 'routes');

// ─────────────────────────────────────────────────────────────
// 1. Coletar o schema real do banco
// ─────────────────────────────────────────────────────────────
async function getSchema(conn) {
    const [rows] = await conn.query(`
        SELECT TABLE_NAME, COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = 'metalfisa'
        ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);
    const schema = {};
    for (const r of rows) {
        if (!schema[r.TABLE_NAME]) schema[r.TABLE_NAME] = new Set();
        schema[r.TABLE_NAME].add(r.COLUMN_NAME);
    }
    return schema;
}

// ─────────────────────────────────────────────────────────────
// 2. Extrair menções de tabelas MySQL do código JS
// ─────────────────────────────────────────────────────────────
function extractMysqlReferences(content, filename) {
    const refs = [];

    // Pattern: FROM/JOIN table_name or INSERT INTO table_name or UPDATE table_name
    const tablePattern = /(?:FROM|JOIN|INTO|UPDATE)\s+`?(\w+)`?/gi;
    let match;
    while ((match = tablePattern.exec(content)) !== null) {
        refs.push({ table: match[1], line: lineOf(content, match.index), file: filename });
    }
    return refs;
}

// ─────────────────────────────────────────────────────────────
// 3. Extrair colunas explícitas em SELECT, WHERE, SET, etc.
// ─────────────────────────────────────────────────────────────
function extractColumnRefs(content, filename) {
    const refs = [];
    // Find all backtick-quoted or unquoted column refs in SQL context
    // Strategy: extract SQL strings (template literals and regular strings) then parse

    // Match template literal SQL blocks
    const sqlBlocks = [];
    const tplLiteral = /`([\s\S]*?)`/g;
    let m;
    while ((m = tplLiteral.exec(content)) !== null) {
        const block = m[1];
        // Only consider blocks that look like SQL
        if (/SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN/i.test(block)) {
            sqlBlocks.push({ sql: block, startIndex: m.index, file: filename });
        }
    }
    return sqlBlocks;
}

function lineOf(content, index) {
    return content.substring(0, index).split('\n').length;
}

// ─────────────────────────────────────────────────────────────
// 4. Parse SQL block for table→column references
// ─────────────────────────────────────────────────────────────
function parseColumnRefsFromSQL(sql) {
    const result = [];

    // Extract table aliases: FROM table AS alias, JOIN table alias
    const aliasMap = {};
    const aliasPattern = /(?:FROM|JOIN)\s+`?(\w+)`?\s+(?:AS\s+)?`?(\w+)`?/gi;
    let m;
    while ((m = aliasPattern.exec(sql)) !== null) {
        aliasMap[m[2].toLowerCase()] = m[1].toLowerCase();
    }

    // Also map table names directly (no alias)
    const directTablePattern = /(?:FROM|JOIN|UPDATE|INTO)\s+`?(\w+)`?(?:\s+WHERE|\s+SET|\s+\(|\s*$|\s+LIMIT|\s+ORDER|\s+GROUP|\s+LEFT|\s+INNER|\s+RIGHT|\s+ON|\s+AS)?/gi;
    while ((m = directTablePattern.exec(sql)) !== null) {
        const tbl = m[1].toLowerCase();
        if (!Object.values(aliasMap).includes(tbl)) {
            aliasMap[tbl] = tbl;
        }
    }

    // Extract WHERE / SET / ON / SELECT column references: alias.column or just column
    const colPattern = /(\w+)\.(\w+)/g;
    while ((m = colPattern.exec(sql)) !== null) {
        const alias = m[1].toLowerCase();
        const col = m[2];
        // Skip common non-column patterns
        if (['req', 'res', 'err', 'pool', 'mysql', 'rows', 'row', 'conn', 'db', 'pg', 'app', 'io', 'Math', 'Date', 'JSON', 'Object', 'Array', 'String', 'Number', 'process', 'console', 'module', 'exports', 'require', 'router', 'express', 'multer', 'path', 'fs', 'crypto', 'os', 'util', 'http', 'https'].includes(alias)) continue;
        if (['length', 'toLowerCase', 'toUpperCase', 'trim', 'map', 'filter', 'forEach', 'find', 'reduce', 'includes', 'join', 'split', 'replace', 'push', 'pop', 'shift', 'slice', 'toString', 'indexOf', 'prototype', 'constructor', 'then', 'catch', 'finally'].includes(col)) continue;

        const resolvedTable = aliasMap[alias] || alias;
        result.push({ table: resolvedTable, column: col, alias });
    }

    return result;
}

// ─────────────────────────────────────────────────────────────
// 5. Main: analyze all route files
// ─────────────────────────────────────────────────────────────
async function main() {
    const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER, password: process.env.MYSQL_PASS, database: process.env.MYSQL_DB
    });

    console.log('📦 Fetching complete schema...');
    const schema = await getSchema(conn);
    await conn.end();

    const tableNames = new Set(Object.keys(schema));
    console.log(`✅ Schema loaded: ${tableNames.size} tables, ${Object.values(schema).reduce((a, s) => a + s.size, 0)} columns total\n`);

    const routeFiles = fs.readdirSync(ROUTES_DIR)
        .filter(f => f.endsWith('.js'))
        .map(f => path.join(ROUTES_DIR, f));

    const allIssues = [];
    const allSQLBlocks = [];
    const suspiciousColumnIssues = [];

    for (const filepath of routeFiles) {
        const filename = path.basename(filepath);
        const content = fs.readFileSync(filepath, 'utf8');
        const sqlBlocks = extractColumnRefs(content, filename);

        for (const block of sqlBlocks) {
            const refs = parseColumnRefsFromSQL(block.sql);
            for (const ref of refs) {
                const tableKey = Object.keys(schema).find(t => t.toLowerCase() === ref.table.toLowerCase());
                if (!tableKey) continue; // Not a MySQL app table (could be PG table or alias)

                const colSet = schema[tableKey];
                // Case-insensitive column check
                const colExists = [...colSet].some(c => c.toLowerCase() === ref.column.toLowerCase());
                if (!colExists) {
                    suspiciousColumnIssues.push({
                        file: filename,
                        table: tableKey,
                        column: ref.column,
                        alias: ref.alias,
                    });
                }
            }
        }
    }

    // Deduplicate
    const seen = new Set();
    const deduped = suspiciousColumnIssues.filter(i => {
        const k = `${i.file}|${i.table}|${i.column}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });

    // Group by file
    const byFile = {};
    for (const issue of deduped) {
        if (!byFile[issue.file]) byFile[issue.file] = [];
        byFile[issue.file].push(issue);
    }

    // Output report
    console.log('═══════════════════════════════════════════════════');
    console.log('  SUSPICIOUS COLUMN REFERENCES (not in MySQL schema)');
    console.log('═══════════════════════════════════════════════════\n');

    let totalIssues = 0;
    for (const [file, issues] of Object.entries(byFile)) {
        // Filter out false positives: only show MySQL app tables
        const appTables = issues.filter(i => tableNames.has(i.table) || tableNames.has(i.table.toLowerCase()));
        if (appTables.length === 0) continue;

        console.log(`📄 ${file} (${appTables.length} issues):`);
        for (const i of appTables) {
            console.log(`   ⚠️  ${i.table}.${i.column}  (alias: ${i.alias})`);
            totalIssues++;
        }
        console.log();
    }

    console.log(`TOTAL SUSPICIOUS REFERENCES: ${totalIssues}`);

    // Also output the full schema for verification
    const schemaOut = {};
    for (const [tbl, cols] of Object.entries(schema)) {
        schemaOut[tbl] = [...cols];
    }
    fs.writeFileSync(
        path.join(__dirname, 'schema_dump.json'),
        JSON.stringify(schemaOut, null, 2)
    );
    console.log('\n✅ Full schema saved to scripts/schema_dump.json');
}

main().catch(console.error);
