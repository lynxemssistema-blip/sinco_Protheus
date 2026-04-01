const db = require('./server/db');
const mysqlPool = require('./server/services/mysqlService');

async function debugData() {
    console.log('--- DEBUGGING DATA FOR OP 005113 ---');

    // 1. Check MySQL
    const [mysqlRows] = await mysqlPool.query(
        "SELECT op_numero, op_item, op_sequencia FROM app_production_appointments WHERE op_numero LIKE '%5113%'"
    );
    console.log('MySQL Appointments:', JSON.stringify(mysqlRows, null, 2));

    if (mysqlRows.length > 0) {
        const op = mysqlRows[0].op_numero;
        console.log(`Checking Protheus for OP: [${op}]`);

        // 2. Check Protheus SC2 (OP Header)
        const sc2 = await db.query(
            "SELECT c2_num, c2_pedido, c2_item, c2_filial FROM sc2010 WHERE TRIM(c2_num) = $1 AND COALESCE(d_e_l_e_t_,'') IN ('',' ')",
            [op.trim()]
        );
        console.log('Protheus SC2:', JSON.stringify(sc2.rows, null, 2));

        if (sc2.rows.length > 0) {
            const pedido = sc2.rows[0].c2_pedido;
            console.log(`Checking Protheus for Pedido: [${pedido}]`);

            // 3. Check Protheus SC5 (Sales Order)
            const sc5 = await db.query(
                "SELECT c5_num, c5_cliente FROM sc5010 WHERE TRIM(c5_num) = $1 AND COALESCE(d_e_l_e_t_,'') IN ('',' ')",
                [pedido.trim()]
            );
            console.log('Protheus SC5:', JSON.stringify(sc5.rows, null, 2));

            if (sc5.rows.length > 0) {
                const cliente = sc5.rows[0].c5_cliente;
                console.log(`Checking Protheus for Cliente: [${cliente}]`);

                // 4. Check Protheus SA1 (Clients)
                const sa1 = await db.query(
                    "SELECT a1_cod, a1_nome FROM sa1010 WHERE TRIM(a1_cod) = $1 AND COALESCE(d_e_l_e_t_,'') IN ('',' ')",
                    [cliente.trim()]
                );
                console.log('Protheus SA1:', JSON.stringify(sa1.rows, null, 2));
            }
        }
    }
}

debugData().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
