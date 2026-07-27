// Script de diagnóstico para a rota /montagem/op/:numero/componentes
const path = require('path');

// Carrega as vars de ambiente
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });

const { Pool } = require('pg');

const db = new Pool({
    host:     process.env.PG_HOST     || process.env.DB_HOST,
    port:     process.env.PG_PORT     || process.env.DB_PORT     || 5432,
    database: process.env.PG_DATABASE || process.env.DB_NAME,
    user:     process.env.PG_USER     || process.env.DB_USER,
    password: process.env.PG_PASSWORD || process.env.DB_PASSWORD,
    ssl:      process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
});

async function test() {
    const num = '006450';
    console.log('Testando OP:', num);

    try {
        // Step 1: busca o produto da OP
        const opRes = await db.query(
            `SELECT TRIM(c2_produto) AS produto FROM public.sc2010
             WHERE TRIM(c2_num) = $1 AND COALESCE(d_e_l_e_t_, '') = ''
             LIMIT 1`,
            [num]
        );
        console.log('OP rows:', opRes.rows);

        if (opRes.rows.length === 0) {
            console.log('OP não encontrada!');
            return;
        }

        const produto = opRes.rows[0].produto;
        console.log('Produto:', produto);

        // Step 2: busca BOM
        const { rows } = await db.query(
            `SELECT
                TRIM(g1.g1_comp)    AS codigo,
                TRIM(b1.b1_desc)    AS descricao,
                CAST(REPLACE(CAST(g1.g1_quant AS TEXT), ',', '.') AS NUMERIC) AS quantidade,
                TRIM(g1.g1_um)      AS unidade
             FROM public.sg1010 g1
             LEFT JOIN public.sb1010 b1
                 ON TRIM(b1.b1_cod) = TRIM(g1.g1_comp)
                 AND COALESCE(b1.d_e_l_e_t_, '') = ''
             WHERE TRIM(g1.g1_cod) = $1
               AND COALESCE(g1.d_e_l_e_t_, '') = ''
             ORDER BY g1.g1_comp`,
            [produto]
        );
        console.log('Componentes encontrados:', rows.length);
        console.log('Primeiros 3:', JSON.stringify(rows.slice(0, 3), null, 2));

    } catch(e) {
        console.error('ERRO:', e.message);
        console.error('Stack:', e.stack);
    } finally {
        await db.end();
    }
}

test();
