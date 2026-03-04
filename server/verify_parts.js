require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

async function verifyParts() {
    const parts = ['MT3-14206', 'MT3-13160', 'MT3-13193', 'MT3-13216'];

    try {
        console.log('--- Verifying Operations for Sample Parts ---');

        // Check for the specific process description provided by user
        const processQuery = `
            SELECT DISTINCT g2_operac, g2_descri 
            FROM sg2010 
            WHERE g2_descri LIKE '%SOLDA MIG/TIG%'
        `;
        const processRes = await pool.query(processQuery);
        console.log('--- Process Codes for SOLDA MIG/TIG ---');
        console.table(processRes.rows);

        // Check specifically for MT3-14206
        const partQuery = `
            SELECT 
                c2.c2_num,
                c2.c2_produto,
                g2.g2_operac,
                g2.g2_descri
            FROM 
                sc2010 c2
            LEFT JOIN 
                sg2010 g2 ON c2.c2_produto = g2.g2_produto
            WHERE 
                TRIM(c2.c2_produto) = 'MT3-13160'
                AND c2.d_e_l_e_t_ = ''
        `;

        const partRes = await pool.query(partQuery);
        console.log('--- Operations for MT3-13160 ---');
        console.table(partRes.rows);
    } catch (err) {
        console.error('Error executing query', err);
    } finally {
        pool.end();
    }
}

verifyParts();
