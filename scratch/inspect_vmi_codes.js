const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const mysql = require('../server/services/mysqlService');
const pg = require('../server/db');

async function main() {
    console.log('--- INSPECTING VMI CODES ---');
    try {
        // 1. MySQL: app_demanda_vmi_map
        const [mysqlMap] = await mysql.query(
            'SELECT * FROM app_demanda_vmi_map WHERE codigo_produto_cliente = ?',
            ['33.03.10235.01']
        );
        console.log('\nMySQL app_demanda_vmi_map for "33.03.10235.01":', mysqlMap);

        // 2. MySQL: app_demanda_vmi
        const [mysqlDemanda] = await mysql.query(
            'SELECT DISTINCT codigo_produto_cliente, descricao_produto_cliente, lote_importacao FROM app_demanda_vmi WHERE codigo_produto_cliente = ?',
            ['33.03.10235.01']
        );
        console.log('\nMySQL app_demanda_vmi for "33.03.10235.01":', mysqlDemanda);

        // 3. PostgreSQL: SB1010 for product MT6-6240
        const pgSb1 = await pg.query(
            `SELECT TRIM(b1_cod) as b1_cod, TRIM(b1_desc) as b1_desc, b1_msblql 
             FROM public.sb1010 
             WHERE TRIM(b1_cod) = $1 OR TRIM(b1_cod) LIKE $2`,
            ['MT6-6240', '%MT6-6240%']
        );
        console.log('\nPostgreSQL SB1010 for "MT6-6240":', pgSb1.rows);

        // 4. PostgreSQL: SZ1010 for mapping
        const pgSz1 = await pg.query(
            `SELECT TRIM(z1_codcli) as z1_codcli, TRIM(z1_produto) as z1_produto, TRIM(z1_revisao) as z1_revisao
             FROM public.sz1010
             WHERE TRIM(z1_produto) = $1 OR TRIM(z1_codcli) = $2`,
            ['MT6-6240', '33.03.10235.01']
        );
        console.log('\nPostgreSQL SZ1010 mapping:', pgSz1.rows);

    } catch (err) {
        console.error('Error during query:', err);
    } finally {
        process.exit(0);
    }
}

main();
