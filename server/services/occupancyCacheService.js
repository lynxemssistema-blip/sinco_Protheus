const mysqlPool = require('./mysqlService');
const db = require('../db');

function sanitizeString(str) {
    if (!str) return '';
    // Replace null bytes and replacement character
    let clean = str.replace(/\0/g, '').replace(/\uFFFD/g, '?');
    // Keep printable ASCII, Latin-1 supplement (for Portuguese accented characters like ç, ã, á, etc.)
    clean = clean.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?');
    return clean.trim();
}

let isRebuilding = false;

async function rebuildDailyOccupancyCache() {
    if (isRebuilding) {
        console.log('⚠️ [OCCUPANCY CACHE] Rebuild already in progress. Skipping...');
        return;
    }
    isRebuilding = true;
    const start = Date.now();
    console.log('⏳ [OCCUPANCY CACHE] Rebuilding daily occupancy cache...');

    let pgClient = null;
    try {
        console.time('Step 1: DB Connect');
        pgClient = await db.connect();
        console.timeEnd('Step 1: DB Connect');

        // 1. Fetch open OPs from Postgres
        console.time('Step 1: Fetch OPs from PG');
        const pgResult = await pgClient.query(`
            SELECT TRIM(c2.c2_num) AS op_num, TRIM(c2.c2_item) AS item_op, TRIM(c2.c2_sequen) AS sequen,
                   TRIM(c2.c2_produto) AS produto, 
                   TRIM(c2.c2_pedido) AS pedido,
                   TRIM(c2.c2_itempv) AS item_pedido,
                   c2.c2_quant AS qtde, c2.c2_quje AS qtde_feita,
                   '' AS cliente_nome
            FROM public.sc2010 c2
            WHERE COALESCE(c2.d_e_l_e_t_, '') IN ('', ' ')
              AND c2.c2_quje < c2.c2_quant
              AND c2.c2_num NOT IN ('', '-', '000000')
            ORDER BY c2.c2_num, c2.c2_item LIMIT 50000
        `);
        const opRows = pgResult.rows;

        // Enrich missing pedido from root OP (sequen '001') in memory
        const opNumToPedido = {};
        for (const r of opRows) {
            if (r.pedido) opNumToPedido[r.op_num] = { pedido: r.pedido, item_pedido: r.item_pedido };
        }
        for (const r of opRows) {
            if (!r.pedido && opNumToPedido[r.op_num]) {
                r.pedido = opNumToPedido[r.op_num].pedido;
                r.item_pedido = opNumToPedido[r.op_num].item_pedido;
            }
        }

        // Enrich client names in batch
        const distinctPedidos = [...new Set(opRows.map(r => r.pedido).filter(Boolean))];
        if (distinctPedidos.length > 0) {
            const clientMap = {};
            for (let i = 0; i < distinctPedidos.length; i += 500) {
                const chunk = distinctPedidos.slice(i, i + 500);
                const chunkFilter = chunk.map(p => `'${p}'`).join(',');
                const [cliRows] = await mysqlPool.query(`
                    SELECT c5.c5_num, a1.a1_nome
                    FROM sc5010 c5
                    LEFT JOIN sa1010 a1 ON a1.a1_cod = c5.c5_cliente AND a1.d_e_l_e_t_ IN ('', ' ')
                    WHERE c5.d_e_l_e_t_ IN ('', ' ') AND c5.c5_num IN (${chunkFilter})
                `);
                cliRows.forEach(c => { clientMap[c.c5_num.trim()] = (c.a1_nome || '').trim(); });
            }
            for (const r of opRows) {
                if (r.pedido && clientMap[r.pedido]) {
                    r.cliente_nome = clientMap[r.pedido];
                }
            }
        }
        console.timeEnd('Step 1: Fetch OPs from PG');
        console.log(`Fetched ${opRows.length} OPs from Postgres.`);

        const opMap = {};
        const opBaseMap = {};
        for (const r of opRows) {
            if (r.sequen) {
                opMap[`${r.op_num}|${r.item_op}|${r.sequen}`] = r;
            }
            if (!opMap[`${r.op_num}|${r.item_op}`] || r.sequen === '001') {
                opMap[`${r.op_num}|${r.item_op}`] = r;
            }
            if (!opBaseMap[r.op_num]) {
                opBaseMap[r.op_num] = r;
            }
        }

        // 2. Fetch routing
        console.time('Step 2: Fetch routing');
        const distinctProds = [...new Set(opRows.map(r => r.produto).filter(Boolean))];
        const routingMap = {};
        const recursoDescriMap = {};
        if (distinctProds.length > 0) {
            const pgRouting = await pgClient.query(`
                SELECT TRIM(g2.g2_produto) prod, TRIM(g2.g2_operac) operac,
                       TRIM(g2.g2_recurso) recurso, g2.g2_tempad tempo,
                       TRIM(h1.h1_descri) recurso_descri
                FROM public.sg2010 g2
                LEFT JOIN public.sh1010 h1 ON h1.h1_codigo = g2.g2_recurso AND COALESCE(h1.d_e_l_e_t_,'') IN ('',' ')
                WHERE g2.g2_produto = ANY($1)
                  AND COALESCE(g2.d_e_l_e_t_, '') IN ('', ' ')
            `, [distinctProds]);
            for (const r of pgRouting.rows) {
                if (!routingMap[r.prod]) routingMap[r.prod] = {};
                const desc = sanitizeString(r.recurso_descri || r.recurso);
                routingMap[r.prod][r.operac] = {
                    recurso_codigo: r.recurso,
                    recurso_descri: desc,
                    tempo: Math.round((parseFloat(r.tempo) || 0) * 1000) / 1000
                };
                if (r.recurso && !recursoDescriMap[r.recurso]) {
                    recursoDescriMap[r.recurso] = desc;
                }
            }
        }
        console.timeEnd('Step 2: Fetch routing');

        // 3. Planning MySQL
        console.time('Step 3: Fetch planning from MySQL');
        const opNums = [...new Set(opRows.map(r => r.op_num).filter(Boolean))];
        let planRows = [];
        if (opNums.length > 0) {
            for (let i = 0; i < opNums.length; i += 500) {
                const chunk = opNums.slice(i, i + 500);
                const [rows] = await mysqlPool.query(`
                    SELECT op_numero, op_item, op_sequencia, operacao_codigo, recurso_codigo, produto_codigo, pedido_venda, data_planejada_inicio, data_planejada_fim 
                    FROM app_production_planning 
                    WHERE op_numero IN (?) OR LEFT(op_numero, 6) IN (?)
                `, [chunk, chunk]);
                planRows = planRows.concat(rows);
            }
        }
        console.timeEnd('Step 3: Fetch planning from MySQL');

        // 3B. Fractional Delivery Forecasts from MySQL
        console.time('Step 3B: Fetch fraction forecasts from MySQL');
        const fractionForecastMap = {};
        if (opNums.length > 0) {
            for (let i = 0; i < opNums.length; i += 500) {
                const chunk = opNums.slice(i, i + 500);
                const [fracRows] = await mysqlPool.query(`
                    SELECT op_protheus, quantidade_pcp, numero_lote, pedido, item, data_entrega_pcp
                    FROM app_pcp_delivery_forecasts
                    WHERE op_protheus IN (?) OR LEFT(op_protheus, 6) IN (?)
                `, [chunk, chunk]);
                for (const fr of fracRows) {
                    const cleanFracOp = (fr.op_protheus || '').trim();
                    if (cleanFracOp) {
                        fractionForecastMap[cleanFracOp] = fr;
                    }
                }
            }
        }
        console.timeEnd('Step 3B: Fetch fraction forecasts from MySQL');

        // 4. Appointments MySQL
        console.time('Step 4: Fetch appointments from MySQL');
        const apptsMap = {};
        const dailyApptsMap = {}; // mapping dateStr -> key -> quantity
        if (opNums.length > 0) {
            for (let i = 0; i < opNums.length; i += 500) {
                const chunk = opNums.slice(i, i + 500);
                const ph = chunk.map(() => '?').join(',');
                const [rows] = await mysqlPool.query(`
                    SELECT op_numero, op_item, operacao_codigo, data_fim, quantidade 
                    FROM app_production_appointments 
                    WHERE op_numero IN (${ph}) OR LEFT(op_numero, 6) IN (${ph})
                `, [...chunk, ...chunk]);
                for (const a of rows) {
                    const key = `${(a.op_numero||'').trim()}|${(a.op_item||'').trim()}|${(a.operacao_codigo||'').trim()}`;
                    apptsMap[key] = (apptsMap[key] || 0) + Number(a.quantidade || 0);
                    
                    if (a.data_fim) {
                        const dateObj = new Date(a.data_fim);
                        if (!isNaN(dateObj.getTime())) {
                            const dateStr = `${dateObj.getFullYear()}${String(dateObj.getMonth()+1).padStart(2,'0')}${String(dateObj.getDate()).padStart(2,'0')}`;
                            if (!dailyApptsMap[dateStr]) dailyApptsMap[dateStr] = {};
                            dailyApptsMap[dateStr][key] = (dailyApptsMap[dateStr][key] || 0) + Number(a.quantidade || 0);
                        }
                    }
                }
            }
        }
        console.timeEnd('Step 4: Fetch appointments from MySQL');

        // 5. Configs
        console.time('Step 5: Fetch configs from MySQL');
        const [capRows] = await mysqlPool.query('SELECT recurso_codigo, tempo_padrao_minutos, capacidade_diaria_minutos FROM app_recursos_capacidade');
        const configMap = {};
        capRows.forEach(r => { configMap[r.recurso_codigo] = r; });

        const [inativosResult] = await mysqlPool.query('SELECT pedido_numero FROM app_pedidos_inativos');
        const inativosSet = new Set(inativosResult.map(r => r.pedido_numero.trim()));
        console.timeEnd('Step 5: Fetch configs from MySQL');

        // Helper functions
        const fmtDate = (val) => {
            if (!val) return '';
            if (typeof val === 'string') return val.replace(/-/g,'').substring(0,8);
            if (val instanceof Date) {
                return `${val.getFullYear()}${String(val.getMonth()+1).padStart(2,'0')}${String(val.getDate()).padStart(2,'0')}`;
            }
            return '';
        };

        const getBusinessDaysBetween = (startStr, endStr) => {
            if (!startStr) return [];
            if (!endStr || endStr < startStr) return [startStr];
            const y1 = parseInt(startStr.substring(0,4));
            const m1 = parseInt(startStr.substring(4,6)) - 1;
            const d1 = parseInt(startStr.substring(6,8));
            const y2 = parseInt(endStr.substring(0,4));
            const m2 = parseInt(endStr.substring(4,6)) - 1;
            const d2 = parseInt(endStr.substring(6,8));
            let current = new Date(y1, m1, d1, 12, 0, 0);
            const end = new Date(y2, m2, d2, 12, 0, 0);
            if (isNaN(current.getTime()) || isNaN(end.getTime())) return [startStr];
            const dates = [];
            while (current <= end) {
                const day = current.getDay();
                if (day !== 0 && day !== 6) {
                    dates.push(`${current.getFullYear()}${String(current.getMonth() + 1).padStart(2, '0')}${String(current.getDate()).padStart(2, '0')}`);
                }
                current.setDate(current.getDate() + 1);
            }
            return dates.length > 0 ? dates : [startStr];
        };

        // 6. Aggregation — direto de app_production_planning por recurso_codigo + data_planejada_inicio
        // Não depende de operacao_codigo ou roteiro. O planning já tem recurso_codigo gravado.
        console.time('Step 6: Aggregation');
        const aggregated = {};

        // Busca a carga planejada agrupada por recurso + dia diretamente do MySQL
        // Distribui a carga de OPs que cruzam múltiplos dias pelos dias de negócio no range
        const yieldLoop = () => new Promise(resolve => setImmediate(resolve));

        // Processa em chunks de 500 para não bloquear o loop de eventos
        for (let planIdx = 0; planIdx < planRows.length; planIdx++) {
            if (planIdx > 0 && planIdx % 500 === 0) await yieldLoop();
            const plan = planRows[planIdx];

            const opn = (plan.op_numero || '').trim();
            const itn = (plan.op_item   || '').trim();
            const seqn = (plan.op_sequencia || '').trim();
            const baseOp = opn.length > 6 ? opn.substring(0, 6) : opn;

            // Resolve opRow: tenta chave com sequencia, chave completa, chave base com item, ou primeiro match
            const opRow = opMap[`${opn}|${itn}|${seqn}`]
                || opMap[`${baseOp}|${itn}|${seqn}`]
                || opMap[`${opn}|${itn}`] 
                || opMap[`${baseOp}|${itn}`] 
                || opMap[`${baseOp}|${opn.substring(6, 8)}|${seqn}`]
                || opMap[`${baseOp}|${opn.substring(6, 8)}`] 
                || opBaseMap[baseOp];

            // 1. Descarta pedidos/projetos inativos (app_pedidos_inativos)
            const ped = (opRow?.pedido || '').trim();
            if ((ped && inativosSet.has(ped)) || inativosSet.has(baseOp) || inativosSet.has(opn)) continue;

            // 2. Descarta ordens de serviço sem cliente comercial
            if (!opRow?.cliente_nome || !opRow.cliente_nome.trim()) continue;

            const pIni = fmtDate(plan.data_planejada_inicio);
            const pFim = fmtDate(plan.data_planejada_fim);
            if (!pIni) continue;

            // Determina o código do recurso: planning > roteiro > config
            const opcn = (plan.operacao_codigo || '').trim();
            let resCode = (plan.recurso_codigo || '').trim();
            if (!resCode && opRow) {
                const prodRouting = routingMap[opRow.produto] || {};
                const rEntry = prodRouting[opcn.padStart(4, '0')] || prodRouting[opcn];
                if (rEntry) resCode = rEntry.recurso_codigo;
            }
            if (!resCode) continue;

            const conf     = configMap[resCode] || {};
            const capacity = parseFloat(conf.capacidade_diaria_minutos) || 480;

            // Obtém o tempo unitário do roteiro para calcular carga em minutos
            let unitTimeMin = 0;
            if (opRow) {
                const prodRouting = routingMap[opRow.produto] || {};
                const rEntry = prodRouting[opcn.padStart(4, '0')] || prodRouting[opcn];
                if (rEntry) {
                    unitTimeMin = parseFloat(rEntry.tempo) || 0;
                }
            }
            // Fallback: usa tempo_padrao_minutos do recurso se não achou roteiro
            if (unitTimeMin <= 0) unitTimeMin = parseFloat(conf.tempo_padrao_minutos) || 0;

            // Calcula quantidade total da fração vs OP principal
            const fracInfo = fractionForecastMap[opn];
            let qtde_total = 0;
            if (fracInfo && Number(fracInfo.quantidade_pcp) > 0) {
                qtde_total = Number(fracInfo.quantidade_pcp);
            } else if (opRow) {
                qtde_total = Number(opRow.qtde) || 0;
            }

            // Calcula qtde pendente e executada
            const opcKey = `${opn}|${itn}|${opcn}`;
            const qtde_apontada = apptsMap[opcKey] || 0;
            const qtde_feita    = qtde_apontada > 0 ? qtde_apontada : (fracInfo ? 0 : (opRow ? (Number(opRow.qtde_feita) || 0) : 0));
            const qtde_pendente = Math.max(0, qtde_total - qtde_feita);

            const min_totais = qtde_total    * unitTimeMin;
            const min_exec   = Math.min(qtde_feita, qtde_total) * unitTimeMin;
            const min_pend   = qtde_pendente * unitTimeMin;

            // Distribui pelos dias úteis entre inicio e fim
            const bDays = getBusinessDaysBetween(pIni, pFim);
            let remaining_totais = min_totais || capacity; // se não há tempo, usa 1 capacidade como proxy

            const resDescri = recursoDescriMap[resCode] || resCode;

            for (let i = 0; i < bDays.length; i++) {
                const d = bDays[i];
                const alloc_totais = (i === bDays.length - 1) ? remaining_totais : Math.min(remaining_totais, capacity);
                const alloc_pend   = (min_totais > 0) ? (alloc_totais / min_totais) * min_pend : alloc_totais;
                remaining_totais  -= alloc_totais;

                if (!aggregated[d]) aggregated[d] = {};
                if (!aggregated[d][resCode]) {
                    aggregated[d][resCode] = {
                        recurso_codigo: resCode,
                        recurso_descri: resDescri,
                        minutos_consumidos: 0,
                        minutos_totais: 0,
                        minutos_executados: 0,
                        minutos_pendentes: 0,
                        capacidade_diaria: capacity
                    };
                }
                const bucket = aggregated[d][resCode];
                bucket.minutos_consumidos += alloc_pend;
                bucket.minutos_totais     += alloc_totais;
                bucket.minutos_pendentes  += alloc_pend;
            }
        }

        // 6.2 Aggregate daily actual execution from appointments
        let apptCounter = 0;
        for (const [d, apptsOnDate] of Object.entries(dailyApptsMap)) {
            for (const [key, qty] of Object.entries(apptsOnDate)) {
                if (++apptCounter % 500 === 0) await yieldLoop();
                const parts = key.split('|');
                const opn = parts[0];
                const itn = parts[1];
                const opcn = parts[2];
                const baseOp = opn.length > 6 ? opn.substring(0, 6) : opn;
                
                const opRow = opMap[`${opn}|${itn}`] 
                    || opMap[`${baseOp}|${itn}`] 
                    || opMap[`${baseOp}|${opn.substring(6, 8)}`] 
                    || opBaseMap[baseOp];
                if (!opRow) continue;
                
                const prodRouting = routingMap[opRow.produto] || {};
                const routeEntry = prodRouting[opcn];
                if (!routeEntry) continue;
                
                const resCode = routeEntry.recurso_codigo;
                if (!resCode) continue;
                
                const conf = configMap[resCode] || {};
                const g2_minutos = Math.round((parseFloat(routeEntry.tempo) || 0) * 1000) / 1000;
                let unitTimeMin = g2_minutos > 0 ? g2_minutos : (parseFloat(conf.tempo_padrao_minutos) || 0);
                const capacity = conf.capacidade_diaria_minutos || 480;
                
                const execMins = qty * unitTimeMin;
                
                if (!aggregated[d]) aggregated[d] = {};
                if (!aggregated[d][resCode]) {
                    aggregated[d][resCode] = {
                        recurso_codigo: resCode, recurso_descri: routeEntry.recurso_descri,
                        minutos_consumidos: 0, minutos_totais: 0, minutos_executados: 0, minutos_pendentes: 0,
                        capacidade_diaria: capacity
                    };
                }
                aggregated[d][resCode].minutos_executados += execMins;
            }
        }
        console.timeEnd('Step 6: Aggregation');

        // 7. Write to MySQL Cache Table
        // 7.1 Ensure table exists (catch permission denied if already exists)
        await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS app_recursos_ocupacao_diaria (
                id INT AUTO_INCREMENT PRIMARY KEY,
                data DATE NOT NULL,
                recurso_codigo VARCHAR(50) NOT NULL,
                recurso_descri VARCHAR(150),
                minutos_consumidos DOUBLE NOT NULL DEFAULT 0,
                minutos_totais DOUBLE NOT NULL DEFAULT 0,
                minutos_executados DOUBLE NOT NULL DEFAULT 0,
                minutos_pendentes DOUBLE NOT NULL DEFAULT 0,
                capacidade_diaria DOUBLE NOT NULL DEFAULT 0,
                taxa_ocupacao DOUBLE NOT NULL DEFAULT 0,
                percentual_executado DOUBLE NOT NULL DEFAULT 0,
                ops_json LONGTEXT,
                ultima_atualizacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY idx_data_recurso (data, recurso_codigo)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `).catch(() => {});

        // 7.2 Clear table safely
        await mysqlPool.query('DELETE FROM app_recursos_ocupacao_diaria').catch(() => {});

        // 7.3 Bulk insert
        const insertRows = [];
        Object.keys(aggregated).forEach(dateStr => {
            const y = dateStr.substring(0,4);
            const m = dateStr.substring(4,6);
            const d = dateStr.substring(6,8);
            const dateISO = `${y}-${m}-${d}`;

            Object.keys(aggregated[dateStr]).forEach(resCode => {
                const bucket = aggregated[dateStr][resCode];
                const tx = bucket.capacidade_diaria > 0
                    ? (bucket.minutos_consumidos / bucket.capacidade_diaria) * 100
                    : (bucket.minutos_consumidos > 0 ? 999 : 0);
                const pctExec = bucket.capacidade_diaria > 0
                    ? (bucket.minutos_executados / bucket.capacidade_diaria) * 100
                    : (bucket.minutos_executados > 0 ? 999 : 0);

                const opsArray = [];

                insertRows.push([
                    dateISO,
                    resCode,
                    bucket.recurso_descri || resCode,
                    bucket.minutos_consumidos,
                    bucket.minutos_totais,
                    bucket.minutos_executados,
                    bucket.minutos_pendentes,
                    bucket.capacidade_diaria,
                    tx,
                    pctExec,
                    JSON.stringify(opsArray)
                ]);
            });
        });

        if (insertRows.length > 0) {
            console.log(`Writing ${insertRows.length} rows to MySQL cache in chunks of 500...`);
            for (let i = 0; i < insertRows.length; i += 500) {
                const chunk = insertRows.slice(i, i + 500);
                try {
                    await mysqlPool.query(`
                        INSERT INTO app_recursos_ocupacao_diaria 
                        (data, recurso_codigo, recurso_descri, minutos_consumidos, minutos_totais, minutos_executados, minutos_pendentes, capacidade_diaria, taxa_ocupacao, percentual_executado, ops_json)
                        VALUES ?
                    `, [chunk]);
                    console.log(`  - Wrote chunk ${Math.floor(i / 500) + 1} (${chunk.length} rows)`);
                } catch (writeErr) {
                    console.warn(`  - Cache chunk write skipped: ${writeErr.message}`);
                }
            }
        }

        console.log(`✅ [OCCUPANCY CACHE] Rebuilt cache successfully in ${Date.now() - start}ms.`);
    } catch (err) {
        console.error('❌ [OCCUPANCY CACHE] Error rebuilding daily occupancy cache:', err);
    } finally {
        if (pgClient) pgClient.release();
        isRebuilding = false;
    }
}

module.exports = { rebuildDailyOccupancyCache };
