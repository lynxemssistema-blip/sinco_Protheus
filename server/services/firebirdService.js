const Firebird = require('node-firebird');
require('dotenv').config();

const options = {
    host: process.env.FB_HOST || '192.168.1.253',
    port: parseInt(process.env.FB_PORT || '3050', 10),
    database: process.env.FB_DATABASE || '/opt/firebird/database/metalfisa.fdb',
    user: process.env.FB_USER || 'SYSDBA',
    password: process.env.FB_PASSWORD || 'buana',
    lowercase_keys: false,
    role: null,
    pageSize: 4096,
    blobAsString: true
};

// Pool assíncrono para reutilização de conexões (máx 10)
const pool = Firebird.pool(10, options);

/**
 * Utilitário para limpar espaços em branco de strings em linhas do Firebird (CHAR/VARCHAR)
 */
function cleanRow(row) {
    if (!row || typeof row !== 'object') return row;
    const cleaned = {};
    for (const [k, v] of Object.entries(row)) {
        if (typeof v === 'string') {
            cleaned[k] = v.trim();
        } else if (Buffer.isBuffer(v)) {
            cleaned[k] = v.toString('utf-8').trim();
        } else {
            cleaned[k] = v;
        }
    }
    return cleaned;
}

/**
 * Executa uma consulta no Firebird de forma segura e estritamente somente leitura
 */
function queryFirebird(sql, params = []) {
    return new Promise((resolve, reject) => {
        // Garantia de segurança: Proibir operações de escrita
        const trimmedSql = sql.trim().toUpperCase();
        if (
            trimmedSql.startsWith('INSERT') ||
            trimmedSql.startsWith('UPDATE') ||
            trimmedSql.startsWith('DELETE') ||
            trimmedSql.startsWith('DROP') ||
            trimmedSql.startsWith('ALTER') ||
            trimmedSql.startsWith('EXECUTE PROCEDURE')
        ) {
            return reject(new Error('Operações de modificação não são permitidas no Firebird (Read-Only).'));
        }

        pool.get((err, db) => {
            if (err) {
                console.error('❌ Erro ao obter conexão do pool Firebird:', err.message);
                return reject(err);
            }

            db.query(sql, params, (queryErr, result) => {
                db.detach();
                if (queryErr) {
                    console.error('❌ Erro na query Firebird:', queryErr.message, '\nSQL:', sql);
                    return reject(queryErr);
                }

                const cleaned = Array.isArray(result) ? result.map(cleanRow) : cleanRow(result);
                resolve(cleaned);
            });
        });
    });
}

/**
 * Busca paginada e com filtros de produtos do MS Metal
 */
