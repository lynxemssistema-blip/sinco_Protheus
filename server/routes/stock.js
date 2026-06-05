const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
require('dotenv').config();

console.log("🚀🚀🚀 STOCK.JS FILE LOADED - VERSION 2026-01-20 13:47 🚀🚀🚀");

const dbConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB,
    port: 3306
};

// GET /:codigo/saldo - Retorna saldo atual do produto (Protheus SB2010/SB2990)
router.get('/:codigo/saldo', async (req, res) => {
    try {
        const { codigo } = req.params;
        const codLimpo = codigo.trim().toUpperCase();

        const query = `
            SELECT SUM(saldo) as saldo FROM (
                SELECT COALESCE(SUM(b2_qatu), 0) as saldo FROM public.sb2010 WHERE TRIM(b2_cod) = $1 AND COALESCE(d_e_l_e_t_, '') <> '*'
                UNION ALL
                SELECT COALESCE(SUM(b2_qatu), 0) as saldo FROM public.sb2990 WHERE TRIM(b2_cod) = $1 AND COALESCE(d_e_l_e_t_, '') <> '*'
            ) t
        `;
        const result = await db.query(query, [codLimpo]);
        const saldo = result.rows[0]?.saldo ? parseFloat(result.rows[0].saldo) : 0;
        
        res.json({ saldo });
    } catch (error) {
        console.error('Erro ao buscar saldo:', error);
        res.status(500).json({ error: 'Erro ao buscar saldo' });
    }
});

// POST /balances-batch - Retorna o saldo dos produtos para o almoxarifado 01
router.post('/balances-batch', express.json(), async (req, res) => {
    try {
        const { codigos } = req.body;
        if (!Array.isArray(codigos) || codigos.length === 0) {
            return res.json({});
        }
        
        const codigosLimpos = codigos.map(c => c.trim().toUpperCase()).filter(c => c);
        if (codigosLimpos.length === 0) {
            return res.json({});
        }

        const placeholders = codigosLimpos.map((_, i) => `$${i + 1}`).join(',');
        const query = `
            SELECT 
                TRIM(b2_cod) as codigo,
                COALESCE(SUM(b2_qatu), 0) as saldo
            FROM public.sb2010 
            WHERE TRIM(b2_cod) IN (${placeholders}) 
              AND TRIM(b2_local) = '01'
              AND COALESCE(d_e_l_e_t_, '') <> '*'
            GROUP BY TRIM(b2_cod)
        `;
        
        const result = await db.query(query, codigosLimpos);
        
        const balanceMap = {};
        codigosLimpos.forEach(c => {
            balanceMap[c] = 0;
        });
        
        result.rows.forEach(row => {
            balanceMap[row.codigo] = parseFloat(row.saldo);
        });

        res.json(balanceMap);
    } catch (error) {
        console.error('Erro ao buscar saldos em lote:', error);
        res.status(500).json({ error: 'Erro ao buscar saldos em lote' });
    }
});

// GET /:codigo/movimentos - Retorna histórico de movimentações (Protheus SD3010)
router.get('/:codigo/movimentos', async (req, res) => {
    try {
        const { codigo } = req.params;
        const query = `
            SELECT
                D3_FILIAL as filial,
                D3_DOC as documento,
                TRIM(D3_COD) as codigo,
                D3_LOCAL as armazem,
                COALESCE(D3_QUANT, 0)::numeric(18,6) as quantidade,
                D3_EMISSAO as emissao,
                D3_TM as tm,
                D3_TIPO as tipo,
                D3_STATUS as status
            FROM public.SD3010
            WHERE TRIM(D3_COD) = $1 AND D_E_L_E_T_ = ' '
            ORDER BY D3_EMISSAO DESC, D3_DOC
            LIMIT 50
        `;
        const result = await db.query(query, [codigo.trim().toUpperCase()]);
        
        // Mapear para o formato que o frontend espera (id, produto_codigo, tipo, quantidade, data_movimento, observacao)
        const rows = result.rows.map((r, index) => ({
            id: r.documento + '-' + index,
            produto_codigo: r.codigo,
            tipo: (r.tm < '500') ? 'E' : 'S',
            quantidade: parseFloat(r.quantidade),
            data_movimento: r.emissao, // YYYYMMDD
            observacao: `Arm: ${r.armazem} | TM: ${r.tm} | Doc: ${r.documento}`,
            usuario: 'Protheus' // Indicador de origem
        }));

        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar movimentos:', error);
        res.status(500).json({ error: 'Erro ao buscar movimentos' });
    }
});

