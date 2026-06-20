require('dotenv').config({ path: '../.env' });
const db = require('../db');
const mysql = require('../services/mysqlService');

async function automate() {
    try {
        console.log("1. Buscando OPs do Pedido 004883 no Protheus...");
        const sc2Res = await db.query(`
            SELECT TRIM(c2_num) as op_num, TRIM(c2_item) as op_item, TRIM(c2_sequen) as op_seq, 
                   TRIM(c2_produto) as produto, c2_quant as quant
            FROM public.sc2010
            WHERE TRIM(c2_pedido) = '004883' AND COALESCE(d_e_l_e_t_, '') = ''
        `);
        const ops = sc2Res.rows;
        console.log(`Encontradas ${ops.length} OPs.`);

        if (ops.length === 0) {
            console.log("Nenhuma OP encontrada.");
            process.exit(0);
        }

        const operacoesAlvo = [
            { codigo: 'MO0013', desc: 'CORTE LASER' },
            { codigo: 'MO0002', desc: 'PUNCIONADEIRA' }
        ];

        let insertCount = 0;

        for (const op of ops) {
            const opBase = op.op_num;
            const opItem = op.op_item;
            const opSeq = op.op_seq;
            const totalQtd = parseFloat(op.quant) || 0;

            for (const operacao of operacoesAlvo) {
                // Check existing appointments
                const [existing] = await mysql.query(`
                    SELECT SUM(quantidade) as total_apontado
                    FROM app_production_appointments
                    WHERE op_numero = ? AND op_item = ? AND op_sequencia = ? AND operacao_codigo = ? AND conferencia_status != 'CANCELADO'
                `, [opBase, opItem, opSeq, operacao.codigo]);

                const apontado = parseFloat(existing[0]?.total_apontado || 0);
                const saldo = totalQtd - apontado;

                if (saldo > 0) {
                    console.log(`-> OP ${opBase}${opItem}${opSeq} | ${operacao.desc}: Saldo de ${saldo}. Apontando...`);
                    
                    await mysql.query(`
                        INSERT INTO app_production_appointments 
                        (op_numero, op_item, op_sequencia, produto_codigo, operacao_codigo, quantidade, conferencia_status, usuario, data_inicio, data_fim)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                    `, [
                        opBase, opItem, opSeq, op.produto, operacao.codigo, saldo, 'CONFERIDO', 'AUTOMACAO'
                    ]);
                    insertCount++;
                } else {
                    console.log(`-> OP ${opBase}${opItem}${opSeq} | ${operacao.desc}: Saldo zero (Total: ${totalQtd}, Apontado: ${apontado}). Ignorando.`);
                }
            }
        }

        console.log(`Sucesso! ${insertCount} apontamentos realizados.`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
automate();
