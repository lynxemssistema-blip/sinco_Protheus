/**
 * PCPMetal - Query Runner
 * Executes READ-ONLY queries safely against PostgreSQL (Protheus) and MySQL (App).
 * Validates that only SELECT statements are executed.
 */
const db = require('../../db');
const mysqlPool = require('../mysqlService');

const FORBIDDEN_KEYWORDS = ['insert', 'update', 'delete', 'drop', 'alter', 'truncate', 'create', 'grant', 'revoke', 'exec', 'execute'];

/**
 * Validates a SQL string is safe (read-only)
 */
function validateQuery(sql) {
    const normalized = sql.toLowerCase().trim();

    if (!normalized.startsWith('select')) {
        throw new Error('Apenas consultas SELECT são permitidas pelo PCPMetal.');
    }

    for (const keyword of FORBIDDEN_KEYWORDS) {
        const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
        if (pattern.test(normalized)) {
            throw new Error(`Consulta bloqueada: contém palavra proibida "${keyword}".`);
        }
    }

    return true;
}

/**
 * Execute a query on PostgreSQL (Protheus)
 * @param {string} sql - SQL query (SELECT only)
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} { rows, rowCount, fields }
 */
async function queryPostgres(sql, params = []) {
    validateQuery(sql);
    const result = await db.query(sql, params);
    return {
        rows: result.rows,
        rowCount: result.rowCount,
        fields: result.fields?.map(f => f.name) || []
    };
}

/**
 * Execute a query on MySQL (App MetalFisa)
 * @param {string} sql - SQL query (SELECT only)
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} { rows, rowCount, fields }
 */
async function queryMySQL(sql, params = []) {
    validateQuery(sql);
    const [rows, fields] = await mysqlPool.query(sql, params);
    return {
        rows,
        rowCount: rows.length,
        fields: fields?.map(f => f.name) || []
    };
}

/**
 * Execute a query on the appropriate database based on banco parameter
 * @param {string} banco - 'postgresql' or 'mysql'
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 */
async function runQuery(banco, sql, params = []) {
    if (banco === 'postgresql' || banco === 'pg') {
        return await queryPostgres(sql, params);
    } else if (banco === 'mysql') {
        return await queryMySQL(sql, params);
    } else {
        throw new Error(`Banco de dados desconhecido: ${banco}. Use 'postgresql' ou 'mysql'.`);
    }
}

/**
 * Get rich context for a specific order+item for AI injection
 */
async function getOrderContext(pedido, item = null) {
    const context = {};

    try {
        // 1. Pedido header (Protheus PG)
        const pedidoQ = await queryPostgres(`
            SELECT c5.c5_num, c5.c5_emissao, c5.c5_nota, sa1.a1_nome as cliente
            FROM sc5010 c5
            LEFT JOIN sa1010 sa1 ON sa1.a1_cod = c5.c5_cliente AND COALESCE(sa1.d_e_l_e_t_,'') = ''
            WHERE c5.c5_num = $1 AND COALESCE(c5.d_e_l_e_t_,'') = ''
            LIMIT 1
        `, [pedido]);
        context.pedido_header = pedidoQ.rows[0] || null;

        // 2. Items (Protheus PG)
        const itemFilter = item ? 'AND c6.c6_item = $2' : '';
        const itemParams = item ? [pedido, item] : [pedido];
        const itensQ = await queryPostgres(`
            SELECT c6.c6_item, c6.c6_produto, c6.c6_qtdven, c6.c6_qtdent,
                   (c6.c6_qtdven - c6.c6_qtdent) as saldo,
                   c6.c6_entreg, c6.c6_op, sb1.b1_desc as produto_desc
            FROM sc6010 c6
            LEFT JOIN sb1010 sb1 ON sb1.b1_cod = c6.c6_produto AND COALESCE(sb1.d_e_l_e_t_,'') = ''
            WHERE c6.c6_num = $1 AND COALESCE(c6.d_e_l_e_t_,'') = '' ${itemFilter}
            ORDER BY c6.c6_item
        `, itemParams);
        context.itens = itensQ.rows;

        // 3. Notes/Planning (MySQL)
        const [notes] = await mysqlPool.query(
            `SELECT * FROM app_sales_order_item_notes WHERE pedido = ? ${item ? 'AND item = ?' : ''} ORDER BY item`,
            item ? [pedido, item] : [pedido]
        );
        context.planning_notes = notes;

        // 4. Latest PCP forecasts (MySQL)
        const [forecasts] = await mysqlPool.query(
            `SELECT f.* FROM app_pcp_delivery_forecasts f
             INNER JOIN (SELECT pedido, item, MAX(id) as max_id FROM app_pcp_delivery_forecasts WHERE pedido = ? GROUP BY pedido, item) m
             ON f.id = m.max_id`,
            [pedido]
        );
        context.pcp_forecasts = forecasts;

    } catch (err) {
        console.error('[QueryRunner] Error fetching order context:', err.message);
        context.error = err.message;
    }

    return context;
}

module.exports = { runQuery, queryPostgres, queryMySQL, validateQuery, getOrderContext };