// POST / - Registra nova movimentação
router.post('/', async (req, res) => {
    // Protheus is the source of truth for stock. Manual direct inserts from here are blocked.
    res.status(501).json({ error: 'Lançamento manual de estoque desativado. O estoque deve ser movimentado via ERP Protheus.' });
});

// ... existing imports
const db = require('../db'); // Import Postgres Connection

// ... existing endpoints

// GET /balances - SIMPLIFIED WORKING VERSION
router.get('/balances', async (req, res) => {
    console.log("\n\n========== BALANCES ROUTE CALLED ==========");
    console.log("Query params:", req.query);

    try {
        const {
            empresa,
            filial,
            almoxarifado,
            codigo,
            descricao,
            grupo,
            tipo,
            limit = 500
        } = req.query;

        console.log("Parsed params:", { empresa, filial, almoxarifado, codigo, descricao, grupo, tipo, limit });

        const params = [];
        let paramCount = 1;

        // Simple WHERE clause - no complex logic
        let whereClause = "WHERE TRIM(COALESCE(s.d_e_l_e_t_, '')) = '' AND TRIM(COALESCE(p.d_e_l_e_t_, '')) = '' ";
        whereClause += "AND s.b2_cod !~ '^MT[0-9]' "; // Exclusão MT

        // Add filters
        if (codigo) {
            params.push(`%${codigo.toUpperCase()}%`);
            whereClause += `AND s.b2_cod LIKE $${paramCount++} `;
        }
        if (descricao) {
            params.push(`%${descricao.toUpperCase()}%`);
            whereClause += `AND p.b1_desc LIKE $${paramCount++} `;
        }
        if (grupo) {
            params.push(`${grupo}%`);
            whereClause += `AND p.b1_grupo LIKE $${paramCount++} `;
        }
        if (tipo) {
            params.push(`${tipo}%`);
            whereClause += `AND p.b1_tipo LIKE $${paramCount++} `;
        }
        if (filial) {
            params.push(`${filial}%`);
            whereClause += `AND s.b2_filial LIKE $${paramCount++} `;
        }
        if (almoxarifado) {
            params.push(`${almoxarifado}%`);
            whereClause += `AND s.b2_local LIKE $${paramCount++} `;
        }

        params.push(parseInt(limit));
        const limitParam = paramCount++;

        // Build queries for each branch
        const queries = [];

        if (!empresa || empresa === '010') {
            queries.push(`(
                SELECT 
                    '010'::text as empresa,
                    s.b2_filial as filial,
                    s.b2_local as almoxarifado,
                    s.b2_cod as cod_produto,
                    p.b1_desc as descricao,
                    p.b1_um as unidade,
                    p.b1_tipo as tipo,
                    p.b1_grupo as grupo,
                    s.b2_qatu as saldo_atual,
                    s.b2_qemp as empenho
                FROM public.sb2010 s
                JOIN public.sb1010 p ON TRIM(p.b1_cod) = TRIM(s.b2_cod)
                ${whereClause}
                LIMIT $${limitParam}
            )`);
        }

        if (!empresa || empresa === '990') {
            queries.push(`(
                SELECT 
                    '990'::text as empresa,
                    s.b2_filial as filial,
                    s.b2_local as almoxarifado,
                    s.b2_cod as cod_producto,
                    p.b1_desc as descricao,
                    p.b1_um as unidade,
                    p.b1_tipo as tipo,
                    p.b1_grupo as grupo,
                    s.b2_qatu as saldo_atual,
                    s.b2_qemp as empenho
                FROM public.sb2990 s
                JOIN public.sb1990 p ON TRIM(p.b1_cod) = TRIM(s.b2_cod)
                ${whereClause}
                LIMIT $${limitParam}
            )`);
        }

        const sql = queries.join(' UNION ALL ');

        console.log("\n=== EXECUTING SQL ===");
        console.log("SQL (FULL):\n", sql);
        console.log("Params:", params);

        // Write to file for debugging
        const fs = require('fs');
        fs.writeFileSync('sql_debug.txt', `SQL:\n${sql}\n\nParams:\n${JSON.stringify(params)}`);
        console.log("SQL saved to sql_debug.txt");

        const result = await db.query(sql, params);

        console.log("=== QUERY RESULT ===");
        console.log("Rows returned:", result.rows.length);
        if (result.rows.length > 0) {
            console.log("First row:", result.rows[0]);
        }

        const rows = result.rows;

        // --- ENRICHMENT (DOCUMENTOS) ---
        if (rows.length > 0) {
            let connection;
            try {
                // Collect codes (handling potential alias typo from query)
                const codigos = rows.map(r => (r.cod_produto || r.cod_producto || '').trim()).filter(c => c);

                if (codigos.length > 0) {
                    connection = await mysql.createConnection(dbConfig);

                    // Create placeholders
                    const placeholders = codigos.map(() => '?').join(',');

                    const [docs] = await connection.execute(
                        `SELECT produto_codigo, url_arquivo FROM produtos_docs WHERE produto_codigo IN (${placeholders}) ORDER BY id ASC`,
                        codigos
                    );

                    const docMap = {};
                    docs.forEach(d => {
                        if (!docMap[d.produto_codigo]) {
                            docMap[d.produto_codigo] = d.url_arquivo;
                        }
                    });

                    rows.forEach(row => {
                        const code = (row.cod_produto || row.cod_producto || '').trim();
                        const fileUrl = docMap[code];
                        row.tem_arquivos = !!fileUrl;
                        row.primeiro_arquivo = fileUrl || null;
                    });
                }
            } catch (errDocs) {
                console.error('Erro ao buscar documentos para o saldo:', errDocs);
            } finally {
                if (connection) await connection.end();
            }
        }

        res.json(rows);

    } catch (error) {
        console.error('[STOCK ERROR]:', error.message);
        res.status(500).json({ error: 'Erro ao buscar saldos: ' + error.message });
    }
});