async function getProdutosMSMetal({
    page = 1,
    limit = 20,
    search = '',
    code = '',
    client_code = '',
    client_name = '',
    has_bom = ''
} = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const whereClauses = [];
    const params = [];

    // 1. Busca textual na descrição (multi-termo)
    if (search && search.trim()) {
        const terms = search.trim().split(/[\s,]+/).filter(Boolean);
        for (const term of terms) {
            whereClauses.push(`UPPER(p.PR_DESCR) LIKE ?`);
            params.push(`%${term.toUpperCase()}%`);
        }
    }

    // 2. Filtro por código interno ou referência de desenho (REFER1)
    if (code && code.trim()) {
        whereClauses.push(`(UPPER(p.PRODUTO) LIKE ? OR UPPER(p.REFER1) LIKE ?)`);
        const cTerm = `%${code.trim().toUpperCase()}%`;
        params.push(cTerm, cTerm);
    }

    // 3. Filtro por código do cliente (Part Number)
    if (client_code && client_code.trim()) {
        whereClauses.push(`EXISTS (
            SELECT 1 FROM MG_PRODUTO_R_CLIENTE c 
            WHERE c.PRODUTO = p.PRODUTO AND UPPER(c.COD_CLI) LIKE ?
        )`);
        params.push(`%${client_code.trim().toUpperCase()}%`);
    }

    // 4. Filtro por Razão Social do Cliente
    if (client_name && client_name.trim()) {
        whereClauses.push(`EXISTS (
            SELECT 1 FROM MG_PRODUTO_R_CLIENTE c 
            JOIN CLIENTES cl ON cl.CGC_CLI = c.CLIENTE 
            WHERE c.PRODUTO = p.PRODUTO AND UPPER(cl.RAZAO) LIKE ?
        )`);
        params.push(`%${client_name.trim().toUpperCase()}%`);
    }

    // 5. Filtro de presença de Estrutura BOM
    if (has_bom === 'true') {
        whereClauses.push(`EXISTS (SELECT 1 FROM MG_ESTRUTURA e WHERE e.COD_PRODUTO = p.PRODUTO)`);
    } else if (has_bom === 'false') {
        whereClauses.push(`NOT EXISTS (SELECT 1 FROM MG_ESTRUTURA e WHERE e.COD_PRODUTO = p.PRODUTO)`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Consulta de contagem total para a paginação
    const countSql = `SELECT COUNT(*) AS TOTAL FROM PRODUTO p ${whereSql}`;
    const countParams = [...params];

    // Consulta dos itens da página
    const dataSql = `
        SELECT FIRST ${limitNum} SKIP ${offset}
            p.PRODUTO,
            p.REFER1,
            p.PR_DESCR,
            p.COD_UNID,
            p.PESO,
            p.CLAS_FISC,
            p.ARQUIVO AS ARQUIVO_PROD,
            e.ID_ESTRUTURA,
            e.COD_DES_ESTRUTURA,
            e.COD_REVDES_ESTRUTURA,
            e.DESC_ESTRUTURA,
            e.ARQUIVO AS ARQUIVO_EST
        FROM PRODUTO p
        LEFT JOIN MG_ESTRUTURA e ON e.COD_PRODUTO = p.PRODUTO
        ${whereSql}
        ORDER BY 
            CASE WHEN (p.REFER1 IS NULL OR TRIM(p.REFER1) = '') THEN 1 ELSE 0 END,
            p.REFER1 ASC, 
            p.PRODUTO ASC
    `;

    const [countRes, products] = await Promise.all([
        queryFirebird(countSql, countParams),
        queryFirebird(dataSql, params)
    ]);

    const total = countRes && countRes[0] ? countRes[0].TOTAL || 0 : 0;

    // Se encontramos produtos, vamos buscar as referências de clientes em lote para os 20 produtos
    if (products.length > 0) {
        const prodCodes = [...new Set(products.map(p => p.PRODUTO).filter(Boolean))];
        if (prodCodes.length > 0) {
            const placeholders = prodCodes.map(() => '?').join(',');
            const clientRefsSql = `
                SELECT 
                    c.PRODUTO,
                    c.CLIENTE AS CNPJ,
                    c.COD_CLI AS CODIGO_CLIENTE,
                    c.REVISAO,
                    cl.RAZAO,
                    cl.NOMEFAN AS NOME_FANT
                FROM MG_PRODUTO_R_CLIENTE c
                LEFT JOIN CLIENTES cl ON cl.CGC_CLI = c.CLIENTE
                WHERE c.PRODUTO IN (${placeholders})
            `;
            try {
                const clientRefs = await queryFirebird(clientRefsSql, prodCodes);
                const refsMap = {};
                clientRefs.forEach(ref => {
                    const cod = ref.PRODUTO;
                    if (!refsMap[cod]) refsMap[cod] = [];
                    refsMap[cod].push(ref);
                });

                products.forEach(p => {
                    p.REFERENCIAS_CLIENTE = refsMap[p.PRODUTO] || [];
                });
            } catch (refErr) {
                console.warn('⚠️ Falha ao buscar referências de cliente no MS Metal:', refErr.message);
                products.forEach(p => { p.REFERENCIAS_CLIENTE = []; });
            }
        }
    }

    return {
        data: products,
        meta: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum)
        }
    };
}

/**
 * Busca os detalhes completos da estrutura (BOM, Matérias-Primas, Recursos, Subconjuntos)
 */
