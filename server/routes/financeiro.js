const express = require('express');
const router = express.Router();
const { query } = require('../db');

// Decode a base64-encoded PostgreSQL bytea field to a proper UTF-8 string.
//
// WHY THIS EXISTS:
// The Protheus database uses WIN1252 encoding. Table SE2010 contains at least
// one record whose text fields include byte 0x8D — a byte that is undefined in
// WIN1252. When PostgreSQL tries to send that byte to a UTF-8 client, it throws:
//   "character with byte sequence 0x8d in encoding WIN1252 has no equivalent in UTF8"
// causing a 500 on every request that touches those rows.
//
// FIX: Instead of returning text columns directly (which triggers the conversion
// error), we fetch them as `encode(TRIM(field)::bytea, 'base64')`. PostgreSQL
// encodes the column bytes as base64 ASCII — no WIN1252→UTF8 conversion happens.
// On the Node side we decode base64 → Buffer → UTF-8 string; Node's Buffer
// handles any invalid sequences gracefully (replaces with U+FFFD) instead of
// throwing. Valid accented Portuguese characters (é, ã, ç …) decode correctly.
const decField = (b64) => {
    if (!b64) return '';
    return Buffer.from(b64, 'base64').toString('utf8').trim();
};

// GET /api/financeiro/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const { data_inicio, data_fim, filial = '010', date_filter_type = 'vencimento' } = req.query;

        let baseQuery = `
            SELECT
                encode(TRIM(SE2.E2_NUM)::bytea,      'base64') AS titulo,
                encode(TRIM(SE2.E2_PREFIXO)::bytea,  'base64') AS prefixo,
                encode(TRIM(SA2.A2_NOME)::bytea,     'base64') AS fornecedor,
                encode(COALESCE(TRIM(SED.ED_DESCRIC), 'SEM NATUREZA')::bytea, 'base64') AS natureza_desc,
                encode(TRIM(SE2.E2_NATUREZ)::bytea,  'base64') AS natureza_cod,
                encode(TRIM(SE2.E2_EMISSAO)::bytea,  'base64') AS data_emissao,
                encode(TRIM(SE2.E2_VENCTO)::bytea,   'base64') AS vencimento,
                SE2.E2_VALOR                                    AS valor_original,
                SE2.E2_SALDO                                    AS saldo,
                COALESCE(SE2.E2_MULTA, 0)                      AS multa,
                COALESCE(SE2.E2_JUROS, 0)                      AS juros,
                COALESCE(SE2.E2_MOEDA, 1)                      AS moeda,
                encode(TRIM(SE2.E2_PARCELA)::bytea,  'base64') AS parcela,
                encode(TRIM(SE2.E2_TIPO)::bytea,     'base64') AS tipo,
                CASE
                    WHEN TRIM(SE2.E2_BAIXA) <> '' THEN 'Pago'
                    WHEN SE2.E2_VENCTO < TO_CHAR(CURRENT_DATE, 'YYYYMMDD') AND TRIM(SE2.E2_BAIXA) = '' THEN 'Atrasado'
                    ELSE 'Aberto'
                END AS status
            FROM
                SE2${filial} SE2
            LEFT JOIN
                SA2${filial} SA2 ON SA2.A2_COD = SE2.E2_FORNECE AND SA2.A2_LOJA = SE2.E2_LOJA AND SA2.D_E_L_E_T_ = ' '
            LEFT JOIN LATERAL (
                SELECT ED_DESCRIC FROM SED${filial}
                WHERE ED_CODIGO = SE2.E2_NATUREZ AND D_E_L_E_T_ = ' '
                LIMIT 1
            ) SED ON true
            WHERE
                SE2.D_E_L_E_T_ = ' '
        `;

        const params = [];
        const filterColumn = date_filter_type === 'emissao' ? 'SE2.E2_EMISSAO' : 'SE2.E2_VENCTO';

        if (data_inicio && data_fim) {
            baseQuery += ` AND ${filterColumn} BETWEEN $1 AND $2 `;
            params.push(data_inicio.replace(/-/g, ''), data_fim.replace(/-/g, ''));
        } else {
            baseQuery += ` AND ${filterColumn} >= TO_CHAR(CURRENT_DATE - INTERVAL '3 months', 'YYYYMMDD') `;
        }

        const orderByColumn = date_filter_type === 'emissao' ? 'SE2.E2_EMISSAO' : 'SE2.E2_VENCTO';
        baseQuery += ` ORDER BY ${orderByColumn} ASC LIMIT 3000`;

        const { rows } = await query(baseQuery, params);

        // Decode all base64 fields back to readable UTF-8 strings
        const decoded = rows.map(row => ({
            titulo:         decField(row.titulo),
            prefixo:        decField(row.prefixo),
            fornecedor:     decField(row.fornecedor),
            natureza_desc:  decField(row.natureza_desc),
            natureza_cod:   decField(row.natureza_cod),
            data_emissao:   decField(row.data_emissao),
            vencimento:     decField(row.vencimento),
            valor_original: row.valor_original,
            saldo:          row.saldo,
            multa:          row.multa,
            juros:          row.juros,
            moeda:          row.moeda,
            parcela:        decField(row.parcela),
            tipo:           decField(row.tipo),
            status:         row.status,
        }));

        res.json(decoded);
    } catch (error) {
        console.error('Erro na rota financeiro/dashboard:', error);
        res.status(500).json({ error: 'Erro interno ao consultar dados financeiros.' });
    }
});

