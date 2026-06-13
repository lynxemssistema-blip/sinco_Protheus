require('dotenv').config({ path: require('path').resolve(__dirname, '../../../server/.env') });
const pool = require('../../../server/services/mysqlService');

async function run() {
    try {
        console.log('=== ANALISANDO DATAS PLANEJADAS E APONTAMENTOS ===');
        const nowStr = '2026-06-09 00:00:00';
        console.log(`Data atual de referência: ${nowStr}\n`);

        // 1. Analisar app_production_planning
        console.log('--- Tabela app_production_planning (Planejamento) ---');
        const [planningRows] = await pool.query(`
            SELECT op_numero, op_item, op_sequencia, operacao_codigo, data_planejada_inicio, data_planejada_fim
            FROM app_production_planning
            WHERE data_planejada_inicio < ? OR data_planejada_fim < ?
            ORDER BY data_planejada_inicio ASC
        `, [nowStr, nowStr]);

        console.log(`Total de planejamentos com datas anteriores a hoje: ${planningRows.length}`);
        if (planningRows.length > 0) {
            console.log('Exemplos de planejamentos antigos:');
            planningRows.slice(0, 10).forEach(row => {
                console.log(`  OP: ${row.op_numero}-${row.op_item}-${row.op_sequencia} | Op. Código: ${row.operacao_codigo} | Início: ${row.data_planejada_inicio} | Fim: ${row.data_planejada_fim}`);
            });
            if (planningRows.length > 10) {
                console.log(`  ... e mais ${planningRows.length - 10} registros.`);
            }
        }

        // 2. Analisar app_production_appointments
        console.log('\n--- Tabela app_production_appointments (Apontamentos) ---');
        const [apptRows] = await pool.query(`
            SELECT op_numero, op_item, op_sequencia, operacao_codigo, usuario, quantidade, data_inicio, data_fim, created_at
            FROM app_production_appointments
            WHERE data_inicio < ? OR data_fim < ?
            ORDER BY data_inicio ASC
        `, [nowStr, nowStr]);

        console.log(`Total de apontamentos com datas de execução anteriores a hoje: ${apptRows.length}`);
        if (apptRows.length > 0) {
            console.log('Exemplos de apontamentos antigos:');
            apptRows.slice(0, 10).forEach(row => {
                console.log(`  OP: ${row.op_numero}-${row.op_item}-${row.op_sequencia} | Op. Código: ${row.operacao_codigo} | Qtd: ${row.quantidade} | Início: ${row.data_inicio} | Fim: ${row.data_fim} | Criado em: ${row.created_at}`);
            });
            if (apptRows.length > 10) {
                console.log(`  ... e mais ${apptRows.length - 10} registros.`);
            }
        }

    } catch (err) {
        console.error('Erro na análise:', err);
    } finally {
        process.exit();
    }
}

run();
