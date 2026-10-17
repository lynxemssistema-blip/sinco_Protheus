require('dotenv').config({path: './server/.env'});
const mysqlPool = require('./server/services/mysqlService');
const db = require('./server/db');

async function test() {
    try {
        const matrixItems = [
            { op: '003595', item_op: '02', sequen: '020', operacao: '10', recurso: 'MO0001', qtd_planejada: 2 }
        ];

        const uniqueOps = [...new Set(matrixItems.map(i => i.op.trim()))];
        const mysqlPlaceholders = uniqueOps.map(() => '?').join(',');

        const [appointments] = await mysqlPool.query(
            `SELECT op_numero, op_item, op_sequencia, operacao_codigo,
            SUM(quantidade) as total_produzido,
            SUM(CASE WHEN conferencia_status = 'PENDENTE' THEN 1 ELSE 0 END) as pendencias_conferencia,
            MIN(data_inicio) as data_real_inicio,
            MAX(data_fim) as data_real_fim
             FROM app_production_appointments
             WHERE op_numero IN(${mysqlPlaceholders})
             GROUP BY op_numero, op_item, op_sequencia, operacao_codigo`,
            uniqueOps
        );

        console.log("Appointments fetched:");
        console.log(appointments.filter(a => a.op_sequencia === '020'));

        let totalProduzida = 0;
        const realOpCode = '10';
        const route = matrixItems[0];
        
        let appt = appointments.find(a =>
            String(a.op_numero).trim() === route.op.trim() &&
            String(a.op_item).trim() === route.item_op.trim() &&
            String(a.op_sequencia).trim() === route.sequen.trim() &&
            String(a.operacao_codigo).trim() === realOpCode
        );

        if (appt) {
            console.log("MATCH FOUND!", appt);
        } else {
            console.log("NO MATCH! Why?");
        }
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}

test();
