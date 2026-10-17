/**
 * Tenant Query Rewriter - Isolamento Transparente de Dados Multi-Tenant (SINCO Suite)
 * 
 * Garante que todas as consultas (SELECT, INSERT, UPDATE, DELETE) executadas contra
 * tabelas operacionais da fábrica sejam filtradas e gravadas com o IdEmpresa do tenant ativo.
 */

// Conjunto inicial de tabelas essenciais com suporte a multi-tenant
const tenantTablesSet = new Set([
    'sc5010', 'sc6010', 'sc2010', 'sb1010', 'sb2010', 'sa1010', 'sa2010', 'sz1010',
    'sg2010', 'sg1010', 'sd1010', 'sd2010', 'sf1010', 'sf2010', 'sc7010',
    'sc1010', 'sh1010', 'se1010', 'se2010', 'sed010', 'ct1010', 'ct2010',
    'pcp_setores', 'pcp_setor_recursos', 'pcp_setor_responsaveis', 'pcp_recursos',
    'app_romaneios', 'app_romaneio_items', 'app_romaneios_nfs', 'app_romaneio_types',
    'app_production_appointments', 'app_production_planning', 'app_production_planning_diario',
    'app_pcp_releases', 'app_pcp_snapshots', 'app_pcp_lotes', 'app_pcp_lote_itens',
    'app_op_priorities', 'app_pedidos_inativos', 'app_pedido_itens_classificacao',
    'app_engineering_releases', 'app_engineering_bom_items', 'app_engineering_timesheets',
    'app_sgq_rncs', 'app_sgq_processos', 'app_sgq_nao_conformidades', 'app_sgq_cargos_funcoes',
    'app_solicitacoes_almoxarifado', 'app_lotes_corte', 'app_lotes_corte_itens',
    'app_produto_ata', 'app_produto_imagens', 'app_produto_estados',
    'app_faturamento_solicitacoes', 'app_faturamento_solicitacao_itens',
    'app_faturamento_auditoria', 'faturamento_pre_etiquetas', 'produtocomercial',
    'cipa_gestoes', 'cipa_cronograma_prazos', 'cipa_candidatos', 'cipa_eleitores_votaram', 'cipa_cedulas_votos', 'cipa_reunioes_atas',
    'portaria_turnos', 'portaria_porteiros', 'portaria_acessos', 'portaria_ocorrencias',
    'app_user_preferences', 'user_preferences',
    'sst_brigada_config', 'sst_brigada_membros', 'sst_brigada_treinamentos', 'sst_brigada_equipamentos', 'sst_brigada_inspecoes', 'sst_brigada_simulados'
]);

// Tabelas globais / de autenticação que NÃO devem ser reescritas automaticamente
const EXCLUDED_TABLES = new Set([
    'empresa',
    'usuario',
    'information_schema',
    'system_metrics',
    'system_parameters',
    'viewmontapeca'
]);

const RESERVED_WORDS = new Set([
    'where', 'order', 'group', 'limit', 'join', 'inner', 'left', 'right',
    'cross', 'union', 'having', 'on', 'as', 'using', 'set', 'into', 'values'
]);

/**
 * Carrega a lista completa de tabelas que possuem IdEmpresa diretamente do MySQL
 */
async function loadTenantTables(pool) {
    try {
        const [rows] = await pool.query(`
            SELECT DISTINCT LOWER(TABLE_NAME) as tbl
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND COLUMN_NAME = 'IdEmpresa'
        `);
        for (const r of rows) {
            if (r.tbl && !EXCLUDED_TABLES.has(r.tbl)) {
                tenantTablesSet.add(r.tbl);
            }
        }
        console.log(`🔒 [MULTI-TENANT] ${tenantTablesSet.size} tabelas monitoradas com isolamento automático por IdEmpresa.`);
    } catch (err) {
        console.warn('⚠️ [MULTI-TENANT] Não foi possível consultar INFORMATION_SCHEMA, usando conjunto base:', err.message);
    }
}

/**
 * Injeta filtro de IdEmpresa na query SQL de forma segura
 */
