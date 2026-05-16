const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../db');

async function analyze() {
    // 1. Como o pedido está armazenado no Protheus?
    const r1 = await db.query(`
        SELECT c5_num, TRIM(c5_num) AS trimmed, LENGTH(TRIM(c5_num)) AS len,
               c5_tipo, COALESCE(c5_nota,'') AS nota, COALESCE(d_e_l_e_t_,'') AS del
        FROM sc5010
        WHERE c5_num LIKE '%4090%'
        LIMIT 5
    `);
    console.log('=== SC5 (cabeçalho) ===');
    r1.rows.forEach(r => console.log(JSON.stringify(r)));

    // 2. Itens do pedido com saldos
    const r2 = await db.query(`
        SELECT TRIM(c6_num) AS num, c6_item, TRIM(c6_produto) AS prod,
               c6_qtdven::numeric AS qtd_ven, c6_qtdent::numeric AS qtd_ent,
               (c6_qtdven::numeric - c6_qtdent::numeric) AS saldo,
               c6_qtdlib::numeric AS lib, COALESCE(d_e_l_e_t_,'') AS del
        FROM sc6010
        WHERE c6_num LIKE '%4090%'
        LIMIT 10
    `);
    console.log('\n=== SC6 (itens) ===');
    r2.rows.forEach(r => console.log(JSON.stringify(r)));

    // 3. Testar a query exata do pcpMaterials com pedido '4090'
    const r3 = await db.query(`
        SELECT COUNT(*) AS total_sem_filtro_ativo
        FROM sc6010 c6
        JOIN sc5010 c5 ON c5.c5_num = c6.c6_num AND c5.c5_filial = c6.c6_filial
            AND COALESCE(c5.d_e_l_e_t_,'') = '' AND c5.c5_tipo <> 'B'
        WHERE TRIM(c5.c5_num) = '4090'
          AND COALESCE(c6.d_e_l_e_t_,'') = ''
    `);
    console.log('\n=== COUNT sem filtro ativo, pedido=4090 ===');
    console.log(JSON.stringify(r3.rows[0]));

    const r4 = await db.query(`
        SELECT COUNT(*) AS total_sem_filtro_ativo
        FROM sc6010 c6
        JOIN sc5010 c5 ON c5.c5_num = c6.c6_num AND c5.c5_filial = c6.c6_filial
            AND COALESCE(c5.d_e_l_e_t_,'') = '' AND c5.c5_tipo <> 'B'
        WHERE TRIM(c5.c5_num) = '004090'
          AND COALESCE(c6.d_e_l_e_t_,'') = ''
    `);
    console.log('\n=== COUNT sem filtro ativo, pedido=004090 ===');
    console.log(JSON.stringify(r4.rows[0]));

    // 4. Com filtro ativo (pendentes)
    const r5 = await db.query(`
        SELECT COUNT(*) AS total_com_filtro_pendente
        FROM sc6010 c6
        JOIN sc5010 c5 ON c5.c5_num = c6.c6_num AND c5.c5_filial = c6.c6_filial
            AND COALESCE(c5.d_e_l_e_t_,'') = '' AND c5.c5_tipo <> 'B'
        WHERE TRIM(c5.c5_num) = '004090'
          AND COALESCE(c6.d_e_l_e_t_,'') = ''
          AND ((c6.c6_qtdven - c6.c6_qtdent) > 0 OR c6.c6_qtdlib > 0)
    `);
    console.log('\n=== COUNT com filtro pendente, pedido=004090 ===');
    console.log(JSON.stringify(r5.rows[0]));

    process.exit(0);
}

analyze().catch(e => { console.error(e.message); process.exit(1); });
