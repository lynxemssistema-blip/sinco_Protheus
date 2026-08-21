const mysqlPool = require('./mysqlService');

let _fcCache = { map: new Map(), expiresAt: 0 };

async function getForecastMapCached() {
    if (Date.now() < _fcCache.expiresAt) return _fcCache.map;
    const map = new Map();
    try {
        const [rows] = await mysqlPool.query(`
            SELECT TRIM(pedido) as pedido, TRIM(item) as item,
                   data_entrega_pcp,
                   data_prevista_faturamento,
                   quantidade_pcp,
                   TRIM(op_protheus) as op_protheus
            FROM app_pcp_delivery_forecasts
            WHERE pedido IS NOT NULL AND item IS NOT NULL
        `);
        for (const row of rows) {
            const baseKey = `${row.pedido}|${row.item}`;
            
            // 1. Mapeamento específico por OP se houver
            if (row.op_protheus && row.op_protheus !== '-') {
                const opClean = String(row.op_protheus).trim();
                const opPrefix6 = opClean.substring(0, 6);
                const opPrefix8 = opClean.length >= 8 ? opClean.substring(0, 8) : null;
                const keysToSet = new Set([opClean, opPrefix6]);
                if (opPrefix8) keysToSet.add(opPrefix8);

                keysToSet.forEach(opKeyPart => {
                    const opKey = `${baseKey}|${opKeyPart}`;
                    map.set(opKey, {
                        data_entrega_pcp: row.data_entrega_pcp || null,
                        data_prevista_faturamento: row.data_prevista_faturamento || null,
                        quantidade_pcp: row.quantidade_pcp || null,
                        op_protheus: row.op_protheus
                    });
                });
            }
            
            // 2. Mapeamento geral/fallback por Pedido|Item (compatibilidade com telas que não usam OPs)
            if (!map.has(baseKey)) {
                map.set(baseKey, {
                    data_entrega_pcp: row.data_entrega_pcp || null,
                    data_prevista_faturamento: row.data_prevista_faturamento || null,
                    quantidade_pcp: row.quantidade_pcp || null,
                    op_protheus: row.op_protheus || null
                });
            } else {
                const current = map.get(baseKey);
                const currentVal = current.data_entrega_pcp ? new Date(current.data_entrega_pcp) : null;
                const rowVal = row.data_entrega_pcp ? new Date(row.data_entrega_pcp) : null;
                if (rowVal && (!currentVal || rowVal > currentVal)) {
                    current.data_entrega_pcp = row.data_entrega_pcp;
                }
                const currentPrev = current.data_prevista_faturamento ? new Date(current.data_prevista_faturamento) : null;
                const rowPrev = row.data_prevista_faturamento ? new Date(row.data_prevista_faturamento) : null;
                if (rowPrev && (!currentPrev || rowPrev > currentPrev)) {
                    current.data_prevista_faturamento = row.data_prevista_faturamento;
                }
                current.quantidade_pcp = (parseFloat(current.quantidade_pcp) || 0) + (parseFloat(row.quantidade_pcp) || 0);
            }
        }
    } catch (err) {
        console.error('getForecastMapCached error:', err.message);
    }
    _fcCache = { map, expiresAt: Date.now() + 60_000 };
    return map;
}

function invalidateForecastCache() {
    _fcCache.expiresAt = 0;
}

module.exports = {
    getForecastMapCached,
    invalidateForecastCache
};
