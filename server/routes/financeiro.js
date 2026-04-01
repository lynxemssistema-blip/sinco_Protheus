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

module.exports = router;

