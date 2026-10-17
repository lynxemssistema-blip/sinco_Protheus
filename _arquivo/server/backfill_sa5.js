require('dotenv').config();
const mysql = require('mysql2/promise');
const { Client } = require('pg');

async function run() {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_DB
    });
    
    const pgClient = new Client({ connectionString: process.env.PROTHEUS_DB_URL });
    await pgClient.connect();

    try {
        await pool.query('ALTER TABLE nfe_recebimento_itens ADD COLUMN cProd_metalfisa VARCHAR(50) DEFAULT NULL AFTER cProd');
        console.log('Column cProd_metalfisa added.');
    } catch(e) {
        if(e.code !== 'ER_DUP_FIELDNAME') throw e;
        console.log('Column already exists.');
    }

    const [itens] = await pool.query('SELECT i.id, i.cProd, n.emitente_cnpj FROM nfe_recebimento_itens i JOIN nfe_recebimentos n ON i.id_nfe = n.id WHERE i.cProd_metalfisa IS NULL');
    console.log(`Found ${itens.length} items to check.`);
    
    for (const item of itens) {
        const cleanCnpj = item.emitente_cnpj.replace(/\D/g, '');
        const resFornecedor = await pgClient.query("SELECT a2_cod FROM public.sa2010 WHERE a2_cgc = $1 AND d_e_l_e_t_ = ' ' LIMIT 1", [cleanCnpj]);
        
        if (resFornecedor.rows.length > 0) {
            const a2_cod = resFornecedor.rows[0].a2_cod;
            const resAssoc = await pgClient.query("SELECT trim(a5_produto) as a5_produto FROM public.sa5010 WHERE a5_fornece = $1 AND trim(a5_codprf) = $2 AND d_e_l_e_t_ = ' ' LIMIT 1", [a2_cod, String(item.cProd).trim()]);
            
            if (resAssoc.rows.length > 0) {
                const cProdMetal = resAssoc.rows[0].a5_produto;
                await pool.query('UPDATE nfe_recebimento_itens SET cProd_metalfisa = ? WHERE id = ?', [cProdMetal, item.id]);
                console.log('Updated item ' + item.id + ' with ' + cProdMetal);
            }
        }
    }
    
    console.log('Done.');
    await pool.end();
    await pgClient.end();
}

run().catch(console.error);
