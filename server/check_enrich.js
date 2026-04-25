require('dotenv').config();
const db = require('./db');
async function checkEnrich() {
    const pedidos = ['001421', '001422', '001423'];
    const codes = ['P001', 'P002'];
    const clis = ['C001'];
    
    let t0 = Date.now();
    await db.query(`
        SELECT * FROM public.sd2010 d2
        JOIN public.sf2010 f2 ON f2.f2_doc = d2.d2_doc AND f2.f2_serie = d2.d2_serie AND COALESCE(f2.d_e_l_e_t_, '') = ''
        WHERE d2.d2_pedido = ANY($1) AND COALESCE(d2.d_e_l_e_t_, '') = ''
    `, [pedidos]);
    console.log('sd2010 took:', Date.now() - t0, 'ms');

    let t1 = Date.now();
    await db.query(`
        SELECT * FROM public.sz1010 z1
        WHERE z1.z1_cliente = ANY($1) AND TRIM(z1.z1_produto) = ANY($2) AND COALESCE(z1.d_e_l_e_t_, '') = ''
    `, [clis, codes]);
    console.log('sz1010 took:', Date.now() - t1, 'ms');
    
    process.exit();
}
checkEnrich();
