require('dotenv').config({ path: require('path').resolve(__dirname, '../../../server/.env') });
const mysqlPool = require('../../../server/services/mysqlService');
const pgDb = require('../../../server/db');

async function run() {
    try {
        console.log('=== ANALISANDO DATAS PLANEJADAS PASSADAS (DESCONSIDERANDO CONCLUÍDOS) ===');
        const nowStr = '2026-06-09 00:00:00';
        console.log(`Data de referência: ${nowStr}\n`);

        // 1. Obter todos os planejamentos com datas anteriores a hoje
        const [planningRows] = await mysqlPool.query(`
            SELECT op_numero, op_item, op_sequencia, operacao_codigo, data_planejada_inicio, data_planejada_fim
            FROM app_production_planning
            WHERE data_planejada_inicio < ? OR data_planejada_fim < ?
            ORDER BY data_planejada_inicio ASC
        `, [nowStr, nowStr]);

        console.log(`Total de planejamentos com datas passadas no MySQL: ${planningRows.length}`);
        if (planningRows.length === 0) {
            console.log('Nenhum planejamento antigo encontrado.');
            process.exit();
        }

        // 2. Coletar números de OPs únicos para buscar no Postgres e no MySQL
        const opNumbers = [...new Set(planningRows.map(r => r.op_numero?.trim()))].filter(Boolean);
        console.log(`OPs únicas identificadas: ${opNumbers.length}`);

        // 3. Buscar quantidades planejadas no Postgres (Protheus)
        const pgQuery = `
            SELECT TRIM(c2_num) as op, TRIM(c2_item) as item, c2_quant::numeric as c2_quant
            FROM public.sc2010
            WHERE TRIM(c2_num) = ANY($1) AND COALESCE(d_e_l_e_t_,'') IN ('', ' ')
        `;
        // Pad left to 6 chars for Protheus compatibility
        const paddedOpsForPg = opNumbers.map(o => String(o).padStart(6, '0'));
        const pgRes = await pgDb.query(pgQuery, [paddedOpsForPg]);
        
        // Criar mapa de quantidade planejada: key = OP|ITEM
        const plannedMap = new Map();
        pgRes.rows.forEach(row => {
            // Trim zeros à esquerda e espaços para garantir compatibilidade
            const opKey = `${Number(row.op)}|${Number(row.item)}`;
            plannedMap.set(opKey, Number(row.c2_quant || 0));
        });

        // 4. Buscar totais produzidos no MySQL (apontamentos)
        // Fazemos em blocos para evitar limites de parâmetros se a lista for muito grande
        let appointments = [];
        const CHUNK = 500;
        for (let i = 0; i < opNumbers.length; i += CHUNK) {
            const chunk = opNumbers.slice(i, i + CHUNK);
            const ph = chunk.map(() => '?').join(',');
            const [ar] = await mysqlPool.execute(`
                SELECT op_numero, op_item, operacao_codigo, SUM(quantidade) as total_produzido
                FROM app_production_appointments
                WHERE op_numero IN (${ph})
                GROUP BY op_numero, op_item, operacao_codigo
            `, chunk);
            appointments = appointments.concat(ar);
        }

        // Criar mapa de apontado: key = OP|ITEM|OPERACAO
        const apptMap = new Map();
        appointments.forEach(a => {
            const apptKey = `${Number(a.op_numero)}|${Number(a.op_item)}|${String(a.operacao_codigo).trim()}`;
            apptMap.set(apptKey, Number(a.total_produzido || 0));
        });

        // 5. Filtrar e exibir os planejamentos que não estão concluídos
        const pendingPlannings = [];
        for (const row of planningRows) {
            const opNumClean = Number(row.op_numero);
            const opItemClean = Number(row.op_item);
            
            const plannedKey = `${opNumClean}|${opItemClean}`;
            const apptKey = `${opNumClean}|${opItemClean}|${String(row.operacao_codigo).trim()}`;

            const plannedQty = plannedMap.get(plannedKey) || 0;
            const producedQty = apptMap.get(apptKey) || 0;

            const done = producedQty >= plannedQty;

            if (!done) {
                pendingPlannings.push({
                    op: row.op_numero,
                    item: row.op_item,
                    sequencia: row.op_sequencia,
                    operacao: row.operacao_codigo,
                    data_inicio: row.data_planejada_inicio,
                    data_fim: row.data_planejada_fim,
                    planejado: plannedQty,
                    produzido: producedQty,
                    saldo: plannedQty - producedQty
                });
            }
        }

        console.log(`\nTotal de planejamentos vencidos PENDENTES (Não concluídos): ${pendingPlannings.length}`);
        if (pendingPlannings.length > 0) {
            console.log('Exemplos de planejamentos vencidos pendentes:');
            pendingPlannings.slice(0, 15).forEach(p => {
                console.log(`  OP: ${p.op}-${p.item}-${p.sequencia} | Op: ${p.operacao} | Início Planejado: ${p.data_inicio?.toISOString().split('T')[0]} | Planejado: ${p.planejado} | Produzido: ${p.produzido} | Saldo: ${p.saldo}`);
            });
            if (pendingPlannings.length > 15) {
                console.log(`  ... e mais ${pendingPlannings.length - 15} registros.`);
            }
        } else {
            console.log('Nenhum planejamento antigo pendente encontrado!');
        }

    } catch (err) {
        console.error('Erro na análise:', err);
    } finally {
        process.exit();
    }
}

run();