// GET /requisicoes - Listagem de requisições internas (SD3)
router.get('/requisicoes', async (req, res) => {
    try {
        const { filial, documento, codigo, dataInicial, dataFinal, limit = 500 } = req.query;
        const params = [];
        let paramCount = 1;

        let whereClause = "WHERE d3.D_E_L_E_T_ = ' ' ";

        if (filial) {
            whereClause += `AND d3.D3_FILIAL = $${paramCount++} `;
            params.push(filial);
        }
        if (documento) {
            whereClause += `AND d3.D3_DOC LIKE $${paramCount++} `;
            params.push(`%${documento}%`);
        }
        if (codigo) {
            whereClause += `AND d3.D3_COD LIKE $${paramCount++} `;
            params.push(`%${codigo.toUpperCase()}%`);
        }
        if (dataInicial) {
            const di = dataInicial.replace(/-/g, '');
            whereClause += `AND d3.D3_EMISSAO >= $${paramCount++} `;
            params.push(di);
        }
        if (dataFinal) {
            const df = dataFinal.replace(/-/g, '');
            whereClause += `AND d3.D3_EMISSAO <= $${paramCount++} `;
            params.push(df);
        }

        const query = `
            SELECT
                d3.D3_FILIAL as filial,
                d3.D3_DOC as documento,
                TRIM(d3.D3_COD) as codigo,
                sb1.B1_DESC AS descricao,
                d3.D3_LOCAL as armazem,
                COALESCE(d3.D3_QUANT, 0)::numeric(18,6) as quantidade,
                d3.D3_EMISSAO as emissao,
                d3.D3_TM as tm,
                d3.D3_TIPO as tipo,
                d3.D3_STATUS as status
            FROM public.SD3010 d3
            LEFT JOIN public.SB1010 sb1
                ON sb1.D_E_L_E_T_ = ' '
                AND btrim(sb1.B1_COD) = btrim(d3.D3_COD)
            ${whereClause}
            ORDER BY d3.D3_FILIAL, d3.D3_EMISSAO DESC, d3.D3_DOC, d3.D3_COD
            LIMIT $${paramCount}
        `;
        params.push(parseInt(limit));

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar requisições:', error);
        res.status(500).json({ error: 'Erro ao buscar requisições', details: error.message });
    }
});

module.exports = router;
