const express = require('express');
const router = express.Router();
const db = require('../db');
const mysql = require('../services/mysqlService');

// Rota para curva S do pedido
router.get('/', async (req, res) => {
    try {
        const { pedido, op, produto, cliente, operacao, setor, planned_date_start, planned_date_end } = req.query;

        // Converter datas do filtro do usuário (YYYY-MM-DD) para YYYYMMDD
        const userStartDate = planned_date_start ? planned_date_start.replace(/-/g, '') : null;
        const userEndDate = planned_date_end ? planned_date_end.replace(/-/g, '') : null;

        // Base filters
        let conditions = [`COALESCE(pl.d_e_l_e_t_, ' ') = ' '`];
        let params = [];
        let paramCount = 1;

        if (pedido) {
            conditions.push(`COALESCE(NULLIF(TRIM(pl.c2_pedido), ''), NULLIF(TRIM(root_op.c2_pedido), '')) LIKE $${paramCount}`);
            params.push(`%${pedido}%`);
            paramCount++;
        }
        if (op) {
            conditions.push(`TRIM(pl.c2_num) LIKE $${paramCount}`);
            params.push(`%${op}%`);
            paramCount++;
        }
        if (produto) {
            conditions.push(`(TRIM(pl.c2_produto) ILIKE $${paramCount} OR TRIM(pl.c2_descri) ILIKE $${paramCount})`);
            params.push(`%${produto}%`);
            paramCount++;
        }

        let opArray = [];
        if (operacao || setor) {
            opArray = operacao ? operacao.split(',').map(op => op.trim().toUpperCase()).filter(Boolean) : [];
            if (setor) {
                try {
                    const [sectorRecs] = await mysql.query(`SELECT recurso_id FROM pcp_setor_recursos WHERE setor_id = ?`, [setor]);
                    if (sectorRecs.length > 0) {
                        opArray.push(...sectorRecs.map(r => r.recurso_id.toUpperCase()));
                    } else if (opArray.length === 0) {
                        opArray.push('___NO_MATCH___');
                    }
                } catch (e) {
                    console.error('Erro ao buscar recursos do setor:', e);
                }
            }
            if (opArray.length > 0) {
                const opConditions = opArray.map((_, i) => `(g2.g2_operac LIKE $${paramCount + i} OR g2.g2_descri LIKE $${paramCount + i} OR g2.g2_recurso LIKE $${paramCount + i})`);
                conditions.push(`EXISTS (
                    SELECT 1 FROM sg2010 g2 
                    WHERE g2.g2_produto = pl.c2_produto 
                    AND COALESCE(g2.d_e_l_e_t_, ' ') = ' ' 
                    AND (${opConditions.join(' OR ')})
                )`);
                opArray.forEach(opItem => params.push(`%${opItem}%`));
                paramCount += opArray.length;
            }
        }

        const queryProtheus = `
            SELECT
                RTRIM(pl.c2_num)       AS op,
                RTRIM(pl.c2_item)      AS item_op,
                RTRIM(pl.c2_sequen)    AS sequen,
                COALESCE(NULLIF(TRIM(pl.c2_pedido), ''), NULLIF(TRIM(root_op.c2_pedido), '')) AS pedido_venda,
                RTRIM(pl.c2_datpri)    AS data_ini,
                RTRIM(pl.c2_datprf)    AS data_fim,
                COALESCE(pl.c2_quant, 0) AS qtd_planejada
            FROM sc2010 pl
            LEFT JOIN sc2010 root_op ON root_op.c2_num = pl.c2_num AND root_op.c2_item = pl.c2_item AND root_op.c2_sequen = '001' AND COALESCE(root_op.d_e_l_e_t_, ' ') = ' '
            WHERE ${conditions.join(' AND ')}
            LIMIT 5000
        `;
        const resultProtheus = await db.query(queryProtheus, params);
        const ops = resultProtheus.rows;

        let pedidoInfo = null;
        if (pedido) {
            try {
                // Ensure padding if pedido is less than 6 chars
                const pedidoFormatado = pedido.padStart(6, '0');
                const queryPedido = `
                    SELECT 
                        MIN(c5.c5_emissao) as data_emissao,
                        MAX(c6.c6_entreg) as data_entrega,
                        SUM(c6.c6_qtdven::numeric) as total_pecas
                    FROM sc6010 c6
                    LEFT JOIN sc5010 c5 ON c5.c5_num = c6.c6_num AND COALESCE(c5.d_e_l_e_t_, ' ') = ' '
                    WHERE c6.c6_num = $1 AND COALESCE(c6.d_e_l_e_t_, ' ') = ' '
                `;
                const resPed = await db.query(queryPedido, [pedidoFormatado]);
                if (resPed.rows.length > 0 && resPed.rows[0].total_pecas) {
                    pedidoInfo = {
                        data_emissao: resPed.rows[0].data_emissao,
                        data_entrega: resPed.rows[0].data_entrega,
                        total_pecas: resPed.rows[0].total_pecas
                    };
                }
            } catch (e) {
                console.error('Erro ao buscar dados do pedido:', e);
            }
        }

        if (ops.length === 0) {
            return res.json({ planejado: [], executado: [], opsFound: 0 });
        }

        // 2. Extrair listas únicas
        const listOpNums = [...new Set(ops.map(o => o.op))];
        const listItems = [...new Set(ops.map(o => o.item_op))];

        // 3. Buscar os Apontamentos reais executados (agrupados por data de fim) no MySQL
        const opNumbersPlaceholders = listOpNums.map(() => '?').join(',');
        const opItemsPlaceholders = listItems.map(() => '?').join(',');
        
        let opFilterSql = '';
        const mysqlParams = [...listOpNums, ...listItems];
        if (opArray.length > 0) {
            const opPlaceholders = opArray.map(() => '?').join(',');
            opFilterSql = `AND operacao_codigo IN (${opPlaceholders})`;
            mysqlParams.push(...opArray);
        }

        const queryApontamentos = `
            SELECT 
                op_numero, 
                op_item, 
                op_sequencia, 
                DATE_FORMAT(data_fim, '%Y%m%d') as data_executada,
                SUM(quantidade) as total_apontado
            FROM app_production_appointments
            WHERE op_numero IN (${opNumbersPlaceholders}) AND op_item IN (${opItemsPlaceholders}) AND data_fim IS NOT NULL ${opFilterSql}
            GROUP BY op_numero, op_item, op_sequencia, DATE_FORMAT(data_fim, '%Y%m%d')
        `;
        
        const [mysqlRows] = await mysql.query(queryApontamentos, mysqlParams);
        const apontamentos = mysqlRows;

        // 4. Estrutura de datas base
        let mapPlanejado = {}; // Data (YYYYMMDD) -> Qtd
        let mapExecutado = {}; // Data (YYYYMMDD) -> Qtd

        // Helpers para manipulação de datas YYYYMMDD
        const parseYMD = (s) => new Date(s.slice(0,4) + '-' + s.slice(4,6) + '-' + s.slice(6,8) + 'T12:00:00');
        const toYMD = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${y}${m}${dd}`;
        };

        // Fallback: usar datas do filtro do usuário → menor data global → '20000101'
        const allStartDates = ops
            .map(op => (op.data_ini && op.data_ini.trim()) || (op.data_fim && op.data_fim.trim()))
            .filter(d => d && d !== '20000101');
        const globalMinDate = allStartDates.length > 0 ? allStartDates.sort()[0] : null;
        const allEndDates = ops
            .map(op => (op.data_fim && op.data_fim.trim()) || (op.data_ini && op.data_ini.trim()))
            .filter(d => d && d !== '20000101');
        const globalMaxDate = allEndDates.length > 0 ? allEndDates.sort().reverse()[0] : null;

        // Prioridade do fallback: filtro do usuário → data global → '20000101'
        const fallbackStart = userStartDate || globalMinDate || '20000101';
        const fallbackEnd = userEndDate || globalMaxDate || fallbackStart;

        // Distribuir quantidade planejada proporcionalmente ao longo dos dias corridos (data_ini → data_fim)
        ops.forEach(op => {
            let startDt = op.data_ini && op.data_ini.trim() ? op.data_ini.trim() : null;
            let endDt = op.data_fim && op.data_fim.trim() ? op.data_fim.trim() : null;

            // Fallback: datas do filtro do usuário quando datas ausentes
            if (!startDt) startDt = fallbackStart;
            if (!endDt) endDt = fallbackEnd;

            // Garantir ordem cronológica
            if (startDt > endDt) { const tmp = startDt; startDt = endDt; endDt = tmp; }

            const qtde = Number(op.qtd_planejada);
            const startDate = parseYMD(startDt);
            const endDate = parseYMD(endDt);
            const totalDays = Math.max(1, Math.round((endDate - startDate) / 86400000) + 1);
            const qtyPerDay = qtde / totalDays;

            // Espalhar a quantidade uniformemente em cada dia corrido
            for (let i = 0; i < totalDays; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                const key = toYMD(d);
                mapPlanejado[key] = (mapPlanejado[key] || 0) + qtyPerDay;
            }
        });

        // Alocar executado por data real
        apontamentos.forEach(ap => {
            const dtReal = ap.data_executada;
            // Para não inflacionar quando há mais de 1 operação por sequência, 
            // no dashboard de pedidos a meta bruta ideal é uma heurística (apontamento / número médio de operações),
            // mas simplificaremos assumindo a somatória dos apontamentos para o gráfico bruto,
            // que em curva S padrão, já reflete evolução.
            // Pelo escopo, a gente conta a métrica apontada da peça/operação concluída.
            mapExecutado[dtReal] = (mapExecutado[dtReal] || 0) + Number(ap.total_apontado);
        });

        // 5. Unir todos os pontos do tempo para ter Eixo X contínuo
        const datasSet = new Set([...Object.keys(mapPlanejado), ...Object.keys(mapExecutado)]);
        let datasOrdenadas = Array.from(datasSet).sort();
        
        // Remove '20000101' se vazio
        datasOrdenadas = datasOrdenadas.filter(d => d !== '20000101' && d.trim() !== '');

        // 6. Gerar Array de Running Total (Soma Acumulada)
        let runningTotalPlanejado = 0;
        let runningTotalExecutado = 0;
        let dataAgrupada = [];

        datasOrdenadas.forEach(dt => {
            runningTotalPlanejado += (mapPlanejado[dt] || 0);
            runningTotalExecutado += (mapExecutado[dt] || 0);
            
            // Format to DD/MM/YYYY
            const dtStr = dt.substring(6,8) + '/' + dt.substring(4,6) + '/' + dt.substring(0,4);
            
            dataAgrupada.push({
                data_crua: dt,
                data: dtStr,
                planejado: Math.round(runningTotalPlanejado),
                executado: Math.round(runningTotalExecutado)
            });
        });

        res.json({
            meta_total_planejada: Math.round(runningTotalPlanejado),
            meta_total_executada: Math.round(runningTotalExecutado),
            curva: dataAgrupada,
            opsFound: ops.length,
            pedido_info: pedidoInfo
        });

    } catch (err) {
        console.error('[curva-s] Erro:', err.message);
        res.status(500).json({ error: 'Erro ao gerar curva S', details: err.message });
    }
});

module.exports = router;
