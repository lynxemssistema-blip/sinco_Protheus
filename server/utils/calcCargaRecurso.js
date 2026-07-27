/**
 * calcCargaRecurso.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Calcula a carga por recurso (em minutos) para um produto acabado,
 * somando todos os níveis da estrutura de produto (BOM recursivo via SG1)
 * mais o roteiro do próprio produto acabado (nível 0 via SG2).
 *
 * Ordem de prioridade por recurso:
 *   1. SG2 do produto acabado           → tempo_peca × qtdFaturar
 *   2. SG2 de cada componente (SG1 CTE) → tempo_peca × g1_quant_acumulada × qtdFaturar
 *   3. app_recursos_capacidade          → fallback APENAS se o recurso está no
 *      SG2 (produto ou componente) mas com tempad = 0
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * @param {string} produto
 *   Código do produto acabado (já com TRIM aplicado)
 *
 * @param {number} qtdFaturar
 *   Quantidade a faturar / saldo do item do pedido
 *
 * @param {Object} routingMap
 *   Mapa de roteiros pre-processado:
 *   { [codigo]: { [recurso]: { tempo_peca: number, setup: number } } }
 *   Construído a partir do SG2010 para produtos + todos os componentes da CTE.
 *
 * @param {Object} bomMap
 *   Mapa da estrutura explodida recursivamente:
 *   { [produto]: [{ comp: string, quant: number }] }
 *   Quantidades já acumuladas em todos os níveis (SUM via CTE recursiva).
 *
 * @param {Object} capacidadeMap
 *   Fallback de tempo padrão por recurso:
 *   { [recurso_codigo]: number }  ← app_recursos_capacidade.tempo_padrao_minutos
 *
 * @returns {Object}
 *   { 'rec_MO0001': 45.5, 'rec_MO0013': 12.3, ... }
 *   Chaves no formato  `rec_${recurso_codigo}`  para uso direto como keys ExcelJS.
 * ─────────────────────────────────────────────────────────────────────────────
 */
function calcCargaRecurso(produto, qtdFaturar, routingMap, bomMap, capacidadeMap = {}) {
    const minByRec        = {};
    const recursosTocados = new Set(); // recursos relevantes para este produto

    /**
     * Soma o tempo de um código (produto ou componente) em todos os seus recursos.
     * @param {string} code       - Código a consultar no routingMap
     * @param {number} multiplier - qtdFaturar × quantidades acumuladas
     */
    const addTime = (code, multiplier) => {
        const ops = routingMap[code] || {};
        Object.entries(ops).forEach(([rec, op]) => {
            recursosTocados.add(rec);
            const tPeca = Number(op.tempo_peca) || 0;
            const setup = Number(op.setup)      || 0;
            const tot   = parseFloat((tPeca * multiplier + setup).toFixed(4));
            if (tot > 0) {
                minByRec[`rec_${rec}`] = (minByRec[`rec_${rec}`] || 0) + tot;
            }
        });
    };

    // Nível 0 — roteiro do produto acabado
    addTime(produto, qtdFaturar);

    // Níveis 1..N — componentes de todos os níveis (quantidades já acumuladas pela CTE)
    (bomMap[produto] || []).forEach(({ comp, quant }) => {
        addTime(comp, quant * qtdFaturar);
    });

    // Fallback de capacidade: aplica APENAS se o recurso está no SG2
    // (produto ou componente) mas o tempo calculado ainda é zero
    recursosTocados.forEach(rec => {
        const key = `rec_${rec}`;
        if (!minByRec[key] && (capacidadeMap[rec] || 0) > 0) {
            minByRec[key] = parseFloat((capacidadeMap[rec] * qtdFaturar).toFixed(4));
        }
    });

    return minByRec;
}

module.exports = { calcCargaRecurso };
