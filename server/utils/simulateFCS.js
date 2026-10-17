/**
 * simulateFCS.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Lógica de Forward Scheduling (Capacidade Finita) para a Planilha Mestra.
 * Ordena os itens por Data PCP / Entrega e aloca a carga sequencialmente
 * nos recursos, respeitando a condição "Início-Início com 1 hora de lag".
 * ─────────────────────────────────────────────────────────────────────────────
 */

const MIN_PER_DAY = 480; // Assumindo 8 horas úteis por dia (8 * 60)
const LAG_MINUTES = 50;  // 1 hora produtiva = 50 minutos na regra da Lynx

function addWorkingDays(startDateStr, totalMinutes) {
    const daysToAdd = Math.floor(totalMinutes / MIN_PER_DAY);
    let d = new Date(startDateStr + 'T12:00:00');
    if (isNaN(d.getTime())) d = new Date();
    
    let added = 0;
    while(added < daysToAdd) {
        d.setDate(d.getDate() + 1);
        // Pula Fim de Semana
        if (d.getDay() !== 0 && d.getDay() !== 6) {
            added++;
        }
    }
    return d.toISOString().split('T')[0];
}

/**
 * @param {Array} items - Referência para a lista de itens da Master Sheet
 * @param {string} data0 - "YYYY-MM-DD"
 * @param {Object} routingSequenceMap - { [codigo]: [ { operac, recurso, tempo_peca, setup } ] }
 * @param {Object} bomMap - Mapa de componentes explodidos
 */
function simulateForwardScheduling(items, data0, routingSequenceMap, bomMap) {
    if (!data0) return items;

    // 1. Filtrar itens que exigem produção (Qtde PCP ou Saldo a Faturar > 0)
    // ATENÇÃO: Se o Saldo a Faturar (qtd_faturar) for 0, o item já foi 100% faturado e não deve ser simulado,
    // mesmo que haja alguma Qtde PCP legada salva no banco.
    const prodItems = items.filter(it => {
        const saldo = parseFloat(it.qtd_faturar) || 0;
        if (saldo <= 0) return false;

        const qtd = parseFloat(it.qtde_pcp) || saldo;
        return qtd > 0 && it.produto;
    });

    // 2. Definir a Data de Ordenação (Prioridade)
    const normalizeDate = (d) => {
        if (!d) return '9999-12-31';
        let str = String(d).trim();
        if (str.length === 8 && !str.includes('-')) {
            str = `${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}`;
        }
        return str;
    };
    
    prodItems.forEach(it => {
        const dPcp = normalizeDate(it.data_pcp);
        const dEnt = normalizeDate(it.entrega);
        
        if (dPcp === '9999-12-31' && dEnt !== '9999-12-31') {
            it.data_pcp = it.entrega;
            it._sortDate = dEnt;
        } else {
            it._sortDate = dPcp !== '9999-12-31' ? dPcp : dEnt;
        }
    });
    
    // Ordenação ascendente (mais urgentes primeiro)
    prodItems.sort((a, b) => a._sortDate.localeCompare(b._sortDate));

    // 3. Estado de ocupação dos recursos (em minutos a partir da data 0)
    const resourceFreeTime = {}; 

    // 4. Processar cada item
    prodItems.forEach(item => {
        const prod = item.produto.trim();
        const qtd = parseFloat(item.qtde_pcp) || parseFloat(item.qtd_faturar) || 0;
        
        let allOps = [];
        
        // Componentes (Níveis 1..N)
        (bomMap[prod] || []).forEach(({ comp, quant }) => {
            if (routingSequenceMap[comp]) {
                routingSequenceMap[comp].forEach(op => {
                    allOps.push({ ...op, code: comp, isComponent: true, qtyMultiplier: quant });
                });
            }
        });

        // Produto Acabado (Nível 0)
        if (routingSequenceMap[prod]) {
            routingSequenceMap[prod].forEach(op => {
                allOps.push({ ...op, code: prod, isComponent: false, qtyMultiplier: 1 });
            });
        }
        
        // Ordem: Componentes primeiro, depois Operações do Prod Acabado em sequência
        allOps.sort((a, b) => {
            if (a.isComponent !== b.isComponent) return a.isComponent ? -1 : 1;
            return a.operac.localeCompare(b.operac);
        });
        
        let lastOpStartMins = null;
        let finalOpEndMins = 0;
        
        allOps.forEach(op => {
            const rec = op.recurso;
            const tPeca = Number(op.tempo_peca) || 0;
            const setup = Number(op.setup) || 0;
            const totalMins = (tPeca * (qtd * op.qtyMultiplier)) + setup;
            
            if (totalMins <= 0) return;
            
            let possibleStart = resourceFreeTime[rec] || 0;
            
            // Condição Início-Início: só pode começar 1h depois que a operac anterior começou
            if (lastOpStartMins !== null) {
                const earliestWithLag = lastOpStartMins + LAG_MINUTES;
                if (earliestWithLag > possibleStart) {
                    possibleStart = earliestWithLag;
                }
            }
            
            const opEnd = possibleStart + totalMins;
            resourceFreeTime[rec] = opEnd;
            
            lastOpStartMins = possibleStart;
            if (opEnd > finalOpEndMins) {
                finalOpEndMins = opEnd;
            }
        });
        
        // 5. Associar a data final projetada ao item
        item.nova_data_pcp = addWorkingDays(data0, finalOpEndMins);
    });
    
    return items;
}

module.exports = { simulateForwardScheduling };
