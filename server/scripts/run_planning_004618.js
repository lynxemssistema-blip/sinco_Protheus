/**
 * Script para rodar o planejamento de todas as OPs do pedido 004618
 * Executar: node server/scripts/run_planning_004618.js
 */
require('dotenv').config({ path: './server/.env' });
const db = require('../db');  // PostgreSQL
const mysql = require('../services/mysqlService');
const { runFcsSequencing } = require('../services/fcsEngine');

async function main() {
    let pgClient;
    try {
        pgClient = await db.connect();
        console.log('✅ PostgreSQL conectado');

        // Busca OPs do pedido 004618 via PostgreSQL (sc2010)
        const result = await pgClient.query(
            `SELECT op_num FROM (
               SELECT DISTINCT TRIM(c2_num) AS op_num
               FROM public.sc2010
               WHERE COALESCE(d_e_l_e_t_, '') IN ('',' ')
                 AND c2_sequen = '001'
                 AND (TRIM(c2_pedido) = '004618'
                   OR TRIM(c2_obs) LIKE '%004618%')
             ) t ORDER BY op_num`
        );

        const opNums = result.rows.map(r => r.op_num.trim()).filter(Boolean);

        if (!opNums.length) {
            console.error('❌ Nenhuma OP encontrada para o pedido 004618');
            // Mostra debug
            const d2 = await pgClient.query(
                `SELECT TRIM(c2_num) as op, TRIM(c2_pedido) as pedido, TRIM(c2_produto) as prod
                 FROM public.sc2010
                 WHERE COALESCE(d_e_l_e_t_,'') IN ('',' ')
                   AND c2_sequen = '001'
                   AND (TRIM(c2_pedido) LIKE '%4618%' OR TRIM(c2_num) LIKE '%4618%')
                 LIMIT 10`
            );
            console.log('DEBUG OPs com 4618:', JSON.stringify(d2.rows));
            pgClient.release();
            process.exit(1);
        }

        pgClient.release();
        pgClient = null;

        console.log(`✅ ${opNums.length} OP(s) encontrada(s) para pedido 004618:`, opNums);

        // Data base = hoje
        const hoje = new Date();
        const data_inicio = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;

        console.log(`\n🚀 Rodando FCS Engine a partir de ${data_inicio}...`);

        const result2 = await runFcsSequencing({
            ops: opNums,
            data_inicio,
            usuario: 'admin_script',
            include_saturday: false,
            clear_existing: false,
        });

        if (!result2.success) {
            console.error('❌ Erro no engine:', result2.error);
            console.log('\n--- LOGS DO AGENTE ---');
            (result2.agent_logs || []).slice(-40).forEach(l => console.log(l));
            process.exit(1);
        }

        console.log('\n✅ PLANEJAMENTO CONCLUÍDO!');
        console.log(`  → Planos gerados: ${result2.plans}`);
        console.log(`  → Fatias diárias: ${result2.daily_slices}`);

        console.log('\n--- ÚLTIMOS 30 LOGS DO AGENTE ---');
        (result2.agent_logs || []).slice(-30).forEach(l => console.log(l));

        // Verifica o banco
        console.log('\n--- VERIFICAÇÃO NO BANCO MySQL ---');
        const [saved] = await mysql.query(
            'SELECT op_numero, recurso_codigo, produto_codigo, data_planejada_inicio, data_planejada_fim, is_sobrecarga FROM app_production_planning WHERE op_numero IN (?) ORDER BY op_numero, recurso_codigo',
            [opNums]
        );

        if (saved.length) {
            console.log(`✅ ${saved.length} registro(s) salvos:`);
            saved.forEach(r => {
                const sobre = r.is_sobrecarga ? ' ⚠️ SOBRECARGA' : '';
                const di = r.data_planejada_inicio ? String(r.data_planejada_inicio).substring(0,10) : 'NULL';
                const df = r.data_planejada_fim ? String(r.data_planejada_fim).substring(0,10) : 'NULL';
                console.log(`  OP ${r.op_numero} | ${r.recurso_codigo} | ${r.produto_codigo} | ${di} → ${df}${sobre}`);
            });
        } else {
            console.error('❌ NADA SALVO NO BANCO! Verifique os logs acima.');
        }

        process.exit(0);
    } catch (e) {
        console.error('❌ ERRO CRÍTICO:', e.message);
        console.error(e.stack);
        if (pgClient) pgClient.release();
        process.exit(1);
    }
}

main();