function injectTenantSql(sql, tenantId) {
    if (!tenantId || tenantId === null) return sql;

    const trimmed = String(sql || '').trim();
    if (!trimmed) return sql;

    // Se a query já contém IdEmpresa explicitamente, respeita a query original
    if (/\bIdEmpresa\b/i.test(trimmed)) {
        return sql;
    }

    // Ignora DDL, explain, show, etc.
    if (/^(SHOW|DESCRIBE|DESC|EXPLAIN|CREATE|ALTER|DROP|TRUNCATE|SET)\b/i.test(trimmed)) {
        return sql;
    }

    const tenantNum = parseInt(tenantId, 10);
    if (isNaN(tenantNum) || tenantNum <= 0) return sql;

    // ── 1. INSERT INTO table (cols) VALUES (vals) ──────────────────────────
    const insertMatch = trimmed.match(/^INSERT\s+INTO\s+([`"]?[a-zA-Z0-9_]+[`"]?)\s*\(([^)]+)\)\s*VALUES\s*\(([\s\S]+)\)/i);
    if (insertMatch) {
        const rawTable = insertMatch[1].replace(/[`"]/g, '').toLowerCase();
        if (tenantTablesSet.has(rawTable) && !EXCLUDED_TABLES.has(rawTable)) {
            const cols = insertMatch[2];
            const vals = insertMatch[3];
            return `INSERT INTO ${insertMatch[1]} (${cols}, IdEmpresa) VALUES (${vals}, ${tenantNum})`;
        }
        return sql;
    }

    // ── 2. UPDATE table SET ... WHERE ... ──────────────────────────────────
    const updateMatch = trimmed.match(/^UPDATE\s+([`"]?[a-zA-Z0-9_]+[`"]?)(?:\s+(?:AS\s+)?([`"]?[a-zA-Z0-9_]+[`"]?))?\s+SET\b/i);
    if (updateMatch) {
        const rawTable = updateMatch[1].replace(/[`"]/g, '').toLowerCase();
        const rawAlias = updateMatch[2] ? updateMatch[2].replace(/[`"]/g, '') : null;
        const alias = (rawAlias && !RESERVED_WORDS.has(rawAlias.toLowerCase())) ? rawAlias : null;

        if (tenantTablesSet.has(rawTable) && !EXCLUDED_TABLES.has(rawTable)) {
            const tableRef = alias || rawTable;
            const tenantCondition = `(${tableRef}.IdEmpresa = ${tenantNum})`;
            const whereMatch = trimmed.match(/\bWHERE\b/i);
            if (whereMatch) {
                const idx = whereMatch.index;
                return trimmed.slice(0, idx + 5) + ` ${tenantCondition} AND` + trimmed.slice(idx + 5);
            } else {
                return trimmed + ` WHERE ${tenantCondition}`;
            }
        }
        return sql;
    }

    // ── 3. DELETE FROM table WHERE ... ────────────────────────────────────
    const deleteMatch = trimmed.match(/^DELETE\s+FROM\s+([`"]?[a-zA-Z0-9_]+[`"]?)(?:\s+(?:AS\s+)?([`"]?[a-zA-Z0-9_]+[`"]?))?(?=\s+WHERE|\s*$)/i);
    if (deleteMatch) {
        const rawTable = deleteMatch[1].replace(/[`"]/g, '').toLowerCase();
        const rawAlias = deleteMatch[2] ? deleteMatch[2].replace(/[`"]/g, '') : null;
        const alias = (rawAlias && !RESERVED_WORDS.has(rawAlias.toLowerCase())) ? rawAlias : null;

        if (tenantTablesSet.has(rawTable) && !EXCLUDED_TABLES.has(rawTable)) {
            const tableRef = alias || rawTable;
            const tenantCondition = `(${tableRef}.IdEmpresa = ${tenantNum})`;
            const whereMatch = trimmed.match(/\bWHERE\b/i);
            if (whereMatch) {
                const idx = whereMatch.index;
                return trimmed.slice(0, idx + 5) + ` ${tenantCondition} AND` + trimmed.slice(idx + 5);
            } else {
                return trimmed + ` WHERE ${tenantCondition}`;
            }
        }
        return sql;
    }

function extractOnCondition(sql, startIndex) {
    let depth = 0;
    let i = startIndex;
    let inQuote = false;
    let quoteChar = '';

    while (i < sql.length) {
        const c = sql[i];
        if (inQuote) {
            if (c === quoteChar && sql[i - 1] !== '\\') {
                inQuote = false;
            }
        } else {
            if (c === "'" || c === '"' || c === '`') {
                inQuote = true;
                quoteChar = c;
            } else if (c === '(') {
                depth++;
            } else if (c === ')') {
                if (depth === 0) {
                    // Parêntese de fechamento pertence à CTE/subquery externa
                    break;
                }
                depth--;
            } else if (depth === 0) {
                const rest = sql.slice(i);
                if (/^(?:\bWHERE\b|\bORDER\s+BY\b|\bGROUP\s+BY\b|\bLIMIT\b|\bHAVING\b|\bUNION\b|\bSELECT\b|(?:\b(?:INNER|LEFT|RIGHT|CROSS)\s+)?\bJOIN\b)/i.test(rest)) {
                    break;
                }
            }
        }
        i++;
    }
    return { condition: sql.slice(startIndex, i), endIndex: i };
}

function findClauseInScope(sql, startIndex) {
    let depth = 0;
    let inQuote = false;
    let quoteChar = '';
    let whereIdx = -1;
    let clauseIdx = -1;
    let scopeEndIdx = sql.length;

    for (let i = startIndex; i < sql.length; i++) {
        const c = sql[i];
        if (inQuote) {
            if (c === quoteChar && sql[i - 1] !== '\\') {
                inQuote = false;
            }
        } else {
            if (c === "'" || c === '"' || c === '`') {
                inQuote = true;
                quoteChar = c;
            } else if (c === '(') {
                depth++;
            } else if (c === ')') {
                if (depth === 0) {
                    scopeEndIdx = i;
                    break;
                }
                depth--;
            } else if (depth === 0) {
                const rest = sql.slice(i);
                if (whereIdx === -1 && /^\bWHERE\b/i.test(rest)) {
                    whereIdx = i;
                } else if (clauseIdx === -1 && /^\b(GROUP\s+BY|ORDER\s+BY|LIMIT|HAVING|UNION)\b/i.test(rest)) {
                    clauseIdx = i;
                }
            }
        }
    }
    return { whereIdx, clauseIdx, scopeEndIdx };
}

    // ── 4. SELECT ... FROM table ... ──────────────────────────────────────
    // 1. Injeta nos JOINs das tabelas isoladas respeitando rigorosamente parênteses e delimitadores
    const joinHeaderRegex = /\b((?:INNER\s+|LEFT\s+|RIGHT\s+|CROSS\s+)?JOIN)\s+([`"]?[a-zA-Z0-9_]+[`"]?)(?:\s+(?:AS\s+)?([`"]?[a-zA-Z0-9_]+[`"]?))?\s+ON\s+/gi;
    let modified = '';
    let lastIndex = 0;
    let match;

    while ((match = joinHeaderRegex.exec(trimmed)) !== null) {
        modified += trimmed.slice(lastIndex, match.index);
        const joinType = match[1];
        const rawTbl = match[2];
        const rawAlias = match[3];
        const onStart = match.index + match[0].length;

        const { condition, endIndex } = extractOnCondition(trimmed, onStart);
        const tbl = rawTbl.replace(/[`"]/g, '').toLowerCase();
        const alias = (rawAlias && !RESERVED_WORDS.has(rawAlias.toLowerCase())) ? rawAlias.replace(/[`"]/g, '') : null;
        const ref = alias || rawTbl;

        if (tenantTablesSet.has(tbl) && !EXCLUDED_TABLES.has(tbl) && !condition.includes('IdEmpresa')) {
            modified += `${joinType} ${rawTbl}${rawAlias ? ' ' + rawAlias : ''} ON (${condition.trim()}) AND (${ref}.IdEmpresa = ${tenantNum}) `;
        } else {
            modified += `${joinType} ${rawTbl}${rawAlias ? ' ' + rawAlias : ''} ON ${condition}`;
        }

        lastIndex = endIndex;
        joinHeaderRegex.lastIndex = endIndex;
    }
    modified += trimmed.slice(lastIndex);

    // 2. Injeta em cada FROM das tabelas isoladas respeitando escopos e CTEs
    const fromRegex = /\bFROM\s+([`"]?[a-zA-Z0-9_]+[`"]?)(?:\s+AS\s+([`"]?[a-zA-Z0-9_]+[`"]?)|\s+(?!(?:WHERE|JOIN|INNER|LEFT|RIGHT|CROSS|NATURAL|ORDER|GROUP|LIMIT|HAVING|UNION|ON|SET|USING|\))\b)([`"]?[a-zA-Z0-9_]+[`"]?))?/gi;
    let fromLastIndex = 0;
    let finalSql = '';
    let fMatch;

    while ((fMatch = fromRegex.exec(modified)) !== null) {
        finalSql += modified.slice(fromLastIndex, fMatch.index + fMatch[0].length);
        fromLastIndex = fMatch.index + fMatch[0].length;

        const rawTable = fMatch[1].replace(/[`"]/g, '').toLowerCase();
        const rawAlias = fMatch[2] ? fMatch[2].replace(/[`"]/g, '') : (fMatch[3] ? fMatch[3].replace(/[`"]/g, '') : null);
        const alias = (rawAlias && !RESERVED_WORDS.has(rawAlias.toLowerCase())) ? rawAlias : null;

        if (tenantTablesSet.has(rawTable) && !EXCLUDED_TABLES.has(rawTable)) {
            const tableRef = alias || rawTable;
            const tenantCondition = `(${tableRef}.IdEmpresa = ${tenantNum})`;

            const { whereIdx, clauseIdx, scopeEndIdx } = findClauseInScope(modified, fromLastIndex);
            const scopeContent = modified.slice(fromLastIndex, scopeEndIdx);

            if (!scopeContent.includes(`${tableRef}.IdEmpresa`) && !scopeContent.includes(`${rawTable}.IdEmpresa`)) {
                if (whereIdx !== -1 && whereIdx < scopeEndIdx) {
                    finalSql += modified.slice(fromLastIndex, whereIdx + 5) + ` ${tenantCondition} AND`;
                    fromLastIndex = whereIdx + 5;
                } else if (clauseIdx !== -1 && clauseIdx < scopeEndIdx) {
                    finalSql += modified.slice(fromLastIndex, clauseIdx) + ` WHERE ${tenantCondition} `;
                    fromLastIndex = clauseIdx;
                } else {
                    finalSql += modified.slice(fromLastIndex, scopeEndIdx) + ` WHERE ${tenantCondition}`;
                    fromLastIndex = scopeEndIdx;
                }
                fromRegex.lastIndex = fromLastIndex;
            }
        }
    }
    finalSql += modified.slice(fromLastIndex);

    return finalSql;
}

module.exports = {
    tenantTablesSet,
    loadTenantTables,
    injectTenantSql
};
