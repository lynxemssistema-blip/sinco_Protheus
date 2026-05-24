const express = require('express');
const router = express.Router();
const db = require('../db');
const mysqlPool = require('../services/mysqlService');
const { getInactiveOrdersFilter } = require('./pedidoFilterHelper');

async function getVisaoGerencial(req, res, isAtrasos) {
    try {
        const getInactiveFilter = await getInactiveOrdersFilter();
        const { startDate, endDate } = req.query;

        let dateFilterClause = '';
        if (startDate && endDate) {
            const startStr = startDate.replace(/-/g, '');
            const endStr = endDate.replace(/-/g, '');

            let pcpPedidos = [];
            try {
                // Consultar o MySQL para obter pedidos que têm previsão PCP no intervalo
                const [pcpRows] = await mysqlPool.query(
                    'SELECT DISTINCT TRIM(pedido) as pedido FROM app_pcp_delivery_forecasts WHERE data_entrega_pcp BETWEEN ? AND ?',
                    [startDate, endDate]
                );
                pcpPedidos = pcpRows.map(r => r.pedido).filter(Boolean);
            } catch (err) {
                console.error('Erro ao buscar pedidos do PCP no MySQL:', err);
            }

            if (pcpPedidos.length > 0) {
                const pedList = pcpPedidos.map(p => `'${p.replace(/'/g, "''")}'`).join(',');
                dateFilterClause = `
                    AND (
                        (TRIM(c6.c6_entreg) BETWEEN '${startStr}' AND '${endStr}')
                        OR (TRIM(c5.c5_num) IN (${pedList}))
                    )
                `;
            } else {
                dateFilterClause = `
                    AND (TRIM(c6.c6_entreg) BETWEEN '${startStr}' AND '${endStr}')
                `;
            }
        }

        // 1. Fetch only sc5010 and sc6010 first. This avoids massive nested loops with sa1010/sb1010
        const query = `
            SELECT
                TRIM(c5.c5_num) as pedido,
                TRIM(c5.c5_cliente) as cod_cliente,
                c5.c5_lojacli as loja_cliente,
                TRIM(c6.c6_item) as item,
                TRIM(c6.c6_produto) as codigo,
                COALESCE(c6.c6_qtdven, 0)::numeric(18,6) as quantidade,
                COALESCE(c6.c6_qtdent, 0)::numeric(18,6) as qtd_entreg,
                (COALESCE(c6.c6_qtdven, 0) - COALESCE(c6.c6_qtdent, 0))::numeric(18,6) as qtd_faturar,
                c6.c6_prcven::numeric(18,2) as valor_unitario,
                ((COALESCE(c6.c6_qtdven, 0) - COALESCE(c6.c6_qtdent, 0)) * COALESCE(c6.c6_prcven, 0))::numeric(18,2) as valor_saldo,
                TRIM(c5.c5_emissao) as c5_emissao_raw,
                TRIM(c6.c6_entreg) as c6_entreg_raw
            FROM public.sc6010 c6
            JOIN public.sc5010 c5
                ON c5.c5_num = c6.c6_num
                AND c5.c5_filial = c6.c6_filial
                AND COALESCE(c5.d_e_l_e_t_, '') = ''
                AND c5.c5_tipo <> 'B'
            WHERE COALESCE(c6.d_e_l_e_t_, '') = '' 
              AND (COALESCE(c6.c6_qtdven, 0) - COALESCE(c6.c6_qtdent, 0)) > 0
              AND NULLIF(TRIM(c6.c6_entreg), '') IS NOT NULL
              ${isAtrasos ? "AND TRIM(c6.c6_entreg) < TO_CHAR(CURRENT_DATE, 'YYYYMMDD')" : ""}
              ${dateFilterClause}
              ${getInactiveFilter('c5.c5_num')}
        `;
        const result = await db.query(query);

        if (result.rows.length === 0) {
            return res.json({ data: [] });
        }

        // 2 + 3. Enrich with Clients (sa1010) and Products (sb1010) — in parallel
        const clientCodes = [...new Set(result.rows.map(r => r.cod_cliente))];
        const productCodes = [...new Set(result.rows.map(r => r.codigo))];
        const uniquePedidos = [...new Set(result.rows.map(r => r.pedido))];

        const [sa1Result, sb1Result, forecastResult] = await Promise.all([
            db.query(`
                SELECT TRIM(a1_cod) as cod, a1_loja as loja, TRIM(a1_nome) as nome
                FROM sa1010
                WHERE a1_cod = ANY($1) AND COALESCE(d_e_l_e_t_, '') = ''
            `, [clientCodes]),
            db.query(`
                SELECT TRIM(b1_cod) as cod, TRIM(b1_desc) as descricao
                FROM sb1010
                WHERE b1_cod = ANY($1) AND COALESCE(d_e_l_e_t_, '') = ''
            `, [productCodes]),
            uniquePedidos.length > 0 ? mysqlPool.query(`
                SELECT TRIM(pedido) as pedido, TRIM(item) as item, data_entrega_pcp, quantidade_pcp
                FROM app_pcp_delivery_forecasts
                WHERE TRIM(pedido) IN (${uniquePedidos.map(() => '?').join(',')})
                ORDER BY id ASC
            `, uniquePedidos) : Promise.resolve([[]])
        ]);

        const clientMap = {};
        sa1Result.rows.forEach(c => {
            clientMap[`${c.cod}|${c.loja}`] = c.nome;
        });

        const productMap = {};
        sb1Result.rows.forEach(p => {
            productMap[p.cod] = p.descricao;
        });

        const forecastsMap = {};
        if (forecastResult && forecastResult[0]) {
            forecastResult[0].forEach(f => {
                const key = `${f.pedido}|${f.item}`;
                forecastsMap[key] = f;
            });
        }

        const data = result.rows.map(row => {
            const parseDate = (dStr) => {
                if (!dStr || dStr.trim() === '' || dStr.length < 8) return '';
                return `${dStr.substring(6, 8)}/${dStr.substring(4, 6)}/${dStr.substring(2, 4)}`;
            };

            const parseDiasAtraso = (dStr) => {
                if (!dStr || dStr.trim() === '' || dStr.length < 8) return 0;
                const d = parseInt(dStr.substring(6, 8), 10);
                const m = parseInt(dStr.substring(4, 6), 10) - 1;
                const y = parseInt(dStr.substring(0, 4), 10);
                const targetDate = new Date(y, m, d);
                if (isNaN(targetDate.getTime())) return 0;

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return Math.floor((today - targetDate) / (1000 * 60 * 60 * 24));
            };

            const key = `${row.pedido}|${row.item}`;
            const forecast = forecastsMap[key];

            return {
                ...row,
                nome_cliente: clientMap[`${row.cod_cliente}|${row.loja_cliente}`] || '',
                descricao: productMap[row.codigo] || '',
                emissao_formatada: parseDate(row.c5_emissao_raw),
                entrega_raw: row.c6_entreg_raw || '',
                entrega_formatada: parseDate(row.c6_entreg_raw),
                dias_atraso: parseDiasAtraso(row.c6_entreg_raw),
                quantidade: parseFloat(row.quantidade || 0),
                qtd_entreg: parseFloat(row.qtd_entreg || 0),
                qtd_faturar: parseFloat(row.qtd_faturar || 0),
                valor_unitario: parseFloat(row.valor_unitario || 0),
                valor_saldo: parseFloat(row.valor_saldo || 0),
                data_entrega_pcp: forecast ? forecast.data_entrega_pcp : null,
                quantidade_pcp: forecast ? parseFloat(forecast.quantidade_pcp) : null
            };
        });

        // Sort data explicitly
        data.sort((a, b) => {
            if (a.c6_entreg_raw !== b.c6_entreg_raw) {
                return (a.c6_entreg_raw || '').localeCompare(b.c6_entreg_raw || '');
            }
            return (a.pedido || '').localeCompare(b.pedido || '');
        });

        res.json({ data: data });
    } catch (err) {
        console.error(`Erro na Visão Gerencial ${isAtrasos ? 'Atrasos' : 'Fábrica'}:`, err);
        res.status(500).json({ error: 'Erro ao processar visão gerencial.', details: err.message });
    }
}

module.exports = {
    getVisaoGerencial
};