async function getEstruturaMSMetal(idOuCodigo) {
    if (!idOuCodigo) throw new Error('ID da estrutura ou código do produto não informado.');

    // 1. Localizar o cabeçalho da estrutura
    let estrutura = null;
    let idNum = parseInt(idOuCodigo, 10);

    if (!isNaN(idNum) && String(idNum) === String(idOuCodigo).trim()) {
        const res = await queryFirebird(
            `SELECT FIRST 1 e.*, p.PR_DESCR, p.REFER1, p.COD_UNID, p.PESO, p.CLAS_FISC, p.ARQUIVO AS ARQUIVO_PROD
             FROM MG_ESTRUTURA e
             LEFT JOIN PRODUTO p ON p.PRODUTO = e.COD_PRODUTO
             WHERE e.ID_ESTRUTURA = ?`,
            [idNum]
        );
        if (res && res.length > 0) estrutura = res[0];
    }

    // Se não achou por ID numérico direto, busca por código do produto ou REFER1
    if (!estrutura) {
        const res = await queryFirebird(
            `SELECT FIRST 1 e.*, p.PR_DESCR, p.REFER1, p.COD_UNID, p.PESO, p.CLAS_FISC, p.ARQUIVO AS ARQUIVO_PROD
             FROM PRODUTO p
             JOIN MG_ESTRUTURA e ON e.COD_PRODUTO = p.PRODUTO
             WHERE UPPER(p.REFER1) = UPPER(?) OR UPPER(p.PRODUTO) = UPPER(?)`,
            [String(idOuCodigo).trim(), String(idOuCodigo).trim()]
        );
        if (res && res.length > 0) estrutura = res[0];
    }

    // Se ainda não encontrou uma estrutura cadastrada, buscar apenas os dados cadastrais do produto
    if (!estrutura) {
        const prodRes = await queryFirebird(
            `SELECT FIRST 1 p.PRODUTO, p.REFER1, p.PR_DESCR, p.COD_UNID, p.PESO, p.CLAS_FISC, p.ARQUIVO AS ARQUIVO_PROD
             FROM PRODUTO p
             WHERE UPPER(p.REFER1) = UPPER(?) OR UPPER(p.PRODUTO) = UPPER(?)`,
            [String(idOuCodigo).trim(), String(idOuCodigo).trim()]
        );
        if (prodRes && prodRes.length > 0) {
            return {
                produto: prodRes[0],
                estrutura: null,
                materias_primas: [],
                subconjuntos: [],
                roteiro: [],
                clientes: []
            };
        }
        throw new Error(`Produto ou Estrutura "${idOuCodigo}" não encontrado no MS Metal.`);
    }

    const idEstrutura = estrutura.ID_ESTRUTURA;
    const codProduto = estrutura.COD_PRODUTO;

    // 2. Buscar em paralelo: Matérias-Primas, Subconjuntos, Roteiro de Operações e Clientes
    const [materiasPrimas, subconjuntos, roteiro, clientes] = await Promise.all([
        // Matérias-Primas
        queryFirebird(
            `SELECT 
                mp.ID_ESTRUTURA,
                mp.COD_PRODUTO,
                mp.DESC_MP,
                mp.QTDE_PC_MP,
                mp.QTDE_KG_MP,
                mp.UN1,
                p.REFER1 AS REFER_MP,
                p.CLAS_FISC AS NCM_MP
             FROM MG_ESTRUTURA_R_MATPRIMA mp
             LEFT JOIN PRODUTO p ON p.PRODUTO = mp.COD_PRODUTO
             WHERE mp.ID_ESTRUTURA = ?
             ORDER BY mp.DESC_MP ASC`,
            [idEstrutura]
        ),

        // Subconjuntos / Estrutura Filha
        queryFirebird(
            `SELECT 
                ee.ID_ESTRUTURA,
                ee.ID_COMPONENTE,
                ee.QTD_COMPONENTE,
                eFilha.DESC_ESTRUTURA,
                eFilha.COD_DES_ESTRUTURA,
                eFilha.COD_REVDES_ESTRUTURA,
                pFilho.REFER1 AS REFER_COMPONENTE,
                pFilho.PRODUTO AS PROD_COMPONENTE
             FROM MG_ESTRUTURA_R_ESTRUTURA ee
             LEFT JOIN MG_ESTRUTURA eFilha ON eFilha.ID_ESTRUTURA = ee.ID_COMPONENTE
             LEFT JOIN PRODUTO pFilho ON pFilho.PRODUTO = eFilha.COD_PRODUTO
             WHERE ee.ID_ESTRUTURA = ?`,
            [idEstrutura]
        ),

        // Roteiro de Operações & Centros de Trabalho
        queryFirebird(
            `SELECT 
                r.ID_ESTRUTURA,
                r.ORDEM_RECURSO,
                r.COD_RECURSO,
                r.TEMPO_PREP,
                r.TEMPO_OPER,
                rec.DSC_RECURSO,
                rec.SIGLA
             FROM MG_ESTRUTURA_R_RECURSO r
             LEFT JOIN MG_RECURSO rec ON rec.COD_RECURSO = r.COD_RECURSO
             WHERE r.ID_ESTRUTURA = ?
             ORDER BY r.ORDEM_RECURSO ASC`,
            [idEstrutura]
        ),

        // Clientes vinculados ao produto
        queryFirebird(
            `SELECT 
                c.PRODUTO,
                c.CLIENTE AS CNPJ,
                c.COD_CLI AS CODIGO_CLIENTE,
                c.REVISAO,
                cl.RAZAO,
                cl.NOMEFAN AS NOME_FANT
             FROM MG_PRODUTO_R_CLIENTE c
             LEFT JOIN CLIENTES cl ON cl.CGC_CLI = c.CLIENTE
             WHERE c.PRODUTO = ?`,
            [codProduto]
        )
    ]);

    return {
        estrutura,
        produto: {
            PRODUTO: estrutura.COD_PRODUTO,
            REFER1: estrutura.REFER1,
            PR_DESCR: estrutura.PR_DESCR,
            COD_UNID: estrutura.COD_UNID,
            PESO: estrutura.PESO,
            CLAS_FISC: estrutura.CLAS_FISC,
            ARQUIVO_PROD: estrutura.ARQUIVO_PROD
        },
        materias_primas: materiasPrimas || [],
        subconjuntos: subconjuntos || [],
        roteiro: roteiro || [],
        clientes: clientes || []
    };
}

module.exports = {
    queryFirebird,
    getProdutosMSMetal,
    getEstruturaMSMetal
};