// GET /api/financeiro/fluxo-caixa (Consolidado SE1 - Receber e SE2 - Pagar)
router.get('/fluxo-caixa', async (req, res) => {
    try {
        const { data_inicio, data_fim, filial = '010' } = req.query;

        // Query para Contas a Receber (SE1)
        let querySE1 = `
            SELECT 
                'RECEBER' as fluxo,
                encode(TRIM(SE1.E1_NUM)::bytea,      'base64') AS titulo,
                encode(TRIM(SA1.A1_NOME)::bytea,     'base64') AS entidade,
                encode(TRIM(SE1.E1_EMISSAO)::bytea,  'base64') AS data_emissao,
                encode(TRIM(SE1.E1_VENCTO)::bytea,   'base64') AS vencimento,
                SE1.E1_VALOR                                    AS valor_original,
                SE1.E1_SALDO                                    AS saldo,
                CASE 
                    WHEN TRIM(SE1.E1_BAIXA) <> '' THEN 'Recebido'
                    WHEN SE1.E1_VENCTO < TO_CHAR(CURRENT_DATE, 'YYYYMMDD') AND TRIM(SE1.E1_BAIXA) = '' THEN 'Atrasado'
                    ELSE 'Aberto'
                END AS status
            FROM 
                SE1${filial} SE1
            LEFT JOIN 
                SA1${filial} SA1 ON SA1.A1_COD = SE1.E1_CLIENTE AND SA1.A1_LOJA = SE1.E1_LOJA AND SA1.D_E_L_E_T_ = ' '
            WHERE 
                SE1.D_E_L_E_T_ = ' '
        `;

        // Query para Contas a Pagar (SE2)
        let querySE2 = `
            SELECT 
                'PAGAR' as fluxo,
                encode(TRIM(SE2.E2_NUM)::bytea,      'base64') AS titulo,
                encode(TRIM(SA2.A2_NOME)::bytea,     'base64') AS entidade,
                encode(TRIM(SE2.E2_EMISSAO)::bytea,  'base64') AS data_emissao,
                encode(TRIM(SE2.E2_VENCTO)::bytea,   'base64') AS vencimento,
                SE2.E2_VALOR                                    AS valor_original,
                SE2.E2_SALDO                                    AS saldo,
                CASE 
                    WHEN TRIM(SE2.E2_BAIXA) <> '' THEN 'Pago'
                    WHEN SE2.E2_VENCTO < TO_CHAR(CURRENT_DATE, 'YYYYMMDD') AND TRIM(SE2.E2_BAIXA) = '' THEN 'Atrasado'
                    ELSE 'Aberto'
                END AS status
            FROM 
                SE2${filial} SE2
            LEFT JOIN 
                SA2${filial} SA2 ON SA2.A2_COD = SE2.E2_FORNECE AND SA2.A2_LOJA = SE2.E2_LOJA AND SA2.D_E_L_E_T_ = ' '
            WHERE 
                SE2.D_E_L_E_T_ = ' '
        `;

        const params = [];
        if (data_inicio && data_fim) {
            const startStr = data_inicio.replace(/-/g, '');
            const endStr = data_fim.replace(/-/g, '');
            querySE1 += ` AND SE1.E1_VENCTO BETWEEN $1 AND $2 `;
            querySE2 += ` AND SE2.E2_VENCTO BETWEEN $1 AND $2 `;
            params.push(startStr, endStr);
        } else {
            // Default: últimos 3 meses e todo futuro
            querySE1 += ` AND SE1.E1_VENCTO >= TO_CHAR(CURRENT_DATE - INTERVAL '3 months', 'YYYYMMDD') `;
            querySE2 += ` AND SE2.E2_VENCTO >= TO_CHAR(CURRENT_DATE - INTERVAL '3 months', 'YYYYMMDD') `;
        }

        // Executa ambas em paralelo
        const [resSE1, resSE2] = await Promise.all([
            query(querySE1, params),
            query(querySE2, params)
        ]);

        const decodeRow = (row) => ({
            fluxo: row.fluxo,
            titulo: decField(row.titulo),
            entidade: decField(row.entidade),
            data_emissao: decField(row.data_emissao),
            vencimento: decField(row.vencimento),
            valor_original: row.valor_original,
            saldo: row.saldo,
            status: row.status
        });

        res.json({
            receber: resSE1.rows.map(decodeRow),
            pagar: resSE2.rows.map(decodeRow)
        });

    } catch (error) {
        console.error('Erro na rota financeiro/fluxo-caixa:', error);
        res.status(500).json({ error: 'Erro interno ao consultar fluxo de caixa.' });
    }
});

