require('dotenv').config({path: './server/.env'});
const mysqlPool = require('./server/services/mysqlService');
const db = require('./server/db');

async function test() {
    try {
        const matrixQuery = `
            SELECT 
                TRIM(c2.c2_num) as op, 
                TRIM(c2.c2_item) as item_op, 
                TRIM(c2.c2_sequen) as sequen, 
                TRIM(g2.g2_operac) as operacao, 
                TRIM(g2.g2_recurso) as recurso 
            FROM public.sc2010 c2 
            INNER JOIN public.sg2010 g2 ON TRIM(g2.g2_produto) = TRIM(c2.c2_produto) 
            WHERE TRIM(c2.c2_num) = '003595' AND TRIM(c2.c2_sequen) = '016'
        `;
        const pgRes = await db.query(matrixQuery);
        const matrixItems = pgRes.rows;

        const uniqueOps = [...new Set(matrixItems.map(i => i.op.trim()))];
        const mysqlPlaceholders = uniqueOps.map(() => '?').join(',');

        const [appointments] = await mysqlPool.query(
            `SELECT op_numero, op_item, op_sequencia, operacao_codigo,
            SUM(quantidade) as total_produzido
             FROM app_production_appointments
             WHERE op_numero IN(${mysqlPlaceholders})
             GROUP BY op_numero, op_item, op_sequencia, operacao_codigo`,
            uniqueOps
        );

        console.log("Matrix Items:", matrixItems.map(m => m.operacao));
        console.log("Appointments:", appointments.filter(a => a.op_sequencia === '016').map(a => a.operacao_codigo));

        matrixItems.forEach(route => {
            let appt = appointments.find(a =>
                String(a.op_numero).trim() === route.op.trim() &&
                String(a.op_item).trim() === route.item_op.trim() &&
                String(a.op_sequencia).trim() === route.sequen.trim() &&
                String(a.operacao_codigo).trim() === (route.operacao ? route.operacao.trim() : '')
            );
            console.log(`Route Op ${route.operacao}: appt found? ${!!appt}`);
        });

    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}

test();
