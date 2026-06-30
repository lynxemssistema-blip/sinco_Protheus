const db = require('./db');
const mysqlPool = require('./services/mysqlService');

async function test() {
    try {
        const opBase = ['006252'];
        
        // 1. Fetch all child OPs for these OP numbers
        const pgOps = await db.query(`
            SELECT TRIM(c2_num) as op_num, TRIM(c2_item) as op_item, TRIM(c2_sequen) as op_sequencia, TRIM(c2_produto) as produto, c2_quant::numeric as op_qtd
            FROM public.sc2010
            WHERE c2_num = ANY($1::varchar[])
            AND COALESCE(d_e_l_e_t_, '') = ''
        `, [opBase]);
        
        console.log("PG OPs fetched:", pgOps.rows.length);

        // 2. Fetch operation counts for all these products
        const products = [...new Set(pgOps.rows.map(r => r.produto))];
        const pgOpsCount = await db.query(`
            SELECT TRIM(g2_produto) as produto, COUNT(g2_operac) as total_operacoes
            FROM public.sg2010
            WHERE TRIM(g2_produto) = ANY($1::varchar[])
            AND COALESCE(d_e_l_e_t_, '') = ''
            GROUP BY TRIM(g2_produto)
        `, [products]);
        
        const opsCountMap = {};
        pgOpsCount.rows.forEach(r => {
            opsCountMap[r.produto] = parseInt(r.total_operacoes) || 1;
        });

        console.log("Ops Count Map:", opsCountMap);

        // 3. Fetch all MySQL appointments for these OPs
        const [mysqlAppointments] = await mysqlPool.query(`
            SELECT CONCAT(op_numero, op_item, op_sequencia) as op_full, operacao_codigo, SUM(quantidade) as produzido
            FROM app_production_appointments
            WHERE op_numero IN (?)
            AND conferencia_status NOT IN ('CANCELADO', 'DIVERGENTE')
            GROUP BY op_full, operacao_codigo
        `, [opBase]);

        const appointmentsMap = {};
        mysqlAppointments.forEach(r => {
            appointmentsMap[`${r.op_full}-${r.operacao_codigo}`] = parseFloat(r.produzido) || 0;
        });

        console.log("Appointments Map keys count:", Object.keys(appointmentsMap).length);

        // 4. Calculate overall progress for OP 006252
        let totalWeightedPlanned = 0;
        let totalWeightedProduced = 0;

        pgOps.rows.forEach(op => {
            const count = opsCountMap[op.produto] || 1;
            const fullOpKey = `${op.op_num}${op.op_item}${op.op_sequencia}`;
            
            // Each operation of this sequence has planned quantity = op.op_qtd
            totalWeightedPlanned += op.op_qtd * count;

            // Sum produced quantity of all operations of this sequence
            let sumProduced = 0;
            // Let's find all keys in appointmentsMap starting with fullOpKey
            Object.keys(appointmentsMap).forEach(key => {
                if (key.startsWith(`${fullOpKey}-`)) {
                    sumProduced += appointmentsMap[key];
                }
            });
            // Cap produced at planned to avoid >100% per operation
            totalWeightedProduced += Math.min(op.op_qtd * count, sumProduced);
        });

        const overallPct = totalWeightedPlanned > 0 ? (totalWeightedProduced / totalWeightedPlanned) * 100 : 0;
        console.log(`\n=== RESULTS ===`);
        console.log("Total Weighted Planned Qty:", totalWeightedPlanned);
        console.log("Total Weighted Produced Qty:", totalWeightedProduced);
        console.log("Overall Progress %:", overallPct.toFixed(2) + "%");
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

test();