// GET /api/financeiro/plano-contas
router.get('/plano-contas', async (req, res) => {
    try {
        const { filial = '010' } = req.query;

        const baseQuery = `
            SELECT 
                encode(TRIM(CT1.CT1_CONTA)::bytea, 'base64') AS codigo,
                encode(TRIM(CT1.CT1_DESC01)::bytea, 'base64') AS descricao,
                encode(TRIM(CT1.CT1_CLASSE)::bytea, 'base64') AS classe,
                encode(TRIM(CT1.CT1_NORMAL)::bytea, 'base64') AS natureza,
                encode(TRIM(CT1.CT1_NTSPED)::bytea, 'base64') AS grupo_sped,
                encode(TRIM(CT1.CT1_BLOQ)::bytea, 'base64') AS bloqueio,
                encode(TRIM(CT1.CT1_CTASUP)::bytea, 'base64') AS resiliencia_ou_superior -- Often contains superior relation
            FROM 
                CT1${filial} CT1
            WHERE 
                CT1.D_E_L_E_T_ = ' '
            ORDER BY 
                CT1.CT1_CONTA ASC
        `;

        const { rows } = await query(baseQuery);

        const decoded = rows.map(row => ({
            codigo: decField(row.codigo),
            descricao: decField(row.descricao),
            classe: decField(row.classe),
            natureza: decField(row.natureza),
            grupo_sped: decField(row.grupo_sped),
            bloqueio: decField(row.bloqueio),
            superior: decField(row.resiliencia_ou_superior)
        }));

        res.json(decoded);
    } catch (error) {
        console.error('Erro na rota financeiro/plano-contas:', error);
        res.status(500).json({ error: 'Erro interno ao consultar plano de contas.' });
    }
});

