/**
 * Adaptador Transparente PostgreSQL -> MySQL (MariaDB 11.8 / MySQL 8.0)
 * 
 * Permite que todas as rotas legadas do SINCO continuem usando a interface do 'pg'
 * (db.query, db.connect, pool.query, client.query), enquanto todas as consultas
 * são executadas exclusivamente no banco de dados MySQL remoto da Hostinger.
 */

const mysqlPool = require('./services/mysqlService');

function findMatchingParen(str, openIndex) {
    let depth = 0;
    for (let i = openIndex; i < str.length; i++) {
        if (str[i] === '(') depth++;
        else if (str[i] === ')') {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

function rewriteDistinctOn(sql) {
    let result = '';
    let idx = 0;
    const lower = sql.toLowerCase();
    const token = 'distinct on';

    while (idx < sql.length) {
        const found = lower.indexOf(token, idx);
        if (found === -1) {
            result += sql.slice(idx);
            break;
        }

        result += sql.slice(idx, found);
        const openParen = sql.indexOf('(', found + token.length);
        if (openParen === -1) {
            result += sql.slice(found);
            break;
        }

        const closeParen = findMatchingParen(sql, openParen);
        if (closeParen === -1) {
            result += sql.slice(found);
            break;
        }

        const distKeys = sql.slice(openParen + 1, closeParen).trim();
        const afterParen = sql.slice(closeParen + 1);
        const fromMatch = afterParen.match(/\bFROM\b/i);
        if (!fromMatch) {
            result += sql.slice(found);
            break;
        }

        const selectCols = afterParen.slice(0, fromMatch.index).trim();
        const fromStart = closeParen + 1 + fromMatch.index;

        const orderMatch = sql.slice(fromStart).match(/\bORDER\s+BY\b/i);
        if (!orderMatch) {
            result += sql.slice(found);
            break;
        }

        const orderStart = fromStart + orderMatch.index;
        const fromWhere = sql.slice(fromStart, orderStart).trim();

        let orderEnd = sql.length;
        let depth = 0;
        for (let i = orderStart; i < sql.length; i++) {
            if (sql[i] === '(') depth++;
            else if (sql[i] === ')') {
                if (depth === 0) {
                    orderEnd = i;
                    break;
                }
                depth--;
            } else if (sql[i] === ';') {
                orderEnd = i;
                break;
            }
        }

        const orderByPart = sql.slice(orderStart + orderMatch[0].length, orderEnd).trim();
        const rewritten = `* FROM (SELECT ${selectCols}, ROW_NUMBER() OVER (PARTITION BY ${distKeys} ORDER BY ${orderByPart}) AS _rn ${fromWhere}) _d_sub WHERE _rn = 1`;

        result += rewritten;
        idx = orderEnd;
    }

    return result;
}

function replacePgDateFunctions(sql) {
    const formatMap = {
        '\'yyyymmdd\'': "'%Y%m%d'",
        '\'yyyy-mm-dd\'': "'%Y-%m-%d'",
        '\'dd/mm/yyyy\'': "'%d/%m/%Y'",
        '\'dd/mm/yy\'': "'%d/%m/%y'",
        '\'hh24:mi:ss\'': "'%H:%i:%s'",
        '\'yyyy\'': "'%Y'",
        '\'yyyymm\'': "'%Y%m'",
        '\'dd/mm\'': "'%d/%m'",
        '\'mm\'': "'%m'",
        '\'dd\'': "'%d'"
    };

    function processCalls(str, funcName, targetFunc) {
        let result = '';
        let idx = 0;
        const lower = str.toLowerCase();
        const token = funcName.toLowerCase() + '(';

        while (idx < str.length) {
            const found = lower.indexOf(token, idx);
            if (found === -1) {
                result += str.slice(idx);
                break;
            }

            // Ensure word boundary before funcName
            if (found > 0 && /[a-zA-Z0-9_]/.test(str[found - 1])) {
                result += str.slice(idx, found + token.length);
                idx = found + token.length;
                continue;
            }

            result += str.slice(idx, found);
            const openParen = found + token.length - 1;
            const closeParen = findMatchingParen(str, openParen);

            if (closeParen === -1) {
                result += str.slice(found);
                break;
            }

            const argsContent = str.slice(openParen + 1, closeParen).trim();
            // Find last comma not inside quotes or parentheses
            let commaIdx = -1;
            let depth = 0;
            let inQuote = false;
            let quoteChar = '';
            for (let i = argsContent.length - 1; i >= 0; i--) {
                const c = argsContent[i];
                if (inQuote) {
                    if (c === quoteChar && argsContent[i - 1] !== '\\') {
                        inQuote = false;
                    }
                } else {
                    if (c === "'" || c === '"') {
                        inQuote = true;
                        quoteChar = c;
                    } else if (c === ')') {
                        depth++;
                    } else if (c === '(') {
                        depth--;
                    } else if (c === ',' && depth === 0) {
                        commaIdx = i;
                        break;
                    }
                }
            }

            if (commaIdx !== -1) {
                const firstArg = argsContent.slice(0, commaIdx).trim();
                const secondArg = argsContent.slice(commaIdx + 1).trim();
                const mappedFmt = formatMap[secondArg.toLowerCase()] || secondArg;
                const processedFirstArg = replacePgDateFunctions(firstArg);
                result += `${targetFunc}(${processedFirstArg}, ${mappedFmt})`;
            } else {
                result += `${targetFunc}(${argsContent})`;
            }

            idx = closeParen + 1;
        }

        return result;
    }

    let res = sql;
    res = processCalls(res, 'TO_CHAR', 'DATE_FORMAT');
    res = processCalls(res, 'TO_DATE', 'STR_TO_DATE');
    return res;
}

function replacePgTrimWithChars(sql) {
    let res = sql;
    const funcs = [
        { name: 'LTRIM', type: 'LEADING' },
        { name: 'RTRIM', type: 'TRAILING' },
        { name: 'BTRIM', type: 'BOTH' }
    ];

    for (const { name, type } of funcs) {
        let idx = 0;
        const token = name.toLowerCase() + '(';
        while (idx < res.length) {
            const lower = res.toLowerCase();
            const found = lower.indexOf(token, idx);
            if (found === -1) break;

            if (found > 0 && /[a-zA-Z0-9_]/.test(res[found - 1])) {
                idx = found + token.length;
                continue;
            }

            const openParen = found + token.length - 1;
            const closeParen = findMatchingParen(res, openParen);
            if (closeParen === -1) break;

            const argsContent = res.slice(openParen + 1, closeParen).trim();
            let commaIdx = -1;
            let depth = 0;
            let inQuote = false;
            let quoteChar = '';
            for (let i = argsContent.length - 1; i >= 0; i--) {
                const c = argsContent[i];
                if (inQuote) {
                    if (c === quoteChar && argsContent[i - 1] !== '\\') inQuote = false;
                } else {
                    if (c === "'" || c === '"') {
                        inQuote = true;
                        quoteChar = c;
                    } else if (c === ')') depth++;
                    else if (c === '(') depth--;
                    else if (c === ',' && depth === 0) {
                        commaIdx = i;
                        break;
                    }
                }
            }

            if (commaIdx !== -1) {
                const firstArg = argsContent.slice(0, commaIdx).trim();
                const secondArg = argsContent.slice(commaIdx + 1).trim();
                const replacement = `TRIM(${type} ${secondArg} FROM ${firstArg})`;
                res = res.slice(0, found) + replacement + res.slice(closeParen + 1);
                idx = found + replacement.length;
            } else {
                idx = closeParen + 1;
            }
        }
    }
    return res;
}


function replacePgEncode(sql) {
    let result = '';
    let idx = 0;
    const lower = sql.toLowerCase();
    const token = 'encode(';

    while (idx < sql.length) {
        const found = lower.indexOf(token, idx);
        if (found === -1) {
            result += sql.slice(idx);
            break;
        }

        // Ensure word boundary before funcName
        if (found > 0 && /[a-zA-Z0-9_]/.test(sql[found - 1])) {
            result += sql.slice(idx, found + token.length);
            idx = found + token.length;
            continue;
        }

        result += sql.slice(idx, found);
        const openParen = found + token.length - 1;
        const closeParen = findMatchingParen(sql, openParen);

        if (closeParen === -1) {
            result += sql.slice(found);
            break;
        }

        const argsContent = sql.slice(openParen + 1, closeParen).trim();
        // Find last comma not inside quotes or parentheses
        let commaIdx = -1;
        let depth = 0;
        let inQuote = false;
        let quoteChar = '';
        for (let i = argsContent.length - 1; i >= 0; i--) {
            const c = argsContent[i];
            if (inQuote) {
                if (c === quoteChar && argsContent[i - 1] !== '\\') {
                    inQuote = false;
                }
            } else {
                if (c === "'" || c === '"') {
                    inQuote = true;
                    quoteChar = c;
                } else if (c === ')') {
                    depth++;
                } else if (c === '(') {
                    depth--;
                } else if (c === ',' && depth === 0) {
                    commaIdx = i;
                    break;
                }
            }
        }

        if (commaIdx !== -1) {
            const firstArg = argsContent.slice(0, commaIdx).trim();
            const secondArg = argsContent.slice(commaIdx + 1).trim().toLowerCase().replace(/['"]/g, '');
            if (secondArg === 'hex') {
                result += `HEX(${firstArg})`;
            } else {
                result += `TO_BASE64(${firstArg})`;
            }
        } else {
            result += `TO_BASE64(${argsContent})`;
        }

        idx = closeParen + 1;
    }

    return result;
}

function translatePgToMysql(sql, params = []) {
    let newSql = String(sql || '');
    let newParams = Array.isArray(params) ? [...params] : [];

    // 1. Session no-ops: queries que apenas definem variáveis de sessão específicas do Postgres
    const trimmed = newSql.trim();
    if (/^SET\s+(?:statement_timeout|work_mem|client_encoding|search_path)\b/i.test(trimmed)) {
        // Se a query inteira consiste apenas de comandos SET do PG
        const isOnlyPgSets = trimmed.split(';').map(s => s.trim()).filter(Boolean)
            .every(s => /^SET\s+(?:statement_timeout|work_mem|client_encoding|search_path)\b/i.test(s));
        if (isOnlyPgSets) {
            return { sql: 'SELECT 1', params: [], isNoop: true };
        }
    }

    // 2. Remoção de prefixo de schema public.
    newSql = newSql.replace(/\bpublic\.(\w+)/gi, '$1');

    // 2.1 Normalização de tabelas Protheus para minúsculas (Linux MariaDB é case-sensitive)
    newSql = newSql.replace(/\b([sS][a-zA-Z0-9]{5}|[dD][a-zA-Z0-9]{5}|[cC][tT][0-9]{4}|[nN][nN][rR][0-9]{3}|sys_company)\b/g, (tbl) => tbl.toLowerCase());

    // 3. Remoção de cláusulas NULLS LAST / NULLS FIRST (incompatíveis com MySQL)
    newSql = newSql.replace(/\s+NULLS\s+(?:LAST|FIRST)/gi, '');

    // 3.1 Transpilação de encode(..., 'base64') / encode(..., 'hex')
    newSql = replacePgEncode(newSql);

    // 4. Remoção de casts de tipo do Postgres (ex: ::varchar[], ::numeric(18,2), :: numeric, ::timestamp)
    newSql = newSql.replace(/::\s*[a-zA-Z0-9_]+(?:\([0-9, ]+\))?(?:\[\])?/g, '');

    // 5. Substituição de operadores de busca e funções de string
    newSql = newSql.replace(/\bWITH\s+(?!RECURSIVE\b)/gi, 'WITH RECURSIVE ');
    newSql = replacePgTrimWithChars(newSql);
    newSql = newSql.replace(/\b(?:btrim|BTRIM)\s*\(/g, 'TRIM(');
    newSql = newSql.replace(/\bILIKE\b/gi, 'LIKE');
    newSql = newSql.replace(/\s+!~\s*('[^']+')/g, ' NOT REGEXP $1');
    newSql = newSql.replace(/\s+~\s*('[^']+')/g, ' REGEXP $1');

    // 5.1 Escapar palavras reservadas do MySQL quando usadas como alias de coluna (ex: AS desc, AS order)
    newSql = newSql.replace(/\bAS\s+(desc|asc|order|group|key|usage|condition|schema|system|primary|check)\b/gi, 'AS `$1`');

    // 6. regexp_replace(col, pat, repl, 'g') -> REGEXP_REPLACE(col, pat, repl)
    // Remove o 4º argumento de flags do Postgres que é inválido no MariaDB
    newSql = newSql.replace(/(,\s*(?:'[^']*'|"[^"]*"|''|""))\s*,\s*'g[i]?'\s*\)/gi, '$1)');
    newSql = newSql.replace(/\bregexp_replace\s*\(([^,]+),\s*('[^']+'|"[^"]+"|[a-zA-Z0-9_]+),\s*('[^']+'|"[^"]+"),\s*'g'\s*\)/gi, 'REGEXP_REPLACE($1, $2, $3)');

    // 7. STRING_AGG( [DISTINCT] expr, delim [ORDER BY ...] ) -> GROUP_CONCAT([DISTINCT] expr [ORDER BY ...] SEPARATOR delim)
    newSql = newSql.replace(
        /\bSTRING_AGG\s*\(\s*(DISTINCT\s+)?([\s\S]*?),\s*('[^']+')(?:\s+ORDER\s+BY\s+([\s\S]*?))?\s*\)/gi,
        (match, distinct = '', expr, delim, order) => {
            const orderPart = order ? ` ORDER BY ${order.trim()}` : '';
            return `GROUP_CONCAT(${distinct}${expr.trim()}${orderPart} SEPARATOR ${delim})`;
        }
    );

    // BUGFIX (IA): Tratamento seguro de consultas à pg_stat_activity (diagnóstico PG) para evitar erro de tabela inexistente no MySQL
    if (newSql.toLowerCase().includes('pg_stat_activity')) {
        return {
            sql: 'SELECT 1 AS terminated, 1 AS pid, "mysql" AS usename, "idle" AS state, 0 AS idle_since WHERE 1 = 0',
            params: [],
            isNoop: false
        };
    }

    // 8. Funções de Data do Postgres -> MySQL
    newSql = replacePgDateFunctions(newSql);
    // BUGFIX (IA): Generalização de DATE_TRUNC para suportar ano, mês e dia em qualquer expressão
    newSql = newSql.replace(/\bDATE_TRUNC\s*\(\s*'year'\s*,\s*CURRENT_DATE\s*\)/gi, "DATE_FORMAT(CURRENT_DATE, '%Y-01-01')");
    newSql = newSql.replace(/\bDATE_TRUNC\s*\(\s*'month'\s*,\s*CURRENT_DATE\s*\)/gi, "DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')");
    newSql = newSql.replace(/\bDATE_TRUNC\s*\(\s*'year'\s*,\s*([^)]+)\s*\)/gi, "DATE_FORMAT($1, '%Y-01-01')");
    newSql = newSql.replace(/\bDATE_TRUNC\s*\(\s*'month'\s*,\s*([^)]+)\s*\)/gi, "DATE_FORMAT($1, '%Y-%m-01')");
    newSql = newSql.replace(/\bDATE_TRUNC\s*\(\s*'day'\s*,\s*([^)]+)\s*\)/gi, "DATE($1)");

    // BUGFIX (IA): Generalização de intervalos de data do Postgres (dias, meses, anos com + e -)
    newSql = newSql.replace(/(CURRENT_DATE|NOW\(\))\s*-\s*INTERVAL\s*'(\d+)\s*(months?|days?|years?)'/gi, (match, dt, num, unit) => {
        const cleanUnit = unit.toUpperCase().replace(/S$/, '');
        return `DATE_SUB(${dt}, INTERVAL ${num} ${cleanUnit})`;
    });
    newSql = newSql.replace(/(CURRENT_DATE|NOW\(\))\s*\+\s*INTERVAL\s*'(\d+)\s*(months?|days?|years?)'/gi, (match, dt, num, unit) => {
        const cleanUnit = unit.toUpperCase().replace(/S$/, '');
        return `DATE_ADD(${dt}, INTERVAL ${num} ${cleanUnit})`;
    });

    // 9. Conversão de ANY($N) para IN (?)
    // 9. Conversão de ANY($N), ALL($N) e literais ARRAY[...]
    newSql = newSql.replace(/<>\s*ALL\s*\(\s*ARRAY\s*\[([\s\S]*?)\]\s*\)/gi, 'NOT IN ($1)');
    newSql = newSql.replace(/=\s*ANY\s*\(\s*ARRAY\s*\[([\s\S]*?)\]\s*\)/gi, 'IN ($1)');
    newSql = newSql.replace(/<>\s*ALL\s*\(([\s\S]*?)\)/gi, 'NOT IN ($1)');
    newSql = newSql.replace(/=\s*ANY\s*\(([\s\S]*?)\)/gi, 'IN ($1)');
    newSql = newSql.replace(/\bARRAY\s*\[([\s\S]*?)\]/gi, '($1)');

    newSql = newSql.replace(/(?:=\s*ANY|IN\s*ANY)\s*\(\s*(\$\d+)\s*\)/gi, 'IN ($1)');
    newSql = newSql.replace(/NOT\s*\(([^=]+)=\s*ANY\s*\(\s*(\$\d+)\s*\)\)/gi, '$1 NOT IN ($2)');

    // 10. Tradução de unnest legado para tabela nativa de previsões PCP
    newSql = newSql.replace(
        /FROM\s+unnest\s*\([^)]+\)\s*AS\s+t\s*\(\s*fc_pedido,\s*fc_item,\s*data_entrega_pcp,\s*data_prevista_faturamento\s*\)/gi,
        'FROM (SELECT pedido AS fc_pedido, item AS fc_item, data_entrega_pcp, data_prevista_faturamento FROM app_pcp_delivery_forecasts) AS t'
    );

    // 11. Conversão de DISTINCT ON para ROW_NUMBER()
    if (newSql.toLowerCase().includes('distinct on')) {
        newSql = rewriteDistinctOn(newSql);
    }

    // 12. Mapeamento de placeholders: $1, $2 ... para ?
    // Preserva repetições e garante array seguro para expansão do mysql2
    const hasPositionalParams = /\$\d+/.test(newSql);
    if (hasPositionalParams) {
        const expandedParams = [];
        newSql = newSql.replace(/\$(\d+)/g, (match, numStr, matchOffset) => {
            const index = parseInt(numStr, 10) - 1;
            let val = newParams[index];

            // Garante que parâmetros para LIMIT ou OFFSET sejam números inteiros
            const prefix = newSql.slice(Math.max(0, matchOffset - 20), matchOffset);
            if (/\b(?:LIMIT|OFFSET)\s*$/i.test(prefix)) {
                val = parseInt(val, 10);
                if (isNaN(val)) val = 0;
            }

            // Se o parâmetro é um array (ex: IN (?)) e estiver vazio, passamos [null] para evitar 'IN ()' syntax error
            if (Array.isArray(val)) {
                if (val.length === 0) {
                    val = [null];
                }
            }
            expandedParams.push(val);
            return '?';
        });
        newParams = expandedParams;
    }

    return { sql: newSql, params: newParams, isNoop: false };
}

const { getTenantId } = require('./services/tenantContext');
const { injectTenantSql } = require('./services/tenantQueryRewriter');

async function executeQuery(text, params) {
    const translation = translatePgToMysql(text, params);
    if (translation.isNoop) {
        return { rows: [], rowCount: 0 };
    }

    const tenantId = getTenantId();
    const finalSql = tenantId ? injectTenantSql(translation.sql, tenantId) : translation.sql;

    try {
        const [rows] = await mysqlPool.query(finalSql, translation.params);
        if (Array.isArray(rows)) {
            return {
                rows,
                rowCount: rows.length
            };
        }
        return {
            rows: [],
            rowCount: rows?.affectedRows || 0,
            insertId: rows?.insertId
        };
    } catch (err) {
        console.error('❌ [MySQL Adapter Error]:', err.message);
        console.error('   SQL Original:', String(text).slice(0, 300));
        console.error('   SQL Traduzido:', finalSql.slice(0, 300));
        throw err;
    }
}

async function connect() {
    const connection = await mysqlPool.getConnection();
    return {
        query: async (text, params) => {
            const translation = translatePgToMysql(text, params);
            if (translation.isNoop) {
                return { rows: [], rowCount: 0 };
            }

            const tenantId = getTenantId();
            const finalSql = tenantId ? injectTenantSql(translation.sql, tenantId) : translation.sql;

            try {
                const [rows] = await connection.query(finalSql, translation.params);
                if (Array.isArray(rows)) {
                    return {
                        rows,
                        rowCount: rows.length
                    };
                }
                return {
                    rows: [],
                    rowCount: rows?.affectedRows || 0,
                    insertId: rows?.insertId
                };
            } catch (err) {
                console.error('❌ [MySQL Client Adapter Error]:', err.message);
                console.error('   SQL Traduzido:', finalSql.slice(0, 300));
                throw err;
            }
        },
        release: () => {
            try {
                connection.release();
            } catch (_) {}
        },
        on: () => {}
    };
}

const adapter = {
    query: executeQuery,
    connect: connect,
    on: (event, handler) => {
        if (event === 'error') {
            mysqlPool.on('error', handler);
        }
    },
    translatePgToMysql
};

// Suporte a todos os padrões de desestruturação e importação legados:
// const db = require('./db');
// const pool = require('./db');
// const { query } = require('./db');
// db.pool.query(...)
adapter.pool = adapter;

console.log('✅ [DATABASE] Adaptador MySQL Hostinger Ativado (100% Autônomo). PostgreSQL desconectado.');

module.exports = adapter;
