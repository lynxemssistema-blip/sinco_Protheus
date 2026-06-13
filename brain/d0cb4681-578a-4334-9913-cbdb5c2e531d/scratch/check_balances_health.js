require('dotenv').config({ path: require('path').resolve(__dirname, '../../../server/.env') });
const mysqlPool = require('../../../server/services/mysqlService');
const pgDb = require('../../../server/db');

async function run() {
    try {
        console.log('=== VERIFICANDO HIGIENE E CORREÇÃO DOS SALDOS ===');

        // 1. Buscar todos os apontamentos agrupados do MySQL
        const [appts] = await mysqlPool.query(`
            SELECT op_numero, op_item, operacao_codigo, SUM(quantidade) as total_produzido, COUNT(*) as qtd_apontamentos
            FROM app_production_appointments
            GROUP BY op_numero, op_item, operacao_codigo
        `);

        console.log(`Total de operações apontadas encontradas no MySQL: ${appts.length}`);

        if (appts.length === 0) {
            console.log('Nenhum apontamento encontrado.');
            process.exit();
        }

        // 2. Coletar OPs únicas
        const opNumbers = [...new Set(appts.map(a => a.op_numero?.trim()))].filter(Boolean);
        console.log(`Total de OPs únicas nos apontamentos: ${opNumbers.length}`);

        // 3. Buscar c2_quant (planejado) no Protheus (Postgres) em lotes
        let pgRows = [];
        const CHUNK = 500;
        for (let i = 0; i < opNumbers.length; i += CHUNK) {
            const chunk = opNumbers.slice(i, i + CHUNK);
            const paddedOps = chunk.map(o => String(o).padStart(6, '0'));
            
            const pgRes = await pgDb.query(`
                SELECT TRIM(c2_num) as op, TRIM(c2_item) as item, c2_quant::numeric as c2_quant
                FROM public.sc2010
                WHERE TRIM(c2_num) = ANY($1) AND COALESCE(d_e_l_e_t_,'') IN ('', ' ')
            `, [paddedOps]);
            
            pgRows = pgRows.concat(pgRes.rows);
        }

        // Criar mapa de planejado: key = OP|ITEM
        const plannedMap = new Map();
        pgRows.forEach(row => {
            const key = `${Number(row.op)}|${Number(row.item)}`;
            plannedMap.set(key, Number(row.c2_quant || 0));
        });

        // 4. Analisar discrepâncias (onde total_produzido > c2_quant)
        const overAppointed = [];
        let totalComErro = 0;

        for (const app of appts) {
            const opNumClean = Number(app.op_numero);
            const opItemClean = Number(app.op_item);
            const key = `${opNumClean}|${opItemClean}`;

            const plannedQty = plannedMap.get(key);
            
            // Se plannedQty for undefined, a OP pode ter sido deletada no ERP (Protheus)
            if (plannedQty === undefined) {
                // OP não encontrada no Protheus
                continue;
            }

            const producedQty = Number(app.total_produzido || 0);
            
            // Se produzido for maior que o planejado
            if (producedQty > plannedQty) {
                totalComErro++;
                overAppointed.push({
                    op: app.op_numero,
                    item: app.op_item,
                    operacao: app.operacao_codigo,
                    planejado: plannedQty,
                    produzido: producedQty,
                    excedente: producedQty - plannedQty,
                    qtd_apontamentos: app.qtd_apontamentos
                });
            }
        }

        console.log(`\nAnálise finalizada:`);
        console.log(`- Operações analisadas: ${appts.length}`);
        console.log(`- Operações com apontamento ACIMA do planejado (Saldo Negativo): ${totalComErro}`);

        if (overAppointed.length > 0) {
            console.log('\nLista de discrepâncias encontradas (Top 20 ordenado por maior excedente):');
            // Ordenar por maior excedente
            overAppointed.sort((a, b) => b.excedente - a.excedente);
            
            overAppointed.slice(0, 20).forEach((d, idx) => {
                console.log(`  ${idx+1}. OP: ${d.op}-${d.item} | Op: ${d.operacao} | Planejado: ${d.planejado} | Produzido: ${d.produzido} | Excedente: ${d.excedente} | Núm. Lançamentos: ${d.qtd_apontamentos}`);
            });
            if (overAppointed.length > 20) {
                console.log(`  ... e mais ${overAppointed.length - 20} registros com saldo extrapolado.`);
            }
        } else {
            console.log('✅ Nenhum apontamento extrapolou o saldo planejado! Todos os saldos estão consistentes.');
        }

    } catch (err) {
        console.error('Erro na verificação de saldos:', err);
    } finally {
        process.exit();
    }
}

run();
