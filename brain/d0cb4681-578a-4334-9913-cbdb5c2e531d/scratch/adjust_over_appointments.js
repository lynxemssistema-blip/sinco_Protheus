require('dotenv').config({ path: require('path').resolve(__dirname, '../../../server/.env') });
const mysqlPool = require('../../../server/services/mysqlService');
const pgDb = require('../../../server/db');

async function run() {
    let connection;
    try {
        console.log('=== INICIANDO SANEAMENTO DE SALDOS EXCEDENTES ===');
        
        // 1. Obter todos os apontamentos agrupados do MySQL
        const [appts] = await mysqlPool.query(`
            SELECT op_numero, op_item, op_sequencia, operacao_codigo, SUM(quantidade) as total_produzido
            FROM app_production_appointments
            GROUP BY op_numero, op_item, op_sequencia, operacao_codigo
        `);

        console.log(`Total de grupos de operação no MySQL: ${appts.length}`);

        // 2. Coletar OPs únicas
        const opNumbers = [...new Set(appts.map(a => a.op_numero?.trim()))].filter(Boolean);
        
        // 3. Buscar c2_quant (planejado) no Protheus (Postgres)
        let pgRows = [];
        const CHUNK = 500;
        for (let i = 0; i < opNumbers.length; i += CHUNK) {
            const chunk = opNumbers.slice(i, i + CHUNK);
            const paddedOps = chunk.map(o => String(o).padStart(6, '0'));
            
            const pgRes = await pgDb.query(`
                SELECT TRIM(c2_num) as op, TRIM(c2_item) as item, TRIM(c2_sequen) as sequen, c2_quant::numeric as c2_quant
                FROM public.sc2010
                WHERE TRIM(c2_num) = ANY($1) AND COALESCE(d_e_l_e_t_,'') IN ('', ' ')
            `, [paddedOps]);
            
            pgRows = pgRows.concat(pgRes.rows);
        }

        // Criar mapa de planejado: key = OP|ITEM|SEQUEN
        const plannedMap = new Map();
        pgRows.forEach(row => {
            const key = `${Number(row.op)}|${Number(row.item)}|${String(row.sequen).trim()}`;
            plannedMap.set(key, Number(row.c2_quant || 0));
        });

        // 4. Identificar quais grupos estão estourados
        const groupsToAdjust = [];
        for (const app of appts) {
            const opNumClean = Number(app.op_numero);
            const opItemClean = Number(app.op_item);
            const opSeqClean = String(app.op_sequencia).trim();
            const key = `${opNumClean}|${opItemClean}|${opSeqClean}`;

            const plannedQty = plannedMap.get(key);
            if (plannedQty === undefined) continue; // OP não ativa ou deletada no Protheus

            const producedQty = Number(app.total_produzido || 0);
            if (producedQty > plannedQty) {
                groupsToAdjust.push({
                    op_numero: app.op_numero,
                    op_item: app.op_item,
                    op_sequencia: app.op_sequencia,
                    operacao_codigo: app.operacao_codigo,
                    plannedQty,
                    producedQty
                });
            }
        }

        console.log(`Grupos de operação com estouro identificados para ajuste: ${groupsToAdjust.length}`);

        if (groupsToAdjust.length === 0) {
            console.log('✅ Nenhum grupo com saldo estourado foi encontrado.');
            process.exit();
        }

        // 5. Iniciar o processo de ajuste
        connection = await mysqlPool.getConnection();
        await connection.beginTransaction();

        let totalUpdated = 0;
        let totalDeleted = 0;
        let totalQtyReduced = 0;

        for (const group of groupsToAdjust) {
            // Obter todos os apontamentos desse grupo ordenados por id ASC
            const [rows] = await connection.execute(`
                SELECT id, quantidade FROM app_production_appointments
                WHERE op_numero = ? AND op_item = ? AND op_sequencia = ? AND operacao_codigo = ?
                ORDER BY id ASC
            `, [group.op_numero, group.op_item, group.op_sequencia, group.operacao_codigo]);

            let runningSum = 0;
            const targetLimit = group.plannedQty;

            for (const row of rows) {
                const rowQty = Number(row.quantidade) || 0;

                if (runningSum >= targetLimit) {
                    // Já atingiu o limite planejado, deletar apontamento excedente
                    await connection.execute(`
                        DELETE FROM app_production_appointments WHERE id = ?
                    `, [row.id]);
                    totalDeleted++;
                    totalQtyReduced += rowQty;
                } else if (runningSum + rowQty > targetLimit) {
                    // Este apontamento estoura o limite, ajustar para a diferença restante
                    const allowedQty = targetLimit - runningSum;
                    await connection.execute(`
                        UPDATE app_production_appointments SET quantidade = ? WHERE id = ?
                    `, [allowedQty, row.id]);
                    totalUpdated++;
                    totalQtyReduced += (rowQty - allowedQty);
                    runningSum = targetLimit;
                } else {
                    // Apontamento está dentro do limite, mantê-lo intacto
                    runningSum += rowQty;
                }
            }
        }

        // Confirmar transação
        await connection.commit();
        console.log('\n✅ AJUSTE EXECUTADO COM SUCESSO!');
        console.log(`- Grupos de operação ajustados: ${groupsToAdjust.length}`);
        console.log(`- Apontamentos atualizados (quantidade reduzida): ${totalUpdated}`);
        console.log(`- Apontamentos excedentes deletados: ${totalDeleted}`);
        console.log(`- Quantidade total reduzida no banco: ${totalQtyReduced.toFixed(2)} unidades`);

    } catch (err) {
        console.error('❌ Erro no processo de ajuste:', err);
        if (connection) {
            try {
                await connection.rollback();
                console.log('🔄 Transação desfeita (Rollback realizado).');
            } catch (rErr) {
                console.error('Erro ao fazer rollback:', rErr);
            }
        }
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

run();
