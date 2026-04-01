const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });
const db = require('./server/db');

async function checkProtheus() {
    console.log('--- CHECKING PROTHEUS DATA (with env) ---');
    console.log('PGHOST:', process.env.PGHOST);
    
    // Testing specific OPs from the screenshot
    const opNums = ['005113'];
    
    console.log(`Searching for OPs: ${opNums.join(', ')}`);
    
    const query = `
        SELECT TRIM(c2.c2_num) as op_numero,
               TRIM(c2.c2_item) as item_op,
               TRIM(c2.c2_pedido) as pedido_venda,
               TRIM(c5.c5_num) as sc5_num,
               TRIM(sa1.a1_nome) as nome_cliente
        FROM sc2010 c2
        LEFT JOIN sc5010 c5 ON TRIM(c5.c5_num) = TRIM(c2.c2_pedido)
            AND COALESCE(c5.d_e_l_e_t_,'') IN ('',' ')
            AND c5.c5_filial = c2.c2_filial
        LEFT JOIN sa1010 sa1 ON TRIM(sa1.a1_cod) = TRIM(c5.c5_cliente)
            AND COALESCE(sa1.d_e_l_e_t_,'') IN ('',' ')
            AND sa1.a1_loja = c5.c5_lojacli
        WHERE COALESCE(c2.d_e_l_e_t_,'') IN ('',' ')
        AND (TRIM(c2.c2_num) = ANY($1) OR c2.c2_num LIKE '%5113%')
    `;
    
    try {
        const res = await db.query(query, [opNums]);
        console.log('Results:', JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error('Database Error:', err);
    }
}

checkProtheus().then(() => process.exit(0));
