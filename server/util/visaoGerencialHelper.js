const express = require('express');
const router = express.Router();
const db = require('../db');
const mysqlPool = require('../services/mysqlService');
const { getInactiveOrdersFilter } = require('./pedidoFilterHelper');

async function getVisaoGerencial(req, res, isAtrasos) {
    try {
        const getInactiveFilter = await getInactiveOrdersFilter();
        
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
              ${getInactiveFilter('c5.c5_num')}
        `;
        const result = await db.query(query);
        
        if (result.rows.length === 0) {
            return res.json({ data: [] });
        }

        // 2. Enrich with Clients (sa1010)
        const clientPairs = [...new Set(result.rows.map(r => `${r.cod_cliente}|${r.loja_cliente}`))];
        const clientsQuery = `
            SELECT TRIM(a1_cod) as a1_cod, a1_loja, a1_nome
            FROM sa1010
            WHERE COALESCE(d_e_l_e_t_, '') = ''
        `;
        // Since sa1010 isn't extremely huge, we can just fetch the needed ones or all of them.
        // But for safety, let's fetch only what's needed if possible, or just fetch all clients (fast enough).
        // Let's use IN with tuples.
        const clientCodes = [...new Set(result.rows.map(r => r.cod_cliente))];
        const sa1Result = await db.query(`
            SELECT TRIM(a1_cod) as cod, a1_loja as loja, TRIM(a1_nome) as nome
            FROM sa1010
            WHERE a1_cod = ANY($1) AND COALESCE(d_e_l_e_t_, '') = ''
        `, [clientCodes]);
        
        const clientMap = {};
        sa1Result.rows.forEach(c => {
            clientMap[`${c.cod}|${c.loja}`] = c.nome;
        });

        // 3. Enrich with Products (sb1010)
        const productCodes = [...new Set(result.rows.map(r => r.codigo))];
        const sb1Result = await db.query(`
            SELECT TRIM(b1_cod) as cod, TRIM(b1_desc) as descricao
            FROM sb1010
            WHERE b1_cod = ANY($1) AND COALESCE(d_e_l_e_t_, '') = ''
        `, [productCodes]);
        
        const productMap = {};
        sb1Result.rows.forEach(p => {
            productMap[p.cod] = p.descricao;
        });
        
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
                today.setHours(0,0,0,0);
                return Math.floor((today - targetDate) / (1000 * 60 * 60 * 24));
            };

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
                valor_saldo: parseFloat(row.valor_saldo || 0)
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