// GET /api/financeiro/balancete
router.get('/balancete', async (req, res) => {
    try {
        const { data_inicio, data_fim, filial = '010' } = req.query;

        let ct2JoinCond = `(CT2.CT2_DEBITO = CT1.CT1_CONTA OR CT2.CT2_CREDIT = CT1.CT1_CONTA) AND CT2.D_E_L_E_T_ = ' '`;
        const params = [];

        if (data_inicio && data_fim) {
            const startStr = data_inicio.replace(/-/g, '');
            const endStr = data_fim.replace(/-/g, '');
            ct2JoinCond += ` AND CT2.CT2_DATA BETWEEN $1 AND $2`;
            params.push(startStr, endStr);
        } else {
            // Fallback default: Start of year to today
            ct2JoinCond += ` AND CT2.CT2_DATA BETWEEN TO_CHAR(DATE_TRUNC('year', CURRENT_DATE), 'YYYYMMDD') AND TO_CHAR(CURRENT_DATE, 'YYYYMMDD')`;
        }

        const baseQuery = `
            SELECT 
                encode(TRIM(CT1.CT1_CONTA)::bytea, 'base64') AS codigo,
                encode(TRIM(CT1.CT1_DESC01)::bytea, 'base64') AS descricao,
                encode(TRIM(CT1.CT1_CLASSE)::bytea, 'base64') AS classe,
                encode(TRIM(CT1.CT1_NORMAL)::bytea, 'base64') AS natureza,
                COALESCE(SUM(CASE WHEN CT2.CT2_DEBITO = CT1.CT1_CONTA THEN CT2.CT2_VALOR ELSE 0 END), 0) AS total_debito,
                COALESCE(SUM(CASE WHEN CT2.CT2_CREDIT = CT1.CT1_CONTA THEN CT2.CT2_VALOR ELSE 0 END), 0) AS total_credito,
                COALESCE(SUM(CASE WHEN CT2.CT2_DEBITO = CT1.CT1_CONTA THEN CT2.CT2_VALOR ELSE 0 END), 0) -
                COALESCE(SUM(CASE WHEN CT2.CT2_CREDIT = CT1.CT1_CONTA THEN CT2.CT2_VALOR ELSE 0 END), 0) AS saldo_atual
            FROM 
                CT1${filial} CT1
            LEFT JOIN 
                CT2${filial} CT2 ON ${ct2JoinCond} 
            WHERE 
                CT1.D_E_L_E_T_ = ' '
            GROUP BY 
                CT1.CT1_CONTA, CT1.CT1_DESC01, CT1.CT1_CLASSE, CT1.CT1_NORMAL
            ORDER BY 
                CT1.CT1_CONTA ASC
        `;

        const { rows } = await query(baseQuery, params);

        let decoded = rows.map(row => {
            return {
                codigo: decField(row.codigo),
                descricao: decField(row.descricao),
                classe: decField(row.classe),
                natureza: decField(row.natureza),
                total_debito: Number(row.total_debito) || 0,
                total_credito: Number(row.total_credito) || 0,
                saldo_atual: Number(row.saldo_atual) || 0
            };
        });

        res.json(decoded);
    } catch (error) {
        console.error('Erro na rota financeiro/balancete:', error);
        res.status(500).json({ error: 'Erro interno ao consultar balancete dinâmico.' });
    }
});

// GET /api/financeiro/razonete
router.get('/razonete', async (req, res) => {
    try {
        const { conta, data_inicio, data_fim, filial = '010' } = req.query;

        if (!conta) {
            return res.status(400).json({ error: 'Conta é obrigatória.' });
        }

        let baseQuery = `
            SELECT 
                encode(TRIM(CT2.CT2_DATA)::bytea, 'base64')  AS data_lancamento,
                encode(TRIM(CT2.CT2_DOC)::bytea, 'base64')   AS documento,
                encode(TRIM(CT2.CT2_LOTE)::bytea, 'base64')  AS lote,
                encode(TRIM(CT2.CT2_HIST)::bytea, 'base64')  AS historico,
                CT2.CT2_VALOR                                AS valor,
                CASE WHEN CT2.CT2_DEBITO = $1 THEN 'D' ELSE 'C' END as tipo
            FROM 
                CT2${filial} CT2
            WHERE 
                CT2.D_E_L_E_T_ = ' ' 
                AND (CT2.CT2_DEBITO = $1 OR CT2.CT2_CREDIT = $1)
        `;

        const params = [conta];

        if (data_inicio && data_fim) {
            const startStr = data_inicio.replace(/-/g, '');
            const endStr = data_fim.replace(/-/g, '');
            baseQuery += ` AND CT2.CT2_DATA BETWEEN $2 AND $3 `;
            params.push(startStr, endStr);
        }

        baseQuery += ` ORDER BY CT2.CT2_DATA ASC, CT2.CT2_DOC ASC LIMIT 1500 `;

        const { rows } = await query(baseQuery, params);

        const decoded = rows.map(row => ({
            data_lancamento: decField(row.data_lancamento),
            documento: decField(row.documento),
            lote: decField(row.lote),
            historico: decField(row.historico),
            valor: Number(row.valor) || 0,
            tipo: row.tipo,
        }));

        res.json(decoded);
    } catch (error) {
        console.error('Erro na rota financeiro/razonete:', error);
        res.status(500).json({ error: 'Erro interno ao consultar razonete.' });
    }
});

module.exports = router;
