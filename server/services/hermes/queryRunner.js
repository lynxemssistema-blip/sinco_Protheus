/**
 * Hermes - Query Runner
 * Safely executes read/write database queries based on the agent's autonomy settings.
 */
const db = require('../../db');
const mysqlPool = require('../mysqlService');

const FORBIDDEN_KEYWORDS = ['drop', 'alter', 'truncate', 'grant', 'revoke', 'exec', 'execute', 'create schema', 'drop schema'];
const WRITE_KEYWORDS = ['insert', 'update', 'delete', 'replace'];

/**
 * Validates the safety of a SQL query based on database and autonomy switch
 */
function validateQuery(sql, banco, autonomia) {
    const normalized = sql.toLowerCase().trim();

    // 1. Critical security keywords block (always blocked)
    for (const keyword of FORBIDDEN_KEYWORDS) {
        const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
        if (pattern.test(normalized)) {
            throw new Error(`Consulta bloqueada por segurança: contém a palavra proibida "${keyword}".`);
        }
    }

    // 2. PostgreSQL (Protheus ERP) - ALWAYS strictly read-only
    if (banco === 'postgresql' || banco === 'pg') {
        if (!normalized.startsWith('select')) {
            throw new Error('Apenas consultas SELECT são permitidas no banco do ERP Protheus.');
        }
        for (const keyword of WRITE_KEYWORDS) {
            const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
            if (pattern.test(normalized)) {
                throw new Error(`Escrita bloqueada no ERP Protheus: comando "${keyword}" proibido.`);
            }
        }
    }

    // 3. MySQL (App DB) - Writes only allowed if autonomy is active
    if (banco === 'mysql') {
        if (!autonomia) {
            if (!normalized.startsWith('select')) {
                throw new Error('Autonomia desativada: apenas consultas de leitura (SELECT) são permitidas no banco interno.');
            }
            for (const keyword of WRITE_KEYWORDS) {
                const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
                if (pattern.test(normalized)) {
                    throw new Error(`Autonomia desativada: operação de escrita "${keyword}" bloqueada.`);
                }
            }
        }
    }

    return true;
}

/**
 * Executes a PostgreSQL query (Protheus)
 */
async function queryPostgres(sql, params = []) {
    validateQuery(sql, 'postgresql', false); // ERP is always read-only
    const result = await db.query(sql, params);
    return {
        rows: result.rows,
        rowCount: result.rowCount,
        fields: result.fields?.map(f => f.name) || []
    };
}

/**
 * Executes a MySQL query (App)
 */
async function queryMySQL(sql, params = [], autonomia = false) {
    validateQuery(sql, 'mysql', autonomia);
    const [rows, fields] = await mysqlPool.query(sql, params);
    return {
        rows,
        rowCount: Array.isArray(rows) ? rows.length : (rows.affectedRows || 0),
        fields: fields?.map(f => f.name) || []
    };
}

/**
 * Executes queries targeting the correct database engine
 */
async function runQuery(banco, sql, params = [], autonomia = false) {
    if (banco === 'postgresql' || banco === 'pg') {
        return await queryPostgres(sql, params);
    } else if (banco === 'mysql') {
        return await queryMySQL(sql, params, autonomia);
    } else {
        throw new Error(`Banco de dados desconhecido: ${banco}. Use 'postgresql' ou 'mysql'.`);
    }
}

module.exports = { runQuery, queryPostgres, queryMySQL, validateQuery };
